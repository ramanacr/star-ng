import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarNg, StarAnnouncer } from '@star-ng/ui/core';
import {
  StarGeoJsonFeatureCollection,
  StarLonLat,
  StarMap,
  StarMapFeatureEvent,
  StarMapLayer,
  StarMapMarker,
  StarMapTooltip,
} from '@star-ng/ui/map';

const square = (x: number, y: number, size: number): number[][] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

const REGIONS: StarGeoJsonFeatureCollection<{ name: string; sales: number | null }> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'north',
      properties: { name: 'North', sales: 10 },
      geometry: { type: 'Polygon', coordinates: [square(0, 10, 10), square(3, 13, 2)] },
    },
    {
      type: 'Feature',
      id: 'east',
      properties: { name: 'East', sales: 50 },
      geometry: { type: 'MultiPolygon', coordinates: [[square(12, 0, 8)], [square(22, 0, 2)]] },
    },
    {
      type: 'Feature',
      id: 'west',
      properties: { name: 'West', sales: null },
      geometry: { type: 'Polygon', coordinates: [square(0, 0, 10)] },
    },
  ],
};

interface City {
  readonly name: string;
  readonly at: StarLonLat;
  readonly people: number;
}
const CITIES: readonly City[] = [
  { name: 'Port', at: [5, 5], people: 100 },
  { name: 'Hill', at: [15, 4], people: 400 },
];

const LAYERS: readonly StarMapLayer[] = [
  {
    type: 'shape',
    id: 'regions',
    title: 'Sales',
    data: REGIONS,
    value: (f) => (f.properties as { sales: number | null }).sales,
    classes: 4,
  },
  {
    type: 'marker',
    id: 'cities',
    title: 'Cities',
    data: CITIES,
    position: (c: City) => c.at,
    label: (c: City) => c.name,
  },
  {
    type: 'bubble',
    id: 'people',
    data: CITIES,
    position: (c: City) => c.at,
    label: (c: City) => `${c.name} people`,
    value: (c: City) => c.people,
  },
];

@Component({
  imports: [StarMap, StarMapMarker, StarMapTooltip],
  template: `
    <star-map
      [layers]="layers()"
      [(selection)]="selection"
      [(zoom)]="zoom"
      [(center)]="center"
      [selectionMode]="mode()"
      [maxZoom]="10"
      ariaLabel="Sales map"
      (shapeClick)="shapes.push($event)"
      (markerClick)="markers.push($event)"
    >
      @if (slots()) {
        <ng-template starMapMarker let-feature>
          <span class="custom-marker">{{ feature.label }}</span>
        </ng-template>
        <ng-template starMapTooltip let-feature>
          <span class="custom-tip">Tip {{ feature.label }}</span>
        </ng-template>
      }
    </star-map>
  `,
})
class Host {
  readonly map = viewChild.required(StarMap);
  readonly layers = signal<readonly StarMapLayer[]>(LAYERS);
  readonly selection = signal<readonly string[]>([]);
  readonly zoom = signal<number | null>(null);
  readonly center = signal<StarLonLat | null>(null);
  readonly mode = signal<'none' | 'single' | 'multiple'>('single');
  readonly slots = signal(false);
  readonly shapes: StarMapFeatureEvent[] = [];
  readonly markers: StarMapFeatureEvent[] = [];
}

function key(target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function pointer(target: Element, type: string, x: number, y: number, id = 1): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: id });
  target.dispatchEvent(event);
}

async function setup(init: (host: Host) => void = () => undefined, motion = false) {
  const announce = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [
      { provide: StarAnnouncer, useValue: { announce, clear: () => undefined } },
      // Reduced motion (no animation frames) unless a test checks the animation.
      provideStarNg({ reducedMotion: motion ? 'system' : 'always' }),
    ],
  });
  const fixture = TestBed.createComponent(Host);
  init(fixture.componentInstance);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const feature = (name: string) =>
    root.querySelector<HTMLElement>(`[aria-label="${name}"], [aria-label^="${name}:"]`)!;
  return {
    fixture,
    root,
    host,
    map: host.map(),
    announce,
    feature,
    stable: () => fixture.whenStable(),
  };
}

