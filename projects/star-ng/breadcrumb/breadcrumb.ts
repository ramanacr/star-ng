import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

export interface StarBreadcrumbItem {
  readonly label: string;
  readonly routerLink?: string | readonly unknown[];
  readonly url?: string;
  readonly icon?: string;
}

/**
 * Breadcrumb (PrimeNG `p-breadcrumb`): `nav` landmark, ordered list, `aria-current="page"` on
 * the last item, optional home link.
 *
 * `<star-breadcrumb [home]="{ label: 'Home', icon: 'ph-bold ph-house', routerLink: '/' }" [items]="trail" />`
 */
@Component({
  selector: 'star-breadcrumb',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="star-breadcrumb" [attr.aria-label]="ariaLabel() ?? text.breadcrumb">
      <ol class="star-breadcrumb__list">
        @for (item of all(); track $index; let last = $last) {
          <li class="star-breadcrumb__item">
            @if (last) {
              <span class="star-breadcrumb__current" aria-current="page">
                @if (item.icon) {
                  <i [class]="item.icon" aria-hidden="true"></i>
                }
                {{ item.label }}
              </span>
            } @else {
              @if (item.routerLink) {
                <a
                  class="star-breadcrumb__link"
                  [routerLink]="item.routerLink"
                  [attr.aria-label]="item.icon && $first && home() ? item.label : null"
                >
                  @if (item.icon) {
                    <i [class]="item.icon" aria-hidden="true"></i>
                  }
                  @if (!(item.icon && $first && home())) {
                    {{ item.label }}
                  }
                </a>
              } @else if (item.url) {
                <a class="star-breadcrumb__link" [href]="item.url">{{ item.label }}</a>
              } @else {
                <span>{{ item.label }}</span>
              }
              <i
                class="ph-bold ph-caret-right star-breadcrumb__sep star-icon-mirror"
                aria-hidden="true"
              ></i>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class StarBreadcrumb {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly items = input<readonly StarBreadcrumbItem[]>([]);
  /** First item; when it has an icon, only the icon shows (label stays for screen readers). */
  readonly home = input<StarBreadcrumbItem | null>(null);
  readonly ariaLabel = input<string | null>(null);

  protected all(): readonly StarBreadcrumbItem[] {
    const home = this.home();
    return home ? [home, ...this.items()] : this.items();
  }
}
