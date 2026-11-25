import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarRadio, StarRadioGroup } from '@star-ng/ui/radio';
import { StarField, StarFieldLabelEnd, StarInput } from './field';

@Component({
  imports: [StarField, StarFieldLabelEnd, StarInput],
  template: `
    <star-field label="Password" required>
      <a starFieldLabelEnd href="#reset" class="reset">Forgot password?</a>
      <input starInput type="password" />
    </star-field>
  `,
})
class SlotHost {}

@Component({
  imports: [StarField, StarInput],
  template: `
    <star-field label="Reason" [labelEnd]="stamp()">
      <textarea starInput></textarea>
    </star-field>
  `,
})
class TextHost {
  readonly stamp = signal('jdoe · 25 Nov 2026 09:26');
}

describe('StarField label end', () => {
  it('projects starFieldLabelEnd content at the end of the label row, outside the label', async () => {
    const fixture = TestBed.createComponent(SlotHost);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('star-field')!;
    const row = field.querySelector('[data-star-part=labelRow]')!;
    expect(row).toBeTruthy();
    const label = row.querySelector('label')!;
    const end = row.querySelector('[data-star-part=labelEndPanel]')!;
    expect(row.firstElementChild).toBe(label);
    expect(end.querySelector('a.reset')?.textContent).toBe('Forgot password?');
    expect(label.contains(end)).toBe(false);
    // The required marker stays with the label.
    expect(label.querySelector('[data-star-part=requiredText]')).toBeTruthy();
  });

  it('keeps the accessible name of the control to the label text', async () => {
    const fixture = TestBed.createComponent(SlotHost);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(input.labels?.length).toBe(1);
    expect(input.labels![0].textContent).not.toContain('Forgot');
    expect(input.labels![0].textContent).toContain('Password');
    expect(input.getAttribute('aria-labelledby')).toBeNull();
    // The end content is metadata: not in the description either.
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('renders the labelEnd text and updates it', async () => {
    const fixture = TestBed.createComponent(TextHost);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('star-field')!;
    const end = field.querySelector('.star-field__label-end')!;
    expect(end.textContent?.trim()).toBe('jdoe · 25 Nov 2026 09:26');
    expect(field.querySelector('label')!.textContent).not.toContain('jdoe');

    fixture.componentInstance.stamp.set('');
    await fixture.whenStable();
    expect(field.querySelector('[data-star-part=labelRow]')).toBeNull();
    expect(field.querySelector('.star-field__label-end')).toBeNull();
    expect(field.firstElementChild?.tagName).toBe('LABEL');
  });

  it('adds no wrapper without end content', async () => {
    @Component({
      imports: [StarField, StarInput],
      template: `<star-field label="Name" hint="Hint"><input starInput /></star-field>`,
    })
    class Plain {}
    const fixture = TestBed.createComponent(Plain);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('star-field')!;
    expect(field.querySelector('[data-star-part=labelRow]')).toBeNull();
    expect(field.querySelector('[data-star-part=labelEndPanel]')).toBeNull();
    expect(field.firstElementChild?.tagName).toBe('LABEL');
  });

  it('keeps aria-labelledby of a control without a labelable element to the label id', async () => {
    @Component({
      imports: [StarField, StarRadio, StarRadioGroup],
      template: `
        <star-field label="Plan" labelEnd="Changed today">
          <star-radio-group>
            <star-radio value="free">Free</star-radio>
          </star-radio-group>
        </star-field>
      `,
    })
    class Group {}
    const fixture = TestBed.createComponent(Group);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const label = root.querySelector('label')!;
    const named = root.querySelector('[aria-labelledby]')!;
    expect(named.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.textContent).not.toContain('Changed today');
  });
});
