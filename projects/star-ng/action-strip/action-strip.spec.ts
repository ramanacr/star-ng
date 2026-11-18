import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarActionStrip } from '@star-ng/ui/action-strip';
import { provideStarUiText } from '@star-ng/ui/core';
import { StarMenuItem } from '@star-ng/ui/menu';

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

function key(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

@Component({
  imports: [StarActionStrip],
  template: `
    <div class="row" [attr.dir]="dir()">
      Order 1001
      <star-action-strip
        [actions]="actions"
        [max]="max()"
        [ariaLabel]="label()"
        (actionClick)="clicked.push($event.label ?? '')"
      />
    </div>
  `,
})
class StripHost {
  readonly ran: string[] = [];
  readonly clicked: string[] = [];
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly max = signal<number | null>(null);
  readonly label = signal<string | null>(null);
  readonly actions: StarMenuItem[] = [
    { label: 'Edit', icon: 'ph-bold ph-pencil-simple', command: () => this.ran.push('edit') },
    { label: 'Copy', icon: 'ph-bold ph-copy', disabled: true },
    { label: 'Archive', icon: 'ph-bold ph-archive' },
    { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
  ];
}

async function setup() {
  const fixture = TestBed.createComponent(StripHost);
  await fixture.whenStable();
  const strip = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
    'star-action-strip',
  )!;
  const buttons = () => [...strip.querySelectorAll<HTMLButtonElement>('button')];
  const tabStops = () => buttons().filter((button) => button.tabIndex === 0);
  return { fixture, strip, buttons, tabStops };
}

describe('StarActionStrip', () => {
  it('is a toolbar of named icon buttons', async () => {
    const { fixture, strip, buttons } = await setup();
    expect(strip.getAttribute('role')).toBe('toolbar');
    expect(strip.getAttribute('aria-label')).toBe('Actions');
    expect(buttons().map((button) => button.getAttribute('aria-label'))).toEqual([
      'Edit',
      'Copy',
      'Archive',
      'Delete',
    ]);
    expect(buttons()[1].disabled).toBe(true);
    expect(buttons()[0].querySelector('i')?.getAttribute('aria-hidden')).toBe('true');

    fixture.componentInstance.label.set('Order actions');
    await fixture.whenStable();
    expect(strip.getAttribute('aria-label')).toBe('Order actions');
  });

  it('has one tab stop and moves the focus with the arrow keys, Home and End', async () => {
    const { fixture, buttons, tabStops } = await setup();
    expect(tabStops()).toEqual([buttons()[0]]);
    buttons()[0].focus();
    key(buttons()[0], 'ArrowRight');
    await fixture.whenStable();
    // Copy is disabled: skipped.
    expect(document.activeElement).toBe(buttons()[2]);
    expect(tabStops()).toEqual([buttons()[2]]);
    key(document.activeElement!, 'End');
    expect(document.activeElement).toBe(buttons()[3]);
    key(document.activeElement!, 'ArrowRight');
    expect(document.activeElement).toBe(buttons()[0]);
    key(document.activeElement!, 'ArrowLeft');
    expect(document.activeElement).toBe(buttons()[3]);
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('swaps the arrow keys in right-to-left', async () => {
    const { fixture, buttons } = await setup();
    fixture.componentInstance.dir.set('rtl');
    await fixture.whenStable();
    buttons()[0].focus();
    key(buttons()[0], 'ArrowLeft');
    expect(document.activeElement).toBe(buttons()[2]);
  });

  it('renders no button for a separator', async () => {
    const { fixture, buttons } = await setup();
    fixture.componentInstance.actions.splice(1, 0, { separator: true });
    fixture.componentInstance.max.set(10);
    await fixture.whenStable();
    expect(buttons().map((button) => button.getAttribute('aria-label'))).toEqual([
      'Edit',
      'Copy',
      'Archive',
      'Delete',
    ]);
  });

  it('runs the command and emits actionClick on a click', async () => {
    const { fixture, buttons } = await setup();
    buttons()[0].click();
    buttons()[2].click();
    expect(fixture.componentInstance.ran).toEqual(['edit']);
    expect(fixture.componentInstance.clicked).toEqual(['Edit', 'Archive']);
  });

  it('puts the actions over max in a "More actions" menu', async () => {
    const { fixture, strip, buttons } = await setup();
    fixture.componentInstance.max.set(2);
    await fixture.whenStable();
    expect(buttons().length).toBe(3);
    const more = buttons()[2];
    expect(more.getAttribute('aria-label')).toBe('More actions');
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    // The menu trigger is part of the roving focus.
    buttons()[0].focus();
    key(buttons()[0], 'End');
    expect(document.activeElement).toBe(more);

    more.click();
    await fixture.whenStable();
    const items = [...document.querySelectorAll<HTMLElement>('[role=menuitem]')];
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Archive', 'Delete']);
    expect(strip.classList).toContain('star-action-strip--open');
    items[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.clicked).toEqual(['Archive']);
    expect(strip.classList).not.toContain('star-action-strip--open');
  });

  it('reads its texts from STAR_UI_TEXT', async () => {
    TestBed.configureTestingModule({
      providers: [provideStarUiText({ actions: 'Aktionen', moreActions: 'Weitere Aktionen' })],
    });
    const { fixture, strip, buttons } = await setup();
    fixture.componentInstance.max.set(1);
    await fixture.whenStable();
    expect(strip.getAttribute('aria-label')).toBe('Aktionen');
    expect(buttons()[1].getAttribute('aria-label')).toBe('Weitere Aktionen');
  });
});
