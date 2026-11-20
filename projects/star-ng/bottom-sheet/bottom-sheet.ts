import { DOCUMENT, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  createComponent,
  ElementRef,
  EnvironmentInjector,
  inject,
  Injector,
  input,
  Service,
  TemplateRef,
  Type,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarActionSheet, StarActionSheetItem } from './action-sheet';
import {
  STAR_BOTTOM_SHEET_DATA,
  StarBottomSheetConfig,
  StarBottomSheetContext,
  StarBottomSheetRef,
} from './bottom-sheet-ref';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Internal host: the native `<dialog>` of one sheet. */
@Component({
  selector: 'star-bottom-sheet-container',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgComponentOutlet, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = config();
    <!-- Backdrop click only; keyboard users close with Escape. -->
    <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
    <dialog
      data-star-part="sheetPanel"
      #dialog
      class="star-bottom-sheet"
      [class]="panelClass()"
      [class.star-bottom-sheet--modal]="c.hasBackdrop !== false"
      [style.max-height]="c.maxHeight ?? null"
      [attr.aria-label]="c.ariaLabel ?? text.bottomSheet"
      (cancel)="onCancel($event)"
      (close)="onNativeClose()"
      (click)="onClick($event)"
      (keydown.escape)="onEscape()"
    >
      <div data-star-part="surface" class="star-bottom-sheet__surface">
        <div data-star-part="handle" class="star-bottom-sheet__handle" aria-hidden="true"></div>
        <div data-star-part="body" class="star-bottom-sheet__body">
          @if (content(); as content) {
            @if (isTemplate(content)) {
              <ng-container
                *ngTemplateOutlet="content; context: templateContext(); injector: contentInjector()"
              />
            } @else {
              <ng-container *ngComponentOutlet="content; injector: contentInjector()" />
            }
          }
        </div>
      </div>
    </dialog>
  `,
})
export class StarBottomSheetContainer {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly content = input.required<Type<unknown> | TemplateRef<unknown>>();
  readonly config = input.required<StarBottomSheetConfig>();
  readonly contentInjector = input.required<Injector>();
  readonly templateContext = input.required<StarBottomSheetContext>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private isOpen = false;
  /** Closed before the first render: the dialog must never open. */
  private cancelled = false;
  /** Set by the service: asks the ref to dismiss (Escape, backdrop). */
  dismiss: () => void = () => undefined;
  /** Set by the service: runs once after the sheet closed. */
  hidden: () => void = () => undefined;

  constructor() {
    afterNextRender({
      write: () => {
        if (this.cancelled) return;
        const element = this.dialog().nativeElement;
        if (this.config().hasBackdrop === false) element.show?.();
        else element.showModal?.();
        this.isOpen = true;
        this.focusInitial(element);
      },
    });
  }

  protected panelClass(): string {
    const value = this.config().panelClass ?? '';
    return typeof value === 'string' ? value : value.join(' ');
  }

  protected isTemplate(content: unknown): content is TemplateRef<unknown> {
    return content instanceof TemplateRef;
  }

  /** Closes the native dialog; `hidden` runs once. */
  close(): void {
    if (!this.isOpen) {
      // Dismissed before the first render (for example two open() calls in one tick).
      if (this.cancelled) return;
      this.cancelled = true;
      this.hidden();
      return;
    }
    const element = this.dialog().nativeElement;
    if (element.open) element.close();
    this.markHidden();
  }

  /** `data-autofocus` first, then the first focusable element, then the sheet itself. */
  private focusInitial(element: HTMLDialogElement): void {
    const marked = element.querySelector<HTMLElement>('[data-autofocus]');
    const target = marked?.matches(FOCUSABLE)
      ? marked
      : (marked ?? element).querySelector<HTMLElement>(FOCUSABLE);
    if (target) target.focus();
    else {
      element.tabIndex = -1;
      element.focus();
    }
  }

  protected onCancel(event: Event): void {
    // The service owns the state: never let the browser close the sheet by itself.
    event.preventDefault();
    if (this.config().closeOnEscape !== false) this.dismiss();
  }

  /** A non-modal dialog gets no `cancel` event, so Escape is handled here too. */
  protected onEscape(): void {
    if (this.config().hasBackdrop === false && this.config().closeOnEscape !== false) {
      this.dismiss();
    }
  }

  protected onNativeClose(): void {
    this.markHidden();
  }

  protected onClick(event: MouseEvent): void {
    // A click whose target is the <dialog> itself landed on the ::backdrop: the surface fills it.
    if (
      event.target === this.dialog().nativeElement &&
      this.config().hasBackdrop !== false &&
      this.config().closeOnBackdrop !== false
    ) {
      this.dismiss();
    }
  }

  private markHidden(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.hidden();
  }
}

/**
 * Opens a component or a template in a sheet at the bottom edge of the window (Material
 * `MatBottomSheet`). Built on the native `<dialog>` like `StarDialogService`: top layer, inert
 * page, Escape. One sheet is open at a time: opening a new one dismisses the current one. The
 * focus returns to the element that had it before.
 *
 * ```ts
 * const ref = this.sheet.open(ShareOrder, { data: { id: 'ORD-1042' } });
 * const choice = await ref.afterDismissed(); // value passed to ref.dismiss(...) inside ShareOrder
 * ```
 * Inside the opened component: `inject(STAR_BOTTOM_SHEET_DATA)` and `inject(StarBottomSheetRef)`.
 * A template gets the data as `let-data` and the ref as `let-ref="ref"`.
 */
@Service()
export class StarBottomSheet {
  private readonly appRef = inject(ApplicationRef);
  private readonly environment = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly text = inject(STAR_UI_TEXT);
  private current: {
    readonly host: ComponentRef<StarBottomSheetContainer>;
    readonly ref: StarBottomSheetRef<unknown>;
  } | null = null;

  open<C, D = unknown, R = unknown>(
    content: Type<C> | TemplateRef<StarBottomSheetContext<D, R>>,
    config: StarBottomSheetConfig<D> = {},
    injector: Injector = this.environment,
  ): StarBottomSheetRef<R> {
    this.dismiss();
    const opener = this.document.activeElement as HTMLElement | null;
    let host: ComponentRef<StarBottomSheetContainer> | null = null;
    const ref = new StarBottomSheetRef<R>(() => host?.instance.close());
    const contentInjector = Injector.create({
      parent: injector,
      providers: [
        { provide: STAR_BOTTOM_SHEET_DATA, useValue: config.data },
        { provide: StarBottomSheetRef, useValue: ref },
      ],
    });
    host = createComponent(StarBottomSheetContainer, { environmentInjector: this.environment });
    host.setInput('content', content);
    host.setInput('config', config);
    host.setInput('contentInjector', contentInjector);
    host.setInput('templateContext', { $implicit: config.data, ref });
    host.instance.dismiss = () => ref.dismiss();
    host.instance.hidden = () => {
      ref.settle();
      this.destroy(host!);
      // Chromium restores the focus of a closed modal dialog; jsdom and other hosts may not.
      if (opener?.isConnected && !opener.contains(this.document.activeElement)) opener.focus();
    };
    this.document.body.appendChild(host.location.nativeElement);
    this.appRef.attachView(host.hostView);
    this.current = { host, ref: ref as StarBottomSheetRef<unknown> };
    return ref;
  }

  /**
   * Opens a list of actions (an action sheet) and resolves with the chosen action, or
   * `undefined` when the user cancels. The default accessible name is the `actions` UI text.
   */
  openActions<T = unknown>(
    actions: readonly StarActionSheetItem<T>[],
    config: Omit<StarBottomSheetConfig, 'data'> = {},
  ): StarBottomSheetRef<StarActionSheetItem<T>> {
    return this.open<StarActionSheet, readonly StarActionSheetItem<T>[], StarActionSheetItem<T>>(
      StarActionSheet,
      { ...config, ariaLabel: config.ariaLabel ?? this.text.actions, data: actions },
    );
  }

  /** Closes the open sheet, if there is one. Its result is `undefined`. */
  dismiss(): void {
    this.current?.ref.dismiss();
  }

  private destroy(host: ComponentRef<StarBottomSheetContainer>): void {
    if (this.current?.host === host) this.current = null;
    this.appRef.detachView(host.hostView);
    host.destroy();
  }
}
