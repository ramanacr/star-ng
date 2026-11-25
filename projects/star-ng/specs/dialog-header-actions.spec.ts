import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarButton } from '@star-ng/ui/button';
import {
  StarDialog,
  StarDialogHeaderActions,
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

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    TestBed.tick();
    await Promise.resolve();
  }
};

/** The opened `SendReport` components, the last one at the end. */
const instances: SendReport[] = [];
const latest = () => instances[instances.length - 1];

/** Content of a service dialog with its own header buttons: Send is off until the text is valid. */
@Component({
  imports: [StarButton, StarDialogHeaderActions],
  template: `
    <ng-template starDialogHeaderActions>
      <star-button size="sm" class="send" [disabled]="!valid()" (pressed)="send()"
        >Send</star-button
      >
      <star-button size="sm" variant="secondary" class="cancel" (pressed)="ref.close()"
        >Cancel</star-button
      >
    </ng-template>
    @if (extra()) {
      <ng-template starDialogHeaderActions>
        <button type="button" class="extra">Extra</button>
      </ng-template>
    }
    <p class="content">Report</p>
  `,
})
class SendReport {
  readonly ref = inject<StarDialogRef<string>>(StarDialogRef);
  readonly text = signal('');
  readonly extra = signal(false);
  readonly valid = () => this.text().trim().length > 0;
  sendCount = 0;

  constructor() {
    instances.push(this);
  }

  send(): void {
    this.sendCount++;
    if (!this.valid()) return;
    this.ref.close(`sent: ${this.text().trim()}`);
  }
}

/** The last opened `SendReport`. */

function openReport(config = {}) {
  const ref = TestBed.inject(StarDialogService).open<SendReport, unknown, string>(SendReport, {
    header: 'Send report',
    ...config,
  });
  return ref;
}

const dialog = () => document.querySelector<HTMLDialogElement>('star-dialog-container dialog')!;
const controls = () => dialog().querySelector<HTMLElement>('[data-star-part="controlsPanel"]')!;
/** The buttons of the header controls, in DOM (and Tab) order, by their text or label. */
const controlNames = () =>
  Array.from(controls().querySelectorAll('button')).map(
    (button) => button.getAttribute('aria-label') ?? button.textContent!.trim(),
  );

describe('StarDialogService header actions from the opened component', () => {
  beforeEach(() => (instances.length = 0));
  afterEach(() => TestBed.inject(StarDialogService).closeAll());

  it('puts the template content of the component in the header, before the close button', async () => {
    openReport();
    await settle();
    expect(controlNames()).toEqual(['Send', 'Cancel', 'Close']);
    // The body keeps the rest of the content, and not the header buttons.
    const body = dialog().querySelector('.star-dialog__body')!;
    expect(body.querySelector('.content')).not.toBeNull();
    expect(body.querySelector('.send')).toBeNull();
  });

  it('follows the state of the component and runs its logic before the close', async () => {
    const ref = openReport();
    await settle();
    const instance = latest();
    const send = () => controls().querySelector<HTMLButtonElement>('.send button')!;
    expect(send().disabled).toBe(true);

    instance.text.set('Weekly totals');
    await settle();
    expect(send().disabled).toBe(false);

    instance.text.set('  ');
    await settle();
    expect(send().disabled).toBe(true);

    instance.text.set('Weekly totals');
    await settle();
    send().click();
    await settle();
    expect(instance.sendCount).toBe(1);
    await expect(ref.closed).resolves.toBe('sent: Weekly totals');
  });

  it('closes with the button of the component that gives no result', async () => {
    const ref = openReport();
    await settle();
    controls().querySelector<HTMLButtonElement>('.cancel button')!.click();
    await settle();
    await expect(ref.closed).resolves.toBeUndefined();
  });

  it('adds and removes templates while the dialog is open', async () => {
    openReport();
    await settle();
    const instance = latest();
    instance.extra.set(true);
    await settle();
    expect(controlNames()).toEqual(['Send', 'Cancel', 'Extra', 'Close']);
    instance.extra.set(false);
    await settle();
    expect(controlNames()).toEqual(['Send', 'Cancel', 'Close']);
  });

  it('removes the header content when the dialog closes', async () => {
    const ref = openReport();
    await settle();
    ref.close('done');
    await settle();
    await ref.closed;
    // The host leaves after the exit motion; jsdom has none, so it goes at once or soon after.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle();
    expect(document.querySelector('star-dialog-container')).toBeNull();
    expect(document.querySelector('.send')).toBeNull();
  });

  it('puts the component templates first, then headerActions, then headerAction', async () => {
    const ref = openReport({
      closable: false,
      headerActions: [
        { label: 'Save draft', variant: 'secondary', result: 'draft' },
        { label: 'Preview', variant: 'ghost', result: 'preview' },
      ],
      headerAction: { label: 'Close', variant: 'secondary', result: 'closed' },
    });
    await settle();
    expect(controlNames()).toEqual(['Send', 'Cancel', 'Save draft', 'Preview', 'Close']);
    const buttons = Array.from(controls().querySelectorAll<HTMLButtonElement>('button'));
    buttons[2].click();
    await settle();
    await expect(ref.closed).resolves.toBe('draft');
  });

  it('works in a side sheet', async () => {
    openReport({ sheet: true });
    await settle();
    expect(dialog().classList).toContain('star-dialog--sheet');
    expect(controlNames()).toEqual(['Send', 'Cancel', 'Close']);
  });
});

@Component({
  imports: [StarDialog, StarDialogHeaderActions],
  template: `
    <star-dialog [visible]="true" header="Template dialog">
      <ng-template starDialogHeaderActions>
        <button type="button" class="from-template">From template</button>
      </ng-template>
      <button starDialogHeaderActions type="button" class="projected">Projected</button>
      <p>Body</p>
    </star-dialog>
  `,
})
class TemplateDialogHost {}

describe('StarDialog with ng-template starDialogHeaderActions', () => {
  it('renders the template after the projected header actions', async () => {
    const fixture = TestBed.createComponent(TemplateDialogHost);
    await fixture.whenStable();
    const panel = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-star-part="controlsPanel"]',
    )!;
    const names = Array.from(panel.querySelectorAll('button')).map(
      (button) => button.getAttribute('aria-label') ?? button.textContent!.trim(),
    );
    expect(names).toEqual(['Projected', 'From template', 'Close']);
  });
});
