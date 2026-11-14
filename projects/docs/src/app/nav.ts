import { Routes } from '@angular/router';

export interface DocsNavItem {
  readonly label: string;
  /** Route path, for example `controls/button`. */
  readonly path: string;
  /** Extra words that the navigation search matches. */
  readonly keywords?: string;
  readonly load: () => Promise<unknown>;
}

export interface DocsNavGroup {
  readonly label: string;
  readonly items: readonly DocsNavItem[];
}

/**
 * The pages of the docs application, in navigation order. The side navigation, its search
 * and the routes are all built from this list: a new page needs one entry here.
 */
export const DOCS_NAV: readonly DocsNavGroup[] = [
  {
    label: 'Guides',
    items: [
      {
        label: 'Getting started',
        path: 'guides/getting-started',
        keywords: 'install setup styles icons',
        load: () => import('./guides/getting-started.guide').then((m) => m.GettingStartedGuide),
      },
      {
        label: 'Theming and tokens',
        path: 'guides/theming',
        keywords: 'css variables colors palette override brand',
        load: () => import('./guides/theming.guide').then((m) => m.ThemingGuide),
      },
      {
        label: 'Dark mode',
        path: 'guides/dark-mode',
        keywords: 'theme service first paint script system',
        load: () => import('./guides/dark-mode.guide').then((m) => m.DarkModeGuide),
      },
      {
        label: 'Forms',
        path: 'guides/forms',
        keywords: 'signal forms reactive forms validation SignalFormControl formField',
        load: () => import('./guides/forms.guide').then((m) => m.FormsGuide),
      },
      {
        label: 'Internationalisation',
        path: 'guides/i18n',
        keywords: 'translation language text transloco STAR_UI_TEXT locale',
        load: () => import('./guides/i18n.guide').then((m) => m.I18nGuide),
      },
      {
        label: 'Accessibility',
        path: 'guides/accessibility',
        keywords: 'a11y keyboard screen reader contrast wcag aria',
        load: () => import('./guides/accessibility.guide').then((m) => m.AccessibilityGuide),
      },
    ],
  },
  {
    label: 'Buttons',
    items: [
      {
        label: 'Button',
        path: 'controls/button',
        keywords: 'action submit loading icon',
        load: () => import('./controls/button.page').then((m) => m.ButtonPage),
      },
    ],
  },
  {
    label: 'Forms',
    items: [
      {
        label: 'Field and input',
        path: 'controls/field',
        keywords: 'text textarea label hint error starInput',
        load: () => import('./controls/field.page').then((m) => m.FieldPage),
      },
      {
        label: 'Checkbox',
        path: 'controls/checkbox',
        keywords: 'tick indeterminate boolean',
        load: () => import('./controls/checkbox.page').then((m) => m.CheckboxPage),
      },
      {
        label: 'Radio',
        path: 'controls/radio',
        keywords: 'radio group option single choice',
        load: () => import('./controls/radio.page').then((m) => m.RadioPage),
      },
      {
        label: 'Toggle switch',
        path: 'controls/toggle-switch',
        keywords: 'switch on off boolean',
        load: () => import('./controls/toggle-switch.page').then((m) => m.ToggleSwitchPage),
      },
      {
        label: 'Input number',
        path: 'controls/input-number',
        keywords: 'numeric currency percent unit spinbutton',
        load: () => import('./controls/input-number.page').then((m) => m.InputNumberPage),
      },
      {
        label: 'Password',
        path: 'controls/password',
        keywords: 'strength meter rules show hide',
        load: () => import('./controls/password.page').then((m) => m.PasswordPage),
      },
      {
        label: 'Input mask',
        path: 'controls/input-mask',
        keywords: 'format phone pattern',
        load: () => import('./controls/input-mask.page').then((m) => m.InputMaskPage),
      },
      {
        label: 'One-time code',
        path: 'controls/input-otp',
        keywords: 'otp pin verification code',
        load: () => import('./controls/input-otp.page').then((m) => m.InputOtpPage),
      },
      {
        label: 'Tags field',
        path: 'controls/input-tags',
        keywords: 'chips tokens free text',
        load: () => import('./controls/input-tags.page').then((m) => m.InputTagsPage),
      },
      {
        label: 'Input group and icon field',
        path: 'controls/input-group',
        keywords: 'addon prefix suffix icon',
        load: () => import('./controls/input-group.page').then((m) => m.InputGroupPage),
      },
      {
        label: 'Slider',
        path: 'controls/slider',
        keywords: 'range thumb',
        load: () => import('./controls/slider.page').then((m) => m.SliderPage),
      },
      {
        label: 'Rating',
        path: 'controls/rating',
        keywords: 'stars score',
        load: () => import('./controls/rating.page').then((m) => m.RatingPage),
      },
      {
        label: 'Knob',
        path: 'controls/knob',
        keywords: 'dial circular',
        load: () => import('./controls/knob.page').then((m) => m.KnobPage),
      },
      {
        label: 'Color picker',
        path: 'controls/color-picker',
        keywords: 'colour swatch hex',
        load: () => import('./controls/color-picker.page').then((m) => m.ColorPickerPage),
      },
      {
        label: 'Select button and toggle button',
        path: 'controls/select-button',
        keywords: 'segmented toggle choice',
        load: () => import('./controls/select-button.page').then((m) => m.SelectButtonPage),
      },
    ],
  },
  {
    label: 'Data display',
    items: [
      {
        label: 'Tag',
        path: 'controls/tag',
        keywords: 'status label chip severity',
        load: () => import('./controls/tag.page').then((m) => m.TagPage),
      },
      {
        label: 'Badge',
        path: 'controls/badge',
        keywords: 'count dot notification',
        load: () => import('./controls/badge.page').then((m) => m.BadgePage),
      },
    ],
  },
  {
    label: 'Feedback',
    items: [
      {
        label: 'Spinner',
        path: 'controls/spinner',
        keywords: 'loading progress busy',
        load: () => import('./controls/spinner.page').then((m) => m.SpinnerPage),
      },
    ],
  },
];

export const DOCS_ROUTES: Routes = DOCS_NAV.flatMap((group) =>
  group.items.map((item) => ({
    path: item.path,
    title: `${item.label} · StarNG`,
    loadComponent: item.load as () => Promise<never>,
  })),
);
