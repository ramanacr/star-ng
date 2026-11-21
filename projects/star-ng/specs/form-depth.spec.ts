import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { StarFooterTemplate, StarHeaderTemplate, StarIconTemplate } from '@star-ng/ui/core';
import { StarInputMask } from '@star-ng/ui/input-mask';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarInputTags, StarInputTagTemplate } from '@star-ng/ui/input-tags';
import { StarColorPicker } from '@star-ng/ui/knob';
import { StarPassword } from '@star-ng/ui/password';
import { StarRating } from '@star-ng/ui/rating';
import { StarSlider } from '@star-ng/ui/slider';

@Component({
  imports: [
    StarColorPicker,
    StarCheckbox,
    StarRating,
    StarInputNumber,
    StarInputMask,
    StarInputTags,
    StarInputTagTemplate,
    StarPassword,
    StarSlider,
    StarIconTemplate,
    StarHeaderTemplate,
    StarFooterTemplate,
  ],
  template: `
    <star-color-picker
      class="color"
      ariaLabel="Color"
      (opened)="panel.push('open')"
      (closed)="panel.push('close')"
    />

    <star-checkbox class="box" [(checked)]="checked" [(indeterminate)]="mixed">
      Terms
      <ng-template starIcon="check" let-on
        ><b class="own-check">{{ on ? 'y' : 'm' }}</b></ng-template
      >
    </star-checkbox>

    <star-rating class="rate" [(value)]="rating" cancel ariaLabel="Quality">
      <ng-template starIcon="on"><b class="own-on">*</b></ng-template>
      <ng-template starIcon="off"><b class="own-off">.</b></ng-template>
      <ng-template starIcon="cancel"><b class="own-cancel">x</b></ng-template>
    </star-rating>

    <star-input-number
      class="num"
      [(value)]="amount"
      showButtons
      [buttonLayout]="layout()"
      [allowEmpty]="allowEmpty()"
      highlightOnFocus
      [min]="2"
      ariaLabel="Amount"
    >
      <ng-template starIcon="increment"><b class="own-inc">+</b></ng-template>
      <ng-template starIcon="decrement"><b class="own-dec">-</b></ng-template>
    </star-input-number>

    <star-input-mask
      class="mask"
      mask="aa-99"
      characterPattern="[A-F]"
      [(value)]="code"
      ariaLabel="Code"
    />

    <star-input-tags class="tags" [(value)]="tags" ariaLabel="Tags" showClear>
      <ng-template starInputTag let-tag let-index="index"
        ><b class="own-tag">{{ index }}:{{ tag }}</b></ng-template
      >
      <ng-template starIcon="remove"><b class="own-remove">r</b></ng-template>
      <ng-template starIcon="clear"><b class="own-clear">c</b></ng-template>
    </star-input-tags>

    <star-password class="pw" [(value)]="password" feedback [thresholds]="[0.2, 0.4, 0.6]">
      <ng-template starIcon="show"><b class="own-show">s</b></ng-template>
      <ng-template starIcon="hide"><b class="own-hide">h</b></ng-template>
      <ng-template starHeader><p class="own-head">Pick a strong one</p></ng-template>
      <ng-template starFooter><p class="own-foot">No reuse</p></ng-template>
    </star-password>

    <star-slider
      class="slide"
      [(value)]="level"
      orientation="vertical"
      ariaLabel="Level"
      (slideEnd)="ends.push($event)"
    />
  `,
})
class Host {
  readonly checked = signal(false);
  readonly mixed = signal(false);
  readonly rating = signal<number | null>(3);
  readonly amount = signal<number | null>(5);
  readonly layout = signal<'horizontal' | 'stacked' | 'vertical'>('horizontal');
  readonly allowEmpty = signal(true);
  readonly code = signal('');
  readonly tags = signal<readonly string[]>(['alpha', 'beta']);
  readonly password = signal('');
  readonly level = signal(20);
  readonly ends: number[] = [];
  readonly panel: string[] = [];
  readonly picker = viewChild.required(StarColorPicker);
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, host: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
}

const texts = (root: Element, selector: string) =>
  Array.from(root.querySelectorAll(selector)).map((node) => node.textContent?.trim());

