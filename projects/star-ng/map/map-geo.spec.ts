import {
  STAR_MAP_TILE_SIZE,
  StarGeoJsonFeatureCollection,
  starMapBubbleRadius,
  starMapClasses,
  starMapFit,
  starMapParse,
  starMapPath,
  starMapReadingOrder,
  starMapTiles,
  starMapTileUrl,
  starMapToScreen,
  starMapToWorld,
  starMapUnion,
  starMapZoomAround,
  starProject,
  starUnproject,
} from './map-geo';

const square = (x: number, y: number, size: number): number[][] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

const COLLECTION: StarGeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'lake-region',
      properties: { name: 'Lake region' },
      // An outer ring with a hole (the lake).
      geometry: { type: 'Polygon', coordinates: [square(0, 0, 10), square(3, 3, 2)] },
    },
    {
      type: 'Feature',
      properties: { name: 'Islands' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[square(20, 0, 2)], [square(30, 0, 6)]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'River' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 20],
          [10, 25],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Town' },
      geometry: { type: 'Point', coordinates: [5, 30] },
    },
    { type: 'Feature', properties: {}, geometry: null },
  ],
};

describe('map projections', () => {
  it('projects to the 256-pixel world of web tiles (Web Mercator)', () => {
    expect(starProject([0, 0])).toEqual([128, 128]);
    expect(starProject([-180, 0])[0]).toBe(0);
    expect(starProject([180, 0])[0]).toBe(STAR_MAP_TILE_SIZE);
    // The latitude is clamped to the square world.
    expect(starProject([0, 90])[1]).toBeCloseTo(0, 6);
    expect(starProject([0, -90])[1]).toBeCloseTo(256, 6);
    const [x, y] = starProject([13.4, 52.5]);
    const [lon, lat] = starUnproject([x, y]);
    expect(lon).toBeCloseTo(13.4, 8);
    expect(lat).toBeCloseTo(52.5, 8);
  });

  it('projects equirectangular to a world twice as wide as high', () => {
    expect(starProject([0, 0], 'equirectangular')).toEqual([128, 64]);
    expect(starProject([-180, 90], 'equirectangular')).toEqual([0, 0]);
    expect(starProject([180, -90], 'equirectangular')).toEqual([256, 128]);
    const [lon, lat] = starUnproject(starProject([-70, -33], 'equirectangular'), 'equirectangular');
    expect(lon).toBeCloseTo(-70, 10);
    expect(lat).toBeCloseTo(-33, 10);
  });
});

describe('GeoJSON parsing', () => {
  const shapes = starMapParse(COLLECTION, 'equirectangular');

  it('keeps every geometry kind and skips features without geometry', () => {
    expect(shapes.map((s) => s.kind)).toEqual(['area', 'area', 'line', 'point']);
    expect(shapes.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it('draws holes as sub-paths (even-odd fill) and every polygon of a MultiPolygon', () => {
    const [region, islands, river] = shapes;
    expect(region.rings.length).toBe(2);
    expect(starMapPath(region).match(/M/g)?.length).toBe(2);
    expect(starMapPath(region).match(/Z/g)?.length).toBe(2);
    expect(islands.rings.length).toBe(2);
    expect(starMapPath(river)).not.toContain('Z');
    expect(starMapPath(river).startsWith('M')).toBe(true);
  });

  it('puts the centroid in the largest polygon, and gives bounds', () => {
    const [region, islands, , town] = shapes;
    const [cx, cy] = starProject([5, 5], 'equirectangular');
    expect(region.centroid[0]).toBeCloseTo(cx, 6);
    expect(region.centroid[1]).toBeCloseTo(cy, 6);
    // The larger island (30..36) holds the centroid.
    expect(starUnproject(islands.centroid, 'equirectangular')[0]).toBeCloseTo(33, 6);
    expect(town.centroid).toEqual(starProject([5, 30], 'equirectangular'));
    const [minX] = starProject([20, 0], 'equirectangular');
    expect(islands.bounds.minX).toBeCloseTo(minX, 6);
  });

  it('drops a polygon whose outer ring is invalid, holes included (review M12)', () => {
    const shapes = starMapParse(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, Number.NaN],
                ],
                square(3, 3, 2),
              ],
            },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'MultiPolygon',
              coordinates: [
                [
                  [
                    [0, 0],
                    [1, 1],
                  ],
                  square(0.2, 0.2, 0.1),
                ],
                [square(10, 10, 2)],
              ],
            },
          },
        ],
      },
      'equirectangular',
    );
    expect(shapes.length).toBe(1);
    expect(shapes[0].index).toBe(1);
    expect(shapes[0].rings.length).toBe(1);
  });

  it('ignores invalid coordinates', () => {
    const shapes = starMapParse(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [Number.NaN, 3] },
          },
          { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } },
        ],
      },
      'mercator',
    );
    expect(shapes).toEqual([]);
  });
});

