import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete, StarMultiAutoComplete } from '@star-ng/ui/autocomplete';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import {
  StarCalendar,
  StarDatePicker,
  StarDateRangePicker,
  StarMultiDatePicker,
  StarTimePicker,
} from '@star-ng/ui/date-picker';
import { StarEditor } from '@star-ng/ui/editor';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarFileUpload } from '@star-ng/ui/file-upload';
import { StarInputMask } from '@star-ng/ui/input-mask';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarInputOtp } from '@star-ng/ui/input-otp';
import { StarInputTags } from '@star-ng/ui/input-tags';
import { StarColorPicker, StarKnob } from '@star-ng/ui/knob';
import { StarListbox } from '@star-ng/ui/listbox';
import { StarPassword } from '@star-ng/ui/password';
import { StarRadio, StarRadioGroup } from '@star-ng/ui/radio';
import { StarRating } from '@star-ng/ui/rating';
import { StarCascadeSelect, StarMultiSelect, StarSelect } from '@star-ng/ui/select';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { StarRangeSlider, StarSlider } from '@star-ng/ui/slider';
import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';
import { StarTree, StarTreeNode, StarTreeSelect } from '@star-ng/ui/tree';

/**
 * Issue #55: a `star-field` label names the control inside it and a click on the label focuses
 * the control, for every StarNG form control.
 */

const CITIES = ['Berlin', 'Madrid', 'Paris'];
const NODES: StarTreeNode[] = [
  { key: 'a', label: 'Alpha', children: [{ key: 'a1', label: 'Alpha one' }] },
  { key: 'b', label: 'Beta' },
];
const PLACES = [{ name: 'Germany', children: [{ name: 'Munich' }] }];

@Component({
  imports: [
    StarAutoComplete,
    StarCalendar,
    StarCascadeSelect,
    StarCheckbox,
    StarColorPicker,
    StarDatePicker,
    StarDateRangePicker,
    StarEditor,
    StarField,
    StarFileUpload,
    StarInput,
    StarInputMask,
    StarInputNumber,
    StarInputOtp,
    StarInputTags,
    StarKnob,
    StarListbox,
    StarMultiAutoComplete,
    StarMultiDatePicker,
    StarMultiSelect,
    StarPassword,
    StarRadio,
    StarRadioGroup,
    StarRangeSlider,
    StarRating,
    StarSelect,
    StarSelectButton,
    StarSlider,
    StarTimePicker,
    StarToggleSwitch,
    StarTree,
    StarTreeSelect,
  ],
  template: `
    <star-field id="f-select" label="Select city" hint="Pick one">
      <star-select [options]="cities" />
    </star-field>
    <star-field id="f-multi" label="Multi city"
      ><star-multi-select [options]="cities"
    /></star-field>
    <star-field id="f-cascade" label="Cascade place">
      <star-cascade-select [options]="places" optionLabel="name" />
    </star-field>
    <star-field id="f-ac" label="Auto city" hint="Type a city">
      <star-autocomplete [suggestions]="cities" />
    </star-field>
    <star-field id="f-mac" label="Multi auto city">
      <star-multi-autocomplete [suggestions]="cities" />
    </star-field>
    <star-field id="f-date" label="Due date" hint="Day / month / year">
      <star-date-picker />
    </star-field>
    <star-field id="f-range" label="Trip dates"><star-date-range-picker /></star-field>
    <star-field id="f-dates" label="Meeting days"><star-multi-date-picker /></star-field>
    <star-field id="f-time" label="Start time"><star-time-picker /></star-field>
    <star-field id="f-tree" label="Department"><star-tree-select [nodes]="nodes" /></star-field>
    <star-field id="f-slider" label="Volume"><star-slider /></star-field>
    <star-field id="f-range-slider" label="Price"><star-range-slider /></star-field>
    <star-field id="f-knob" label="Level"><star-knob /></star-field>
    <star-field id="f-color" label="Tag color">
      <star-color-picker [swatches]="['#112233', '#445566']" />
    </star-field>
    <star-field id="f-rating" label="Score"><star-rating /></star-field>
    <star-field id="f-segment" label="Size">
      <star-select-button [options]="['S', 'M', 'L']" />
    </star-field>
    <star-field id="f-radio" label="Plan">
      <star-radio-group>
        <star-radio value="free">Free</star-radio>
        <star-radio value="pro">Pro</star-radio>
      </star-radio-group>
    </star-field>
    <star-field id="f-otp" label="Code"><star-input-otp [length]="4" /></star-field>
    <star-field id="f-listbox" label="Cities"><star-listbox [options]="cities" /></star-field>
    <star-field id="f-editor" label="Notes"><star-editor /></star-field>
    <star-field id="f-treeview" label="Folders"><star-tree [nodes]="nodes" /></star-field>
    <star-field id="f-calendar" label="Pick a day"><star-calendar /></star-field>
    <star-field id="f-check" label="Terms"><star-checkbox>I agree</star-checkbox></star-field>
    <star-field id="f-switch" label="Alerts">
      <star-toggle-switch [hasLabel]="false" />
    </star-field>
    <star-field id="f-upload" label="Attachments"><star-file-upload /></star-field>
    <!-- Controls that already linked before #55. -->
    <star-field id="f-password" label="Password"><star-password /></star-field>
    <star-field id="f-number" label="Quantity"><star-input-number /></star-field>
    <star-field id="f-mask" label="Phone"><star-input-mask mask="999-9999" /></star-field>
    <star-field id="f-tags" label="Regions"><star-input-tags /></star-field>
    <star-field id="f-text" label="Name"><input starInput /></star-field>
    <!-- The user's labelling wins. -->
    <star-field id="f-own-label" label="Field text">
      <star-select [options]="cities" ariaLabel="Own name" />
    </star-field>
    <span id="outside">Outside text</span>
    <star-field id="f-own-by" label="Field text">
      <star-select [options]="cities" ariaLabelledBy="outside" />
    </star-field>
    <star-field id="f-error" label="Status" [error]="error()">
      <star-select [options]="cities" />
    </star-field>
    <star-field id="f-swap" label="Swapped">
      @if (swap()) {
        <star-select [options]="cities" />
      } @else {
        <star-autocomplete [suggestions]="cities" />
      }
    </star-field>
    <star-field id="f-ro-date" label="Read-only typing"
      ><star-date-picker readonlyInput
    /></star-field>
    <star-field id="f-two" label="Shared" hint="Shared hint" error="Shared error">
      <star-select id="first" [options]="cities" />
      <star-select id="second" [options]="cities" />
    </star-field>
  `,
})
class Host {
  readonly cities = CITIES;
  readonly nodes = NODES;
  readonly places = PLACES;
  readonly error = signal<string | null>(null);
  readonly swap = signal(false);
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

async function setup() {
  const fixture = TestBed.createComponent(Host);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el };
}

