import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAvatar, StarAvatarGroup } from '@star-ng/ui/avatar';
import { provideStarUiText } from '@star-ng/ui/core';

@Component({
  imports: [StarAvatar, StarAvatarGroup],
  template: `
    <star-avatar-group [max]="max()" size="lg" ariaLabel="Project team">
      @for (name of names(); track name) {
        <star-avatar [name]="name" size="lg" />
      }
    </star-avatar-group>
  `,
})
class GroupHost {
  readonly max = signal<number | null>(3);
  readonly names = signal(['Jane Doe', 'Sam Lee', 'Ava Stone', 'Max Moor', 'Lea Park']);
}

async function setup() {
  const fixture = TestBed.createComponent(GroupHost);
  await fixture.whenStable();
  const group = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
    'star-avatar-group',
  )!;
  const shown = () =>
    [...group.querySelectorAll<HTMLElement>('star-avatar')]
      .filter((avatar) => !avatar.hidden)
      .map((avatar) => avatar.getAttribute('aria-label'));
  const more = () => group.querySelector<HTMLElement>('.star-avatar-group__more');
  return { fixture, group, shown, more };
}

describe('StarAvatarGroup', () => {
  it('is a named group of avatars', async () => {
    const { group } = await setup();
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Project team');
    expect(group.classList).toContain('star-avatar-group');
  });

  it('shows max avatars and a "+N" avatar with an accessible label', async () => {
    const { shown, more } = await setup();
    expect(shown()).toEqual(['Jane Doe', 'Sam Lee', 'Ava Stone']);
    expect(more()?.textContent?.trim()).toBe('+2');
    expect(more()?.getAttribute('role')).toBe('img');
    expect(more()?.getAttribute('aria-label')).toBe('2 more');
    expect(more()?.classList).toContain('star-avatar--lg');
  });

  it('follows changes of max and of the avatars', async () => {
    const { fixture, shown, more } = await setup();
    fixture.componentInstance.max.set(null);
    await fixture.whenStable();
    expect(shown().length).toBe(5);
    expect(more()).toBeNull();

    fixture.componentInstance.max.set(4);
    fixture.componentInstance.names.update((names) => [...names, 'Kim Ray']);
    await fixture.whenStable();
    expect(shown().length).toBe(4);
    expect(more()?.textContent?.trim()).toBe('+2');

    fixture.componentInstance.max.set(10);
    await fixture.whenStable();
    expect(more()).toBeNull();
  });

  it('reads the "more" text from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({
      providers: [provideStarUiText({ moreCount: (count) => `${count} weitere` })],
    });
    const { more } = await setup();
    expect(more()?.getAttribute('aria-label')).toBe('2 weitere');
  });
});

describe('StarAvatar outside a group', () => {
  it('is never hidden', async () => {
    @Component({ imports: [StarAvatar], template: `<star-avatar name="Jane Doe" />` })
    class Single {}
    const fixture = TestBed.createComponent(Single);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('star-avatar')!.hidden,
    ).toBe(false);
  });
});
