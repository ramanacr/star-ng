import {
  starImageAdjustmentsOf,
  starImageAdjustPixels,
  StarImageAnnotation,
  starImageFilter,
  starImageIsNeutral,
  StarImageOperation,
  starImageRotatedSize,
  StarImageSize,
} from './image-editor-model';

/**
 * Replays an operation list on a canvas (browser only). Each geometric step draws on a new
 * canvas, so the source image is never changed.
 */

/** Options of `starImageRender`. */
export interface StarImageRenderOptions {
  /** Fill behind the image (for a JPEG, which has no transparency). */
  readonly background?: string | null;
  /** Use the pixel fallback for the colour adjustments even when `ctx.filter` exists. */
  readonly pixelFilter?: boolean;
}

/** True when the 2D context draws with `filter` (Safari before 18 has no `ctx.filter`). */
export function starImageSupportsFilter(context: CanvasRenderingContext2D): boolean {
  return typeof (context as { filter?: unknown }).filter === 'string';
}

function blank(
  doc: Document,
  size: StarImageSize,
): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
} {
  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size.width));
  canvas.height = Math.max(1, Math.round(size.height));
  return { canvas, context: canvas.getContext('2d') };
}

/** Draws one annotation on a context, in the coordinates of that context. */
export function starImageDrawAnnotation(
  context: CanvasRenderingContext2D,
  annotation: StarImageAnnotation,
): void {
  const [start, end = start] = annotation.points;
  if (!start) return;
  context.save();
  context.strokeStyle = annotation.color;
  context.fillStyle = annotation.color;
  context.lineWidth = annotation.strokeWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  switch (annotation.kind) {
    case 'pen':
      context.moveTo(start.x, start.y);
      for (const point of annotation.points.slice(1)) context.lineTo(point.x, point.y);
      if (annotation.points.length === 1) context.lineTo(start.x + 0.01, start.y);
      context.stroke();
      break;
    case 'rectangle':
      context.rect(
        Math.min(start.x, end.x),
        Math.min(start.y, end.y),
        Math.abs(end.x - start.x),
        Math.abs(end.y - start.y),
      );
      context.stroke();
      break;
    case 'ellipse':
      context.ellipse(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2,
        Math.abs(end.x - start.x) / 2,
        Math.abs(end.y - start.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
      break;
    case 'arrow': {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const head = Math.max(10, annotation.strokeWidth * 4);
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.moveTo(end.x, end.y);
      context.lineTo(
        end.x - head * Math.cos(angle - Math.PI / 6),
        end.y - head * Math.sin(angle - Math.PI / 6),
      );
      context.moveTo(end.x, end.y);
      context.lineTo(
        end.x - head * Math.cos(angle + Math.PI / 6),
        end.y - head * Math.sin(angle + Math.PI / 6),
      );
      context.stroke();
      break;
    }
    case 'text':
      context.font = `${annotation.fontSize ?? 16}px system-ui, sans-serif`;
      context.textBaseline = 'top';
      context.fillText(annotation.text ?? '', start.x, start.y);
      break;
  }
  context.restore();
}

/** Draws the source with the adjustments of the list on a new canvas. */
function base(
  doc: Document,
  source: CanvasImageSource,
  size: StarImageSize,
  ops: readonly StarImageOperation[],
  options: StarImageRenderOptions,
): HTMLCanvasElement | null {
  const { canvas, context } = blank(doc, size);
  if (!context) return null;
  const adjustments = starImageAdjustmentsOf(ops);
  const neutral = starImageIsNeutral(adjustments);
  const useFilter = !neutral && !options.pixelFilter && starImageSupportsFilter(context);
  if (useFilter) context.filter = starImageFilter(adjustments);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (useFilter) context.filter = 'none';
  if (!neutral && !useFilter) {
    // The pixel fallback: read, adjust, write back. A tainted canvas cannot be read; the editor
    // only draws safe sources, but a browser may still refuse.
    try {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      starImageAdjustPixels(pixels.data, adjustments);
      context.putImageData(pixels, 0, 0);
    } catch {
      // Keep the unadjusted image.
    }
  }
  return canvas;
}

/**
 * The source image after every operation, on a new canvas of the output size. `null` without
 * a 2D context. Colour adjustments apply to the source (the last `adjust` wins), so the colours
 * of annotations stay as chosen.
 */
export function starImageRender(
  doc: Document,
  source: CanvasImageSource,
  size: StarImageSize,
  ops: readonly StarImageOperation[],
  options: StarImageRenderOptions = {},
): HTMLCanvasElement | null {
  let canvas = base(doc, source, size, ops, options);
  if (!canvas) return null;
  for (const op of ops) {
    if (op.type === 'adjust') continue;
    if (op.type === 'annotate') {
      const context = canvas.getContext('2d');
      if (context) starImageDrawAnnotation(context, op.annotation);
      continue;
    }
    const current: HTMLCanvasElement = canvas;
    const from = { width: current.width, height: current.height };
    const next =
      op.type === 'crop'
        ? blank(doc, op.rect)
        : op.type === 'rotate'
          ? blank(doc, starImageRotatedSize(from, op.angle))
          : op.type === 'resize'
            ? blank(doc, op)
            : blank(doc, from);
    const context = next.context;
    if (!context) return null;
    switch (op.type) {
      case 'crop':
        context.drawImage(
          current,
          op.rect.x,
          op.rect.y,
          op.rect.width,
          op.rect.height,
          0,
          0,
          op.rect.width,
          op.rect.height,
        );
        break;
      case 'rotate':
        context.translate(next.canvas.width / 2, next.canvas.height / 2);
        context.rotate((op.angle * Math.PI) / 180);
        context.drawImage(current, -from.width / 2, -from.height / 2);
        break;
      case 'flip':
        if (op.axis === 'horizontal') {
          context.translate(from.width, 0);
          context.scale(-1, 1);
        } else {
          context.translate(0, from.height);
          context.scale(1, -1);
        }
        context.drawImage(current, 0, 0);
        break;
      case 'resize':
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(current, 0, 0, next.canvas.width, next.canvas.height);
        break;
    }
    canvas = next.canvas;
  }
  if (options.background) {
    const { canvas: filled, context } = blank(doc, { width: canvas.width, height: canvas.height });
    if (!context) return canvas;
    context.fillStyle = options.background;
    context.fillRect(0, 0, filled.width, filled.height);
    context.drawImage(canvas, 0, 0);
    return filled;
  }
  return canvas;
}