/** Text of a node without its `aria-hidden` parts (the required star). */
function visibleText(node: Element): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) out += child.textContent;
    else if (child instanceof Element && child.getAttribute('aria-hidden') !== 'true') {
      out += ' ' + visibleText(child) + ' ';
    }
  });
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * A small accessible-name computation: `aria-labelledby`, then `aria-label`, then the `label`
 * elements of a labelable element (`label[for]` or a wrapping label).
 */
function accessibleName(element: Element): string {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .map((node) => (node ? visibleText(node) : ''))
      .join(' ')
      .trim();
  }
  const label = element.getAttribute('aria-label');
  if (label) return label;
  const labels = (element as HTMLInputElement).labels;
  if (labels?.length) {
    return [...labels]
      .map((node) => visibleText(node))
      .join(' ')
      .trim();
  }
  return '';
}

function fieldParts(el: HTMLElement, id: string) {
  const field = el.querySelector<HTMLElement>(`#${id}`)!;
  const label = field.querySelector<HTMLLabelElement>('label.star-field__label')!;
  return { field, label };
}

/** Field id, selector of the named element in the field, expected label text. */
const NAMED: readonly [string, string, string][] = [
  ['f-select', '[role=combobox]', 'Select city'],
  ['f-multi', '[role=combobox]', 'Multi city'],
  ['f-cascade', 'button.star-cascade__trigger', 'Cascade place'],
  ['f-ac', 'input[role=combobox]', 'Auto city'],
  ['f-mac', 'input[role=combobox]', 'Multi auto city'],
  ['f-date', 'input.star-date__input', 'Due date'],
  ['f-range', 'input.star-date__input', 'Trip dates'],
  ['f-dates', 'input.star-date__input', 'Meeting days'],
  ['f-time', 'input.star-time__input', 'Start time'],
  ['f-tree', 'button.star-tree-select__trigger', 'Department'],
  ['f-slider', 'input[type=range]', 'Volume'],
  ['f-range-slider', 'input[type=range]', 'Price'],
  ['f-knob', '[role=slider]', 'Level'],
  ['f-color', '[role=radiogroup]', 'Tag color'],
  ['f-rating', 'star-rating', 'Score'],
  ['f-segment', 'star-select-button', 'Size'],
  ['f-radio', 'star-radio-group', 'Plan'],
  ['f-otp', 'star-input-otp', 'Code'],
  ['f-listbox', '[role=listbox]', 'Cities'],
  ['f-editor', '[role=textbox]', 'Notes'],
  ['f-treeview', '[role=tree]', 'Folders'],
  ['f-calendar', 'star-calendar', 'Pick a day'],
  ['f-check', 'input[type=checkbox]', 'Terms'],
  ['f-switch', 'input[role=switch]', 'Alerts'],
  ['f-upload', 'input[type=file]', 'Attachments'],
  ['f-password', 'input', 'Password'],
  ['f-number', 'input', 'Quantity'],
  ['f-mask', 'input', 'Phone'],
  ['f-tags', 'input', 'Regions'],
  ['f-text', 'input', 'Name'],
];