describe('form inputs depth (N1)', () => {
  it('checkbox: the check icon slot shows for checked and indeterminate', async () => {
    const { fixture, host, root } = await setup();
    const box = root.querySelector('.box')!;
    expect(box.querySelector('.own-check')).toBeNull();
    host.checked.set(true);
    await fixture.whenStable();
    expect(texts(box, '.own-check')).toEqual(['y']);
    host.mixed.set(true);
    await fixture.whenStable();
    expect(texts(box, '.own-check')).toEqual(['m']);
    expect(box.querySelector('.own-check')!.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('rating: cancel clears the value; on, off and cancel icon slots', async () => {
    const { fixture, host, root } = await setup();
    const rate = root.querySelector('.rate')!;
    expect(texts(rate, '.own-on')).toEqual(['*', '*', '*']);
    expect(texts(rate, '.own-off')).toEqual(['.', '.']);
    const cancel = rate.querySelector<HTMLInputElement>('input[value="0"]')!;
    expect(cancel.getAttribute('aria-label')).toBe('Clear');
    expect(rate.querySelector('.own-cancel')).not.toBeNull();
    cancel.click();
    await fixture.whenStable();
    expect(host.rating()).toBeNull();
    expect(rate.querySelectorAll('.own-on').length).toBe(0);
  });

  it('input number: button layouts, icon slots and allowEmpty', async () => {
    const { fixture, host, root } = await setup();
    const num = root.querySelector('.num')!;
    const control = num.querySelector('[data-star-part="controlPanel"]')!;
    const order = () =>
      Array.from(control.querySelectorAll('button, input')).map((node) =>
        node.tagName === 'INPUT' ? 'input' : (node.textContent?.trim() ?? ''),
      );
    expect(order()).toEqual(['-', 'input', '+']);
    host.layout.set('stacked');
    await fixture.whenStable();
    expect(order()).toEqual(['input', '+', '-']);
    expect(num.querySelector('[data-star-part="stepPanel"]')).not.toBeNull();
    host.layout.set('vertical');
    await fixture.whenStable();
    expect(order()).toEqual(['+', 'input', '-']);
    expect(num.classList).toContain('star-number--vertical');

    const input = num.querySelector<HTMLInputElement>('input')!;
    host.allowEmpty.set(false);
    await fixture.whenStable();
    input.dispatchEvent(new Event('focus'));
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(host.amount()).toBe(5);
    host.amount.set(null);
    await fixture.whenStable();
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(host.amount()).toBe(2);
  });

  it('input number: highlightOnFocus selects the text', async () => {
    const { root } = await setup();
    const input = root.querySelector<HTMLInputElement>('.num input')!;
    const select = vi.spyOn(input, 'select');
    input.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    expect(select).toHaveBeenCalled();
  });

  it('input mask: characterPattern limits the letter slots', async () => {
    const { fixture, host, root } = await setup();
    const input = root.querySelector<HTMLInputElement>('.mask input')!;
    input.value = 'XCB12';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(input.value).toBe('CB-12');
    expect(host.code()).toBe('CB-12');
  });

  it('input tags: chip and icon slots', async () => {
    const { root } = await setup();
    const tags = root.querySelector('.tags')!;
    expect(texts(tags, '.own-tag')).toEqual(['0:alpha', '1:beta']);
    expect(tags.querySelectorAll('.own-remove').length).toBe(2);
    expect(tags.querySelector('.own-clear')).not.toBeNull();
    expect(tags.querySelector('[data-star-part="removeButton"]')?.getAttribute('aria-label')).toBe(
      'Remove alpha',
    );
  });

  it('password: thresholds, show and hide icons, header and footer', async () => {
    const { fixture, host, root } = await setup();
    const pw = root.querySelector('.pw')!;
    expect(texts(pw, '.own-show')).toEqual(['s']);
    pw.querySelector<HTMLButtonElement>('[data-star-part="revealButton"]')!.click();
    await fixture.whenStable();
    expect(texts(pw, '.own-hide')).toEqual(['h']);
    expect(texts(pw, '.own-head')).toEqual(['Pick a strong one']);
    expect(texts(pw, '.own-foot')).toEqual(['No reuse']);
    // 3 of 5 default rules met: 0.6 is strong with these thresholds.
    host.password.set('abcdef1!');
    await fixture.whenStable();
    expect(pw.querySelector('[data-star-part="levelText"]')?.textContent?.trim()).toBe(
      'Password strength: strong',
    );
  });

  it('slider: vertical orientation and slideEnd', async () => {
    const { fixture, host, root } = await setup();
    const slide = root.querySelector('.slide')!;
    expect(slide.classList).toContain('star-slider--vertical');
    const input = slide.querySelector<HTMLInputElement>('input')!;
    expect(input.getAttribute('aria-orientation')).toBe('vertical');
    input.value = '40';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.level()).toBe(40);
    expect(host.ends).toEqual([40]);
  });

  it('color picker: opened and closed of the custom color panel', async () => {
    const { fixture, host } = await setup();
    host.picker().openPanel();
    await fixture.whenStable();
    host.picker().closePanel(false);
    await fixture.whenStable();
    expect(host.panel).toEqual(['open', 'close']);
  });
});
