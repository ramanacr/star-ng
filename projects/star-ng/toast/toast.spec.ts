import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarToast, StarToastCloseEvent, StarToastService } from './toast';

@Component({
  imports: [StarToast],
  template: `
    <star-toast
      class="orders"
      key="orders"
      [preventDuplicates]="history()"
      [preventOpenDuplicates]="open()"
      [breakpoints]="breakpoints"
      (closed)="events.push($event)"
    />
    <star-toast class="other" key="other" (closed)="otherEvents.push($event)" />
  `,
})
class Host {
  readonly history = signal(false);
  readonly open = signal(false);
  readonly breakpoints = { '640px': { 'inset-block-end': '4rem' } };
  readonly events: StarToastCloseEvent[] = [];
  readonly otherEvents: StarToastCloseEvent[] = [];
}

describe('star-toast duplicates, breakpoints and closed', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    const toasts = TestBed.inject(StarToastService);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, toasts, host: fixture.componentInstance, el };
  }

  const resize = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    window.dispatchEvent(new Event('resize'));
  };
  const initialWidth = window.innerWidth;

  afterEach(() => {
    const toasts = TestBed.inject(StarToastService);
    toasts.preventDuplicates = true;
    toasts.clear();
    resize(initialWidth);
    vi.useRealTimers();
  });

  it('preventOpenDuplicates keeps one visible copy when the service allows copies', async () => {
    const { fixture, toasts, host } = await setup();
    toasts.preventDuplicates = false;
    toasts.show({ summary: 'Saved', key: 'orders' });
    toasts.show({ summary: 'Saved', key: 'orders' });
    expect(toasts.messages().length).toBe(2);
    toasts.clear();

    host.open.set(true);
    await fixture.whenStable();
    const first = toasts.show({ summary: 'Saved', key: 'orders' });
    expect(toasts.show({ summary: 'Saved', key: 'orders' })).toBe(first);
    // Another severity or detail is another message.
    toasts.show({ summary: 'Saved', key: 'orders', severity: 'success' });
    toasts.show({ summary: 'Saved', detail: 'ORD-1042', key: 'orders' });
    // The rule belongs to the outlet of the key.
    toasts.show({ summary: 'Saved', key: 'other' });
    toasts.show({ summary: 'Saved', key: 'other' });
    expect(toasts.messages().filter((m) => m.key === 'orders').length).toBe(3);
    expect(toasts.messages().filter((m) => m.key === 'other').length).toBe(2);
  });

  it('preventDuplicates ignores a message that the outlet showed before, also after it closed', async () => {
    const { fixture, toasts, host } = await setup();
    host.history.set(true);
    await fixture.whenStable();
    const id = toasts.show({ severity: 'warn', summary: 'Stock is low', key: 'orders' });
    toasts.remove(id);
    expect(toasts.show({ severity: 'warn', summary: 'Stock is low', key: 'orders' })).toBe(0);
    expect(toasts.messages()).toEqual([]);
    expect(
      toasts.show({ severity: 'warn', summary: 'Stock is low', detail: 'INV-2041', key: 'orders' }),
    ).toBeGreaterThan(0);
  });

  it('emits closed with the reason timeout, close or clear, for its own key only', async () => {
    const { toasts, host, el } = await setup();
    vi.useFakeTimers();
    const seen: string[] = [];
    const subscription = toasts.closed.subscribe((event) => seen.push(event.reason));

    toasts.show({ summary: 'Timed', life: 1000, key: 'orders' });
    vi.advanceTimersByTime(1000);

    toasts.show({ summary: 'Closed by hand', sticky: true, key: 'orders' });
    TestBed.tick();
    el.querySelector<HTMLButtonElement>('.orders .star-toast__close')!.click();

    toasts.show({ summary: 'Cleared', sticky: true, key: 'orders' });
    toasts.show({ summary: 'Elsewhere', sticky: true, key: 'other' });
    toasts.clear('orders');

    expect(host.events.map((event) => [event.message.summary, event.reason])).toEqual([
      ['Timed', 'timeout'],
      ['Closed by hand', 'close'],
      ['Cleared', 'clear'],
    ]);
    expect(host.otherEvents).toEqual([]);
    toasts.clear();
    expect(host.otherEvents.map((event) => event.reason)).toEqual(['clear']);
    expect(seen).toEqual(['timeout', 'close', 'clear', 'clear']);
    subscription.unsubscribe();
  });

  it('goes full width at the bottom on a window below a breakpoint', async () => {
    resize(1200);
    const { fixture, el } = await setup();
    const stack = el.querySelector<HTMLElement>('.orders')!;
    expect(stack.classList).not.toContain('star-toast-stack--narrow');
    resize(600);
    await fixture.whenStable();
    expect(stack.classList).toContain('star-toast-stack--narrow');
    expect(stack.classList).toContain('star-toast-stack--top-right');
    expect(stack.style.getPropertyValue('inset-block-end')).toBe('4rem');
    expect(el.querySelector('.other')!.classList).not.toContain('star-toast-stack--narrow');
  });
});

@Component({
  imports: [StarToast],
  template: `<star-toast key="plain-outlet" />`,
})
class PlainHost {}

describe('star-toast resize listener', () => {
  it('adds no window resize listener without breakpoints', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const fixture = TestBed.createComponent(PlainHost);
    await fixture.whenStable();
    expect(add.mock.calls.filter(([type]) => type === 'resize')).toEqual([]);
    add.mockRestore();
  });
});
