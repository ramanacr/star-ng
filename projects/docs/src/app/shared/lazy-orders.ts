import { linkedSignal, resource, signal } from '@angular/core';
import { StarLazyLoadEvent, starFilterMatch } from '@star-ng/ui/core';

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
  request: StarLazyLoadEvent,
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

/**
 * State of a lazy list (call it in a field initializer): `options` for the control, `load` for its
 * `lazyLoad` output. An Angular `resource()` loads each page. The options array has the full length,
 * with `undefined` where a page is not loaded yet.
 */
export function lazyOrders() {
  const request = signal<StarLazyLoadEvent | undefined>(undefined);
  const page = resource({
    params: request,
    loader: ({ params, abortSignal }) => fetchOrderPage(params, abortSignal),
  });
  const options = linkedSignal<LazyOrderPage | undefined, readonly (LazyOrder | undefined)[]>({
    source: () => (page.hasValue() ? page.value() : undefined),
    computation: (next, previous) => {
      if (!next) return previous?.value ?? [];
      // Same filter and length: keep the loaded pages. A new filter starts a new array.
      const keep = previous?.source?.filter === next.filter && previous.value.length === next.total;
      const rows = keep
        ? [...previous.value]
        : Array.from<LazyOrder | undefined>({ length: next.total });
      next.rows.forEach((row, i) => (rows[next.first + i] = row));
      return rows;
    },
  });
  return {
    options: options.asReadonly(),
    load: (event: StarLazyLoadEvent) => request.set(event),
  };
}
