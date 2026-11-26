import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarRadio, StarRadioGroup } from '@star-ng/ui/radio';
import { StarField, StarFieldLabelEnd, StarFieldLabelSuffix, StarInput } from './field';

@Component({
  imports: [StarField, StarInput],
  template: `
    <star-field
      label="Received Date"
      [required]="required()"
      [hint]="hint()"
      [labelSuffix]="suffix()"
      [labelSuffixTooltip]="tooltip()"
    >
      <input starInput type="date" />
    </star-field>
  `,
})
class TextHost {
  readonly required = signal(false);
  readonly hint = signal('');
  readonly suffix = signal('#');
  readonly tooltip = signal('Required to close/transmit');
}

@Component({
  imports: [StarField, StarFieldLabelEnd, StarFieldLabelSuffix, StarInput],
  template: `
    <star-field label="Received Date" required labelSuffixTooltip="Required to close/transmit">
      <i starFieldLabelSuffix class="mark">#</i>
      <span starFieldLabelEnd>jdoe</span>
      <input starInput />
    </star-field>
  `,
})
class SlotHost {}

function setup<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, root, field: root.querySelector('star-field')! };
}

describe('StarField label suffix', () => {
  it('renders the marker inside the label, right after the label text', async () => {
    const { fixture, field } = setup(TextHost);
    await fixture.whenStable();
    const label = field.querySelector('label')!;
    const suffix = label.querySelector('[data-star-part=labelSuffixPanel]')!;
    expect(suffix).toBeTruthy();
    expect(suffix.classList).toContain('star-field__label-suffix');
    expect(suffix.textContent?.trim()).toBe('#');
    expect(label.lastElementChild).toBe(suffix);
    expect(label.textContent?.trim().startsWith('Received Date')).toBe(true);
  });

  it('keeps the required marker before the suffix', async () => {
    const { fixture, field } = setup(TextHost);
    fixture.componentInstance.required.set(true);
    await fixture.whenStable();
    const label = field.querySelector('label')!;
    const required = label.querySelector('[data-star-part=requiredText]')!;
    const suffix = label.querySelector('[data-star-part=labelSuffixPanel]')!;
    expect(required.textContent).toBe('*');
    expect(required.nextElementSibling).toBe(suffix);
  });

  it('hides the marker from assistive technology and describes the control with its meaning', async () => {
    const { fixture, field } = setup(TextHost);
    await fixture.whenStable();
    const suffix = field.querySelector('[data-star-part=labelSuffixPanel]')!;
    expect(suffix.getAttribute('aria-hidden')).toBe('true');
    const input = field.querySelector('input')!;
    expect(input.getAttribute('aria-labelledby')).toBeNull();
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    expect(ids).toHaveLength(1);
    const description = field.querySelector(`#${ids[0]}`)!;
    expect(description.textContent?.trim()).toBe('Required to close/transmit');
    expect(description.classList).toContain('star-sr-only');
    expect(field.querySelector('label')!.contains(description)).toBe(false);
  });

  it('puts the hint first in the description, then the suffix meaning', async () => {
    const { fixture, field } = setup(TextHost);
    fixture.componentInstance.hint.set('Date on the receipt');
    await fixture.whenStable();
    const input = field.querySelector('input')!;
    const [hintId, suffixId] = input.getAttribute('aria-describedby')!.split(' ');
    expect(field.querySelector(`#${hintId}`)?.textContent?.trim()).toBe('Date on the receipt');
    expect(field.querySelector(`#${suffixId}`)?.textContent?.trim()).toBe(
      'Required to close/transmit',
    );
  });

  it('shows the tooltip text on hover of the marker and while the control has the focus', async () => {
    const { fixture, field } = setup(TextHost);
    await fixture.whenStable();
    vi.useFakeTimers();
    try {
      const suffix = field.querySelector('[data-star-part=labelSuffixPanel]')!;
      suffix.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(400);
      fixture.detectChanges();
      expect(document.querySelector('.star-tooltip')?.textContent).toBe(
        'Required to close/transmit',
      );
      suffix.dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(10);
      fixture.detectChanges();
      expect(document.querySelector('.star-tooltip')).toBeNull();

      const input = field.querySelector('input')!;
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();
      expect(document.querySelector('.star-tooltip')?.textContent).toBe(
        'Required to close/transmit',
      );
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      fixture.detectChanges();
      expect(document.querySelector('.star-tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a marker without a tooltip and no description', async () => {
    const { fixture, field } = setup(TextHost);
    fixture.componentInstance.tooltip.set('');
    await fixture.whenStable();
    expect(field.querySelector('[data-star-part=labelSuffixPanel]')?.textContent?.trim()).toBe('#');
    expect(field.querySelector('input')!.getAttribute('aria-describedby')).toBeNull();
    field.querySelector('input')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await fixture.whenStable();
    expect(document.querySelector('.star-tooltip')).toBeNull();
  });

  it('projects starFieldLabelSuffix content after the required marker, before the label end', async () => {
    const { fixture, field } = setup(SlotHost);
    await fixture.whenStable();
    const row = field.querySelector('[data-star-part=labelRow]')!;
    const label = row.querySelector('label')!;
    const suffix = label.querySelector('[data-star-part=labelSuffixPanel]')!;
    expect(suffix.querySelector('i.mark')).toBeTruthy();
    expect(suffix.previousElementSibling?.getAttribute('data-star-part')).toBe('requiredText');
    expect(label.nextElementSibling?.getAttribute('data-star-part')).toBe('labelEndPanel');
    const input = field.querySelector('input')!;
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('removes the marker and the description when the suffix is cleared', async () => {
    const { fixture, field } = setup(TextHost);
    await fixture.whenStable();
    fixture.componentInstance.suffix.set('');
    await fixture.whenStable();
    expect(field.querySelector('[data-star-part=labelSuffixPanel]')).toBeNull();
    expect(field.querySelector('input')!.getAttribute('aria-describedby')).toBeNull();
    expect(field.querySelector('.star-sr-only[id]')).toBeNull();
  });

  it('adds nothing without a suffix', async () => {
    @Component({
      imports: [StarField, StarInput],
      template: `<star-field label="Name" required><input starInput /></star-field>`,
    })
    class Plain {}
    const { fixture, field } = setup(Plain);
    await fixture.whenStable();
    expect(field.querySelector('[data-star-part=labelSuffixPanel]')).toBeNull();
    expect(field.querySelector('.star-sr-only[id]')).toBeNull();
    expect(field.querySelector('input')!.getAttribute('aria-describedby')).toBeNull();
    const label = field.querySelector('label')!;
    expect(label.lastElementChild?.getAttribute('data-star-part')).toBe('requiredText');
  });

  it('describes a control without a labelable element and keeps its name to the label', async () => {
    @Component({
      imports: [StarField, StarRadio, StarRadioGroup],
      template: `
        <star-field label="Plan" labelSuffix="#" labelSuffixTooltip="Required to close">
          <star-radio-group>
            <star-radio value="free">Free</star-radio>
          </star-radio-group>
        </star-field>
      `,
    })
    class Group {}
    const { fixture, root } = setup(Group);
    await fixture.whenStable();
    const label = root.querySelector('label')!;
    const named = root.querySelector('[aria-labelledby]')!;
    expect(named.getAttribute('aria-labelledby')).toBe(label.id);
    const described = root.querySelector('[aria-describedby]')!;
    expect(root.querySelector(`#${described.getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Required to close',
    );
  });
});
