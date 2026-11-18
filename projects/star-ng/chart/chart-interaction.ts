import { Directive, inject, TemplateRef } from '@angular/core';

/** One data point, as `pointSelect` and the tooltip template see it. */
export interface StarChartPointInfo {
  /** Position of the series in `series` (hidden series keep their place). */
  readonly seriesIndex: number;
  /** Position of the point in its series (the category, or the scatter point). */
  readonly index: number;
  /** The value (the y value for scatter). */
  readonly value: number;
  /** Name of the series. */
  readonly series: string;
  /** Name of the category; for scatter the formatted x value. */
  readonly label: string;
}

/** Event of `pointSelect`: a click on a data point, or Enter or Space on a focused one. */
export interface StarChartPointSelectEvent {
  readonly seriesIndex: number;
  readonly index: number;
  readonly value: number;
}

/** A focus target over a data point, placed in percent of the plot. */
export interface StarChartPointTarget extends StarChartPointInfo {
  readonly left: number;
  readonly top: number;
  /** The hover index that shows the tooltip of this point. */
  readonly hover: number;
  /** Accessible name: series, category and value. */
  readonly name: string;
}

/** Rows of focus targets: one row per drawn series, in drawing order. */
export type StarChartPointRows = readonly (readonly StarChartPointTarget[])[];

/** Position of the focused point in the rows. */
export interface StarChartPointCursor {
  readonly row: number;
  readonly col: number;
}

/** The cursor moved inside `rows`, so it always points at a target (or row 0, col 0). */
export function starChartClampCursor(
  rows: StarChartPointRows,
  cursor: StarChartPointCursor,
): StarChartPointCursor {
  if (!rows.length) return { row: 0, col: 0 };
  const row = Math.min(Math.max(cursor.row, 0), rows.length - 1);
  const col = Math.min(Math.max(cursor.col, 0), Math.max(0, rows[row].length - 1));
  return { row, col };
}

/**
 * The cursor after a key: Arrow Right and Arrow Left move along the series, Arrow Down and
 * Arrow Up to the next and the previous series (same position, or its last point), Home and End
 * to the ends of the series. `null` for any other key. The plot keeps its left-to-right geometry
 * in right-to-left, so the arrows are not mirrored.
 */
export function starChartMoveCursor(
  rows: StarChartPointRows,
  cursor: StarChartPointCursor,
  key: string,
): StarChartPointCursor | null {
  const { row, col } = starChartClampCursor(rows, cursor);
  const length = rows[row]?.length ?? 0;
  switch (key) {
    case 'ArrowRight':
      return { row, col: Math.min(col + 1, Math.max(0, length - 1)) };
    case 'ArrowLeft':
      return { row, col: Math.max(col - 1, 0) };
    case 'Home':
      return { row, col: 0 };
    case 'End':
      return { row, col: Math.max(0, length - 1) };
    case 'ArrowDown':
      return starChartClampCursor(rows, { row: Math.min(row + 1, rows.length - 1), col });
    case 'ArrowUp':
      return starChartClampCursor(rows, { row: Math.max(row - 1, 0), col });
    default:
      return null;
  }
}

/** Context of the `starChartTooltip` template. */
export interface StarChartTooltipContext {
  /** The points that the tooltip is about (`let-points`): one, or all series of a category. */
  readonly $implicit: readonly StarChartPointInfo[];
  readonly points: readonly StarChartPointInfo[];
  /** Title of the tooltip: the category, or the series for scatter. */
  readonly label: string;
}

/**
 * Content of the chart tooltip: `<ng-template starChartTooltip let-points let-label="label">`.
 * It shows on hover and on keyboard focus of a data point. PrimeNG / Chart.js
 * `plugins.tooltip.callbacks`.
 */
@Directive({ selector: 'ng-template[starChartTooltip]' })
export class StarChartTooltip {
  readonly template = inject<TemplateRef<StarChartTooltipContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: StarChartTooltip,
    _ctx: unknown,
  ): _ctx is StarChartTooltipContext {
    return true;
  }
}
