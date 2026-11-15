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

/** A word longer than this has no room in a print column: it gets soft break points. */
const LONG_WORD = 20;
/** Characters between two soft break points of a long word. */
const WORD_CHUNK = 12;

/**
 * Escaped text for the print document. A word without spaces that is longer than `LONG_WORD`
 * (a web address, a code, a signature) gets `<wbr>` soft break points. The print engine then
 * wraps it inside its cell. Without them such a word sets the minimum width of its column, the
 * table gets wider than the paper, and the engine shrinks the whole page (all text smaller) to
 * make it fit. The CSS `overflow-wrap:anywhere` is no replacement: it lets every column shrink
 * to one character, and the table then splits the width by the longest cell text.
 */
function printable(value: StarExportCell): string {
  return String(value)
    .split(/(\s+)/)
    .map((word) => {
      const letters = Array.from(word);
      if (letters.length <= LONG_WORD) return escapeXml(word);
      const chunks: string[] = [];
      for (let start = 0; start < letters.length; start += WORD_CHUNK) {
        chunks.push(escapeXml(letters.slice(start, start + WORD_CHUNK).join('')));
      }
      return chunks.join('<wbr>');
    })
    .join('');
}

/** One step of the fit ladder: how a print table gives way when it is wider than the paper. */
export interface StarPrintFitStep {
  /** Text size in CSS pixels. The normal size is 12 px (9 pt). */
  readonly size: number;
  /** A cell of one short word may wrap too (at a hyphen). */
  readonly wrap: boolean;
  /** A word may break at any character. Last resort: it sets no minimum width on a column. */
  readonly anywhere: boolean;
}

/** The text size of the print document, in CSS pixels (9 pt). */
const PRINT_SIZE = 12;

/**
 * What a table gives way to, in this order, until its minimum width fits the paper: first the
 * cells of one short word may wrap (the text keeps its size), then the text gets smaller
 * (11, 10, 9 and 8 px; 8 px is 6 pt, the floor), and last a word may break at any character.
 * Step 0 is the table as it is built: no rule changes, short words never wrap.
 */
export const PRINT_FIT_STEPS: readonly StarPrintFitStep[] = [
  { size: PRINT_SIZE, wrap: false, anywhere: false },
  { size: PRINT_SIZE, wrap: true, anywhere: false },
  { size: 11, wrap: true, anywhere: false },
  { size: 10, wrap: true, anywhere: false },
  { size: 9, wrap: true, anywhere: false },
  { size: 8, wrap: true, anywhere: false },
  { size: 8, wrap: true, anywhere: true },
];

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Style rules of one fit step. `scope` is the selector of the table (`table` in this file).
 * `columns` (minimum widths of the columns) is for the step that breaks words: it gives each
 * column a share of the width in proportion to its longest word.
 */
function fitRules(step: StarPrintFitStep, scope: string, columns: readonly number[] = []): string {
  const scale = step.size / PRINT_SIZE;
  const total = columns.reduce((sum, width) => sum + width, 0);
  return (
    `${scope}{font-size:${step.size}px${step.anywhere && total ? ';table-layout:fixed' : ''}}` +
    // Padding follows the text size: at 6 pt, 4 px of padding would take a third of a column.
    `${scope} th,${scope} td{padding:${round(4 * scale)}px ${round(8 * scale)}px${
      step.anywhere ? ';overflow-wrap:anywhere' : ''
    }}` +
    (step.wrap ? `${scope} td.s{white-space:normal}` : '') +
    // Without this, a word-breaking table gives its width to the columns with the longest text
    // and leaves one character for the others. The shares add up to 100% at most, and the
    // padding is inside them, so the table does not grow beyond the page.
    (step.anywhere && total
      ? `${scope} th{box-sizing:border-box}` +
        columns
          .map(
            (width, index) =>
              `${scope} th:nth-child(${index + 1}){width:${Math.floor((width / total) * 10000) / 100}%}`,
          )
          .join('')
      : '')
  );
}

/**
 * Style sheet that makes the print table fit any paper. `widths[i]` is the minimum width in
 * pixels of the table at step `i` of `PRINT_FIT_STEPS`; `columns` are the minimum widths of its
 * columns at the last step that keeps words whole. Step `i` applies when the content width of
 * the page is less than the minimum width of every step before it. The query is a container
 * query on the wrapper of the table, so it is answered with the real width of the page, which
 * the print dialog (paper, margins, scale) decides after the document is built. A step that is
 * not narrower than a step before it is left out.
 */
