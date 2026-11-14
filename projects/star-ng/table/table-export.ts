/**
 * File builders for `star-table` export. No third-party library: an `.xlsx` file is a ZIP of
 * small XML parts, written here without compression.
 */

/** One exported cell: text, or a number that a spreadsheet can sum. */
export type StarExportCell = string | number;

const encoder = new TextEncoder();

function escapeXml(text: string): string {
  return (
    text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      // Characters that XML 1.0 does not allow.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  );
}

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP archive with stored (not compressed) entries. */
function zip(files: readonly { readonly name: string; readonly text: string }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((size, part) => size + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

/** Column letters of a 0-based column index: 0 → A, 26 → AA. */
function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/**
 * Excel workbook (`.xlsx`) with one sheet: a bold header row, then the rows. Text cells are
 * inline strings, which a spreadsheet never reads as a formula; numbers stay numbers.
 */
export function buildXlsx(
  headers: readonly string[],
  rows: readonly (readonly StarExportCell[])[],
  sheetName = 'Sheet1',
): Uint8Array {
  const cell = (value: StarExportCell, column: number, row: number, style = '') => {
    const ref = `${columnName(column)}${row}`;
    return typeof value === 'number' && Number.isFinite(value)
      ? `<c r="${ref}"${style}><v>${value}</v></c>`
      : `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
  };
  const sheetRows = [
    `<row r="1">${headers.map((header, i) => cell(header, i, 1, ' s="1"')).join('')}</row>`,
    ...rows.map(
      (row, r) =>
        `<row r="${r + 2}">${row.map((value, i) => cell(value, i, r + 2)).join('')}</row>`,
    ),
  ];
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const pkg = 'http://schemas.openxmlformats.org/package/2006';
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
  // Sheet names: 31 characters at most, none of \ / ? * [ ] :
  const safeName = escapeXml(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1');
  return zip([
    {
      name: '[Content_Types].xml',
      text: `${head}<Types xmlns="${pkg}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${type}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${type}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${type}.styles+xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      text: `${head}<Relationships xmlns="${pkg}/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      text: `${head}<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `${head}<Relationships xmlns="${pkg}/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      text: `${head}<styleSheet xmlns="${main}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      text: `${head}<worksheet xmlns="${main}"><sheetData>${sheetRows.join('')}</sheetData></worksheet>`,
    },
  ]);
}

/** HTML document with one table, for the browser print dialog ("Save as PDF"). */
export function buildPrintDocument(
  title: string,
  headers: readonly string[],
  rows: readonly (readonly StarExportCell[])[],
): string {
  const escape = (value: StarExportCell) => escapeXml(String(value));
  const numeric = (value: StarExportCell) => (typeof value === 'number' ? ' class="n"' : '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>
body{font:12px/1.4 system-ui,sans-serif;color:#000;margin:16px}
h1{font-size:16px;margin:0 0 12px}
table{width:100%;border-collapse:collapse}
th,td{padding:4px 8px;border:1px solid #999;text-align:left;vertical-align:top}
th{background:#eee}
.n{text-align:right}
thead{display:table-header-group}
tr{break-inside:avoid}
</style></head><body><h1>${escape(title)}</h1><table><thead><tr>${headers
    .map((header) => `<th scope="col">${escape(header)}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${row.map((value) => `<td${numeric(value)}>${escape(value)}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody></table></body></html>`;
}
