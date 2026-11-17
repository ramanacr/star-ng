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
        label: 'Right-to-left',
        path: 'guides/right-to-left',
        keywords: 'rtl direction dir arabic hebrew persian urdu mirror bidi logical start end',
        load: () => import('./guides/right-to-left.guide').then((m) => m.RightToLeftGuide),
      },
      {
        label: 'Template slots',
        path: 'guides/template-slots',
        keywords: 'ng-template customize header footer empty loading group icon option node date',
        load: () => import('./guides/template-slots.guide').then((m) => m.TemplateSlotsGuide),
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
    label: 'Selection',
    items: [
      {
        label: 'Select',
        path: 'controls/select',
        keywords: 'dropdown combobox single choice filter groups virtual',
        load: () => import('./controls/select.page').then((m) => m.SelectPage),
      },
      {
        label: 'Multi-select',
        path: 'controls/multi-select',
        keywords: 'dropdown checkbox chips select all limit',
        load: () => import('./controls/multi-select.page').then((m) => m.MultiSelectPage),
      },
      {
        label: 'Cascade select',
        path: 'controls/cascade-select',
        keywords: 'nested submenu country state city path',
        load: () => import('./controls/cascade-select.page').then((m) => m.CascadeSelectPage),
      },
      {
        label: 'Listbox',
        path: 'controls/listbox',
        keywords: 'inline list single multiple filter',
        load: () => import('./controls/listbox.page').then((m) => m.ListboxPage),
      },
      {
        label: 'Autocomplete',
        path: 'controls/autocomplete',
        keywords: 'suggestions search async typeahead multiple chips',
        load: () => import('./controls/autocomplete.page').then((m) => m.AutocompletePage),
      },
      {
        label: 'Tree',
        path: 'controls/tree',
        keywords: 'hierarchy nodes folders checkbox expand',
        load: () => import('./controls/tree.page').then((m) => m.TreePage),
      },
      {
        label: 'Tree select',
        path: 'controls/tree-select',
        keywords: 'dropdown tree hierarchy checkbox',
        load: () => import('./controls/tree-select.page').then((m) => m.TreeSelectPage),
      },
    ],
  },
  {
    label: 'Date and time',
    items: [
      {
        label: 'Date picker',
        path: 'controls/date-picker',
        keywords:
          'datepicker date range multiple calendar input format locale min max time month year',
        load: () => import('./controls/date-picker.page').then((m) => m.DatePickerPage),
      },
      {
        label: 'Calendar',
        path: 'controls/calendar',
        keywords: 'inline month grid week range date',
        load: () => import('./controls/calendar.page').then((m) => m.CalendarPage),
      },
      {
        label: 'Time picker',
        path: 'controls/time-picker',
        keywords: 'time hour minute clock timeonly',
        load: () => import('./controls/time-picker.page').then((m) => m.TimePickerPage),
      },
    ],
  },
  {
    label: 'Menus',
    items: [
      {
        label: 'Menu',
        path: 'controls/menu',
        keywords: 'popup dropdown actions submenu trigger',
        load: () => import('./controls/menu.page').then((m) => m.MenuPage),
      },
      {
        label: 'Split button',
        path: 'controls/split-button',
        keywords: 'main action caret dropdown',
        load: () => import('./controls/split-button.page').then((m) => m.SplitButtonPage),
      },
      {
        label: 'Menubar',
        path: 'controls/menubar',
        keywords: 'top bar file edit view dropdown',
        load: () => import('./controls/menubar.page').then((m) => m.MenubarPage),
      },
      {
        label: 'Context menu',
        path: 'controls/context-menu',
        keywords: 'right click shortcut f10',
        load: () => import('./controls/context-menu.page').then((m) => m.ContextMenuPage),
      },
      {
        label: 'Mega menu',
        path: 'controls/mega-menu',
        keywords: 'panel columns catalogue',
        load: () => import('./controls/mega-menu.page').then((m) => m.MegaMenuPage),
      },
      {
        label: 'Panel menu',
        path: 'controls/panel-menu',
        keywords: 'accordion side navigation sections tree',
        load: () => import('./controls/panel-menu.page').then((m) => m.PanelMenuPage),
      },
    ],
  },
  {
    label: 'Panels',
    items: [
      {
        label: 'Accordion',
        path: 'controls/accordion',
        keywords: 'collapse sections expand faq',
        load: () => import('./controls/accordion.page').then((m) => m.AccordionPage),
      },
      {
        label: 'Panel and fieldset',
        path: 'controls/panel',
        keywords: 'box card collapse legend group fieldset',
        load: () => import('./controls/panel.page').then((m) => m.PanelPage),
      },
      {
        label: 'Card',
        path: 'controls/card',
        keywords: 'surface title footer media',
        load: () => import('./controls/card.page').then((m) => m.CardPage),
      },
      {
        label: 'Tabs',
        path: 'controls/tabs',
        keywords: 'tablist tabpanel pill lazy',
        load: () => import('./controls/tabs.page').then((m) => m.TabsPage),
      },
      {
        label: 'Stepper',
        path: 'controls/stepper',
        keywords: 'wizard steps linear',
        load: () => import('./controls/stepper.page').then((m) => m.StepperPage),
      },
      {
        label: 'Divider',
        path: 'controls/divider',
        keywords: 'separator line rule',
        load: () => import('./controls/divider.page').then((m) => m.DividerPage),
      },
      {
        label: 'Toolbar',
        path: 'controls/toolbar',
        keywords: 'actions bar roving focus',
        load: () => import('./controls/toolbar.page').then((m) => m.ToolbarPage),
      },
    ],
  },
  {
    label: 'Navigation',
    items: [
      {
        label: 'App bar',
        path: 'controls/app-bar',
        keywords: 'navbar toolbar header top bar title actions sticky banner landmark',
        load: () => import('./controls/app-bar.page').then((m) => m.AppBarPage),
      },
      {
        label: 'Breadcrumb',
        path: 'controls/breadcrumb',
        keywords: 'path trail home location',
        load: () => import('./controls/breadcrumb.page').then((m) => m.BreadcrumbPage),
      },
      {
        label: 'Bottom navigation',
        path: 'controls/bottom-nav',
        keywords: 'bottom nav tab bar mobile navigation bar destinations badge',
        load: () => import('./controls/bottom-nav.page').then((m) => m.BottomNavPage),
      },
      {
        label: 'Paginator',
        path: 'controls/paginator',
        keywords: 'pages rows per page first last report',
        load: () => import('./controls/paginator.page').then((m) => m.PaginatorPage),
      },
    ],
  },
  {
    label: 'Overlays',
    items: [
      {
        label: 'Dialog',
        path: 'controls/dialog',
        keywords: 'modal window header footer service component data result focus inert',
        load: () => import('./controls/dialog.page').then((m) => m.DialogPage),
      },
      {
        label: 'Confirm',
        path: 'controls/confirm',
        keywords: 'confirmation alertdialog popup ask delete accept reject',
        load: () => import('./controls/confirm.page').then((m) => m.ConfirmPage),
      },
      {
        label: 'Drawer',
        path: 'controls/drawer',
        keywords: 'side sheet panel left right top bottom',
        load: () => import('./controls/drawer.page').then((m) => m.DrawerPage),
      },
      {
        label: 'Popover',
        path: 'controls/popover',
        keywords: 'overlay panel anchored floating details',
        load: () => import('./controls/popover.page').then((m) => m.PopoverPage),
      },
      {
        label: 'Tooltip',
        path: 'controls/tooltip',
        keywords: 'hint hover focus label describedby',
        load: () => import('./controls/tooltip.page').then((m) => m.TooltipPage),
      },
      {
        label: 'Toast',
        path: 'controls/toast',
        keywords: 'notification message snackbar alert status',
        load: () => import('./controls/toast.page').then((m) => m.ToastPage),
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
      {
        label: 'Avatar',
        path: 'controls/avatar',
        keywords: 'initials image icon person user',
        load: () => import('./controls/avatar.page').then((m) => m.AvatarPage),
      },
      {
        label: 'Chip',
        path: 'controls/chip',
        keywords: 'pill label remove removable',
        load: () => import('./controls/chip.page').then((m) => m.ChipPage),
      },
      {
        label: 'Timeline',
        path: 'controls/timeline',
        keywords: 'events history steps vertical horizontal',
        load: () => import('./controls/timeline.page').then((m) => m.TimelinePage),
      },
      {
        label: 'Skeleton',
        path: 'controls/skeleton',
        keywords: 'placeholder loading shimmer',
        load: () => import('./controls/skeleton.page').then((m) => m.SkeletonPage),
      },
      {
        label: 'List',
        path: 'controls/list',
        keywords: 'list item nav list action list subheader avatar divider dense',
        load: () => import('./controls/list.page').then((m) => m.ListPage),
      },
      {
        label: 'Virtual scroller',
        path: 'controls/virtual-scroller',
        keywords: 'virtual scroll windowing large list lazy load infinite performance',
        load: () => import('./controls/virtual-scroller.page').then((m) => m.VirtualScrollerPage),
      },
      {
        label: 'Tree table',
        path: 'controls/tree-table',
        keywords: 'treetable hierarchy rows expand treegrid columns',
        load: () => import('./controls/tree-table.page').then((m) => m.TreeTablePage),
      },
      {
        label: 'Data view',
        path: 'controls/data-view',
        keywords: 'dataview list grid layout cards paging items template',
        load: () => import('./controls/data-view.page').then((m) => m.DataViewPage),
      },
      {
        label: 'Order list',
        path: 'controls/order-list',
        keywords: 'orderlist reorder sort move up down priority',
        load: () => import('./controls/order-list.page').then((m) => m.OrderListPage),
      },
      {
        label: 'Pick list',
        path: 'controls/pick-list',
        keywords: 'picklist transfer source target move dual list',
        load: () => import('./controls/pick-list.page').then((m) => m.PickListPage),
      },
      {
        label: 'Organization chart',
        path: 'controls/org-chart',
        keywords: 'orgchart hierarchy team structure tree connector',
        load: () => import('./controls/org-chart.page').then((m) => m.OrgChartPage),
      },
    ],
  },
  {
    label: 'Table',
    items: [
      {
        label: 'Table',
        path: 'controls/table',
        keywords:
          'data grid columns rows cell templates striped sticky loading empty skeleton p-table',
        load: () => import('./controls/table.page').then((m) => m.TablePage),
      },
      {
        label: 'Table sorting and filtering',
        path: 'controls/table-sort-filter',
        keywords:
          'sort multi-sort global filter column filter search range multiselect date number',
        load: () => import('./controls/table-sort-filter.page').then((m) => m.TableSortFilterPage),
      },
      {
        label: 'Table paging',
        path: 'controls/table-paging',
        keywords: 'pagination paginator lazy server side load rows per page',
        load: () => import('./controls/table-paging.page').then((m) => m.TablePagingPage),
      },
      {
        label: 'Table selection',
        path: 'controls/table-selection',
        keywords: 'single multiple checkbox radio row click actions buttons',
        load: () => import('./controls/table-selection.page').then((m) => m.TableSelectionPage),
      },
      {
        label: 'Table editing',
        path: 'controls/table-edit',
        keywords: 'inline cell edit editor reorder move rows up down',
        load: () => import('./controls/table-edit.page').then((m) => m.TableEditPage),
      },
      {
        label: 'Table columns',
        path: 'controls/table-columns',
        keywords: 'hide show reorder resize freeze frozen sticky saved state stateKey',
        load: () => import('./controls/table-columns.page').then((m) => m.TableColumnsPage),
      },
      {
        label: 'Table layout',
        path: 'controls/table-layout',
        keywords: 'expansion detail group footer stack responsive phone virtual scroll',
        load: () => import('./controls/table-layout.page').then((m) => m.TableLayoutPage),
      },
      {
        label: 'Table export',
        path: 'controls/table-export',
        keywords: 'csv excel xlsx print pdf download',
        load: () => import('./controls/table-export.page').then((m) => m.TableExportPage),
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
      {
        label: 'Message',
        path: 'controls/message',
        keywords: 'inline alert severity closable banner',
        load: () => import('./controls/message.page').then((m) => m.MessagePage),
      },
      {
        label: 'Banner',
        path: 'controls/banner',
        keywords: 'notice page alert persistent dismiss announcement',
        load: () => import('./controls/banner.page').then((m) => m.BannerPage),
      },
      {
        label: 'Progress bar',
        path: 'controls/progress-bar',
        keywords: 'percent determinate indeterminate upload',
        load: () => import('./controls/progress-bar.page').then((m) => m.ProgressBarPage),
      },
    ],
  },
  {
    label: 'Charts',
    items: [
      {
        label: 'Chart',
        path: 'controls/chart',
        keywords: 'bar line area doughnut pie graph svg data table series',
        load: () => import('./controls/chart.page').then((m) => m.ChartPage),
      },
    ],
  },
  {
    label: 'Media',
    items: [
      {
        label: 'File upload',
        path: 'controls/file-upload',
        keywords: 'files drop drag choose accept size limit progress status attachment paste',
        load: () => import('./controls/file-upload.page').then((m) => m.FileUploadPage),
      },
      {
        label: 'Editor',
        path: 'controls/editor',
        keywords: 'rich text wysiwyg html toolbar bold italic list link sanitize',
        load: () => import('./controls/editor.page').then((m) => m.EditorPage),
      },
      {
        label: 'Carousel',
        path: 'controls/carousel',
        keywords: 'slides scroll snap autoplay pages dots slider',
        load: () => import('./controls/carousel.page').then((m) => m.CarouselPage),
      },
      {
        label: 'Galleria',
        path: 'controls/galleria',
        keywords: 'gallery photos thumbnails caption images',
        load: () => import('./controls/galleria.page').then((m) => m.GalleriaPage),
      },
      {
        label: 'Image',
        path: 'controls/image',
        keywords: 'picture preview zoom lazy photo',
        load: () => import('./controls/image.page').then((m) => m.ImagePage),
      },
    ],
  },
  {
    label: 'Utilities',
    items: [
      {
        label: 'Splitter',
        path: 'controls/splitter',
        keywords: 'resize panes gutter divider layout',
        load: () => import('./controls/splitter.page').then((m) => m.SplitterPage),
      },
      {
        label: 'Speed dial',
        path: 'controls/speed-dial',
        keywords: 'floating action button fab quick actions',
        load: () => import('./controls/speed-dial.page').then((m) => m.SpeedDialPage),
      },
      {
        label: 'Dock',
        path: 'controls/dock',
        keywords: 'shortcuts bar magnify apps',
        load: () => import('./controls/dock.page').then((m) => m.DockPage),
      },
      {
        label: 'Scroll top',
        path: 'controls/scroll-top',
        keywords: 'back to top button scroll',
        load: () => import('./controls/scroll-top.page').then((m) => m.ScrollTopPage),
      },
      {
        label: 'Block UI',
        path: 'controls/block-ui',
        keywords: 'busy overlay mask inert loading',
        load: () => import('./controls/block-ui.page').then((m) => m.BlockUiPage),
      },
      {
        label: 'Meter group',
        path: 'controls/meter-group',
        keywords: 'segmented bar usage legend meter',
        load: () => import('./controls/meter-group.page').then((m) => m.MeterGroupPage),
      },
      {
        label: 'Terminal',
        path: 'controls/terminal',
        keywords: 'command line console history log',
        load: () => import('./controls/terminal.page').then((m) => m.TerminalPage),
      },
      {
        label: 'Inplace',
        path: 'controls/inplace',
        keywords: 'inline edit value editor',
        load: () => import('./controls/inplace.page').then((m) => m.InplacePage),
      },
      {
        label: 'Scroll panel',
        path: 'controls/scroll-panel',
        keywords: 'scrollbar region fixed height',
        load: () => import('./controls/scroll-panel.page').then((m) => m.ScrollPanelPage),
      },
      {
        label: 'Float label',
        path: 'controls/float-label',
        keywords: 'floating label input textarea select',
        load: () => import('./controls/float-label.page').then((m) => m.FloatLabelPage),
      },
      {
        label: 'Image compare',
        path: 'controls/image-compare',
        keywords: 'before after slider divider',
        load: () => import('./controls/image-compare.page').then((m) => m.ImageComparePage),
      },
      {
        label: 'Focus trap',
        path: 'controls/focus-trap',
        keywords: 'tab keyboard overlay cdk',
        load: () => import('./controls/focus-trap.page').then((m) => m.FocusTrapPage),
      },
      {
        label: 'Ripple',
        path: 'controls/ripple',
        keywords: 'ink press effect',
        load: () => import('./controls/ripple.page').then((m) => m.RipplePage),
      },
      {
        label: 'Animate on scroll',
        path: 'controls/animate-on-scroll',
        keywords: 'reveal fade intersection observer',
        load: () => import('./controls/animate-on-scroll.page').then((m) => m.AnimateOnScrollPage),
      },
      {
        label: 'Theme switch',
        path: 'controls/theme-switch',
        keywords: 'dark mode light system speed dial',
        load: () => import('./controls/theme-switch.page').then((m) => m.ThemeSwitchPage),
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