export function printFitStyle(widths: readonly number[], columns: readonly number[] = []): string {
  let narrowest = widths[0] ?? 0;
  let css = '';
  for (let index = 1; index < widths.length && index < PRINT_FIT_STEPS.length; index++) {
    if (widths[index] >= narrowest) continue;
    css += `@container (width < ${narrowest}px){${fitRules(PRINT_FIT_STEPS[index], 'table', columns)}}`;
    narrowest = widths[index];
  }
  return css;
}

/** Widths measured by `fitPrintDocument`. */
export interface StarPrintFitMeasure {
  /** Minimum width of the table at each step of `PRINT_FIT_STEPS`. */
  readonly widths: readonly number[];
  /** Minimum width of each column at the last step that keeps words whole. */
  readonly columns: readonly number[];
}

/**
 * Measures the minimum width of the print table at each fit step, in the layout of `doc`, and
 * adds the style sheet of `printFitStyle` to it. Call it when the frame has loaded, before the
 * print dialog opens. The widths are read in the real fonts of the document, so the text of any
 * font, wide or narrow, gets the steps it needs.
 */
export function fitPrintDocument(doc: Document): StarPrintFitMeasure {
  const table = doc.querySelector('table');
  if (!table) return { widths: [], columns: [] };
  // The probe sets the table to 1 px wide, and a table is never narrower than its minimum
  // width: the width that is read is the minimum width, whatever the size of the frame is.
  const probe = doc.createElement('style');
  doc.head.append(probe);
  const lastWhole = PRINT_FIT_STEPS.findIndex((step) => step.anywhere) - 1;
  let columns: number[] = [];
  const widths = PRINT_FIT_STEPS.map((step, index) => {
    probe.textContent = `table{width:1px}${fitRules(step, 'table')}`;
    if (index === lastWhole) {
      columns = Array.from(table.querySelectorAll('thead th'), (cell) =>
        Math.ceil(cell.getBoundingClientRect().width),
      );
    }
    return Math.ceil(table.getBoundingClientRect().width);
  });
  probe.remove();
  const css = printFitStyle(widths, columns);
  if (css) {
    const style = doc.createElement('style');
    style.textContent = css;
    doc.head.append(style);
  }
  return { widths, columns };
}

/**
 * HTML document with one table, for the browser print dialog ("Save as PDF"). The table is
 * built to print at the normal size. When the paper is too narrow for it, call
 * `fitPrintDocument` on the loaded document: the table then wraps, shrinks or breaks words
 * (see `PRINT_FIT_STEPS`) so that no column is cut off.
 */
export function buildPrintDocument(
  title: string,
  headers: readonly string[],
  rows: readonly (readonly StarExportCell[])[],
): string {
  const escape = (value: StarExportCell) => escapeXml(String(value));
  // A cell of one short word (a code, a number, a date, an address) is never wrapped: a break
  // inside "INV-0001" or "2026-01-05" would only make it hard to read.
  const cellClass = (value: StarExportCell) => {
    const text = String(value);
    const classes = [
      typeof value === 'number' ? 'n' : '',
      // A number has no break point: it needs no rule.
      typeof value !== 'number' && text.length <= LONG_WORD && !/\s/.test(text) ? 's' : '',
    ].filter(Boolean);
    return classes.length ? ` class="${classes.join(' ')}"` : '';
  };
  // A column of numbers has its header on the right too, above the right-aligned numbers.
  const numberColumn = (index: number) =>
    rows.length > 0 && rows.every((row) => typeof row[index] === 'number');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>
body{font:12px/1.4 system-ui,sans-serif;color:#000;margin:16px}
h1{font-size:16px;margin:0 0 12px;overflow-wrap:anywhere}
.fit{container-type:inline-size}
table{width:100%;border-collapse:collapse}
th,td{padding:4px 8px;border:1px solid #999;text-align:left;vertical-align:top;overflow-wrap:break-word}
th{background:#eee}
th.n,td.n{text-align:right}
td.s{white-space:nowrap}
thead{display:table-header-group}
tr{break-inside:avoid}
</style></head><body><h1>${escape(title)}</h1><div class="fit"><table><thead><tr>${headers
    .map(
      (header, index) =>
        `<th scope="col"${numberColumn(index) ? ' class="n"' : ''}>${printable(header)}</th>`,
    )
    .join('')}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${row.map((value) => `<td${cellClass(value)}>${printable(value)}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody></table></div></body></html>`;
}
