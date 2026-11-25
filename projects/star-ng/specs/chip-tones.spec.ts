import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarChip, StarChipSeverity } from '@star-ng/ui/layout';

@Component({
  imports: [StarChip],
  template: `
    <star-chip id="plain" label="Design" removable (removed)="log.push('removed plain')" />
    <star-chip id="tone" [severity]="severity()">Keyword</star-chip>
    <star-chip
      id="filter"
      severity="info"
      clickable
      removable
      [disabled]="disabled()"
      (chipClick)="log.push('click')"
      (removed)="log.push('removed')"
      ><b>Status:</b> Open</star-chip
    >
    <star-chip id="body" clickable (chipClick)="log.push('body')"
      >Date range: Last 30 days</star-chip
    >
  `,
})
class Host {
  readonly severity = signal<StarChipSeverity | null>(null);
  readonly disabled = signal(false);
  readonly log: string[] = [];
}

describe('StarChip tones and clickable body', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }

  it('keeps the default chip unchanged: no tone class, no body button', async () => {
    const { el } = await setup();
    const chip = el.querySelector('#plain')!;
    expect(chip.className.split(' ').filter((name) => name.startsWith('star-chip'))).toEqual([
      'star-chip',
    ]);
    const buttons = chip.querySelectorAll('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute('data-star-part')).toBe('removeButton');
    expect(buttons[0].getAttribute('aria-label')).toBe('Remove Design');
    expect(buttons[0].hasAttribute('aria-labelledby')).toBe(false);
    expect(chip.querySelector('[data-star-part=text]')!.hasAttribute('id')).toBe(false);
  });

  it('sets a tone class for each severity and none for null', async () => {
    const { fixture, el, host } = await setup();
    const chip = el.querySelector('#tone')!;
    expect(chip.classList).not.toContain('star-chip--tone');
    for (const tone of ['neutral', 'info', 'primary', 'success', 'warn', 'danger'] as const) {
      host.severity.set(tone);
      await fixture.whenStable();
      expect(chip.classList).toContain('star-chip--tone');
      expect(chip.classList).toContain(`star-chip--${tone}`);
      expect(chip.classList).toContain('star-chip');
    }
    host.severity.set(null);
    await fixture.whenStable();
    expect(chip.classList).not.toContain('star-chip--tone');
    expect(chip.classList).toContain('star-chip');
  });

  it('makes the body a button that emits chipClick, separate from the remove button', async () => {
    const { el, host } = await setup();
    const chip = el.querySelector('#filter')!;
    expect(chip.classList).toContain('star-chip--clickable');
    const body = chip.querySelector<HTMLButtonElement>('[data-star-part=bodyButton]')!;
    expect(body.tagName).toBe('BUTTON');
    expect(body.type).toBe('button');
    expect(body.textContent!.trim()).toBe('Status: Open');
    expect(body.querySelector('b')!.textContent).toBe('Status:');
    body.click();
    expect(host.log).toEqual(['click']);
    chip.querySelector<HTMLButtonElement>('[data-star-part=removeButton]')!.click();
    expect(host.log).toEqual(['click', 'removed']);
  });

  it('names the remove button after the projected text when there is no label', async () => {
    const { el } = await setup();
    const chip = el.querySelector('#filter')!;
    const remove = chip.querySelector<HTMLButtonElement>('[data-star-part=removeButton]')!;
    const text = chip.querySelector('[data-star-part=text]')!;
    expect(remove.getAttribute('aria-label')).toBe('Remove');
    expect(remove.getAttribute('aria-labelledby')).toBe(`${remove.id} ${text.id}`);
    expect(text.id).toMatch(/^star-chip-text-/);
  });

  it('a body without a remove button still emits chipClick', async () => {
    const { el, host } = await setup();
    el.querySelector<HTMLButtonElement>('#body [data-star-part=bodyButton]')!.click();
    expect(host.log).toEqual(['body']);
    expect(el.querySelector('#body [data-star-part=removeButton]')).toBeNull();
  });

  it('disables the body and the remove button of a disabled chip', async () => {
    const { fixture, el, host } = await setup();
    host.disabled.set(true);
    await fixture.whenStable();
    const buttons = el.querySelectorAll<HTMLButtonElement>('#filter button');
    expect([...buttons].map((button) => button.disabled)).toEqual([true, true]);
  });
});
