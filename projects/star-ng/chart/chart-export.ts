/**
 * Export of the chart plot as a stand-alone SVG document or a PNG image (browser only). The
 * chart draws with CSS classes and design tokens, which do not exist outside the page, so the
 * export copies the computed paint of every element into the copy.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Presentation properties copied from the computed style into the exported copy. */
const PAINT = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'paint-order',
] as const;

export interface StarChartExportOptions {
  /** Text of the `<title>` of the document. */
  readonly title: string;
  /** Background color; the default is the computed background of the chart surface. */
  readonly background?: string;
  /**
   * Changes the copy before it is written, after the paint is copied: for example a new
   * `viewBox`. The width and height of the document come from the `viewBox` of the copy.
   */
  readonly prepare?: (copy: SVGSVGElement) => void;
}

/** Width and height of the view box of `svg` (read from the attribute). */
export function starChartViewBox(svg: SVGSVGElement): { width: number; height: number } | null {
  const [, , width, height] = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** A self-contained SVG document of `svg`: inline paint, no hover targets, a title. */
export function starChartSvgDocument(svg: SVGSVGElement, options: StarChartExportOptions): string {
  const doc = svg.ownerDocument;
  const view = doc.defaultView;
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  originals.forEach((original, i) => {
    const target = copies[i] as SVGElement;
    if (!target || !view) return;
    if (original.classList.contains('star-chart__hit')) {
      target.setAttribute('data-export', 'skip');
      return;
    }
    const computed = view.getComputedStyle(original);
    const style: string[] = [];
    for (const name of PAINT) {
      const value = computed.getPropertyValue(name);
      if (value) style.push(`${name}:${value}`);
    }
    // Keep the inline paint that the chart sets (series colors), resolved where possible.
    const own = (original as SVGElement).style;
    for (const name of ['fill', 'stroke'] as const) {
      const inline = own?.getPropertyValue(name);
      if (inline && !computed.getPropertyValue(name)) style.push(`${name}:${inline}`);
    }
    target.removeAttribute('class');
    if (style.length) target.setAttribute('style', style.join(';'));
  });
  for (const hit of copy.querySelectorAll('[data-export="skip"]')) hit.remove();
  options.prepare?.(copy);
  copy.setAttribute('xmlns', SVG_NS);
  const box = starChartViewBox(copy);
  if (box) {
    copy.setAttribute('width', String(box.width));
    copy.setAttribute('height', String(box.height));
  }
  const title = doc.createElementNS(SVG_NS, 'title');
  title.textContent = options.title;
  copy.insertBefore(title, copy.firstChild);
  const background = options.background;
  if (background) {
    const fill = doc.createElementNS(SVG_NS, 'rect');
    fill.setAttribute('width', '100%');
    fill.setAttribute('height', '100%');
    fill.setAttribute('fill', background);
    copy.insertBefore(fill, title.nextSibling);
  }
  return new XMLSerializer().serializeToString(copy);
}

/** Loads an image from a URL. */
function loadImage(doc: Document, url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new (doc.defaultView?.Image ?? Image)();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The chart image did not load.'));
    image.src = url;
  });
}

/**
 * A PNG image of an SVG document, `scale` times the size of the view box. `null` when the
 * browser has no canvas.
 */
export async function starChartPng(
  doc: Document,
  svgDocument: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob | null> {
  const canvas = doc.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) return null;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDocument)}`;
  const image = await loadImage(doc, url);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
