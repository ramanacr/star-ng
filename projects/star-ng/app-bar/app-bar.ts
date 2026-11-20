import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/** How `star-app-bar` stays in the page. */
export type StarAppBarPosition = 'static' | 'sticky' | 'fixed';

/**
 * App bar (Ignite `igx-navbar`, Material `mat-toolbar` used as the top bar): the top bar of an
 * application or a view, with a start area (menu button, logo), a title and an end area (actions).
 *
 * ```html
 * <star-app-bar title="Orders" position="sticky" elevated>
 *   <star-button starAppBarStart variant="ghost" iconOnly leadingIcon="ph-bold ph-list" ariaLabel="Menu" />
 *   <star-button starAppBarEnd variant="ghost" iconOnly leadingIcon="ph-bold ph-bell" ariaLabel="Notifications" />
 * </star-app-bar>
 * ```
 *
 * The bar is a `<header>` with the `banner` landmark. A page has one banner landmark, at the top
 * level: set `landmark` to `false` for an app bar inside another landmark (a dialog, the main
 * area) or for a second bar.
 */
@Component({
  selector: 'star-app-bar',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-app-bar star-app-bar--' + position()",
    '[class.star-app-bar--elevated]': 'elevated()',
    '[class.star-app-bar--dense]': 'dense()',
    // `title` is an input: the attribute would show as a tooltip over the whole bar.
    '[attr.title]': 'null',
  },
  template: `
    <header
      data-star-part="barPanel"
      class="star-app-bar__bar"
      [attr.role]="landmark() ? 'banner' : 'none'"
    >
      <div data-star-part="startPanel" class="star-app-bar__start">
        <ng-content select="[starAppBarStart]" />
      </div>
      <div data-star-part="titleText" class="star-app-bar__title">{{ title() }}<ng-content /></div>
      <div data-star-part="endPanel" class="star-app-bar__end">
        <ng-content select="[starAppBarEnd]" />
      </div>
    </header>
  `,
})
export class StarAppBar {
  /** Title text. The default content goes after it, so a custom title can replace it. */
  readonly title = input('');
  /**
   * `static` scrolls with the page; `sticky` stays at the top of its scroll container (below the
   * safe area of the device); `fixed` stays at the top of the window, over the page.
   */
  readonly position = input<StarAppBarPosition>('static');
  /** A shadow under the bar. */
  readonly elevated = input(false, { transform: booleanAttribute });
  /** A lower bar. */
  readonly dense = input(false, { transform: booleanAttribute });
  /** `true`: the bar is the `banner` landmark. `false`: no landmark role (nested or second bar). */
  readonly landmark = input(true, { transform: booleanAttribute });
}
