import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTimePicker } from './time-picker';

@Component({
  imports: [StarTimePicker],
  template: `
    <div [attr.dir]="dir()">
      <star-time-picker
        ariaLabel="Cut-off"
        min="08:00"
        max="18:00"
        [stepMinute]="15"
        [hourFormat]="hourFormat()"
        [(value)]="cutOff"
      />
    </div>
  `,
})
class Host {
  readonly cutOff = signal<string | null>('09:30');
  readonly hourFormat = signal<'12' | '24'>('24');
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('time picker panel', () => {
  async function setup(change?: (host: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('.star-date__toggle')!;
    const open = async () => {
      toggle.click();
      await fixture.whenStable();
      // The focus moves into the panel after the next render.
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    return { fixture, el, host: fixture.componentInstance, toggle, open };
  }

  const panel = () => document.querySelector<HTMLElement>('.star-time__panel');
  const column = (part: string) =>
    document.querySelector<HTMLElement>(`.star-time__column[data-part="${part}"]`)!;
  const cell = (part: string, value: number) =>
    column(part).querySelector<HTMLButtonElement>(`[data-value="${value}"]`)!;
  const values = (part: string, filter: (cell: HTMLElement) => boolean = () => true) =>
    [...column(part).querySelectorAll<HTMLElement>('[role="option"]')]
      .filter(filter)
      .map((item) => Number(item.dataset['value']));
  const key = (target: Element, name: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

  afterEach(() => document.querySelectorAll('.star-time__panel').forEach((item) => item.remove()));

  it('keeps the native field for typing and hides the popup of the browser', async () => {
    const { el, host, fixture, toggle } = await setup();
    const input = el.querySelector<HTMLInputElement>('star-time-picker input')!;
    expect(input.type).toBe('time');
    expect(input.value).toBe('09:30');
    expect(input.step).toBe('900');
    input.value = '14:45';
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.cutOff()).toBe('14:45');
    expect(toggle.getAttribute('aria-haspopup')).toBe('dialog');
    expect(toggle.getAttribute('aria-label')).toBe('Choose time');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a StarNG panel with hour and minute columns, focused on the chosen hour', async () => {
    const { toggle, open } = await setup();
    await open();
    expect(panel()?.getAttribute('role')).toBe('dialog');
    expect(panel()?.getAttribute('aria-label')).toBe('Choose time');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(panel()!.id);
    expect(column('hour').getAttribute('role')).toBe('listbox');
    expect(column('hour').getAttribute('aria-label')).toBe('Hour');
    expect(column('minute').getAttribute('aria-label')).toBe('Minute');
    expect(document.querySelector('.star-time__column[data-part="period"]')).toBeNull();
    expect(values('hour')).toEqual(Array.from({ length: 24 }, (_, hour) => hour));
    // The minutes follow stepMinute.
    expect(values('minute')).toEqual([0, 15, 30, 45]);
    expect(cell('hour', 9).getAttribute('aria-selected')).toBe('true');
    expect(cell('minute', 30).getAttribute('aria-selected')).toBe('true');
    expect(cell('hour', 9).classList).toContain('star-time__cell--selected');
    expect(document.activeElement).toBe(cell('hour', 9));
  });

  it('disables the times outside min and max, and a disabled cell is not chosen', async () => {
    const { fixture, host, open } = await setup((h) => h.cutOff.set('18:00'));
    await open();
    const disabled = (item: HTMLElement) => item.getAttribute('aria-disabled') === 'true';
    expect(values('hour', disabled)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 19, 20, 21, 22, 23]);
    // At 18 h only 18:00 is inside the limits.
    expect(values('minute', disabled)).toEqual([15, 30, 45]);
    cell('hour', 20).click();
    cell('minute', 45).click();
    await fixture.whenStable();
    expect(host.cutOff()).toBe('18:00');

    cell('hour', 10).click();
    await fixture.whenStable();
    expect(host.cutOff()).toBe('10:00');
    cell('minute', 45).click();
    await fixture.whenStable();
    expect(host.cutOff()).toBe('10:45');
    // A new hour keeps the minutes; when that time is outside the limits, the nearest one is set.
    cell('hour', 18).click();
    await fixture.whenStable();
    expect(host.cutOff()).toBe('18:00');
  });

  it('starts at the first time inside the limits when there is no value', async () => {
    const { fixture, host, open } = await setup((h) => h.cutOff.set(null));
    await open();
    expect(document.querySelectorAll('[aria-selected="true"]').length).toBe(0);
    cell('minute', 45).click();
    await fixture.whenStable();
    expect(host.cutOff()).toBe('08:45');
  });

  it('has an am / pm column in the 12-hour clock', async () => {
    const { fixture, host, open } = await setup((h) => h.hourFormat.set('12'));
    await open();
    expect(values('hour')).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(column('period').getAttribute('aria-label')).toBe('AM or PM');
    expect(cell('period', 0).getAttribute('aria-selected')).toBe('true');
    expect(cell('hour', 9).getAttribute('aria-selected')).toBe('true');
    // In the morning, 12 (midnight) to 7 are before 08:00.
    expect(cell('hour', 12).getAttribute('aria-disabled')).toBe('true');
    expect(cell('hour', 7).getAttribute('aria-disabled')).toBe('true');

    cell('period', 1).click();
    await fixture.whenStable();
    // 21:30 is after 18:00: the nearest time inside the limits is set.
    expect(host.cutOff()).toBe('18:00');
    expect(cell('hour', 6).getAttribute('aria-selected')).toBe('true');
    expect(cell('hour', 12).getAttribute('aria-disabled')).toBeNull();
    cell('hour', 2).click();
    await fixture.whenStable();
    expect(host.cutOff()).toBe('14:00');
  });

  it('moves with the arrow keys in a column and between columns', async () => {
    const { fixture, open } = await setup();
    await open();
    const settle = async () => {
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    };
    key(document.activeElement!, 'ArrowDown');
    await settle();
    expect(document.activeElement).toBe(cell('hour', 10));
    expect(cell('hour', 10).getAttribute('tabindex')).toBe('0');
    expect(cell('hour', 9).getAttribute('tabindex')).toBe('-1');
    key(document.activeElement!, 'ArrowUp');
    key(document.activeElement!, 'ArrowUp');
    await settle();
    expect(document.activeElement).toBe(cell('hour', 8));
    key(document.activeElement!, 'End');
    await settle();
    expect(document.activeElement).toBe(cell('hour', 23));
    key(document.activeElement!, 'ArrowRight');
    await settle();
    expect(document.activeElement).toBe(cell('minute', 30));
    key(document.activeElement!, 'ArrowLeft');
    await settle();
    expect(document.activeElement).toBe(cell('hour', 23));
  });

  it('mirrors Arrow left and Arrow right in right-to-left', async () => {
    const { fixture, open } = await setup((h) => h.dir.set('rtl'));
    await open();
    // The overlay is outside the host element: the page direction decides.
    panel()!.setAttribute('dir', 'rtl');
    key(document.activeElement!, 'ArrowLeft');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(cell('minute', 30));
    key(document.activeElement!, 'ArrowRight');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(cell('hour', 9));
  });

  it('closes with Escape and gives the focus back to the clock button', async () => {
    const { fixture, toggle, open } = await setup();
    await open();
    key(document.activeElement!, 'Escape');
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('opens from the field with Alt + Arrow down and gives the focus back to the field', async () => {
    const { fixture, el } = await setup();
    const input = el.querySelector<HTMLInputElement>('star-time-picker input')!;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
    await fixture.whenStable();
    expect(panel()).not.toBeNull();
    document.querySelector<HTMLButtonElement>('.star-time__bar button')!.click();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('renders on the server platform', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const { el, toggle } = await setup();
    expect(el.querySelector<HTMLInputElement>('star-time-picker input')?.value).toBe('09:30');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