describe('map view maths', () => {
  const viewport = { width: 800, height: 400 };

  it('fits bounds into the viewport with padding and limits', () => {
    const fit = starMapFit({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, viewport, 0, 0, 20);
    expect(fit.zoom).toBeCloseTo(3, 10);
    expect(fit.center).toEqual([50, 25]);
    const capped = starMapFit({ minX: 10, minY: 10, maxX: 10, maxY: 10 }, viewport, 0, 0, 6);
    expect(capped.zoom).toBe(6);
    const floor = starMapFit({ minX: 0, minY: 0, maxX: 256, maxY: 256 }, viewport, 0, 1, 6);
    expect(floor.zoom).toBe(1);
  });

  it('converts between world and screen points', () => {
    const view = { center: [50, 25] as const, zoom: 3 };
    expect(starMapToScreen([50, 25], view, viewport)).toEqual([400, 200]);
    expect(starMapToScreen([51, 25], view, viewport)).toEqual([408, 200]);
    expect(starMapToWorld([408, 200], view, viewport)).toEqual([51, 25]);
  });

  it('zooms around a point that stays in place', () => {
    const view = { center: [50, 25] as const, zoom: 3 };
    const anchor = [600, 100] as const;
    const world = starMapToWorld(anchor, view, viewport);
    const zoomed = starMapZoomAround(view, anchor, 4, viewport);
    expect(zoomed.zoom).toBe(4);
    const after = starMapToScreen(world, zoomed, viewport);
    expect(after[0]).toBeCloseTo(600, 8);
    expect(after[1]).toBeCloseTo(100, 8);
  });

  it('orders features in reading order: rows from the top, then from the left', () => {
    const order = starMapReadingOrder(
      [
        [50, 10],
        [10, 11],
        [30, 40],
        [5, 41],
      ],
      5,
    );
    expect(order).toEqual([1, 0, 3, 2]);
  });

  it('classes values in equal intervals and leaves missing values out', () => {
    const classes = starMapClasses([10, 20, null, 50], 4);
    expect(classes.breaks).toEqual([10, 20, 30, 40, 50]);
    expect(classes.classOf(10)).toBe(0);
    expect(classes.classOf(29.9)).toBe(1);
    expect(classes.classOf(50)).toBe(3);
    expect(classes.classOf(null)).toBeNull();
    const flat = starMapClasses([7, 7], 5);
    expect(flat.classOf(7)).toBe(0);
    expect(starMapClasses([], 5).breaks).toEqual([]);
  });

  it('sizes bubbles by area', () => {
    expect(starMapBubbleRadius(0, 0, 100, 4, 24)).toBe(4);
    expect(starMapBubbleRadius(100, 0, 100, 4, 24)).toBe(24);
    expect(starMapBubbleRadius(25, 0, 100, 4, 24)).toBe(14);
    expect(starMapBubbleRadius(5, 5, 5, 4, 24)).toBe(24);
  });

  it('places tiles on whole pixels without seams at a fractional zoom (review M15)', () => {
    const tiles = starMapTiles({ center: [100.3, 77.7], zoom: 2.37 }, { width: 700, height: 500 });
    for (const tile of tiles) {
      expect(Number.isInteger(tile.left)).toBe(true);
      expect(Number.isInteger(tile.width)).toBe(true);
      const right = tiles.find((t) => t.y === tile.y && t.x === tile.x + 1);
      if (right) expect(tile.left + tile.width).toBe(right.left);
      const below = tiles.find((t) => t.x === tile.x && t.y === tile.y + 1);
      if (below) expect(tile.top + tile.height).toBe(below.top);
    }
  });

  it('handles very large value and bounds lists (review M20)', () => {
    const values = Array.from({ length: 200_000 }, (_, i) => i);
    expect(starMapClasses(values, 4).breaks).toEqual([0, 49999.75, 99999.5, 149999.25, 199999]);
    const many = Array.from({ length: 200_000 }, (_, i) => ({
      minX: i,
      minY: 0,
      maxX: i + 1,
      maxY: 1,
    }));
    expect(starMapUnion(many)).toEqual({ minX: 0, minY: 0, maxX: 200_000, maxY: 1 });
  });

  it('lists the visible tiles only', () => {
    const view = { center: [128, 128] as const, zoom: 1 };
    const tiles = starMapTiles(view, { width: 256, height: 256 });
    expect(tiles.map((t) => `${t.z}/${t.x}/${t.y}`).sort()).toEqual([
      '1/0/0',
      '1/0/1',
      '1/1/0',
      '1/1/1',
    ]);
    expect(tiles[0].size).toBe(256);
    // Zoom 2.5 uses level 3 tiles at 0.71 of their size; a small view needs few.
    const near = starMapTiles({ center: [128, 128], zoom: 2.5 }, { width: 100, height: 100 });
    expect(near.every((t) => t.z === 3)).toBe(true);
    expect(near.length).toBeLessThanOrEqual(4);
    expect(starMapTileUrl('https://tiles.example/{z}/{x}/{y}.png', 3, 4, 2)).toBe(
      'https://tiles.example/3/4/2.png',
    );
  });
});
