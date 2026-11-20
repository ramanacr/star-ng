import {
  STAR_IMAGE_NO_ADJUSTMENTS,
  starImageAdjustPixels,
  starImageAnnotationBox,
  starImageAspectCrop,
  starImageClampCrop,
  starImageFilter,
  starImageFitScale,
  starImageHistoryPush,
  starImageHistoryRedo,
  starImageHistoryStart,
  starImageHistoryUndo,
  starImageIsSafeSource,
  starImageMapPoint,
  starImageNudgeCrop,
  StarImageOperation,
  starImageOutputSize,
  starImageResizeCrop,
  starImageRotatedSize,
} from './image-editor-model';

const SIZE = { width: 400, height: 200 };

describe('image editor geometry', () => {
  it('gives the bounding box of a rotated image', () => {
    expect(starImageRotatedSize(SIZE, 90)).toEqual({ width: 200, height: 400 });
    expect(starImageRotatedSize(SIZE, -90)).toEqual({ width: 200, height: 400 });
    expect(starImageRotatedSize(SIZE, 180)).toEqual({ width: 400, height: 200 });
    const diagonal = starImageRotatedSize({ width: 100, height: 100 }, 45);
    expect(diagonal.width).toBe(Math.round(100 * Math.SQRT2));
    expect(diagonal.height).toBe(diagonal.width);
  });

  it('follows the size through crop, rotate, flip and resize', () => {
    const ops: StarImageOperation[] = [
      { type: 'crop', rect: { x: 10, y: 10, width: 300, height: 100 } },
      { type: 'rotate', angle: 90 },
      { type: 'flip', axis: 'horizontal' },
      { type: 'resize', width: 50, height: 150 },
      { type: 'adjust', adjustments: { ...STAR_IMAGE_NO_ADJUSTMENTS, brightness: 120 } },
    ];
    expect(starImageOutputSize(SIZE, ops.slice(0, 1))).toEqual({ width: 300, height: 100 });
    expect(starImageOutputSize(SIZE, ops.slice(0, 2))).toEqual({ width: 100, height: 300 });
    expect(starImageOutputSize(SIZE, ops)).toEqual({ width: 50, height: 150 });
  });

  it('maps a point forward through each operation', () => {
    const point = { x: 100, y: 50 };
    expect(
      starImageMapPoint(
        { type: 'crop', rect: { x: 10, y: 20, width: 50, height: 50 } },
        point,
        SIZE,
      ),
    ).toEqual({ x: 90, y: 30 });
    expect(starImageMapPoint({ type: 'flip', axis: 'horizontal' }, point, SIZE)).toEqual({
      x: 300,
      y: 50,
    });
    expect(starImageMapPoint({ type: 'flip', axis: 'vertical' }, point, SIZE)).toEqual({
      x: 100,
      y: 150,
    });
    expect(starImageMapPoint({ type: 'resize', width: 200, height: 100 }, point, SIZE)).toEqual({
      x: 50,
      y: 25,
    });
    // 90° clockwise: the top-left corner goes to the top-right corner.
    const rotated = starImageMapPoint({ type: 'rotate', angle: 90 }, { x: 0, y: 0 }, SIZE);
    expect(rotated.x).toBeCloseTo(200);
    expect(rotated.y).toBeCloseTo(0);
  });

  it('maps the box of an annotation through later operations', () => {
    const ops: StarImageOperation[] = [
      {
        type: 'annotate',
        annotation: {
          kind: 'rectangle',
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 30 },
          ],
          color: '#000',
          strokeWidth: 2,
        },
      },
      { type: 'flip', axis: 'horizontal' },
    ];
    const box = starImageAnnotationBox(SIZE, ops, 0)!;
    // The box grows by half the stroke width on each side.
    expect(box).toEqual({ x: 349, y: 9, width: 42, height: 22 });
    expect(starImageAnnotationBox(SIZE, ops, 1)).toBeNull();
  });

  it('starts a crop as the largest centred box of a ratio', () => {
    expect(starImageAspectCrop(SIZE, null)).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    expect(starImageAspectCrop(SIZE, 1)).toEqual({ x: 100, y: 0, width: 200, height: 200 });
    expect(starImageAspectCrop(SIZE, 16 / 9)).toEqual({ x: 22, y: 0, width: 356, height: 200 });
  });

  it('keeps a crop inside the image with a minimum size', () => {
    expect(starImageClampCrop({ x: -10, y: 190, width: 50, height: 50 }, SIZE)).toEqual({
      x: 0,
      y: 150,
      width: 50,
      height: 50,
    });
    expect(starImageClampCrop({ x: 0, y: 0, width: 999, height: 0 }, SIZE)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 1,
    });
  });

  it('nudges a crop with the arrow keys and resizes it with Shift', () => {
    const rect = { x: 10, y: 10, width: 100, height: 100 };
    expect(starImageNudgeCrop(rect, 'ArrowRight', false, 5, null, SIZE)).toEqual({
      ...rect,
      x: 15,
    });
    expect(starImageNudgeCrop(rect, 'ArrowUp', false, 50, null, SIZE)).toEqual({ ...rect, y: 0 });
    expect(starImageNudgeCrop(rect, 'ArrowRight', true, 5, null, SIZE)).toEqual({
      ...rect,
      width: 105,
    });
    expect(starImageNudgeCrop(rect, 'ArrowUp', true, 5, null, SIZE)).toEqual({
      ...rect,
      height: 95,
    });
    // A fixed ratio: the height follows the width.
    expect(starImageNudgeCrop(rect, 'ArrowRight', true, 10, 1, SIZE)).toEqual({
      ...rect,
      width: 110,
      height: 110,
    });
    expect(starImageNudgeCrop(rect, 'Enter', false, 5, null, SIZE)).toBe(rect);
  });

  it('resizes a crop by a handle and keeps a fixed ratio inside the image', () => {
    const rect = { x: 100, y: 50, width: 100, height: 100 };
    expect(starImageResizeCrop(rect, 'se', 20, 10, null, SIZE)).toEqual({
      x: 100,
      y: 50,
      width: 120,
      height: 110,
    });
    expect(starImageResizeCrop(rect, 'nw', 20, 10, null, SIZE)).toEqual({
      x: 120,
      y: 60,
      width: 80,
      height: 90,
    });
    // 2:1 from the east edge: the height follows.
    expect(starImageResizeCrop(rect, 'e', 100, 0, 2, SIZE)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 100,
    });
    // Too big for the image: shrinks, ratio kept.
    const big = starImageResizeCrop(rect, 'se', 500, 500, 1, SIZE);
    expect(big.width).toBe(big.height);
    expect(big.y + big.height).toBeLessThanOrEqual(200);
    expect(big.x + big.width).toBeLessThanOrEqual(400);
  });

  it('fits the image in the view without upscaling', () => {
    expect(starImageFitScale(SIZE, { width: 200, height: 200 })).toBe(0.5);
    expect(starImageFitScale({ width: 100, height: 50 }, { width: 800, height: 600 })).toBe(1);
    expect(starImageFitScale(SIZE, { width: 0, height: 0 })).toBe(1);
  });
});

