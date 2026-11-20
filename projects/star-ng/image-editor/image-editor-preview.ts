import { StarImageOperation, StarImageSize, starImageSizeAfter } from './image-editor-model';

/**
 * Scale (of the natural size) at which the editor renders and caches the adjusted source for the
 * view canvas of `viewWidth` device pixels. The view scale alone (view width / output width) is
 * too small after an enlarging resize: the resize then stretches a base with fewer pixels than
 * the view shows, and the preview is blurry. So the view scale is multiplied by the enlargement
 * of the resizes (at least 1), and capped at the natural size. The result can be larger than the
 * view; the editor draws it scaled down. This file is internal and is not exported from the
 * entry point.
 */
export function starImagePreviewScale(
  natural: StarImageSize,
  ops: readonly StarImageOperation[],
  viewWidth: number,
): number {
  let size = natural;
  let enlargement = 1;
  for (const op of ops) {
    const next = starImageSizeAfter(op, size);
    if (op.type === 'resize' && size.width > 0 && size.height > 0) {
      enlargement *= Math.max(next.width / size.width, next.height / size.height);
    }
    size = next;
  }
  if (!size.width) return 1;
  return Math.min(1, (viewWidth / size.width) * Math.max(1, enlargement));
}
