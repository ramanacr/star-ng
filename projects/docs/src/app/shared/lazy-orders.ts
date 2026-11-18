import { computed, linkedSignal, resource, signal } from '@angular/core';
import { StarListLazyLoadEvent, starFilterMatch } from '@star-ng/ui/core';

/** An order of the lazy examples. */
export interface LazyOrder {
  readonly id: number;
  readonly name: string;
}

/** One page of the fake order service. */
export interface LazyOrderPage {
  readonly first: number;
  readonly rows: readonly LazyOrder[];
  readonly total: number;
  readonly filter: string;
}

const ORDERS: readonly LazyOrder[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  name: `Order ${String(i + 1).padStart(5, '0')}`,
}));

/** A fake order service: no network, a short delay, server-side filter and paging. */
export async function fetchOrderPage(
  request: StarListLazyLoadEvent,
  abortSignal?: AbortSignal,
): Promise<LazyOrderPage> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 400);
    abortSignal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(abortSignal.reason);
    });
  });
  const matches = ORDERS.filter((order) => starFilterMatch(order.name, request.filter));
  return {
    first: request.first,
    rows: matches.slice(request.first, request.last + 1),
    total: matches.length,
    filter: request.filter,
  };
}

/** What the list knows for one filter text: the total and the loaded orders by index. */
export interface LazyOrderState {
  readonly filter: string;
  readonly total: number;
  readonly rows: ReadonlyMap<number, LazyOrder>;
}

/**
 * State of a lazy list (call it in a field initializer): `options` for the control, `load` for its
 * `lazyLoad` output. The control asks for each range once, so no request may get lost: the requests
 * of one filter text collect in a list, and an Angular `resource()` loads the ranges of that list
 * that are not in the cache yet. A new request restarts the resource (the old load is aborted), and
 * the new load fetches what is still missing. The options array has the full length, with
 * `undefined` where an order is not loaded yet. When a load fails, `failed` is true: the page shows
 * a Retry button that calls `resetLazy()` of the control, which asks again for the rows in view.
 */
export function lazyOrders() {
  const requests = signal<readonly StarListLazyLoadEvent[]>([]);
  const cache = new Map<number, LazyOrder>();
  let cacheFilter: string | null = null;
  let total = 0;
  /** True when every order of the range is in the cache (or the range is past the end). */
  const loaded = (r: StarListLazyLoadEvent) => {
    if (!total) return false;
    for (let i = r.first; i <= Math.min(r.last, total - 1); i++) if (!cache.has(i)) return false;
    return true;
  };
  const state = resource({
    params: () => (requests().length ? requests() : undefined),
    loader: async ({ params, abortSignal }): Promise<LazyOrderState> => {
      const filter = params[0].filter;
      if (filter !== cacheFilter) {
        cache.clear();
        cacheFilter = filter;
        total = 0;
      }
      const pages = await Promise.all(
        params.filter((r) => !loaded(r)).map((r) => fetchOrderPage(r, abortSignal)),
      );
      for (const page of pages) {
        total = page.total;
        page.rows.forEach((row, i) => cache.set(page.first + i, row));
      }
      return { filter, total, rows: new Map(cache) };
    },
  });
  const options = linkedSignal<LazyOrderState | undefined, readonly (LazyOrder | undefined)[]>({
    source: () => (state.hasValue() ? state.value() : undefined),
    computation: (next, previous) =>
      next
        ? Array.from({ length: next.total }, (_, i) => next.rows.get(i))
        : (previous?.value ?? []),
  });
  return {
    options: options.asReadonly(),
    /** True when the last load failed: call `resetLazy()` of the control to ask again. */
    failed: computed(() => state.status() === 'error'),
    load: (event: StarListLazyLoadEvent) =>
      requests.update((list) =>
        list.length && list[0].filter === event.filter ? [...list, event] : [event],
      ),
  };
}
