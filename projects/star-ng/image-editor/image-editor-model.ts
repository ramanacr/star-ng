/**
 * Pure model of `star-image-editor`: the operation list, the geometry of crop, rotation, flip
 * and resize, the undo history, the colour adjustments and the source rule. Nothing here touches
 * the DOM, so every function runs on the server and in unit tests.
 */

/** A size in image pixels. */
export interface StarImageSize {
  readonly width: number;
  readonly height: number;
}

/** A point in image pixels, from the top-left corner. */
export interface StarImagePoint {
  readonly x: number;
  readonly y: number;
}

/** A rectangle in image pixels. */
export interface StarImageRect extends StarImagePoint, StarImageSize {}

/**
 * Colour adjustments in percent. `brightness`, `contrast` and `saturation` are 100 when
 * unchanged (0 to 200); `grayscale` and `sepia` are 0 when unchanged (0 to 100).
 */
export interface StarImageAdjustments {
  readonly brightness: number;
  readonly contrast: number;
  readonly saturation: number;
  readonly grayscale: number;
  readonly sepia: number;
}

/** Adjustments that change nothing. */
export const STAR_IMAGE_NO_ADJUSTMENTS: StarImageAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
};

/** Kind of an annotation of `star-image-editor`. */
export type StarImageAnnotationKind = 'pen' | 'rectangle' | 'ellipse' | 'arrow' | 'text';

/**
 * An annotation drawn on the image. `points`: the sampled points of a pen stroke; the start and
 * the end of a rectangle, an ellipse or an arrow; the top-left corner of a text.
 */
export interface StarImageAnnotation {
  readonly kind: StarImageAnnotationKind;
  readonly points: readonly StarImagePoint[];
  /** A CSS colour, resolved when the annotation was made (an export has no tokens). */
  readonly color: string;
  /** Line width in image pixels. A text uses it for its size (`fontSize`). */
  readonly strokeWidth: number;
  readonly text?: string;
  /** Font size of a text in image pixels. */
  readonly fontSize?: number;
}

/**
 * One edit of `star-image-editor`. The editor keeps the list and replays it on the source image
 * for the view and the export (non-destructive). Coordinates are in the pixels of the image as
 * it is before that operation.
 */
export type StarImageOperation =
  | { readonly type: 'crop'; readonly rect: StarImageRect }
  /** Rotation in degrees, clockwise. The image grows to the bounding box of the turned image. */
  | { readonly type: 'rotate'; readonly angle: number }
  | { readonly type: 'flip'; readonly axis: 'horizontal' | 'vertical' }
  | { readonly type: 'resize'; readonly width: number; readonly height: number }
  /** Colour adjustments of the source image. The last one in the list is in force. */
  | { readonly type: 'adjust'; readonly adjustments: StarImageAdjustments }
  | { readonly type: 'annotate'; readonly annotation: StarImageAnnotation };

/** A crop handle: an edge or a corner, by compass point. */
export type StarImageCropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Sine and cosine with the float noise of right angles removed. */
function turn(degrees: number): { sin: number; cos: number } {
  const angle = radians(degrees);
  const clean = (value: number) => (Math.abs(value) < 1e-10 ? 0 : value);
  return { sin: clean(Math.sin(angle)), cos: clean(Math.cos(angle)) };
}

/** Size of the bounding box of an image of `size` turned by `angle` degrees (whole pixels). */
export function starImageRotatedSize(size: StarImageSize, angle: number): StarImageSize {
  const { sin, cos } = turn(angle);
  return {
    width: Math.max(1, Math.round(Math.abs(size.width * cos) + Math.abs(size.height * sin))),
    height: Math.max(1, Math.round(Math.abs(size.width * sin) + Math.abs(size.height * cos))),
  };
}

/** Size of the image after one operation. */
export function starImageSizeAfter(op: StarImageOperation, size: StarImageSize): StarImageSize {
  switch (op.type) {
    case 'crop':
      return { width: op.rect.width, height: op.rect.height };
    case 'rotate':
      return starImageRotatedSize(size, op.angle);
    case 'resize':
      return { width: op.width, height: op.height };
    default:
      return size;
  }
}

/** Size of the image after a list of operations. */
export function starImageOutputSize(
  source: StarImageSize,
  ops: readonly StarImageOperation[],
): StarImageSize {
  return ops.reduce((size, op) => starImageSizeAfter(op, size), source);
}

