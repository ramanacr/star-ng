import { StarDocumentInfo, StarDocumentRenderer } from '@star-ng/ui/document-viewer';

/**
 * Renderers of the document viewer examples. The library ships no PDF engine, so the docs draw
 * their own pages: a generated report (with text, so search works) and a list of images.
 */

const A4 = { width: 595, height: 842 };
const A4_LANDSCAPE = { width: 842, height: 595 };
const REGIONS = ['North', 'South', 'East', 'West'] as const;

/** Text lines of a page of the sample report. */
function reportLines(index: number, count: number): string[] {
  if (index === 0) {
    return [
      'Quarterly report',
      'Office supplies, third quarter',
      'Summary: revenue grew in every region. Paper and toner sold best.',
      `This report has ${count} pages.`,
    ];
  }
  if (index === count - 1) {
    return [
      'Appendix',
      'Method: the totals include returns and exclude tax.',
      'Contact the finance team for the raw data.',
    ];
  }
  const region = REGIONS[(index - 1) % REGIONS.length];
  return [
    `${region} region`,
    `Revenue: ${(120 + index * 17).toLocaleString('en')} thousand`,
    `Orders: ${(900 + index * 53).toLocaleString('en')}`,
    index % 3 === 0 ? 'Note: toner stock was low in week 9.' : 'No stock issues.',
  ];
}

/** A generated report of `source` pages (a number; default 12). Page 4 is landscape. */
export class SampleReportRenderer implements StarDocumentRenderer {
  private count = 0;

  async load(source: unknown): Promise<StarDocumentInfo> {
    if (source === 'missing.pdf') throw new Error('The file missing.pdf was not found.');
    this.count = typeof source === 'number' ? source : 12;
    return {
      pageCount: this.count,
      pageSize: (index) => (index === 3 ? A4_LANDSCAPE : A4),
    };
  }

  async renderPage(index: number, canvas: HTMLCanvasElement, scale: number): Promise<void> {
    const context = canvas.getContext('2d');
    if (!context) return;
    const size = index === 3 ? A4_LANDSCAPE : A4;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    // Paper is white in both themes, as a printed page.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.fillStyle = '#1e3a5f';
    context.fillRect(0, 0, size.width, 56);
    context.fillStyle = '#ffffff';
    context.font = '600 18px sans-serif';
    context.fillText('Office supplies', 40, 35);
    const lines = reportLines(index, this.count);
    context.fillStyle = '#0f172a';
    context.font = '700 24px sans-serif';
    context.fillText(lines[0], 40, 110);
    context.font = '400 14px sans-serif';
    lines.slice(1).forEach((line, i) => context.fillText(line, 40, 150 + i * 26));
    // A small bar chart per page.
    const base = size.height - 160;
    for (let i = 0; i < 6; i++) {
      const height = 30 + ((index * 37 + i * 53) % 90);
      context.fillStyle = i % 2 ? '#4f8a5b' : '#3b6ea5';
      context.fillRect(40 + i * 60, base - height, 40, height);
    }
    context.fillStyle = '#64748b';
    context.font = '400 12px sans-serif';
    context.fillText(`Page ${index + 1} of ${this.count}`, 40, size.height - 40);
  }

  async textContent(index: number): Promise<string> {
    return reportLines(index, this.count).join('\n');
  }

  dispose(): void {
    this.count = 0;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`The image ${url.slice(0, 40)} did not load.`));
    image.src = url;
  });
}

/** Shows a list of image URLs as pages (scans, slides). It has no text, so there is no search. */
export class ImagePagesRenderer implements StarDocumentRenderer {
  private images: HTMLImageElement[] = [];

  async load(source: unknown): Promise<StarDocumentInfo> {
    const urls = Array.isArray(source) ? (source as string[]) : [];
    this.images = await Promise.all(urls.map(loadImage));
    return {
      pageCount: this.images.length,
      pageSize: (index) => ({
        width: this.images[index].naturalWidth || 640,
        height: this.images[index].naturalHeight || 360,
      }),
    };
  }

  async renderPage(index: number, canvas: HTMLCanvasElement): Promise<void> {
    const image = this.images[index];
    const context = canvas.getContext('2d');
    if (!image || !context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  dispose(): void {
    this.images = [];
  }
}
