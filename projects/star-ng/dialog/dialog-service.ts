import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  computed,
  createComponent,
  EnvironmentInjector,
  inject,
  InjectionToken,
  Injector,
  input,
  Service,
  signal,
  Type,
} from '@angular/core';
import { StarButton, StarButtonVariant } from '@star-ng/ui/button';
import { StarStyled, ɵSTAR_PART_HOST, ɵstarAfterExit } from '@star-ng/ui/core';
import { StarDialog, StarDialogIconTone, StarDialogPosition } from './dialog';
import { StarDialogSize } from './dialog-base';
import { STAR_DIALOG_DEFAULTS } from './dialog-defaults';
import { ɵStarDialogHeaderTemplates } from './dialog-header-actions';

/** Data passed to the component opened by `StarDialogService.open()`. */
export const STAR_DIALOG_DATA = new InjectionToken<unknown>('STAR_DIALOG_DATA');

/**
 * A button in the header of a dialog opened with `StarDialogService.open()`. A press closes the
 * dialog with `result`. With `closable: false` it can take the place of the close icon. For a
 * button that runs logic of the opened component first (validation, a request), use
 * `<ng-template starDialogHeaderActions>` in that component.
 */
export interface StarDialogHeaderAction {
  /** Text of the button. */
  readonly label: string;
  /** Button variant. Default `'secondary'`. */
  readonly variant?: StarButtonVariant;
  /** Phosphor icon class before the label, for example `ph-bold ph-x`. */
  readonly icon?: string;
  /** Accessible name when it must differ from the label. */
  readonly ariaLabel?: string;
  /** Value that `StarDialogRef.closed` resolves with. Default `undefined`. */
  readonly result?: unknown;
}

export interface StarDialogConfig<D = unknown> {
  readonly header?: string;
  /** Text after the title, part of the accessible name (for example a record number). */
  readonly subheader?: string;
  /** Icon in a tile before the title: a Phosphor name (`file-text`) or class. Decorative. */
  readonly icon?: string;
  /** Color of the icon tile. Default `'primary'`. */
  readonly iconTone?: StarDialogIconTone;
  /** A line under the header. Default false. */
  readonly headerDivider?: boolean;
  /** A button in the header that closes the dialog with its `result`. After `headerActions`. */
  readonly headerAction?: StarDialogHeaderAction;
  /**
   * Buttons in the header, in this order (put the primary one first). Each closes the dialog with
   * its `result`. They come after the `<ng-template starDialogHeaderActions>` content of the
   * opened component and before `headerAction`.
   */
  readonly headerActions?: readonly StarDialogHeaderAction[];
  readonly size?: StarDialogSize;
  readonly width?: string;
  readonly data?: D;
  /** Default: `STAR_DIALOG_DEFAULTS`, else true. */
  readonly closable?: boolean;
  /** Default: `STAR_DIALOG_DEFAULTS`, else true. */
  readonly closeOnEscape?: boolean;
  /** Close on a backdrop click. Default: `STAR_DIALOG_DEFAULTS`, else false. */
  readonly dismissableMask?: boolean;
  readonly role?: 'dialog' | 'alertdialog';
  /** Accessible name when there is no header. */
  readonly ariaLabel?: string;
  /** Place in the window. Default `'center'`. With `sheet`, only `'start'` changes the edge. */
  readonly position?: StarDialogPosition;
  /**
   * Full-height side sheet at the end edge (`position: 'start'`: the start edge), with a gap from
   * the window edges. `width` or `size` set its width. Default false.
   */
  readonly sheet?: boolean;
  /** Drag by the header, and Alt + arrow keys on the move button. Default false. */
  readonly draggable?: boolean;
  /** Corner handle that resizes the dialog. Default false. */
  readonly resizable?: boolean;
  /** Header button that fills the window. Default false. */
  readonly maximizable?: boolean;
  /** Dragging and resizing stay inside the window. Default true. */
  readonly keepInViewport?: boolean;
  /** Widths per window size: `{ '<max-width>': '<width>' }`. */
  readonly breakpoints?: Readonly<Record<string, string>>;
  /** Blocks the page scroll while open. Default true (the service dialog is modal). */
  readonly blockScroll?: boolean;
  /** Moves the focus into the content on open. Default true. */
  readonly focusOnShow?: boolean;
}

