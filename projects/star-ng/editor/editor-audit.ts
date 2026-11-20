/**
 * The accessibility check of `star-editor`, after the accessibility inspector of Aurora RTE (MIT,
 * same owner, https://github.com/ramanacr/aurora-rte, `accessibility-inspector.ts`): images
 * without alternative text, links without text, skipped heading levels, tables without header
 * cells and custom text colors with low contrast. Each problem has a fix where one is safe.
 */
import { starEditorUnwrap } from './editor-dom';
import { starEditorToggleHeaderRow } from './editor-table';

export type StarEditorIssueKind = 'alt' | 'emptyLink' | 'heading' | 'tableHeader' | 'contrast';

export interface StarEditorIssue {
  readonly kind: StarEditorIssueKind;
  readonly element: HTMLElement;
  /** For `heading`: the level before and the level of the heading. For `contrast`: the ratio. */
  readonly detail: readonly number[];
  /** Repairs the problem in the DOM. */
  readonly fix: () => void;
}

/** Relative luminance of `rgb(…)` or `#rrggbb`, or `null` for another form. */
function luminance(color: string): number | null {
  let channels: number[] | null = null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const full = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    channels = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i.exec(color.trim());
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return null;
    channels = [rgb[1], rgb[2], rgb[3]].map(Number);
  }
  if (!channels) return null;
  const [r, g, b] = channels.map((value) => {
    const share = value / 255;
    return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two colors, or `null` when one cannot be read. */
export function starEditorContrast(text: string, background: string): number | null {
  const a = luminance(text);
  const b = luminance(background);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The background color behind `element`: the nearest one that is not transparent. */
function backgroundOf(element: Element, view: Window | null): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const color = view?.getComputedStyle(node).backgroundColor ?? '';
    if (color && luminance(color) !== null) return color;
  }
  return 'rgb(255, 255, 255)';
}

/** The problems in `area`, in reading order. */
export function starEditorAudit(area: HTMLElement): StarEditorIssue[] {
  const issues: StarEditorIssue[] = [];
  const view = area.ownerDocument.defaultView;
  let level = 0;
  for (const element of area.querySelectorAll<HTMLElement>(
    'img, a, h1, h2, h3, h4, h5, h6, table, [style*="color"]',
  )) {
    const tag = element.tagName;
    if (tag === 'IMG' && !element.hasAttribute('alt')) {
      issues.push({ kind: 'alt', element, detail: [], fix: () => element.setAttribute('alt', '') });
    } else if (
      tag === 'A' &&
      !element.textContent?.trim() &&
      !element.querySelector('img[alt]:not([alt=""])')
    ) {
      issues.push({ kind: 'emptyLink', element, detail: [], fix: () => starEditorUnwrap(element) });
    } else if (/^H[1-6]$/.test(tag)) {
      const current = Number(tag[1]);
      // The content usually sits under the heading 1 of the page: it may start at heading 2.
      if (current > Math.max(level, 1) + 1) {
        const right = Math.max(level, 1) + 1;
        issues.push({
          kind: 'heading',
          element,
          detail: [level, current],
          fix: () => {
            const heading = element.ownerDocument.createElement(`h${right}`);
            for (const attribute of [...element.attributes])
              heading.setAttribute(attribute.name, attribute.value);
            while (element.firstChild) heading.appendChild(element.firstChild);
            element.replaceWith(heading);
          },
        });
      }
      level = current;
    } else if (tag === 'TABLE' && !element.querySelector('th')) {
      issues.push({
        kind: 'tableHeader',
        element,
        detail: [],
        fix: () => starEditorToggleHeaderRow(element as HTMLTableElement),
      });
    }
    const color = element.style?.getPropertyValue('color');
    if (color) {
      const shown = view?.getComputedStyle(element).color || color;
      const ratio = starEditorContrast(shown, backgroundOf(element, view));
      if (ratio !== null && ratio < 4.5)
        issues.push({
          kind: 'contrast',
          element,
          detail: [Math.round(ratio * 10) / 10],
          fix: () => {
            element.style.removeProperty('color');
            if (!element.getAttribute('style')) element.removeAttribute('style');
            if (element.tagName === 'SPAN' && !element.attributes.length) starEditorUnwrap(element);
          },
        });
    }
  }
  return issues;
}
