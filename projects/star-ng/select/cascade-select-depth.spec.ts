import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarCascadeSelect } from './cascade-select';
import { StarSelectedTemplate } from './select-slots';

interface Place {
  name: string;
  region?: string;
  code?: string;
  children?: Place[];
}

const PLACES: Place[] = [
  {
    name: 'de',
    region: 'Germany',
    children: [{ name: 'Munich', code: 'MUC' }],
  },
  { name: 'Remote', code: 'REMOTE' },
];

@Component({
  imports: [StarCascadeSelect, StarSelectedTemplate, StarIconTemplate],
  template: `
    <star-cascade-select
      [options]="options()"
      optionLabel="name"
      optionGroupLabel="region"
      optionValue="code"
      [(value)]="place"
      showClear
      showPath
      emptyMessage="No places yet"
      [loading]="loading()"
      [fluid]="fluid()"
      [tabindex]="tabindex()"
      [ariaLabelledBy]="labelledBy()"
      [autofocus]="autofocus()"
      (show)="events.push('show')"
      (beforeShow)="events.push('beforeShow')"
      (hide)="events.push('hide')"
      (beforeHide)="events.push('beforeHide')"
      (cleared)="events.push('cleared')"
    >
      @if (slots()) {
        <ng-template starSelected let-option
          ><b class="own-value">{{ $any(option).code }}</b></ng-template
        >
        <ng-template starIcon="dropdown"><b class="own-caret">v</b></ng-template>
      }
    </star-cascade-select>
    <span id="place-label">Place</span>
  `,
})
class Host {
  readonly options = signal<Place[]>(PLACES);
  readonly place = signal<string | null>('MUC');
  readonly loading = signal(false);
  readonly fluid = signal(false);
  readonly tabindex = signal<number | null>(null);
  readonly labelledBy = signal<string | null>(null);
  readonly autofocus = signal(false);
  readonly slots = signal(false);
  readonly events: string[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    host: fixture.componentInstance,
    trigger: el.querySelector<HTMLButtonElement>('.star-cascade__trigger')!,
    stable: () => fixture.whenStable(),
  };
}

const items = () => [...document.querySelectorAll<HTMLElement>('.star-menu__item')];

describe('StarCascadeSelect depth', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('uses optionGroupLabel for the parents in the menu and the path', async () => {
    const t = await setup();
    expect(t.trigger.textContent!.trim()).toBe('Germany / Munich');
    t.trigger.click();
    await t.stable();
    expect(items().map((i) => i.textContent!.trim())).toEqual(['Germany', 'Remote']);
  });

  it('emits the show, hide and clear outputs', async () => {
    const t = await setup();
    t.trigger.click();
    await t.stable();
    expect(t.host.events).toEqual(['beforeShow', 'show']);
    t.trigger.click();
    await t.stable();
    expect(t.host.events).toEqual(['beforeShow', 'show', 'beforeHide', 'hide']);
    t.el.querySelector<HTMLButtonElement>('[aria-label="Clear"]')!.click();
    await t.stable();
    expect(t.host.place()).toBeNull();
    expect(t.host.events.at(-1)).toBe('cleared');
  });

  it('shows the empty message when there are no options', async () => {
    const t = await setup((h) => h.options.set([]));
    t.trigger.click();
    await t.stable();
    const entries = items();
    expect(entries.map((i) => i.textContent!.trim())).toEqual(['No places yet']);
    expect(entries[0].getAttribute('aria-disabled')).toBe('true');
  });

  it('shows the loading icon and aria-busy, and sets fluid, tabindex and the label id', async () => {
    const t = await setup((h) => {
      h.loading.set(true);
      h.fluid.set(true);
      h.tabindex.set(-1);
      h.labelledBy.set('place-label');
    });
    const host = t.el.querySelector('star-cascade-select')!;
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.classList).toContain('star-cascade--fluid');
    expect(t.el.querySelector('[data-star-part=dropdownIcon]')!.className).toContain('star-spin');
    expect(t.trigger.getAttribute('tabindex')).toBe('-1');
    expect(t.trigger.getAttribute('aria-labelledby')).toBe(`place-label ${t.trigger.id}`);
  });

  it('autofocuses the trigger', async () => {
    const t = await setup((h) => h.autofocus.set(true));
    expect(document.activeElement).toBe(t.trigger);
    t.trigger.blur();
  });

  it('renders the selected value and icon slots', async () => {
    const t = await setup((h) => h.slots.set(true));
    expect(t.trigger.querySelector('.own-value')!.textContent).toBe('MUC');
    expect(t.el.querySelector('.own-caret')!.closest('[aria-hidden=true]')).not.toBeNull();
  });
});
