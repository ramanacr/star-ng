/**
 * Inline SVG pictures for the docs examples: a colored rectangle with a label. The pictures are
 * data URLs made in the page, so the docs need no image files and no network.
 */
export function sampleImage(label: string, color: string, width = 640, height = 360): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${color}"/>` +
    `<text x="50%" y="50%" fill="#ffffff" font-family="sans-serif" font-size="${Math.round(height / 8)}" text-anchor="middle" dominant-baseline="middle">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const COLORS = ['#3b6ea5', '#4f8a5b', '#a8663a', '#7a5c99', '#2f8a8a', '#8a6f2f'] as const;

/** `count` pictures named "Warehouse 1", "Warehouse 2", ... in different colors. */
export function sampleSet(
  prefix: string,
  count: number,
  width = 640,
  height = 360,
): { readonly label: string; readonly src: string }[] {
  return Array.from({ length: count }, (_, index) => {
    const label = `${prefix} ${index + 1}`;
    return { label, src: sampleImage(label, COLORS[index % COLORS.length], width, height) };
  });
}
