import { NgComponentOutlet } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  createComponent,
  DOCUMENT,
  EnvironmentInjector,
  inject,
  InjectionToken,
  Injector,
  input,
  Service,
  signal,
  Type,
} from '@angular/core';
import { ɵstarAfterExit } from '@star-ng/ui/core';
import { StarWindow, StarWindowPosition, StarWindowSize, StarWindowState } from './window';

/** Data passed to the component opened by `StarWindowService.open()`. */
export const STAR_WINDOW_DATA = new InjectionToken<unknown>('STAR_WINDOW_DATA');

/** Options of `StarWindowService.open()`. The defaults are those of `star-window`. */
export interface StarWindowConfig<D = unknown> {
  readonly header?: string;
  /** Accessible name when there is no header. */
  readonly ariaLabel?: string;
  readonly data?: D;
  /** Place in the viewport; centered (with a cascade) when not set. */
  readonly position?: StarWindowPosition;
  readonly size?: StarWindowSize;
  readonly state?: StarWindowState;
  readonly draggable?: boolean;
  readonly resizable?: boolean;
  readonly keepInViewport?: boolean;
  readonly closeOnEscape?: boolean;
  readonly minimizable?: boolean;
  readonly maximizable?: boolean;
  readonly closable?: boolean;
  readonly minWidth?: number;
  readonly minHeight?: number;
}

/**
 * Handle of a window opened from code. The opened component injects it to close its window with a
 * result: `inject(StarWindowRef<Result>).close(result)`.
 */
export class StarWindowRef<R = unknown> {
  private resolve!: (result: R | undefined) => void;
  /** Resolves when the window has closed: the result, or `undefined` (close button, Escape). */
  readonly closed = new Promise<R | undefined>((resolve) => (this.resolve = resolve));
  private result: R | undefined;
  private done = false;

  constructor(private readonly hide: () => void) {}

  close(result?: R): void {
    if (this.done) return;
    this.result = result;
    this.hide();
  }

  /** @internal Called once the window has closed. */
  settle(): void {
    if (this.done) return;
    this.done = true;
    this.resolve(this.result);
  }
}

/** @internal Host of a window opened from code: a `star-window` whose body is the component. */
@Component({
  selector: 'star-window-container',
  imports: [StarWindow, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = config();
    <star-window
      [(visible)]="visible"
      [header]="c.header ?? ''"
      [ariaLabel]="c.ariaLabel ?? null"
      [position]="c.position ?? null"
      [size]="c.size ?? null"
      [state]="c.state ?? 'normal'"
      [draggable]="c.draggable ?? true"
      [resizable]="c.resizable ?? true"
      [keepInViewport]="c.keepInViewport ?? true"
      [closeOnEscape]="c.closeOnEscape ?? false"
      [minimizable]="c.minimizable ?? true"
      [maximizable]="c.maximizable ?? true"
      [closable]="c.closable ?? true"
      [minWidth]="c.minWidth ?? 240"
      [minHeight]="c.minHeight ?? 160"
      (closed)="closed()"
    >
      <ng-container *ngComponentOutlet="component(); injector: contentInjector()" />
    </star-window>
  `,
})
export class StarWindowContainer {
  readonly component = input.required<Type<unknown>>();
  readonly config = input.required<StarWindowConfig>();
  readonly contentInjector = input.required<Injector>();
  readonly visible = signal(true);
  /** Set by the service; runs after the window closed. */
  closed: () => void = () => undefined;
}

/**
 * Opens a component in a `star-window` from code (Kendo UI `WindowService`). The window is added
 * at the end of `<body>`; several windows stack and cascade.
 *
 * ```ts
 * const ref = this.windows.open(OrderNotes, { header: 'Notes', data: { id } });
 * const result = await ref.closed;
 * ```
 * Inside the opened component: `inject(STAR_WINDOW_DATA)` and `inject(StarWindowRef)`.
 */
@Service()
export class StarWindowService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environment = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly hosts = new Set<ComponentRef<StarWindowContainer>>();

  open<C, D = unknown, R = unknown>(
    component: Type<C>,
    config: StarWindowConfig<D> = {},
    injector: Injector = this.environment,
  ): StarWindowRef<R> {
    let host: ComponentRef<StarWindowContainer> | null = null;
    const ref = new StarWindowRef<R>(() => host?.instance.visible.set(false));
    const contentInjector = Injector.create({
      parent: injector,
      providers: [
        { provide: STAR_WINDOW_DATA, useValue: config.data },
        { provide: StarWindowRef, useValue: ref },
      ],
    });
    host = createComponent(StarWindowContainer, { environmentInjector: this.environment });
    host.setInput('component', component);
    host.setInput('config', config);
    host.setInput('contentInjector', contentInjector);
    host.instance.closed = () => {
      ref.settle();
      // The close transition (`allow-discrete`) needs the element in the DOM: destroy after it.
      ɵstarAfterExit(host!.location.nativeElement, () => this.destroy(host!));
    };
    this.document.body.appendChild(host.location.nativeElement);
    this.appRef.attachView(host.hostView);
    this.hosts.add(host);
    return ref;
  }

  /** Closes every window opened by the service. */
  closeAll(): void {
    for (const host of this.hosts) host.instance.visible.set(false);
  }

  private destroy(host: ComponentRef<StarWindowContainer>): void {
    if (!this.hosts.delete(host)) return;
    this.appRef.detachView(host.hostView);
    host.destroy();
  }
}
