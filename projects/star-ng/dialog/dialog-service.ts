import { NgComponentOutlet } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
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
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarDialog, StarDialogPosition } from './dialog';
import { StarDialogSize } from './dialog-base';
import { STAR_DIALOG_DEFAULTS } from './dialog-defaults';

/** Data passed to the component opened by `StarDialogService.open()`. */
export const STAR_DIALOG_DATA = new InjectionToken<unknown>('STAR_DIALOG_DATA');

export interface StarDialogConfig<D = unknown> {
  readonly header?: string;
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
  /** Place in the window. Default `'center'`. */
  readonly position?: StarDialogPosition;
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
  /** Resolves when the dialog has closed: the result, or `undefined` (Escape, ×, backdrop). */
  readonly closed = new Promise<R | undefined>((resolve) => (this.resolve = resolve));
  private result: R | undefined;
  private done = false;

  constructor(private readonly hide: () => void) {}

  close(result?: R): void {
    if (this.done) return;
    this.result = result;
    this.hide();
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
  imports: [StarDialog, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = config();
    <star-dialog
      [(visible)]="visible"
      [header]="c.header ?? ''"
      [size]="c.size ?? defaults.size ?? 'md'"
      [width]="c.width ?? null"
      [closable]="c.closable ?? defaults.closable ?? true"
      [closeOnEscape]="c.closeOnEscape ?? defaults.closeOnEscape ?? true"
      [dismissableMask]="c.dismissableMask ?? defaults.dismissableMask ?? false"
      [role]="c.role ?? 'dialog'"
      [ariaLabel]="c.ariaLabel ?? null"
      [position]="c.position ?? 'center'"
      [draggable]="c.draggable ?? false"
      [resizable]="c.resizable ?? false"
      [maximizable]="c.maximizable ?? false"
      [keepInViewport]="c.keepInViewport ?? true"
      [breakpoints]="c.breakpoints ?? null"
      [blockScroll]="c.blockScroll"
      [focusOnShow]="c.focusOnShow ?? true"
      (hidden)="hidden()"
    >
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
  readonly visible = signal(true);
  /** Set by the service; runs after the native dialog closed. */
  hidden: () => void = () => undefined;
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
 * Put its action buttons in an element with class `star-dialog__footer`.
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
    const contentInjector = Injector.create({
      parent: injector,
      providers: [
        { provide: STAR_DIALOG_DATA, useValue: config.data },
        { provide: StarDialogRef, useValue: ref },
      ],
    });
    host = createComponent(StarDialogContainer, { environmentInjector: this.environment });
    host.setInput('component', component);
    host.setInput('config', config);
    host.setInput('contentInjector', contentInjector);
    host.instance.hidden = () => {
      ref.settle();
      this.destroy(host!);
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
    this.appRef.detachView(host.hostView);
    host.destroy();
  }
}
