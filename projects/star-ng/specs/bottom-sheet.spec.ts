import { Component, inject, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  STAR_BOTTOM_SHEET_DATA,
  StarBottomSheet,
  StarBottomSheetContext,
  StarBottomSheetRef,
} from '@star-ng/ui/bottom-sheet';
import { provideStarUiText } from '@star-ng/ui/core';

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
  template: `
    <p class="order">Order {{ data.id }}</p>
    <button id="pdf" type="button" (click)="ref.dismiss('pdf')">PDF</button>
    <button id="csv" type="button" data-autofocus (click)="ref.dismiss('csv')">CSV</button>
  `,
})
class ExportOrder {
  readonly data = inject<{ id: string }>(STAR_BOTTOM_SHEET_DATA);
  readonly ref = inject<StarBottomSheetRef<string>>(StarBottomSheetRef);
}

@Component({
  template: `
    <button id="opener" type="button">Open</button>
    <ng-template #tpl let-data let-ref="ref">
      <button id="tpl-ok" type="button" (click)="ref.dismiss(data + ' ok')">OK</button>
    </ng-template>
  `,
})
class Page {
  readonly tpl = viewChild.required<TemplateRef<StarBottomSheetContext<string, string>>>('tpl');
}

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  }
};

const sheet = () => document.querySelector<HTMLDialogElement>('dialog.star-bottom-sheet');

async function setup() {
  const fixture = TestBed.createComponent(Page);
  await fixture.whenStable();
  const opener = document.getElementById('opener') as HTMLButtonElement;
  opener.focus();
  return { fixture, opener, service: TestBed.inject(StarBottomSheet) };
}

