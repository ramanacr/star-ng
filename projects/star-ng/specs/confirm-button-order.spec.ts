import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideStarDialogDefaults,
  StarConfirmHost,
  StarConfirmOptions,
  StarConfirmService,
  StarConfirmTemplate,
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

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarConfirmHost, StarConfirmTemplate],
  template: `
    <button type="button" #target>Delete invoice</button>
    <star-confirm-host>
      <ng-template starConfirmTemplate="acceptIcon"><i class="accept-icon"></i></ng-template>
    </star-confirm-host>
  `,
})
class Host {
  readonly target = viewChild.required<ElementRef<HTMLButtonElement>>('target');
}

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  }
};

type Surface = 'dialog' | 'popup';

/** Opens one request on the dialog or the popup and returns its buttons in DOM order. */
async function open(surface: Surface, options: Omit<StarConfirmOptions, 'target'>) {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const confirm = TestBed.inject(StarConfirmService);
  const target = fixture.componentInstance.target();
  target.nativeElement.focus();
  const result = confirm.ask(surface === 'popup' ? { ...options, target } : options);
  await settle();
  const root =
    surface === 'popup'
      ? document.querySelector<HTMLElement>('.star-popover')!
      : (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('dialog')!;
  const actions = root.querySelector<HTMLElement>('.star-confirm__actions, .star-dialog__footer')!;
  const buttons = [...actions.querySelectorAll('button')];
  const labels = buttons.map((b) => b.textContent?.trim());
  /** The button host that carries `data-autofocus`. */
  const autofocus = () =>
    [...actions.querySelectorAll('star-button')]
      .filter((b) => b.hasAttribute('data-autofocus'))
      .map((b) => b.textContent?.trim());
  return { confirm, result, buttons, labels, autofocus };
}

describe('confirm buttonOrder', () => {
  for (const surface of ['dialog', 'popup'] as const) {
    describe(surface, () => {
      it('renders reject first by default', async () => {
        const { labels, autofocus, confirm } = await open(surface, { message: 'Delete?' });
        expect(labels).toEqual(['Cancel', 'Confirm']);
        expect(autofocus()).toEqual(['Cancel']);
        confirm.settle(false);
      });

      it('renders accept first in the DOM with buttonOrder accept-first', async () => {
        const { labels, buttons, autofocus, result } = await open(surface, {
          message: 'Delete?',
          acceptLabel: 'Delete',
          severity: 'danger',
          buttonOrder: 'accept-first',
        });
        expect(labels).toEqual(['Delete', 'Cancel']);
        // The variant, the icon slot and the default focus (reject) do not change.
        expect(buttons[0].className).toContain('star-btn--danger');
        expect(buttons[0].querySelector('.accept-icon')).not.toBeNull();
        expect(autofocus()).toEqual(['Cancel']);
        buttons[0].click();
        await expect(result).resolves.toBe(true);
      });

      it('keeps defaultFocus accept with accept-first', async () => {
        const { labels, buttons, autofocus, result } = await open(surface, {
          message: 'Send?',
          buttonOrder: 'accept-first',
          defaultFocus: 'accept',
        });
        expect(labels).toEqual(['Confirm', 'Cancel']);
        expect(autofocus()).toEqual(['Confirm']);
        buttons[1].click();
        await expect(result).resolves.toBe(false);
      });

      it('keeps rejectVisible false with accept-first', async () => {
        const { labels, autofocus, confirm } = await open(surface, {
          message: 'Noted?',
          buttonOrder: 'accept-first',
          rejectVisible: false,
        });
        expect(labels).toEqual(['Confirm']);
        expect(autofocus()).toEqual(['Confirm']);
        confirm.settle(false);
      });
    });
  }
});

describe('confirm buttonOrder with provideStarDialogDefaults', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideStarDialogDefaults({ confirmButtonOrder: 'accept-first' })],
    }),
  );

  for (const surface of ['dialog', 'popup'] as const) {
    it(`renders accept first on the ${surface} from confirmButtonOrder`, async () => {
      const { labels, autofocus, confirm } = await open(surface, { message: 'Delete?' });
      expect(labels).toEqual(['Confirm', 'Cancel']);
      expect(autofocus()).toEqual(['Cancel']);
      confirm.settle(false);
    });

    it(`lets buttonOrder of the request win on the ${surface}`, async () => {
      const { labels, autofocus, confirm } = await open(surface, {
        message: 'Delete?',
        buttonOrder: 'reject-first',
      });
      expect(labels).toEqual(['Cancel', 'Confirm']);
      expect(autofocus()).toEqual(['Cancel']);
      confirm.settle(false);
    });
  }
});