/** Controls with a labelable element: the label points at it with `for`. */
const LABELABLE = new Set([
  'f-ac',
  'f-mac',
  'f-date',
  'f-range',
  'f-dates',
  'f-time',
  'f-slider',
  'f-check',
  'f-switch',
  'f-upload',
  'f-password',
  'f-number',
  'f-mask',
  'f-tags',
  'f-text',
]);

describe('star-field label linking (#55)', () => {
  it.each(NAMED)('%s: the field label names the control', async (id, selector, label) => {
    const { el } = await setup();
    const { field } = fieldParts(el, id);
    const control = field.querySelector(selector);
    expect(control, `${id} ${selector}`).not.toBeNull();
    expect(accessibleName(control!)).toContain(label);
  });

  it.each(NAMED)('%s: a click on the label focuses the control', async (id) => {
    const { fixture, el } = await setup();
    const { field, label } = fieldParts(el, id);
    if (LABELABLE.has(id)) {
      // The label points at the input, so the browser names it.
      const control = label.control;
      expect(control, id).not.toBeNull();
      expect(field.contains(control)).toBe(true);
    } else {
      expect(label.hasAttribute('for'), `${id} label has no for`).toBe(false);
    }
    label.click();
    await fixture.whenStable();
    expect(field.contains(document.activeElement), `${id} focus`).toBe(true);
    expect(document.activeElement).not.toBe(label);
  });

  it('every label for points at a labelable element in its field', async () => {
    const { el } = await setup();
    for (const label of el.querySelectorAll<HTMLLabelElement>('label.star-field__label[for]')) {
      const target = document.getElementById(label.htmlFor);
      expect(target, label.htmlFor).not.toBeNull();
      expect(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']).toContain(target!.tagName);
      expect(label.closest('star-field')!.contains(target)).toBe(true);
    }
  });

  it('a div combobox names itself with the label id and is described by the hint', async () => {
    const { el } = await setup();
    const { field, label } = fieldParts(el, 'f-select');
    const combobox = field.querySelector('[role=combobox]')!;
    expect(combobox.getAttribute('aria-labelledby')).toBe(label.id);
    const hint = field.querySelector('.star-field__hint')!;
    expect(combobox.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('the inputs of autocomplete and date picker are described by the hint', async () => {
    const { el } = await setup();
    for (const id of ['f-ac', 'f-date']) {
      const field = el.querySelector(`#${id}`)!;
      const hint = field.querySelector('.star-field__hint')!;
      const input = field.querySelector('input:not([type=hidden])')!;
      expect(input.getAttribute('aria-describedby'), id).toBe(hint.id);
    }
  });

  it('the label and the button text name a cascade or tree select (WCAG 2.5.3)', async () => {
    const { el } = await setup();
    const trigger = el.querySelector('#f-tree button.star-tree-select__trigger')!;
    expect(accessibleName(trigger)).toMatch(/^Department .+/);
    const cascade = el.querySelector('#f-cascade button.star-cascade__trigger')!;
    expect(accessibleName(cascade)).toMatch(/^Cascade place .+/);
  });

  it('ariaLabel and ariaLabelledBy of the user win over the field label', async () => {
    const { el } = await setup();
    const own = el.querySelector('#f-own-label [role=combobox]')!;
    expect(own.hasAttribute('aria-labelledby')).toBe(false);
    expect(accessibleName(own)).toBe('Own name');
    const by = el.querySelector('#f-own-by [role=combobox]')!;
    expect(by.getAttribute('aria-labelledby')).toBe('outside');
  });

  it('a field error marks a div combobox invalid and describes it', async () => {
    const { fixture, el } = await setup();
    fixture.componentInstance.error.set('Choose a status');
    await fixture.whenStable();
    const field = el.querySelector('#f-error')!;
    const combobox = field.querySelector('[role=combobox]')!;
    expect(combobox.getAttribute('aria-invalid')).toBe('true');
    expect(combobox.getAttribute('aria-describedby')).toBe(
      field.querySelector('.star-field__error')!.id,
    );
  });

  it('the popup calendar of a date picker does not take the label', async () => {
    const { fixture, el } = await setup();
    const field = el.querySelector('#f-date')!;
    field.querySelector<HTMLButtonElement>('.star-date__toggle')!.click();
    await fixture.whenStable();
    const label = field.querySelector<HTMLLabelElement>('label.star-field__label')!;
    expect(label.htmlFor).toBe(field.querySelector('input.star-date__input')!.id);
    const calendar = document.querySelector('.star-date__panel star-calendar')!;
    expect(calendar.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('a control created later takes the label after the first one is destroyed', async () => {
    const { fixture, el } = await setup();
    let label = el.querySelector<HTMLLabelElement>('#f-swap label')!;
    expect(label.control).toBe(el.querySelector('#f-swap input'));
    fixture.componentInstance.swap.set(true);
    await fixture.whenStable();
    label = el.querySelector<HTMLLabelElement>('#f-swap label')!;
    const combobox = el.querySelector('#f-swap [role=combobox]')!;
    expect(label.hasAttribute('for')).toBe(false);
    expect(combobox.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('a second control in the same field does not use the label, the hint or the error', async () => {
    const { el } = await setup();
    const label = el.querySelector('#f-two label')!;
    const first = el.querySelector('#first [role=combobox]')!;
    const second = el.querySelector('#second [role=combobox]')!;
    expect(first.getAttribute('aria-labelledby')).toBe(label.id);
    expect(first.getAttribute('aria-describedby')).toBe(
      el.querySelector('#f-two .star-field__error')!.id,
    );
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(second.hasAttribute('aria-labelledby')).toBe(false);
    expect(second.hasAttribute('aria-describedby')).toBe(false);
    expect(second.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('a click on a star-field label only focuses (#55)', () => {
  async function clickLabel(id: string) {
    const ctx = await setup();
    const { field, label } = fieldParts(ctx.el, id);
    const input = label.control as HTMLInputElement;
    expect(input, id).not.toBeNull();
    const clicks = vi.fn();
    input.addEventListener('click', clicks);
    label.click();
    await ctx.fixture.whenStable();
    return { ...ctx, field, input, clicks };
  }

  it('does not open the file dialog of a file upload', async () => {
    const { input, clicks } = await clickLabel('f-upload');
    expect(clicks).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it('does not open the popup of a date picker with readonlyInput', async () => {
    const { input, clicks } = await clickLabel('f-ro-date');
    expect(clicks).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    expect(document.querySelector('.star-date__panel')).toBeNull();
  });

  it('does not toggle a checkbox or a switch', async () => {
    for (const id of ['f-check', 'f-switch']) {
      const { input, clicks } = await clickLabel(id);
      expect(clicks, id).not.toHaveBeenCalled();
      expect(input.checked, id).toBe(false);
      expect(document.activeElement, id).toBe(input);
    }
  });

  it('keeps the native label behaviour with a for that the user set', async () => {
    @Component({
      imports: [StarField],
      template: `<star-field label="Agree" for="own-box"
        ><input id="own-box" type="checkbox"
      /></star-field>`,
    })
    class OwnFor {}
    const fixture = TestBed.createComponent(OwnFor);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLLabelElement>('label')!.click();
    expect(el.querySelector<HTMLInputElement>('#own-box')!.checked).toBe(true);
  });
});

describe('StarField.linkControl outside an injection context', () => {
  it('does not throw, and unlinkControl ends the link', async () => {
    @Component({ imports: [StarField], template: `<star-field label="Late" />` })
    class Late {}
    const fixture = TestBed.createComponent(Late);
    await fixture.whenStable();
    const field = fixture.debugElement.children[0].injector.get(StarField);
    const id = () => 'late-input';
    expect(field.linkControl(id)).toBe(true);
    expect(field.linkControl(() => 'other')).toBe(false);
    await fixture.whenStable();
    const label = (fixture.nativeElement as HTMLElement).querySelector('label')!;
    expect(label.htmlFor).toBe('late-input');
    field.unlinkControl(id);
    expect(field.linkControl(() => 'other')).toBe(true);
  });
});
