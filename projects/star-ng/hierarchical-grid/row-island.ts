import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  input,
} from '@angular/core';
import type { StarOptionKey } from '@star-ng/ui/core';
import type { StarColumn } from '@star-ng/ui/table';
import type { Observable } from 'rxjs';

/** The child rows of a parent row: an array, a promise or an observable (first value). */
export type StarRowIslandLoader<P = unknown, C = unknown> = (
  parent: P,
) => readonly C[] | Promise<readonly C[]> | Observable<readonly C[]>;

/**
 * One level of the layout of `star-hierarchical-grid` (Ignite UI `igx-row-island`, Kendo UI
 * detail template with a child grid, AG Grid `detailCellRendererParams`, DevExtreme
 * `masterDetail`). Each expanded parent row shows one child `star-table` per island, configured
 * from the island: its columns (sorting, filtering and editing come from the `StarColumn`
 * settings), paging and selection. Islands nest: a `star-row-island` inside another one is the
 * next level.
 *
 * ```html
 * <star-hierarchical-grid [data]="customers" [columns]="customerColumns" dataKey="id">
 *   <star-row-island key="orders" label="Orders" [columns]="orderColumns" dataKey="id">
 *     <star-row-island label="Order lines" [childData]="loadLines" [columns]="lineColumns" />
 *   </star-row-island>
 * </star-hierarchical-grid>
 * ```
 *
 * It is a layout element: it renders nothing, the grid reads its settings.
 */
@Component({
  selector: 'star-row-island',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { hidden: '' },
  template: '',
})
export class StarRowIsland<C = unknown> {
  /** The field of the parent row that holds the child rows. */
  readonly key = input<string | null>(null);
  /** Loads the child rows of a parent row (instead of `key`): an array, a promise or an observable. */
  readonly childData = input<StarRowIslandLoader<never, C> | null>(null);
  readonly columns = input.required<readonly StarColumn<C>[]>();
  /** Row key of the child rows (default: the row object). */
  readonly dataKey = input<StarOptionKey<C> | null>(null);
  /** Name of the child grids, for example "Orders" ("Orders of Example Ltd."). */
  readonly label = input('');
  /** Text of a parent row in the child grid name (default: the key of the row). */
  readonly rowLabel = input<((row: C) => string) | null>(null);
  readonly paginator = input(false, { transform: booleanAttribute });
  /** Rows per page with `paginator`. */
  readonly rows = input(5);
  readonly selectionMode = input<'single' | 'multiple' | 'cell' | 'range' | null>(null);
  readonly editMode = input<'cell' | 'row'>('cell');
  readonly filterDisplay = input<'row' | 'menu'>('row');
  /** The islands of the next level. */
  readonly islands = contentChildren(StarRowIsland, { descendants: false });
}
