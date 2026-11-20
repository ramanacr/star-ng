import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { STAR_UI_TEXT, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarMenuItem } from '@star-ng/ui/menu';
import { StarThemeMode, StarThemeService } from '@star-ng/ui/theme';
import { StarSpeedDial } from '@star-ng/ui/utility';

const MODES: readonly { readonly mode: StarThemeMode; readonly icon: string }[] = [
  { mode: 'system', icon: 'ph-bold ph-monitor' },
  { mode: 'light', icon: 'ph-bold ph-sun' },
  { mode: 'dark', icon: 'ph-bold ph-moon' },
];

/**
 * Theme switch: a small speed dial with System, Light and Dark. The button shows the icon of
 * the current choice; `StarThemeService` applies and remembers it. The texts come from
 * `STAR_UI_TEXT` (`theme`, `themeSystem`, `themeLight`, `themeDark`).
 *
 * The control is not positioned: the host places it. For a fixed corner:
 *
 * ```css
 * star-theme-switch {
 *   position: fixed;
 *   top: var(--star-space-3);
 *   inset-inline-end: var(--star-space-4);
 *   z-index: 40;
 * }
 * ```
 *
 * `<star-theme-switch />`
 */
@Component({
  selector: 'star-theme-switch',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarSpeedDial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-theme-switch' },
  template: `
    <star-speed-dial
      size="sm"
      direction="down"
      [icon]="current().icon"
      [items]="items()"
      [activeIndex]="activeIndex()"
      [ariaLabel]="label()"
    />
  `,
})
export class StarThemeSwitch {
  private readonly theme = inject(StarThemeService);
  private readonly text = inject(STAR_UI_TEXT);

  protected readonly activeIndex = computed(() =>
    MODES.findIndex((item) => item.mode === this.theme.mode()),
  );
  protected readonly current = computed(() => MODES[this.activeIndex()] ?? MODES[0]);

  private modeLabel(mode: StarThemeMode): string {
    return mode === 'system'
      ? this.text.themeSystem
      : mode === 'light'
        ? this.text.themeLight
        : this.text.themeDark;
  }

  protected readonly items = computed<readonly StarMenuItem[]>(() =>
    MODES.map(({ mode, icon }) => ({
      label: this.modeLabel(mode),
      icon,
      command: () => this.theme.setMode(mode),
    })),
  );

  /** Accessible name of the button, for example "Theme: Dark". */
  protected readonly label = computed(
    () => `${this.text.theme}: ${this.modeLabel(this.current().mode)}`,
  );
}
