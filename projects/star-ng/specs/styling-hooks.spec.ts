// Styling hooks (pass-through `pt` and unstyled mode) of the controls that have them. Each entry
// renders a control (and opens its popup when it has one). The test fails when an element of the
// control template has no part name, so a new element cannot miss its hook.
import { Component, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarButton, StarButtonGroup } from '@star-ng/ui/button';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { StarDialog } from '@star-ng/ui/dialog';
import { StarPassThrough } from '@star-ng/ui/core';
import { StarRadio, StarRadioGroup } from '@star-ng/ui/radio';
import { StarMultiSelect, StarSelect } from '@star-ng/ui/select';
import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';

const OPTIONS = ['Lisbon', 'Oslo', 'Porto'];

@Component({
  imports: [
    StarButton,
    StarButtonGroup,
    StarCheckbox,
    StarRadio,
    StarRadioGroup,
    StarSelect,
    StarMultiSelect,
    StarToggleSwitch,
  ],
  template: `
    <star-button id="button" [pt]="pt()" [unstyled]="unstyled()" leadingIcon="ph-bold ph-plus"
      ><b class="projected">Add</b></star-button
    >
    <star-button-group id="button-group" [pt]="pt()" [unstyled]="unstyled()" />
    <star-checkbox id="checkbox" [pt]="pt()" [unstyled]="unstyled()" [checked]="true"
      ><b class="projected">Agree</b></star-checkbox
    >
    <star-radio-group id="radio-group" [pt]="pt()" [unstyled]="unstyled()" value="a">
      <star-radio id="radio" [pt]="pt()" [unstyled]="unstyled()" value="a"
        ><b class="projected">A</b></star-radio
      >
    </star-radio-group>
    <star-toggle-switch id="switch" [pt]="pt()" [unstyled]="unstyled()" [checked]="true"
      ><b class="projected">On</b></star-toggle-switch
    >
    <star-select
      id="select"
      [pt]="pt()"
      [unstyled]="unstyled()"
      [options]="options"
      value="Oslo"
      filter
      showClear
      ariaLabel="City"
    />
    <star-multi-select
      id="multi"
      [pt]="pt()"
      [unstyled]="unstyled()"
      [options]="options"
      [value]="['Oslo']"
      filter
      showClear
      ariaLabel="Cities"
    />
  `,
})
class Host {
  readonly options = OPTIONS;
  readonly pt = signal<StarPassThrough | null>(null);
  readonly unstyled = signal<boolean | undefined>(undefined);
}

interface Entry {
  readonly id: string;
  readonly type: Type<unknown>;
  /** Opens the popup of the control; returns its root element. */
  readonly open?: (host: HTMLElement) => Promise<HTMLElement | null>;
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

async function openSelect(host: HTMLElement): Promise<HTMLElement | null> {
  host.querySelector<HTMLElement>('[role=combobox]')!.click();
  await tick();
  await tick();
  const panels = [...document.querySelectorAll<HTMLElement>('.star-panel')];
  return panels.at(-1) ?? null;
}

const ENTRIES: readonly Entry[] = [
  { id: 'button', type: StarButton },
  { id: 'button-group', type: StarButtonGroup },
  { id: 'checkbox', type: StarCheckbox },
  { id: 'radio-group', type: StarRadioGroup },
  { id: 'radio', type: StarRadio },
  { id: 'switch', type: StarToggleSwitch },
  { id: 'select', type: StarSelect, open: openSelect },
  { id: 'multi', type: StarMultiSelect, open: openSelect },
];

/** Elements of the control's own template without a part name (projected content excluded). */
function unnamed(root: HTMLElement, host: HTMLElement): string[] {
  return (
    [...root.querySelectorAll<HTMLElement>('*')]
      .filter((element) => !element.closest('.projected'))
      // A nested control with styling hooks names its own parts.
      .filter((element) => element.closest('[data-star-part=root]') === host || root !== host)
      .filter((element) => !element.hasAttribute('data-star-part'))
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`)
  );
}

describe('styling hooks of the controls', () => {
  afterEach(() => document.querySelectorAll('.star-panel').forEach((panel) => panel.remove()));

  it('every control has the StarStyled host directive', () => {
    for (const entry of ENTRIES) {
      const def = (entry.type as unknown as { ɵcmp: { hostDirectives?: unknown } }).ɵcmp;
      expect(String(def.hostDirectives), entry.id).toBeTruthy();
    }
  });

  for (const entry of ENTRIES) {
    it(`${entry.id}: every element has a part, and pt and unstyled reach them`, async () => {
      const fixture = TestBed.createComponent(Host);
      await fixture.whenStable();
      const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        `#${entry.id}`,
      )!;
      expect(host.getAttribute('data-star-part')).toBe('root');
      expect(unnamed(host, host)).toEqual([]);
      const popup = (await entry.open?.(host)) ?? null;
      await fixture.whenStable();
      if (entry.open) expect(popup).not.toBeNull();
      if (popup) expect(unnamed(popup, host)).toEqual([]);

      fixture.componentInstance.pt.set({ root: { class: 'hook-root' } });
      fixture.componentInstance.unstyled.set(true);
      await fixture.whenStable();
      expect(host.classList).toContain('hook-root');
      const parts = [host, ...host.querySelectorAll<HTMLElement>('[data-star-part]')];
      for (const part of parts.filter((item) => !item.closest('.projected'))) {
        expect(part.hasAttribute('data-star-unstyled'), part.className).toBe(true);
      }
    });
  }
});

@Component({
  imports: [StarDialog, StarButton],
  template: `
    <star-dialog [visible]="true" header="Edit order" unstyled>
      <star-button id="nested">Save</star-button>
      <p class="consumer">Text of the application</p>
    </star-dialog>
  `,
})
class NestedHost {}

describe('unstyled mode does not reach nested styled controls', () => {
  it('marks the parts of the unstyled dialog only, not a styled button or content inside it', async () => {
    const fixture = TestBed.createComponent(NestedHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const dialog = el.querySelector<HTMLElement>('star-dialog')!;
    expect(dialog.hasAttribute('data-star-unstyled')).toBe(true);
    expect(dialog.querySelector('dialog')!.hasAttribute('data-star-unstyled')).toBe(true);
    const nested = el.querySelector<HTMLElement>('#nested')!;
    expect(nested.getAttribute('data-star-part')).toBe('root');
    expect(nested.hasAttribute('data-star-unstyled')).toBe(false);
    expect(nested.querySelector('button')!.hasAttribute('data-star-unstyled')).toBe(false);
    const consumer = el.querySelector<HTMLElement>('.consumer')!;
    expect(consumer.hasAttribute('data-star-part')).toBe(false);
    // The CSS gives back the theme tokens to these elements (`_unstyled.scss`):
    // `[data-star-unstyled] :not([data-star-part])` and nested roots without the attribute.
  });
});
