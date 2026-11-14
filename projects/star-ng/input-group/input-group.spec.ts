import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarInput } from 'star-ng/field';
import { StarIconField, StarInputGroup, StarInputGroupAddon } from './input-group';

@Component({
  imports: [StarIconField, StarInputGroup, StarInputGroupAddon, StarInput],
  template: `
    <star-icon-field icon="ph-bold ph-magnifying-glass" [iconPosition]="position()">
      <input starInput type="search" aria-label="Search" />
    </star-icon-field>
    <star-input-group ariaLabel="Dose">
      <input starInput aria-label="Amount" />
      <star-input-group-addon>kg</star-input-group-addon>
    </star-input-group>
  `,
})
class Host {
  readonly position = signal<'start' | 'end'>('start');
}

describe('StarIconField and StarInputGroup', () => {
  it('renders a decorative icon next to the projected input and switches sides', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('star-icon-field')!;
    const icon = field.querySelector('i')!;
    expect(icon.className).toContain('ph-magnifying-glass');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(field.querySelector('input.star-input')).not.toBeNull();
    expect(field.classList.contains('star-icon-field--end')).toBe(false);

    fixture.componentInstance.position.set('end');
    await fixture.whenStable();
    expect(field.classList.contains('star-icon-field--end')).toBe(true);
  });

  it('groups the input and its add-on under one accessible name', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const group = (fixture.nativeElement as HTMLElement).querySelector('star-input-group')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Dose');
    expect(group.querySelector('.star-input-group__addon')?.textContent).toBe('kg');
  });
});
