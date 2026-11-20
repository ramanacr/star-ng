import { StarImageOperation } from './image-editor-model';
import { starImagePreviewScale } from './image-editor-preview';

const SIZE = { width: 1000, height: 500 };

describe('image editor preview base scale', () => {
  it('uses the view scale without a resize, and never more than the natural size', () => {
    expect(starImagePreviewScale(SIZE, [], 500)).toBe(0.5);
    expect(starImagePreviewScale(SIZE, [], 2000)).toBe(1);
  });

  it('keeps the base sharp after an enlarging resize', () => {
    const ops: StarImageOperation[] = [{ type: 'resize', width: 3000, height: 1500 }];
    // The output is 3000 wide and the view 1500: the base needs the full 1000 source pixels,
    // not 500 that the resize then stretches.
    expect(starImagePreviewScale(SIZE, ops, 1500)).toBe(1);
    expect(starImagePreviewScale(SIZE, ops, 600)).toBeCloseTo(0.6);
  });

  it('counts the resize factor after a crop and a turn', () => {
    const ops: StarImageOperation[] = [
      { type: 'crop', rect: { x: 0, y: 0, width: 400, height: 200 } },
      { type: 'rotate', angle: 90 },
      { type: 'resize', width: 400, height: 800 },
    ];
    // Output 400 x 800 from a 200 x 400 turned crop: twice the source detail. A view of 100
    // pixels across shows a quarter of the output width, so the base needs half the source.
    expect(starImagePreviewScale(SIZE, ops, 100)).toBeCloseTo(0.5);
  });

  it('keeps the view scale after a shrinking resize', () => {
    const ops: StarImageOperation[] = [{ type: 'resize', width: 500, height: 250 }];
    expect(starImagePreviewScale(SIZE, ops, 250)).toBe(0.5);
  });
});
