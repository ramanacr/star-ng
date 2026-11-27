// Edge refraction of the glass layers: one hidden SVG with two displacement filters (left to
// right and right to left), which the theme CSS references with `backdrop-filter: url(#…)`.
// Only Chromium renders an SVG filter in `backdrop-filter`; other browsers keep the plain glass.
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  EnvironmentProviders,
  inject,
  PLATFORM_ID,
  provideEnvironmentInitializer,
} from '@angular/core';
import { REFRACTION_ATTRIBUTE, REFRACTION_FILTER_ID } from './theme-factory';
/** Id of the `<svg>` that holds both filters. */
const REFRACTION_SVG_ID = 'star-glass-refraction-defs';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The displacement map, in fractions of the layer box (`primitiveUnits="objectBoundingBox"`), so
 * the map scales with the box: a neutral middle (no displacement, where the text is) and a band
 * along each edge that samples the backdrop from further inside, like the rim of a lens. The band
 * on the start side and on the top is wider: the light comes from there, as the edge highlight
 * (`--star-glass-angle`). Right to left mirrors the start and end bands.
 */
const MAP = {
  /** Width of the start and end bands (x) and of the top and bottom bands (y). */
  x: { start: 0.08, end: 0.05, blur: 0.02 },
  y: { start: 0.22, end: 0.14, blur: 0.05 },
  /** Largest shift: half of this, in fractions of the box width and height. */
  scale: 0.16,
  /** The filter region reaches past the box so the blur of the map ends outside it. */
  margin: 0.1,
} as const;

type Attrs = Readonly<Record<string, string | number>>;

function svgElement(doc: Document, name: string, attrs: Attrs): SVGElement {
  const element = doc.createElementNS(SVG_NS, name) as SVGElement;
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
}

/**
 * One axis of the map: a neutral flood (0.5 in the channel), a band at the low edge that pushes
 * the sampling point up the axis (1) and one at the high edge that pushes it down (0), blurred
 * along the axis into ramps.
 */
function axis(
  doc: Document,
  filter: SVGElement,
  name: 'x' | 'y',
  low: number,
  high: number,
  blur: number,
): void {
  const m = MAP.margin;
  const full = 1 + 2 * m;
  const color = (value: number) => (name === 'x' ? `rgb(${value}, 0, 0)` : `rgb(0, ${value}, 0)`);
  const band = (from: number, size: number) =>
    name === 'x'
      ? { x: from, y: -m, width: size, height: full }
      : { x: -m, y: from, width: full, height: size };
  filter.append(
    svgElement(doc, 'feFlood', { 'flood-color': color(128), result: `${name}-base` }),
    svgElement(doc, 'feFlood', {
      ...band(-m, m + low),
      'flood-color': color(255),
      result: `${name}-low`,
    }),
    svgElement(doc, 'feFlood', {
      ...band(1 - high, m + high),
      'flood-color': color(0),
      result: `${name}-high`,
    }),
  );
  const merge = svgElement(doc, 'feMerge', { result: `${name}-bands` });
  for (const input of ['base', 'low', 'high']) {
    merge.append(svgElement(doc, 'feMergeNode', { in: `${name}-${input}` }));
  }
  filter.append(
    merge,
    svgElement(doc, 'feGaussianBlur', {
      in: `${name}-bands`,
      stdDeviation: name === 'x' ? `${blur} 0` : `0 ${blur}`,
      result: name,
    }),
  );
}

function refractionFilter(doc: Document, rtl: boolean): SVGElement {
  const m = MAP.margin;
  const filter = svgElement(doc, 'filter', {
    id: rtl ? `${REFRACTION_FILTER_ID}-rtl` : REFRACTION_FILTER_ID,
    x: -m,
    y: -m,
    width: 1 + 2 * m,
    height: 1 + 2 * m,
    filterUnits: 'objectBoundingBox',
    primitiveUnits: 'objectBoundingBox',
    'color-interpolation-filters': 'sRGB',
  });
  // In right to left the wide band is on the right: the start side.
  const [left, right] = rtl ? [MAP.x.end, MAP.x.start] : [MAP.x.start, MAP.x.end];
  axis(doc, filter, 'x', left, right, MAP.x.blur);
  axis(doc, filter, 'y', MAP.y.start, MAP.y.end, MAP.y.blur);
  filter.append(
    // Red from the x map, green from the y map.
    svgElement(doc, 'feComposite', {
      in: 'x',
      in2: 'y',
      operator: 'arithmetic',
      k2: 1,
      k3: 1,
      result: 'map',
    }),
    svgElement(doc, 'feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'map',
      scale: MAP.scale,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
    }),
  );
  return filter;
}

/**
 * Whether the browser renders an SVG filter in `backdrop-filter`: Chromium does. Firefox and
 * Safari do not, and a `backdrop-filter` value that a browser cannot use may cost the blur too, so
 * they never get the value: the theme CSS uses it only under `data-star-refraction`. The engine
 * comes from `navigator.userAgentData` (only Chromium has it, in a secure context), with a check
 * that the value parses.
 */
export function refractionRenders(doc: Document): boolean {
  const view = doc.defaultView;
  const data = (view?.navigator as { userAgentData?: { brands?: { brand: string }[] } } | undefined)
    ?.userAgentData;
  const chromium = !!data?.brands?.some((entry) => entry.brand === 'Chromium');
  return chromium && !!view?.CSS?.supports('backdrop-filter', `url(#a) blur(1px)`);
}

/**
 * Puts the hidden SVG with the refraction filters at the end of `<body>`, once, and marks `<html>`
 * with `data-star-refraction` when the browser renders the filter. A second call does nothing.
 * No inline script and no `style` attribute: the SVG is moved out of the flow through the CSSOM,
 * which a Content Security Policy allows.
 */
export function insertRefraction(doc: Document, renders = refractionRenders(doc)): void {
  if (!doc.getElementById(REFRACTION_SVG_ID) && doc.body) {
    const svg = svgElement(doc, 'svg', {
      id: REFRACTION_SVG_ID,
      width: 0,
      height: 0,
      'aria-hidden': 'true',
      focusable: 'false',
    });
    // Out of the flow and out of sight. It stays in a rendered subtree: Chromium does not apply
    // a filter from an SVG that is not rendered (for example one in `<head>`).
    svg.style.position = 'absolute';
    svg.style.overflow = 'hidden';
    svg.style.pointerEvents = 'none';
    svg.append(refractionFilter(doc, false), refractionFilter(doc, true));
    doc.body.append(svg);
  }
  if (renders) doc.documentElement.setAttribute(REFRACTION_ATTRIBUTE, '');
}

/**
 * Turns on the edge refraction of the glass layers of a theme made with `refraction: true` (the
 * glass theme is): the dock and the toasts bend the backdrop along their edges. Chromium only;
 * other browsers keep the plain glass. In the browser it puts one hidden SVG with the filters
 * into the document and sets `data-star-refraction` on `<html>`; on the server it does nothing.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideStarGlassRefraction()] });
 * ```
 */
export function provideStarGlassRefraction(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    insertRefraction(inject(DOCUMENT));
  });
}
