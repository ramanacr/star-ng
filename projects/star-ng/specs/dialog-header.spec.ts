import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  STAR_DIALOG_DATA,
  StarDialog,
  StarDialogIconTone,
  StarDialogRef,
  StarDialogService,
} from '@star-ng/ui/dialog';

// jsdom has no HTMLDialogElement methods. Minimal stand-ins (real browsers implement these).
const dialogProto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
dialogProto.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
dialogProto.show ??= dialogProto.showModal;
dialogProto.close ??= function (this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

@Component({
  imports: [StarDialog],
  template: `
    <star-dialog
      [visible]="true"
      header="Restore record"
      [subheader]="subheader()"
      [icon]="icon()"
      [iconTone]="tone()"
      [headerDivider]="divider()"
    >
      <span starDialogHeader class="extra">Saved at 10:42</span>
      <button starDialogHeaderActions type="button" class="header-action">Close</button>
      <p>Body</p>
    </star-dialog>
  `,
})
class HeaderHost {
  readonly subheader = signal('');
  readonly icon = signal<string | null>(null);
  readonly tone = signal<StarDialogIconTone>('primary');
  readonly divider = signal(false);
}

async function setup() {
  const fixture = TestBed.createComponent(HeaderHost);
  await fixture.whenStable();
  const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  return { fixture, dialog, host: fixture.componentInstance };
}

describe('StarDialog header', () => {
  it('keeps the default header without icon, subheader or divider', async () => {
    const { dialog } = await setup();
    expect(dialog.querySelector('.star-dialog__icon')).toBeNull();
    expect(dialog.querySelector('.star-dialog__subheader')).toBeNull();
    expect(dialog.querySelector('.star-dialog__heading--icon')).toBeNull();
    expect(dialog.querySelector('header')!.classList).not.toContain('star-dialog__header--divided');
    const title = dialog.querySelector('h2')!;
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('shows a decorative icon tile in the tone before the title', async () => {
    const { fixture, dialog, host } = await setup();
    host.icon.set('file-text');
    host.tone.set('info');
    await fixture.whenStable();
    const tile = dialog.querySelector<HTMLElement>('[data-star-part="headerIconPanel"]')!;
    expect(tile.getAttribute('aria-hidden')).toBe('true');
    expect(tile.classList).toContain('star-dialog__icon');
    expect(tile.classList).toContain('star-dialog__icon--info');
    const glyph = tile.querySelector('[data-star-part="headerIcon"]')!;
    expect(glyph.className).toBe('ph-bold ph-file-text');
    // The tile comes before the title.
    const heading = dialog.querySelector('[data-star-part="headingPanel"]')!;
    expect(heading.classList).toContain('star-dialog__heading--icon');
    expect(heading.firstElementChild).toBe(tile);

    host.icon.set('ph-fill ph-warning');
    host.tone.set('danger');
    await fixture.whenStable();
    expect(dialog.querySelector('[data-star-part="headerIcon"]')!.className).toBe(
      'ph-fill ph-warning',
    );
    expect(dialog.querySelector('.star-dialog__icon--danger')).not.toBeNull();

    host.icon.set('ph-trash');
    await fixture.whenStable();
    expect(dialog.querySelector('[data-star-part="headerIcon"]')!.className).toBe(
      'ph-bold ph-trash',
    );

    host.icon.set('  ');
    await fixture.whenStable();
    expect(dialog.querySelector('.star-dialog__icon')).toBeNull();
  });

  it('shows the subheader after the title and adds it to the accessible name', async () => {
    const { fixture, dialog, host } = await setup();
    host.subheader.set('REC-2041');
    await fixture.whenStable();
    const line = dialog.querySelector('[data-star-part="titleLinePanel"]')!;
    const title = line.querySelector('h2')!;
    const sub = line.querySelector<HTMLElement>('[data-star-part="subheaderText"]')!;
    expect(sub.textContent).toBe('REC-2041');
    expect(title.nextElementSibling).toBe(sub);
    expect(dialog.getAttribute('aria-labelledby')).toBe(`${title.id} ${sub.id}`);
    expect(dialog.hasAttribute('aria-label')).toBe(false);
  });

  it('draws a divider under the header with headerDivider', async () => {
    const { fixture, dialog, host } = await setup();
    host.divider.set(true);
    await fixture.whenStable();
    expect(dialog.querySelector('header')!.classList).toContain('star-dialog__header--divided');
  });

  it('puts header actions before the close button and header content under the title', async () => {
    const { dialog } = await setup();
    const controls = dialog.querySelector('[data-star-part="controlsPanel"]')!;
    const action = controls.querySelector('.header-action')!;
    expect(action.nextElementSibling?.classList).toContain('star-dialog__close');
    const text = dialog.querySelector('[data-star-part="headingTextPanel"]')!;
    expect(text.querySelector('.extra')).not.toBeNull();
  });
});

@Component({ template: `<p class="content">{{ data }}</p>` })
class Content {
  readonly data = inject(STAR_DIALOG_DATA);
  readonly ref = inject(StarDialogRef);
}

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    TestBed.tick();
    await Promise.resolve();
  }
};

describe('StarDialogService header options', () => {
  afterEach(() => TestBed.inject(StarDialogService).closeAll());

  it('passes the icon, tone, subheader and divider to the dialog', async () => {
    TestBed.inject(StarDialogService).open(Content, {
      header: 'Preview',
      subheader: 'REC-2041',
      icon: 'file-text',
      iconTone: 'success',
      headerDivider: true,
    });
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;
    expect(dialog.querySelector('.star-dialog__icon--success i')!.className).toBe(
      'ph-bold ph-file-text',
    );
    const sub = dialog.querySelector<HTMLElement>('.star-dialog__subheader')!;
    expect(sub.textContent).toBe('REC-2041');
    expect(dialog.getAttribute('aria-labelledby')).toContain(sub.id);
    expect(dialog.querySelector('header')!.classList).toContain('star-dialog__header--divided');
    // No header action without the option.
    expect(dialog.querySelector('[data-star-part="controlsPanel"] star-button')).toBeNull();
  });

  it('shows a header action that closes the dialog with its result', async () => {
    const ref = TestBed.inject(StarDialogService).open<Content, unknown, string>(Content, {
      header: 'Preview',
      closable: false,
      headerAction: { label: 'Close', variant: 'secondary', result: 'done' },
    });
    await settle();
    const dialog = document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;
    expect(dialog.querySelector('.star-dialog__close')).toBeNull();
    const button = dialog.querySelector<HTMLButtonElement>(
      '[data-star-part="controlsPanel"] star-button button',
    )!;
    expect(button.textContent?.trim()).toBe('Close');
    button.click();
    await settle();
    await expect(ref.closed).resolves.toBe('done');
  });
});