/** Where a point of the image before `op` (of `size`) is after it. */
export function starImageMapPoint(
  op: StarImageOperation,
  point: StarImagePoint,
  size: StarImageSize,
): StarImagePoint {
  switch (op.type) {
    case 'crop':
      return { x: point.x - op.rect.x, y: point.y - op.rect.y };
    case 'flip':
      return op.axis === 'horizontal'
        ? { x: size.width - point.x, y: point.y }
        : { x: point.x, y: size.height - point.y };
    case 'resize':
      return {
        x: (point.x * op.width) / size.width,
        y: (point.y * op.height) / size.height,
      };
    case 'rotate': {
      const after = starImageRotatedSize(size, op.angle);
      const { sin, cos } = turn(op.angle);
      const dx = point.x - size.width / 2;
      const dy = point.y - size.height / 2;
      return {
        x: after.width / 2 + dx * cos - dy * sin,
        y: after.height / 2 + dx * sin + dy * cos,
      };
    }
    default:
      return point;
  }
}

/** The box an annotation covers, in its own coordinates, with half the line width around it. */
export function starImageAnnotationBounds(annotation: StarImageAnnotation): StarImageRect {
  // A loop, not Math.min(...points): a long pen stroke would exceed the argument limit.
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const { x, y } of annotation.points) {
    if (x < left) left = x;
    if (y < top) top = y;
    if (x > right) right = x;
    if (y > bottom) bottom = y;
  }
  if (annotation.kind === 'text') {
    const size = annotation.fontSize ?? 16;
    right = left + Math.max(1, (annotation.text ?? '').length) * size * 0.6;
    bottom = top + size * 1.2;
  } else {
    const half = annotation.strokeWidth / 2;
    left -= half;
    top -= half;
    right += half;
    bottom += half;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The box of the annotation at `index` of `ops`, mapped through every later operation to the
 * coordinates of the output image. `null` when `ops[index]` is no annotation.
 */
export function starImageAnnotationBox(
  source: StarImageSize,
  ops: readonly StarImageOperation[],
  index: number,
): StarImageRect | null {
  const op = ops[index];
  if (op?.type !== 'annotate') return null;
  const box = starImageAnnotationBounds(op.annotation);
  let corners: StarImagePoint[] = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height },
  ];
  let size = starImageOutputSize(source, ops.slice(0, index + 1));
  for (const later of ops.slice(index + 1)) {
    const before = size;
    corners = corners.map((corner) => starImageMapPoint(later, corner, before));
    size = starImageSizeAfter(later, before);
  }
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const round = (value: number) => Math.round(value * 100) / 100;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x: round(x),
    y: round(y),
    width: round(Math.max(...xs) - x),
    height: round(Math.max(...ys) - y),
  };
}

/** The largest box of `ratio` (width / height; `null`: free, the whole image), centred. */
export function starImageAspectCrop(size: StarImageSize, ratio: number | null): StarImageRect {
  if (!ratio || ratio <= 0) return { x: 0, y: 0, width: size.width, height: size.height };
  let width = size.width;
  let height = Math.round(width / ratio);
  if (height > size.height) {
    height = size.height;
    width = Math.round(height * ratio);
  }
  return {
    x: Math.round((size.width - width) / 2),
    y: Math.round((size.height - height) / 2),
    width,
    height,
  };
}

/** A crop inside the image: whole pixels, at least 1 × 1, moved back inside when it sticks out. */
export function starImageClampCrop(rect: StarImageRect, size: StarImageSize): StarImageRect {
  const width = Math.min(size.width, Math.max(1, Math.round(rect.width)));
  const height = Math.min(size.height, Math.max(1, Math.round(rect.height)));
  const x = Math.min(size.width - width, Math.max(0, Math.round(rect.x)));
  const y = Math.min(size.height - height, Math.max(0, Math.round(rect.y)));
  return { x, y, width, height };
}

/** Shrinks a box anchored at its top-left corner to fit the image, keeping `ratio`. */
function fitRatio(rect: StarImageRect, ratio: number, size: StarImageSize): StarImageRect {
  let { width, height } = rect;
  const maxWidth = size.width - Math.max(0, rect.x);
  const maxHeight = size.height - Math.max(0, rect.y);
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  return { ...rect, width: Math.floor(width), height: Math.floor(height) };
}

/**
 * The crop after a key: an arrow moves it by `step` pixels; with `resize` (Shift) the right and
 * down arrows make it wider and taller, the left and up arrows narrower and lower. With a
 * `ratio` the other side follows. Another key returns `rect` itself.
 */
