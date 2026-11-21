import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarNg, StarAnnouncer, StarFluid } from '@star-ng/ui/core';
import { StarIcon } from '@star-ng/ui/icon';
import { StarChipsArea, StarChipsAreaReorderEvent } from '@star-ng/ui/layout';
import { StarCascadeSelect } from '@star-ng/ui/select';

@Component({
  imports: [StarIcon],
  template: `
    <star-icon id="deco" name="house" />
    <star-icon id="named" name="ph-trash" weight="fill" [size]="24" label="Delete" />
    <star-icon id="sized" name="star" weight="regular" size="2rem" mirror />
  `,
})
class IconHost {}

describe('StarIcon', () => {
  it('wraps a Phosphor class with weight, size and a name or decorative mode', async () => {
    const fixture = TestBed.createComponent(IconHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const deco = el.querySelector<HTMLElement>('#deco')!;
    expect(deco.getAttribute('aria-hidden')).toBe('true');
    expect(deco.hasAttribute('role')).toBe(false);
    expect(deco.querySelector('i')!.className).toBe('ph-bold ph-house');
    const named = el.querySelector<HTMLElement>('#named')!;
    expect(named.getAttribute('role')).toBe('img');
    expect(named.getAttribute('aria-label')).toBe('Delete');
    expect(named.hasAttribute('aria-hidden')).toBe(false);
    expect(named.querySelector('i')!.className).toBe('ph-fill ph-trash');
    expect(named.style.fontSize).toBe('24px');
    const sized = el.querySelector<HTMLElement>('#sized')!;
    expect(sized.querySelector('i')!.className).toBe('ph ph-star star-icon-mirror');
    expect(sized.style.fontSize).toBe('2rem');
  });
});

@Component({
  imports: [StarChipsArea],
  template: `
    <star-chips-area
      ariaLabel="Tags"
      [(items)]="tags"
      removable
      (reorder)="moves.push($event)"
      (removed)="removedTags.push($event)"
    />
  `,
})
class ChipsHost {
  readonly tags = signal<readonly string[]>(['red', 'green', 'blue']);
  readonly moves: StarChipsAreaReorderEvent<string>[] = [];
  readonly removedTags: string[] = [];
}

describe('StarChipsArea', () => {
  it('reorders with Control+Shift and the arrow keys, announces, and removes with Delete', async () => {
    const fixture = TestBed.createComponent(ChipsHost);
    await fixture.whenStable();
    const announcer = TestBed.inject(StarAnnouncer);
    const said: string[] = [];
    const original = announcer.announce.bind(announcer);
    announcer.announce = ((message: string, ...rest: unknown[]) => {
      said.push(message);
      return (original as (...args: unknown[]) => unknown)(message, ...rest);
    }) as typeof announcer.announce;
    const el = fixture.nativeElement as HTMLElement;
    const list = el.querySelector('[role=list]')!;
    expect(list.getAttribute('aria-label')).toBe('Tags');
    const chips = () => [...el.querySelectorAll<HTMLElement>('[data-star-part=chipButton]')];
    expect(chips().map((c) => c.textContent!.trim())).toEqual(['red', 'green', 'blue']);
    expect(chips().map((c) => c.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);

    chips()[0].focus();
    chips()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(chips()[1]);

    chips()[1].dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    await fixture.whenStable();
    expect(fixture.componentInstance.tags()).toEqual(['red', 'blue', 'green']);
    expect(fixture.componentInstance.moves[0]).toEqual({
      item: 'green',
      previousIndex: 1,
      currentIndex: 2,
    });
    expect(said).toContain('green, position 3 of 3');
    expect(document.activeElement).toBe(chips()[2]);

    chips()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.tags()).toEqual(['red', 'blue']);
    expect(fixture.componentInstance.removedTags).toEqual(['green']);
    expect(said).toContain('green removed');
    expect(document.activeElement).toBe(chips()[1]);
  });
});

interface Tag {
  readonly id: number;
  readonly name: string;
}

@Component({
  imports: [StarChipsArea],
  template: `
    <star-chips-area
      ariaLabel="Labels"
      [(items)]="tags"
      optionLabel="name"
      [trackBy]="byId"
      removable
    />
  `,
})
class ChipsKeyHost {
  readonly tags = signal<readonly Tag[]>([
    { id: 1, name: 'red' },
    { id: 2, name: 'green' },
    { id: 3, name: 'blue' },
  ]);
  readonly byId = (_: number, tag: Tag) => tag.id;
}

describe('StarChipsArea access and identity', () => {
  it('names the remove buttons for assistive technology and keeps them out of the tab order', async () => {
    const fixture = TestBed.createComponent(ChipsKeyHost);
    await fixture.whenStable();
    const remove = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[data-star-part=removeButton]',
    );
    expect(remove.length).toBe(3);
    expect(remove[1].getAttribute('aria-label')).toBe('Remove green');
    expect(remove[1].hasAttribute('aria-hidden')).toBe(false);
    expect(remove[1].getAttribute('tabindex')).toBe('-1');
  });

  it('keeps one chip in the tab order when the owner removes items', async () => {
    const fixture = TestBed.createComponent(ChipsKeyHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const chips = () => [...el.querySelectorAll<HTMLElement>('[data-star-part=chipButton]')];
    chips()[2].focus();
    await fixture.whenStable();
    expect(chips()[2].getAttribute('tabindex')).toBe('0');
    fixture.componentInstance.tags.set([{ id: 1, name: 'red' }]);
    await fixture.whenStable();
    expect(chips().map((c) => c.getAttribute('tabindex'))).toEqual(['0']);
  });

  it('keeps the DOM of an item when the items move (trackBy)', async () => {
    const fixture = TestBed.createComponent(ChipsKeyHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const blue = el.querySelectorAll('[data-star-part=listItem]')[2];
    const [r, g, b] = fixture.componentInstance.tags();
    fixture.componentInstance.tags.set([b, r, g]);
    await fixture.whenStable();
    expect(el.querySelectorAll('[data-star-part=listItem]')[0]).toBe(blue);
  });
});

@Component({
  imports: [StarFluid, StarCascadeSelect],
  template: `
    <div [starFluid]="on()" id="box">
      <star-cascade-select ariaLabel="Place" [options]="[]" />
    </div>
  `,
})
class FluidHost {
  readonly on = signal(true);
}

describe('Fluid layout', () => {
  it('starFluid marks a container, and provideStarNg({ fluid }) marks the page and sets the default', async () => {
    TestBed.configureTestingModule({ providers: [provideStarNg({ fluid: true })] });
    const fixture = TestBed.createComponent(FluidHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#box')!.getAttribute('data-star-fluid')).toBe('');
    expect(document.documentElement.hasAttribute('data-star-fluid')).toBe(true);
    expect(el.querySelector('star-cascade-select')!.classList).toContain('star-cascade--fluid');
    fixture.componentInstance.on.set(false);
    await fixture.whenStable();
    // Off: a nearer data-star-fluid="false" turns the fluid layout off for its content.
    expect(el.querySelector('#box')!.getAttribute('data-star-fluid')).toBe('false');
    fixture.destroy();
    document.documentElement.removeAttribute('data-star-fluid');
  });
});