describe('image editor history', () => {
  it('pushes, undoes and redoes lists of operations', () => {
    const flip: StarImageOperation = { type: 'flip', axis: 'vertical' };
    let state = starImageHistoryStart();
    expect(state.past.length).toBe(0);
    state = starImageHistoryPush(state, [flip]);
    state = starImageHistoryPush(state, [flip, flip]);
    expect(state.present.length).toBe(2);
    state = starImageHistoryUndo(state);
    expect(state.present).toEqual([flip]);
    expect(state.future.length).toBe(1);
    state = starImageHistoryRedo(state);
    expect(state.present.length).toBe(2);
    // A new edit drops the redo stack.
    state = starImageHistoryUndo(state);
    state = starImageHistoryPush(state, []);
    expect(state.future.length).toBe(0);
    expect(starImageHistoryRedo(state)).toBe(state);
    expect(starImageHistoryUndo(starImageHistoryStart())).toEqual(starImageHistoryStart());
  });

  it('keeps at most the given number of steps', () => {
    let state = starImageHistoryStart();
    for (let i = 0; i < 10; i++) state = starImageHistoryPush(state, [], 3);
    expect(state.past.length).toBe(3);
  });
});

describe('image editor filters', () => {
  it('builds a canvas filter string, none for neutral values', () => {
    expect(starImageFilter(STAR_IMAGE_NO_ADJUSTMENTS)).toBe('none');
    expect(starImageFilter({ ...STAR_IMAGE_NO_ADJUSTMENTS, brightness: 150, sepia: 40 })).toBe(
      'brightness(1.5) contrast(1) saturate(1) grayscale(0) sepia(0.4)',
    );
  });

  it('applies the same adjustments to pixels when ctx.filter is missing', () => {
    const pixel = () => new Uint8ClampedArray([200, 100, 50, 255]);
    const bright = pixel();
    starImageAdjustPixels(bright, { ...STAR_IMAGE_NO_ADJUSTMENTS, brightness: 50 });
    expect([...bright]).toEqual([100, 50, 25, 255]);

    const gray = pixel();
    starImageAdjustPixels(gray, { ...STAR_IMAGE_NO_ADJUSTMENTS, grayscale: 100 });
    expect(gray[0]).toBe(gray[1]);
    expect(gray[1]).toBe(gray[2]);
    expect(gray[3]).toBe(255);

    const flat = pixel();
    starImageAdjustPixels(flat, { ...STAR_IMAGE_NO_ADJUSTMENTS, contrast: 0 });
    expect([...flat].slice(0, 3)).toEqual([128, 128, 128]);

    const unchanged = pixel();
    starImageAdjustPixels(unchanged, STAR_IMAGE_NO_ADJUSTMENTS);
    expect([...unchanged]).toEqual([200, 100, 50, 255]);

    const sepia = pixel();
    starImageAdjustPixels(sepia, { ...STAR_IMAGE_NO_ADJUSTMENTS, sepia: 100 });
    expect(sepia[0]).toBeGreaterThan(sepia[2]);
  });
});

