import { DestroyRef, Directive, inject, Injectable, signal, TemplateRef } from '@angular/core';

/**
 * @internal Header action templates of one dialog, in the order they were created. A
 * `star-dialog` has one, and `StarDialogService` gives one to each opened component.
 */
@Injectable()
export class ɵStarDialogHeaderTemplates {
  private readonly list = signal<readonly TemplateRef<unknown>[]>([]);
  /** The templates to render in the header, in source order. */
  readonly templates = this.list.asReadonly();

  add(template: TemplateRef<unknown>): void {
    this.list.update((list) => [...list, template]);
  }

  remove(template: TemplateRef<unknown>): void {
    this.list.update((list) => list.filter((item) => item !== template));
  }
}

/**
 * Header actions from a template: `<ng-template starDialogHeaderActions>` puts its content in the
 * header of the dialog, before the move, maximize and close buttons.
 *
 * Its main use is a component opened with `StarDialogService.open()`: the component puts its own
 * buttons in the header of the service dialog. The buttons keep the state and the click handlers
 * of the component (disabled while a form is invalid, loading while it sends), and a button
 * closes the dialog with `inject(StarDialogRef).close(result)`.
 *
 * ```html
 * <ng-template starDialogHeaderActions>
 *   <star-button size="sm" [disabled]="form.invalid" (pressed)="send()">Send</star-button>
 *   <star-button size="sm" variant="secondary" (pressed)="ref.close()">Cancel</star-button>
 * </ng-template>
 * ```
 * It works inside a template `star-dialog` too. The content leaves the header when the template
 * is destroyed (for example in an `@if` that turns false) and when the dialog closes. Outside a
 * dialog it renders nothing.
 */
@Directive({ selector: 'ng-template[starDialogHeaderActions]' })
export class StarDialogHeaderActions {
  constructor() {
    const host = inject(ɵStarDialogHeaderTemplates, { optional: true });
    if (!host) return;
    const template = inject<TemplateRef<unknown>>(TemplateRef);
    host.add(template);
    inject(DestroyRef).onDestroy(() => host.remove(template));
  }
}