/**
 * Handle of a dialog opened from code. The opened component injects it to close itself with a
 * result: `inject(StarDialogRef<Result>).close(result)`.
 */
export class StarDialogRef<R = unknown> {
  private resolve!: (result: R | undefined) => void;
  /**
   * Resolves when the dialog has closed: the result, or `undefined` (Escape, ×, backdrop). When
   * the host is destroyed first (for example at app teardown) it settles with the result given
   * so far, which is `undefined` if `close()` was not called.
   */
  readonly closed = new Promise<R | undefined>((resolve) => (this.resolve = resolve));
  private result: R | undefined;
  private done = false;
  private requested = false;

  constructor(private readonly hide: () => void) {}

  close(result?: R): void {
    // The first call wins: a second one during the exit motion (the result comes after it where
    // the browser has no CSS `overlay`) does not change the result.
    if (this.done || this.requested) return;
    this.requested = true;
    this.result = result;
    this.hide();
  }

  /** @internal The user closed the dialog (Escape, ×, backdrop): a later `close(result)` is ignored. */
  markRequested(): void {
    this.requested = true;
  }

  /** Called by the container once the native dialog has closed. */
  settle(): void {
    if (this.done) return;
    this.done = true;
    this.resolve(this.result);
  }
}

/** Internal host: an `star-dialog` whose body is the requested component. */
@Component({
  selector: 'star-dialog-container',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarButton, StarDialog, NgComponentOutlet, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = config();
    <star-dialog
      [(visible)]="visible"
      [header]="c.header ?? ''"
      [subheader]="c.subheader ?? ''"
      [icon]="c.icon ?? null"
      [iconTone]="c.iconTone ?? 'primary'"
      [headerDivider]="c.headerDivider ?? false"
      [size]="c.size ?? defaults.size ?? 'md'"
      [width]="c.width ?? null"
      [closable]="c.closable ?? defaults.closable ?? true"
      [closeOnEscape]="c.closeOnEscape ?? defaults.closeOnEscape ?? true"
      [dismissableMask]="c.dismissableMask ?? defaults.dismissableMask ?? false"
      [role]="c.role ?? 'dialog'"
      [ariaLabel]="c.ariaLabel ?? null"
      [position]="c.position ?? 'center'"
      [sheet]="c.sheet ?? false"
      [draggable]="c.draggable ?? false"
      [resizable]="c.resizable ?? false"
      [maximizable]="c.maximizable ?? false"
      [keepInViewport]="c.keepInViewport ?? true"
      [breakpoints]="c.breakpoints ?? null"
      [blockScroll]="c.blockScroll"
      [focusOnShow]="c.focusOnShow ?? true"
      (visibleChange)="!$event && userClosed()"
      (hidden)="hidden()"
    >
      <!-- Header order: the templates of the opened component, headerActions, headerAction. -->
      <ng-container ngProjectAs="[starDialogHeaderActions]">
        @for (actions of headerTemplates().templates(); track actions) {
          <ng-container [ngTemplateOutlet]="actions" />
        }
        @for (action of configActions(); track $index) {
          <star-button
            size="sm"
            [variant]="action.variant ?? 'secondary'"
            [leadingIcon]="action.icon ?? null"
            [ariaLabel]="action.ariaLabel ?? null"
            (pressed)="headerActionPressed(action.result)"
            >{{ action.label }}</star-button
          >
        }
      </ng-container>
      <ng-container *ngComponentOutlet="component(); injector: contentInjector()" />
    </star-dialog>
  `,
})
export class StarDialogContainer {
  /** `STAR_DIALOG_DEFAULTS`: used where the `open()` config sets nothing. */
  protected readonly defaults = inject(STAR_DIALOG_DEFAULTS);
  readonly component = input.required<Type<unknown>>();
  readonly config = input.required<StarDialogConfig>();
  readonly contentInjector = input.required<Injector>();
  /** Templates of `<ng-template starDialogHeaderActions>` in the opened component. */
  readonly headerTemplates = input.required<ɵStarDialogHeaderTemplates>();
  /** `headerActions`, then `headerAction`. */
  protected readonly configActions = computed(() => {
    const { headerActions = [], headerAction } = this.config();
    return headerAction ? [...headerActions, headerAction] : headerActions;
  });
  readonly visible = signal(true);
  /** Set by the service; runs after the native dialog closed. */
  hidden: () => void = () => undefined;
  /** Set by the service; runs when the user closes the dialog (Escape, ×, backdrop). */
  userClosed: () => void = () => undefined;
  /** Set by the service; closes the dialog with the result of the header action. */
  headerActionPressed: (result: unknown) => void = () => undefined;
}

/**
 * Opens a component in a modal `star-dialog` from code (PrimeNG `DialogService` /
 * `DynamicDialog`). No host element in the template is needed; dialogs stack in the top layer.
 *
 * ```ts
 * const ref = this.dialogs.open(EditOrder, { header: 'Edit order', size: 'lg', data: { id } });
 * const saved = await ref.closed; // value passed to ref.close(...) inside EditOrder
 * ```
 * Inside the opened component: `inject(STAR_DIALOG_DATA)` and `inject(StarDialogRef)`.
 * Put its action buttons in an element with class `star-dialog__footer`, or in the header with
 * `<ng-template starDialogHeaderActions>` (the buttons keep the state and the click handlers of the
 * component). `headerActions` and `headerAction` put buttons in the header that close the dialog
 * with a fixed result, for example a Close button with `closable: false`. `sheet: true` opens a
 * full-height side sheet; a dialog or sheet opened from an open one stacks above it, and Escape
 * closes only the top one.
 */
@Service()
export class StarDialogService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environment = inject(EnvironmentInjector);
  private readonly openRefs = new Set<ComponentRef<StarDialogContainer>>();

  open<C, D = unknown, R = unknown>(
    component: Type<C>,
    config: StarDialogConfig<D> = {},
    injector: Injector = this.environment,
  ): StarDialogRef<R> {
    let host: ComponentRef<StarDialogContainer> | null = null;
    const ref = new StarDialogRef<R>(() => host?.instance.visible.set(false));
    const headerTemplates = new ɵStarDialogHeaderTemplates();
    const contentInjector = Injector.create({
      parent: injector,
      providers: [
        { provide: STAR_DIALOG_DATA, useValue: config.data },
        { provide: StarDialogRef, useValue: ref },
        { provide: ɵStarDialogHeaderTemplates, useValue: headerTemplates },
      ],
    });
    host = createComponent(StarDialogContainer, { environmentInjector: this.environment });
    host.setInput('component', component);
    host.setInput('config', config);
    host.setInput('contentInjector', contentInjector);
    host.setInput('headerTemplates', headerTemplates);
    // Destroyed before it closed (for example during the exit motion): the result still comes.
    host.onDestroy(() => ref.settle());
    host.instance.userClosed = () => ref.markRequested();
    host.instance.headerActionPressed = (result) => ref.close(result as R);
    host.instance.hidden = () => {
      ref.settle();
      // The close transition (`allow-discrete`) needs the element in the DOM: destroy after it.
      ɵstarAfterExit(host!.location.nativeElement, () => this.destroy(host!));
    };
    document.body.appendChild(host.location.nativeElement);
    this.appRef.attachView(host.hostView);
    this.openRefs.add(host);
    return ref;
  }

  /** Closes every open dialog (for example on sign-out). */
  closeAll(): void {
    for (const host of this.openRefs) host.instance.visible.set(false);
  }

  private destroy(host: ComponentRef<StarDialogContainer>): void {
    if (!this.openRefs.delete(host)) return;
    // Called after the exit motion: the application may have destroyed the view meanwhile.
    if (host.hostView.destroyed) return;
    this.appRef.detachView(host.hostView);
    host.destroy();
  }
}