describe('image editor source rule', () => {
  const base = 'https://app.example/editor/';
  it('allows data:, blob: and same-origin addresses only', () => {
    expect(starImageIsSafeSource('data:image/png;base64,AAA', base)).toBe(true);
    expect(starImageIsSafeSource('blob:https://app.example/123', base)).toBe(true);
    expect(starImageIsSafeSource('/assets/photo.jpg', base)).toBe(true);
    expect(starImageIsSafeSource('photo.jpg', base)).toBe(true);
    expect(starImageIsSafeSource('https://cdn.other.example/photo.jpg', base)).toBe(false);
    expect(starImageIsSafeSource('javascript:alert(1)', base)).toBe(false);
    expect(starImageIsSafeSource('data:text/html,<b>x</b>', base)).toBe(false);
    expect(starImageIsSafeSource('', base)).toBe(false);
  });
});

describe('image editor preview scale', () => {
  it('scales the pixel coordinates of the operations, not turns or colours', async () => {
    const { starImageScaleOps } = await import('./image-editor-render');
    const ops: StarImageOperation[] = [
      { type: 'crop', rect: { x: 10, y: 20, width: 100, height: 50 } },
      { type: 'rotate', angle: 90 },
      { type: 'resize', width: 40, height: 80 },
      {
        type: 'annotate',
        annotation: {
          kind: 'text',
          points: [{ x: 4, y: 8 }],
          color: '#000',
          strokeWidth: 2,
          text: 'A',
          fontSize: 12,
        },
      },
    ];
    expect(starImageScaleOps(ops, 0.5)).toEqual([
      { type: 'crop', rect: { x: 5, y: 10, width: 50, height: 25 } },
      { type: 'rotate', angle: 90 },
      { type: 'resize', width: 20, height: 40 },
      {
        type: 'annotate',
        annotation: {
          kind: 'text',
          points: [{ x: 2, y: 4 }],
          color: '#000',
          strokeWidth: 1,
          text: 'A',
          fontSize: 6,
        },
      },
    ]);
    expect(starImageScaleOps(ops, 1)).toEqual(ops);
  });
});
