import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAccordion, StarAccordionPanel } from 'star-ng/accordion';
import { StarFieldset, StarPanel } from 'star-ng/panel';

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

@Component({
  imports: [StarAccordion, StarAccordionPanel, StarPanel, StarFieldset],
  template: `
    <star-accordion [(value)]="open" [multiple]="multiple()">
      <star-accordion-panel value="a" header="A">Body A</star-accordion-panel>
      <star-accordion-panel value="b" header="B">Body B</star-accordion-panel>
      <star-accordion-panel value="c" header="C" disabled>Body C</star-accordion-panel>
    </star-accordion>
    <star-panel header="Notes" toggleable [(collapsed)]="collapsed">Panel body</star-panel>
    <star-fieldset legend="Contact" toggleable [(collapsed)]="fieldsetCollapsed">
      Fieldset body
    </star-fieldset>
  `,
})
class AccordionHost {
  readonly open = signal<readonly string[]>([]);
  readonly multiple = signal(false);
  readonly collapsed = signal(false);
  readonly fieldsetCollapsed = signal(false);
}

describe('StarAccordion and StarPanel', () => {
  it('opens one panel at a time unless multiple; arrows move between headers', async () => {
    const fixture = TestBed.createComponent(AccordionHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const headers = [...el.querySelectorAll<HTMLButtonElement>('.star-accordion__header')];
    const regions = [...el.querySelectorAll<HTMLElement>('star-accordion [role=region]')];
    expect(regions[0].hasAttribute('inert')).toBe(true);

    headers[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toEqual(['a']);
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');
    expect(regions[0].hasAttribute('inert')).toBe(false);
    headers[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toEqual(['b']);

    fixture.componentInstance.multiple.set(true);
    await fixture.whenStable();
    headers[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toEqual(['b', 'a']);

    headers[0].focus();
    key(headers[0], 'ArrowDown');
    expect(document.activeElement).toBe(headers[1]);
    key(headers[1], 'ArrowDown'); // C is disabled: wraps to A
    expect(document.activeElement).toBe(headers[0]);
  });

  it('panel toggles collapsed', async () => {
    const fixture = TestBed.createComponent(AccordionHost);
    await fixture.whenStable();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.star-panel-box__toggle',
    )!;
    toggle.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('fieldset toggles collapsed and keeps the native legend', async () => {
    const fixture = TestBed.createComponent(AccordionHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('.star-fieldset__toggle')!;
    expect(el.querySelector('fieldset > legend')).not.toBeNull();
    toggle.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.fieldsetCollapsed()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