describe('StarBottomSheet', () => {
  afterEach(() => TestBed.inject(StarBottomSheet).dismiss());

  it('opens a component as a modal sheet with data, focus and a result', async () => {
    const { opener, service } = await setup();
    const ref = service.open<ExportOrder, { id: string }, string>(ExportOrder, {
      data: { id: 'ORD-1042' },
      ariaLabel: 'Export order',
      panelClass: ['wide', 'tall'],
      maxHeight: '50dvh',
    });
    await settle();
    const dialog = sheet()!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.classList).toContain('star-bottom-sheet--modal');
    expect(dialog.classList).toContain('wide');
    expect(dialog.classList).toContain('tall');
    expect(dialog.style.maxHeight).toBe('50dvh');
    expect(dialog.getAttribute('aria-label')).toBe('Export order');
    expect(dialog.querySelector('.star-bottom-sheet__handle')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(dialog.querySelector('.order')?.textContent).toBe('Order ORD-1042');
    // data-autofocus wins over the first button.
    expect(document.activeElement?.id).toBe('csv');

    dialog.querySelector<HTMLButtonElement>('#pdf')!.click();
    await expect(ref.afterDismissed()).resolves.toBe('pdf');
    await expect(ref.closed).resolves.toBe('pdf');
    await settle();
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('opens a template with let-data and let-ref', async () => {
    const { fixture, service } = await setup();
    const ref = service.open(fixture.componentInstance.tpl(), { data: 'INV-2041' });
    await settle();
    expect(document.activeElement?.id).toBe('tpl-ok');
    sheet()!.querySelector<HTMLButtonElement>('#tpl-ok')!.click();
    await expect(ref.closed).resolves.toBe('INV-2041 ok');
  });

  it('dismisses with undefined on Escape and on a backdrop click, and returns the focus', async () => {
    const { opener, service } = await setup();
    const first = service.open(ExportOrder, { data: { id: 'A' } });
    await settle();
    sheet()!.dispatchEvent(new Event('cancel', { cancelable: true }));
    await expect(first.closed).resolves.toBeUndefined();
    await settle();
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(opener);

    const second = service.open(ExportOrder, { data: { id: 'B' } });
    await settle();
    sheet()!.click();
    await expect(second.closed).resolves.toBeUndefined();
  });

  it('keeps the sheet open when closeOnEscape and closeOnBackdrop are false', async () => {
    const { service } = await setup();
    const ref = service.open(ExportOrder, {
      data: { id: 'A' },
      closeOnEscape: false,
      closeOnBackdrop: false,
    });
    await settle();
    const cancel = new Event('cancel', { cancelable: true });
    sheet()!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    sheet()!.click();
    await settle();
    expect(sheet()?.hasAttribute('open')).toBe(true);
    ref.dismiss('done');
    await expect(ref.closed).resolves.toBe('done');
  });

  it('opens without a backdrop as a non-modal sheet that Escape closes', async () => {
    const { service } = await setup();
    const show = vi.spyOn(HTMLDialogElement.prototype, 'show');
    const ref = service.open(ExportOrder, { data: { id: 'A' }, hasBackdrop: false });
    await settle();
    expect(show).toHaveBeenCalled();
    expect(sheet()!.classList).not.toContain('star-bottom-sheet--modal');
    sheet()!
      .querySelector('#pdf')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(ref.closed).resolves.toBeUndefined();
    show.mockRestore();
  });

  it('closes on a backdrop click only, not on the handle row or the padding', async () => {
    const { service } = await setup();
    const ref = service.open(ExportOrder, { data: { id: 'A' } });
    await settle();
    const dialog = sheet()!;
    const surface = dialog.querySelector<HTMLElement>('.star-bottom-sheet__surface')!;
    // The surface wraps the handle and the body, so a click there never targets the dialog.
    expect(surface.parentElement).toBe(dialog);
    expect(surface.contains(dialog.querySelector('.star-bottom-sheet__handle'))).toBe(true);
    expect(surface.contains(dialog.querySelector('.star-bottom-sheet__body'))).toBe(true);
    dialog.querySelector<HTMLElement>('.star-bottom-sheet__handle')!.click();
    surface.click();
    dialog.querySelector<HTMLElement>('.star-bottom-sheet__body')!.click();
    await settle();
    expect(sheet()?.hasAttribute('open')).toBe(true);

    // The ::backdrop: the click target is the dialog itself.
    dialog.click();
    await expect(ref.closed).resolves.toBeUndefined();
  });

  it('two open() calls in one tick give one sheet and dismiss the first one', async () => {
    const { service } = await setup();
    const first = service.open(ExportOrder, { data: { id: 'A' } });
    const second = service.open(ExportOrder, { data: { id: 'B' } });
    await expect(first.closed).resolves.toBeUndefined();
    await settle();
    const sheets = document.querySelectorAll('dialog.star-bottom-sheet');
    expect(sheets.length).toBe(1);
    expect(sheets[0].hasAttribute('open')).toBe(true);
    expect(sheets[0].textContent).toContain('Order B');
    second.dismiss('done');
    await expect(second.closed).resolves.toBe('done');
    await settle();
    expect(document.querySelectorAll('dialog.star-bottom-sheet').length).toBe(0);
  });

  it('keeps one sheet open at a time', async () => {
    const { service } = await setup();
    const first = service.open(ExportOrder, { data: { id: 'A' } });
    await settle();
    const second = service.open(ExportOrder, { data: { id: 'B' } });
    await expect(first.closed).resolves.toBeUndefined();
    await settle();
    expect(document.querySelectorAll('dialog.star-bottom-sheet').length).toBe(1);
    expect(sheet()!.textContent).toContain('Order B');
    second.dismiss();
  });

  it('uses the bottomSheet UI text as the default name', async () => {
    TestBed.configureTestingModule({
      providers: [provideStarUiText({ bottomSheet: 'Blatt' })],
    });
    const { service } = await setup();
    service.open(ExportOrder, { data: { id: 'A' } });
    await settle();
    expect(sheet()!.getAttribute('aria-label')).toBe('Blatt');
  });
});

describe('action sheet', () => {
  afterEach(() => TestBed.inject(StarBottomSheet).dismiss());

  const items = () => [...sheet()!.querySelectorAll<HTMLButtonElement>('button')];

  it('lists the actions and resolves with the chosen one', async () => {
    const { service } = await setup();
    const ref = service.openActions([
      { label: 'Share', icon: 'ph-bold ph-share', value: 'share' },
      { label: 'Duplicate', disabled: true },
      { label: 'Delete', danger: true, value: 'delete' },
    ]);
    await settle();
    expect(sheet()!.getAttribute('aria-label')).toBe('Actions');
    expect(sheet()!.querySelector('ul')?.getAttribute('role')).toBe('list');
    expect(items().map((b) => b.textContent?.trim())).toEqual([
      'Share',
      'Duplicate',
      'Delete',
      'Cancel',
    ]);
    expect(items()[0].querySelector('i')?.getAttribute('aria-hidden')).toBe('true');
    expect(items()[1].disabled).toBe(true);
    expect(items()[2].classList).toContain('star-action-sheet__item--danger');
    expect(document.activeElement).toBe(items()[0]);

    items()[2].click();
    await expect(ref.closed).resolves.toEqual({ label: 'Delete', danger: true, value: 'delete' });
  });

  it('resolves undefined on Cancel and takes a custom name', async () => {
    const { service } = await setup();
    const ref = service.openActions([{ label: 'Share' }], { ariaLabel: 'Invoice actions' });
    await settle();
    expect(sheet()!.getAttribute('aria-label')).toBe('Invoice actions');
    items()[1].click();
    await expect(ref.closed).resolves.toBeUndefined();
  });
});