export function starImageNudgeCrop(
  rect: StarImageRect,
  key: string,
  resize: boolean,
  step: number,
  ratio: number | null,
  size: StarImageSize,
): StarImageRect {
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = delta[key];
  if (!move) return rect;
  const [dx, dy] = move;
  if (!resize) return starImageClampCrop({ ...rect, x: rect.x + dx, y: rect.y + dy }, size);
  let width = Math.max(1, rect.width + dx);
  let height = Math.max(1, rect.height + dy);
  if (ratio) {
    if (dx) height = Math.max(1, Math.round(width / ratio));
    else width = Math.max(1, Math.round(height * ratio));
    return starImageClampCrop(fitRatio({ ...rect, width, height }, ratio, size), size);
  }
  return starImageClampCrop({ ...rect, width, height }, size);
}

/**
 * The crop after a handle was dragged by `dx`, `dy` image pixels. The opposite edge or corner
 * stays. With a `ratio`, a corner or a side edge sets the width and the height follows; the top
 * or bottom edge sets the height and the width follows. The result stays inside the image.
 */
export function starImageResizeCrop(
  rect: StarImageRect,
  handle: StarImageCropHandle,
  dx: number,
  dy: number,
  ratio: number | null,
  size: StarImageSize,
): StarImageRect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  if (handle.includes('w')) left = Math.min(right - 1, Math.max(0, left + dx));
  if (handle.includes('e')) right = Math.max(left + 1, Math.min(size.width, right + dx));
  if (handle.includes('n')) top = Math.min(bottom - 1, Math.max(0, top + dy));
  if (handle.includes('s')) bottom = Math.max(top + 1, Math.min(size.height, bottom + dy));
  if (!ratio) {
    return starImageClampCrop({ x: left, y: top, width: right - left, height: bottom - top }, size);
  }
  const horizontal = handle.includes('e') || handle.includes('w');
  let width = right - left;
  let height = bottom - top;
  if (horizontal) height = width / ratio;
  else width = height * ratio;
  // Room from the fixed edge or corner.
  const maxWidth = handle.includes('w') ? right : size.width - left;
  const maxHeight = handle.includes('n') ? bottom : size.height - top;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));
  const x = handle.includes('w') ? right - width : left;
  const y = handle.includes('n') ? bottom - height : top;
  return starImageClampCrop({ x, y, width, height }, size);
}

/** Scale that fits `image` into `view`; never above 1 (no upscaling). 1 for an unmeasured view. */
export function starImageFitScale(image: StarImageSize, view: StarImageSize): number {
  if (!view.width || !view.height || !image.width || !image.height) return 1;
  return Math.min(1, view.width / image.width, view.height / image.height);
}

/** The adjustments in force: those of the last `adjust` operation. */
export function starImageAdjustmentsOf(ops: readonly StarImageOperation[]): StarImageAdjustments {
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (op.type === 'adjust') return op.adjustments;
  }
  return STAR_IMAGE_NO_ADJUSTMENTS;
}

/** True when the adjustments change nothing. */
export function starImageIsNeutral(adjustments: StarImageAdjustments): boolean {
  return (Object.keys(STAR_IMAGE_NO_ADJUSTMENTS) as (keyof StarImageAdjustments)[]).every(
    (name) => adjustments[name] === STAR_IMAGE_NO_ADJUSTMENTS[name],
  );
}

/** The adjustments as a canvas `filter` string; `none` when they change nothing. */
export function starImageFilter(adjustments: StarImageAdjustments): string {
  if (starImageIsNeutral(adjustments)) return 'none';
  const { brightness, contrast, saturation, grayscale, sepia } = adjustments;
  return (
    `brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100}) ` +
    `grayscale(${grayscale / 100}) sepia(${sepia / 100})`
  );
}

type Matrix = readonly [number, number, number, number, number, number, number, number, number];

function multiply(pixel: [number, number, number], m: Matrix): [number, number, number] {
  const [r, g, b] = pixel;
  return [
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ];
}

/** The colour matrices of the CSS filter functions (Filter Effects Module Level 1). */
function saturateMatrix(s: number): Matrix {
  return [
    0.213 + 0.787 * s,
    0.715 - 0.715 * s,
    0.072 - 0.072 * s,
    0.213 - 0.213 * s,
    0.715 + 0.285 * s,
    0.072 - 0.072 * s,
    0.213 - 0.213 * s,
    0.715 - 0.715 * s,
    0.072 + 0.928 * s,
  ];
}