afterEach(() => document.documentElement.removeAttribute('data-star-motion'));

describe('StarMap', () => {
  it('draws shapes with holes, markers and bubbles with names and values', async () => {
    const { root, feature } = await setup();
    const north = feature('North');
    expect(north.tagName.toLowerCase()).toBe('path');
    expect(north.getAttribute('role')).toBe('button');
    expect(north.getAttribute('aria-label')).toBe('North: 10');
    // The hole is a second sub-path, filled even-odd.
    expect(north.getAttribute('d')?.match(/M/g)?.length).toBe(2);
    expect(north.getAttribute('fill-rule')).toBe('evenodd');
    expect(feature('East').getAttribute('d')?.match(/M/g)?.length).toBe(2);
    expect(feature('West').getAttribute('aria-label')).toBe('West');
    expect(feature('West').classList).toContain('star-map__shape--empty');
    expect(root.querySelector('.star-map__marker[aria-label="Port"]')).not.toBeNull();
    const bubble = root.querySelector('circle.star-map__bubble[aria-label="Hill people: 400"]');
    expect(Number(bubble?.getAttribute('r'))).toBe(24);
  });

  it('colours shapes by value classes and shows a legend with no data', async () => {
    const { root, feature } = await setup();
    expect(feature('North').style.fill).toContain('color-mix');
    expect(feature('North').style.fill).not.toBe(feature('East').style.fill);
    const legend = root.querySelector('.star-map__legend')!;
    expect(legend.querySelector('.star-map__legend-title')?.textContent?.trim()).toBe(
      'Legend: Sales',
    );
    const list = legend.querySelector('ul')!;
    expect(root.querySelector(`#${list.getAttribute('aria-labelledby')}`)).not.toBeNull();
    expect([...list.querySelectorAll('li')].map((li) => li.textContent?.trim())).toEqual([
      '10 to 20',
      '20 to 30',
      '30 to 40',
      '40 to 50',
      'No data',
    ]);
  });

  it('is an application only while it has the focus, with a hint', async () => {
    const { root, feature, stable } = await setup();
    const viewport = root.querySelector('.star-map__viewport')!;
    expect(viewport.getAttribute('role')).toBe('group');
    expect(viewport.getAttribute('aria-label')).toBe('Sales map');
    expect(
      root.querySelector(`#${viewport.getAttribute('aria-describedby')}`)?.textContent,
    ).toContain('Arrow keys move between the features');
    feature('North').focus();
    await stable();
    expect(viewport.getAttribute('role')).toBe('application');
    (document.activeElement as HTMLElement).blur();
    await stable();
    expect(viewport.getAttribute('role')).toBe('group');
  });

  it('moves between features in reading order with one tab stop, and selects with Enter', async () => {
    const { root, host, feature, stable } = await setup();
    const tabbable = () =>
      [...root.querySelectorAll('[data-map-key]')].filter(
        (e) => e.getAttribute('tabindex') === '0',
      );
    expect(tabbable().length).toBe(1);
    // Reading order: rows from the top (north first), each row from the left.
    const order: string[] = [];
    let current = tabbable()[0] as HTMLElement;
    current.focus();
    for (let i = 0; i < 7; i++) {
      order.push(current.getAttribute('aria-label')!);
      key(current, 'ArrowRight');
      await stable();
      current = document.activeElement as HTMLElement;
    }
    expect(order[0]).toBe('North: 10');
    expect(new Set(order).size).toBe(7);
    expect(order.indexOf('West')).toBeLessThan(order.indexOf('Port'));

    feature('East').focus();
    key(feature('East'), 'Enter');
    await stable();
    expect(host.selection()).toEqual(['regions:east']);
    expect(feature('East').getAttribute('aria-pressed')).toBe('true');
    expect(host.shapes.at(-1)?.feature).toMatchObject({
      key: 'regions:east',
      label: 'East',
      value: 50,
    });
    key(feature('East'), ' ');
    await stable();
    expect(host.selection()).toEqual([]);
    // A marker reports a click but has no selection state.
    const port = root.querySelector<HTMLElement>('.star-map__marker[aria-label="Port"]')!;
    port.click();
    await stable();
    expect(host.markers.at(-1)?.feature.key).toBe('cities:0');
    expect(port.getAttribute('aria-pressed')).toBeNull();
  });

  it('keys shapes by layer, so two layers with the same GeoJSON ids stay apart', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { root, host, stable } = await setup((h) =>
      h.layers.set([
        { type: 'shape', id: 'a', data: REGIONS, label: () => 'Region A' },
        { type: 'shape', id: 'b', data: REGIONS, label: () => 'Region B' },
      ]),
    );
    const keys = [...root.querySelectorAll('[data-map-key]')].map((e) =>
      e.getAttribute('data-map-key'),
    );
    expect(keys).toHaveLength(6);
    expect(new Set(keys).size).toBe(6);
    expect(keys).toContain('a:north');
    expect(keys).toContain('b:north');
    const bNorth = root.querySelector<HTMLElement>('[data-map-key="b:north"]')!;
    bNorth.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await stable();
    expect(host.selection()).toEqual(['b:north']);
    expect(root.querySelector('[data-map-key="a:north"]')!.getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(bNorth.getAttribute('aria-pressed')).toBe('true');
    // The arrow keys visit all six features once: the focus does not stick to the first layer.
    let current = root.querySelector<HTMLElement>('[data-map-key][tabindex="0"]')!;
    current.focus();
    key(current, 'Home');
    await stable();
    current = document.activeElement as HTMLElement;
    const visited: string[] = [];
    for (let i = 0; i < 6; i++) {
      visited.push(current.getAttribute('data-map-key')!);
      key(current, 'ArrowRight');
      await stable();
      current = document.activeElement as HTMLElement;
    }
    expect(new Set(visited).size).toBe(6);
    const all = [...errors.mock.calls, ...warns.mock.calls].map((call) => String(call[0]));
    expect(all.filter((message) => message.includes('NG0955'))).toEqual([]);
  });

  it('selects several shapes with selectionMode="multiple" and none with "none"', async () => {
    const { host, feature, stable } = await setup((h) => h.mode.set('multiple'));
    feature('North').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    feature('East').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await stable();
    expect(host.selection()).toEqual(['regions:north', 'regions:east']);
    host.mode.set('none');
    await stable();
    expect(feature('North').getAttribute('aria-pressed')).toBeNull();
  });

  it('zooms with the keys and the buttons, announces it and pans with Shift and arrows', async () => {
    const { root, host, map, feature, stable, announce } = await setup();
    const fitted = map.view();
    expect(host.zoom()).toBeNull();
    feature('North').focus();
    key(feature('North'), '+');
    await stable();
    expect(host.zoom()).toBeCloseTo(fitted.zoom + 1, 3);
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Zoom level /));
    const before = host.center()!;
    key(feature('North'), 'ArrowRight', { shiftKey: true });
    await stable();
    expect(host.center()![0]).toBeGreaterThan(before[0]);
    expect(host.center()![1]).toBeCloseTo(before[1], 6);
    const zoomOut = root.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]')!;
    zoomOut.click();
    await stable();
    expect(host.zoom()).toBeCloseTo(fitted.zoom, 3);
    root.querySelector<HTMLButtonElement>('button[aria-label="Reset view"]')!.click();
    await stable();
    expect(host.zoom()).toBeNull();
    expect(host.center()).toBeNull();
    // The zoom stops at maxZoom.
    host.zoom.set(10);
    await stable();
    expect(root.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!.disabled).toBe(
      true,
    );
  });

  it('pans with a drag, zooms with Control and the wheel, and keeps the click after a drag', async () => {
    const { root, host, map, feature, stable } = await setup();
    const viewport = root.querySelector('.star-map__viewport')!;
    const start = map.view();
    pointer(feature('North'), 'pointerdown', 100, 100);
    pointer(viewport, 'pointermove', 140, 100);
    pointer(viewport, 'pointerup', 140, 100);
    feature('North').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await stable();
    // The drag moved the map 40 pixels to the right: the centre moved west.
    expect(map.view().center[0]).toBeCloseTo(start.center[0] - 40 / 2 ** start.zoom, 6);
    // The click that ends a drag does not select.
    expect(host.selection()).toEqual([]);

    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
      ctrlKey: true,
      clientX: 400,
      clientY: 225,
    });
    viewport.dispatchEvent(wheel);
    await stable();
    expect(wheel.defaultPrevented).toBe(true);
    expect(host.zoom()).toBeCloseTo(start.zoom + 1, 3);
    const plain = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 });
    viewport.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
  });

  it('uses bold icons in the bar (the weight that apps load)', async () => {
    const { root } = await setup();
    const icons = [...root.querySelectorAll('.star-map__bar i')];
    expect(icons.length).toBe(4);
    expect(icons.every((icon) => icon.classList.contains('ph-bold'))).toBe(true);
  });

  it('has a data table of every feature, shown with the table button', async () => {
    const { root, stable } = await setup();
    const table = root.querySelector('table')!;
    expect(table.classList).toContain('star-sr-only');
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.children].map((cell) => cell.textContent?.trim()),
    );
    expect(rows).toContainEqual(['North', 'Sales', '10']);
    expect(rows).toContainEqual(['West', 'Sales', 'No data']);
    expect(rows).toContainEqual(['Port', 'Cities', 'No data']);
    expect(rows).toContainEqual(['Hill people', 'people', '400']);
    const toggle = [...root.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Table'),
    )!;
    toggle.click();
    await stable();
    expect(table.classList).not.toContain('star-sr-only');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent?.trim()).toBe('Map');
  });

  it('renders the marker and tooltip slots', async () => {
    const { root, feature, stable } = await setup((h) => h.slots.set(true));
    expect(root.querySelector('.custom-marker')?.textContent).toBe('Port');
    feature('North').focus();
    await stable();
    const tip = root.querySelector('.star-map__tooltip')!;
    expect(tip.getAttribute('aria-hidden')).toBe('true');
    expect(tip.textContent?.trim()).toBe('Tip North');
  });

  it('draws tiles only for the visible range, with the attribution, and warns without one', async () => {
    const tile: StarMapLayer = {
      type: 'tile',
      id: 'base',
      urlTemplate: 'https://tiles.example/{z}/{x}/{y}.png',
      attribution: '© Example tiles',
    };
    const { root, host, stable } = await setup((h) => h.layers.set([tile, ...LAYERS]));
    const images = [...root.querySelectorAll('.star-map__tiles image')];
    expect(images.length).toBeGreaterThan(0);
    expect(images.length).toBeLessThan(40);
    expect(images[0].getAttribute('href')).toMatch(
      /^https:\/\/tiles\.example\/\d+\/\d+\/\d+\.png$/,
    );
    expect(root.querySelector('.star-map__attribution')?.textContent?.trim()).toBe(
      '© Example tiles',
    );

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    host.layers.set([{ ...tile, attribution: '' }, ...LAYERS]);
    await stable();
    expect(root.querySelectorAll('.star-map__tiles image').length).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('attribution'));
    warn.mockRestore();
  });

  it('shows the panning state only during a drag (review M10)', async () => {
    const { root, feature, stable } = await setup();
    const viewport = root.querySelector('.star-map__viewport')!;
    pointer(feature('North'), 'pointerdown', 100, 100);
    pointer(viewport, 'pointermove', 160, 100);
    await stable();
    expect(viewport.classList).toContain('star-map__viewport--panning');
    pointer(viewport, 'pointerup', 160, 100);
    await stable();
    expect(viewport.classList).not.toContain('star-map__viewport--panning');
  });

  it('zooms the same with a wheel in line mode as in pixel mode (review M14)', async () => {
    const { root, host, map, stable } = await setup();
    const start = map.view().zoom;
    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -3,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
      ctrlKey: true,
      clientX: 400,
      clientY: 225,
    });
    root.querySelector('.star-map__viewport')!.dispatchEvent(wheel);
    await stable();
    // 3 lines are 48 pixels: 0.48 zoom levels.
    expect(host.zoom()).toBeCloseTo(start + 0.48, 3);
  });

  it('pans with the plain arrow keys when the map has no features (review M17)', async () => {
    const { root, host, stable } = await setup((h) => h.layers.set([]));
    const viewport = root.querySelector<HTMLElement>('.star-map__viewport')!;
    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(
      root.querySelector(`#${viewport.getAttribute('aria-describedby')}`)?.textContent,
    ).toContain('Without features, the arrow keys pan');
    viewport.focus();
    key(viewport, 'ArrowRight');
    await stable();
    expect(host.center()![0]).toBeGreaterThan(0);
    key(viewport, 'ArrowDown');
    await stable();
    expect(host.center()![1]).toBeLessThan(0);
  });

  it('stops a zoom animation when the user pans (review M16)', async () => {
    const view = document.defaultView!;
    const realMatchMedia = view.matchMedia;
    view.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
    })) as typeof view.matchMedia;
    onTestFinished(() => {
      view.matchMedia = realMatchMedia;
    });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(view, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(view, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const { root, host, map, feature, stable } = await setup(() => undefined, true);
    const fitted = map.view().zoom;
    root.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!.click();
    const run = (time: number) => frames.splice(0).forEach((callback) => callback(time));
    run(1000);
    run(1100);
    feature('North').focus();
    key(feature('North'), 'ArrowRight', { shiftKey: true });
    await stable();
    const panned = host.zoom()!;
    expect(panned).toBeGreaterThan(fitted);
    expect(panned).toBeLessThan(fitted + 1);
    run(2000);
    await stable();
    // The animation did not finish over the pan.
    expect(host.zoom()).toBe(panned);
    vi.restoreAllMocks();
  });

  it('animates a button zoom only when motion is allowed', async () => {
    // CI browsers report reduced motion: stub the system setting to "no preference".
    const view = document.defaultView!;
    const realMatchMedia = view.matchMedia;
    view.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
    })) as typeof view.matchMedia;
    onTestFinished(() => {
      view.matchMedia = realMatchMedia;
    });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(view, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const { root, host, map, stable } = await setup(() => undefined, true);
    expect(document.documentElement.hasAttribute('data-star-motion')).toBe(false);
    const fitted = map.view().zoom;
    root.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!.click();
    expect(host.zoom()).toBeNull();
    // The first frame starts the clock; 100 ms later the animation is half way.
    // Angular may queue frames too: each step runs every queued callback.
    const run = (time: number) => frames.splice(0).forEach((callback) => callback(time));
    run(1000);
    run(1100);

    // Half way in time, the eased zoom is past the middle.
    expect(map.view().zoom).toBeGreaterThan(fitted + 0.5);
    expect(map.view().zoom).toBeLessThan(fitted + 1);
    run(2000);
    await stable();
    expect(host.zoom()).toBeCloseTo(fitted + 1, 3);
    vi.restoreAllMocks();
  });

  it('renders on the server without tiles', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.layers.set([
      {
        type: 'tile',
        id: 'base',
        urlTemplate: 'https://t.example/{z}/{x}/{y}.png',
        attribution: 'T',
      },
      ...LAYERS,
    ]);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('path.star-map__shape').length).toBe(3);
    expect(root.querySelectorAll('.star-map__tiles image').length).toBe(0);
    expect(root.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 800 450');
  });
});