function grayscaleMatrix(amount: number): Matrix {
  const a = 1 - Math.min(1, amount);
  return [
    0.2126 + 0.7874 * a,
    0.7152 - 0.7152 * a,
    0.0722 - 0.0722 * a,
    0.2126 - 0.2126 * a,
    0.7152 + 0.2848 * a,
    0.0722 - 0.0722 * a,
    0.2126 - 0.2126 * a,
    0.7152 - 0.7152 * a,
    0.0722 + 0.9278 * a,
  ];
}

function sepiaMatrix(amount: number): Matrix {
  const a = 1 - Math.min(1, amount);
  return [
    0.393 + 0.607 * a,
    0.769 - 0.769 * a,
    0.189 - 0.189 * a,
    0.349 - 0.349 * a,
    0.686 + 0.314 * a,
    0.168 - 0.168 * a,
    0.272 - 0.272 * a,
    0.534 - 0.534 * a,
    0.131 + 0.869 * a,
  ];
}

/**
 * Applies the adjustments to RGBA pixels in place, in the order of `starImageFilter`. The
 * fallback for engines without `CanvasRenderingContext2D.filter`. Alpha is kept.
 */
export function starImageAdjustPixels(
  data: Uint8ClampedArray,
  adjustments: StarImageAdjustments,
): void {
  if (starImageIsNeutral(adjustments)) return;
  const brightness = adjustments.brightness / 100;
  const contrast = adjustments.contrast / 100;
  const intercept = 255 * (0.5 - 0.5 * contrast);
  const saturate = saturateMatrix(adjustments.saturation / 100);
  const gray = grayscaleMatrix(adjustments.grayscale / 100);
  const sepia = sepiaMatrix(adjustments.sepia / 100);
  const clamp = (value: number) => Math.min(255, Math.max(0, value));
  for (let i = 0; i < data.length; i += 4) {
    let pixel: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
    // Each filter function clamps its result, as the CSS filter chain does.
    pixel = pixel.map((c) => clamp(c * brightness)) as [number, number, number];
    pixel = pixel.map((c) => clamp(c * contrast + intercept)) as [number, number, number];
    pixel = multiply(pixel, saturate).map(clamp) as [number, number, number];
    pixel = multiply(pixel, gray).map(clamp) as [number, number, number];
    pixel = multiply(pixel, sepia).map(clamp) as [number, number, number];
    data[i] = pixel[0];
    data[i + 1] = pixel[1];
    data[i + 2] = pixel[2];
  }
}

/**
 * True when the editor may draw `src` on a canvas without tainting it: a `data:image/` URL, a
 * `blob:` URL or an address of the same origin as `baseUri` (the document). Any other address
 * would make the export throw, so the editor does not draw it.
 */
export function starImageIsSafeSource(src: string, baseUri: string): boolean {
  const value = src.trim();
  if (!value) return false;
  if (/^data:/i.test(value)) return /^data:image\//i.test(value);
  if (/^blob:/i.test(value)) return true;
  try {
    const base = new URL(baseUri);
    const url = new URL(value, base);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === base.origin;
  } catch {
    return false;
  }
}

/** Undo history of the operation lists: the steps before, the current list and the steps after. */
export interface StarImageHistory {
  readonly past: readonly (readonly StarImageOperation[])[];
  readonly present: readonly StarImageOperation[];
  readonly future: readonly (readonly StarImageOperation[])[];
}

/** An empty history. */
export function starImageHistoryStart(
  present: readonly StarImageOperation[] = [],
): StarImageHistory {
  return { past: [], present, future: [] };
}

/** Makes `present` the current list; the old one becomes undoable. Drops the redo steps. */
export function starImageHistoryPush(
  state: StarImageHistory,
  present: readonly StarImageOperation[],
  limit = 100,
): StarImageHistory {
  const past = limit > 0 ? [...state.past, state.present].slice(-limit) : [];
  return { past, present, future: [] };
}

/** One step back; the same state when there is nothing to undo. */
export function starImageHistoryUndo(state: StarImageHistory): StarImageHistory {
  if (!state.past.length) return state;
  return {
    past: state.past.slice(0, -1),
    present: state.past[state.past.length - 1],
    future: [state.present, ...state.future],
  };
}

/** One step forward again; the same state when there is nothing to redo. */
export function starImageHistoryRedo(state: StarImageHistory): StarImageHistory {
  if (!state.future.length) return state;
  return {
    past: [...state.past, state.present],
    present: state.future[0],
    future: state.future.slice(1),
  };
}
