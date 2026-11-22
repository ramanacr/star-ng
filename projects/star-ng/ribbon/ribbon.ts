import { _IdGenerator } from '@angular/cdk/a11y';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  Directive,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import {
  STAR_UI_TEXT,
  StarAnnouncer,
  starInlineKey,
  StarPart,
  StarStyled,
  ɵSTAR_PART_HOST,
  ɵstarModalOutside,
} from '@star-ng/ui/core';
import { StarMenu, StarMenuItem, StarMenuTrigger } from '@star-ng/ui/menu';
import { StarTooltip } from '@star-ng/ui/tooltip';
import {
  starAssignKeyTips,
  StarKeyTipEntry,
  starKeyTipMatch,
  StarRibbonGroupMode,
  starRibbonGroupModes,
} from './ribbon-model';

/**
 * Kind of a ribbon item: a button, a toggle button (`pressed`), a split button (button plus
 * `menu`), a dropdown menu button (`menu`), a button group (`items`) or a custom item (the
 * `ng-template[starRibbonItem]` of the group with the same id).
 */
export type StarRibbonItemType = 'button' | 'toggle' | 'split' | 'dropdown' | 'group' | 'custom';

/** An entry of the menu of a split or dropdown item. */
export interface StarRibbonMenuItem {
  readonly id: string;
  readonly label?: string;
  readonly icon?: string;
  readonly disabled?: boolean;
  readonly separator?: boolean;
}

/** One item of a ribbon group. The ribbon never changes it: `pressed` stays with the owner. */
export interface StarRibbonItem {
  /** Command id: `command` emits it. Unique in the ribbon. */
  readonly id: string;
  readonly label: string;
  /** Default `'button'`. */
  readonly type?: StarRibbonItemType;
  /** Phosphor icon class, for example `ph-bold ph-clipboard`. */
  readonly icon?: string;
  /** `'large'`: icon above the label, three rows high. Default `'small'`. */
  readonly size?: 'large' | 'small';
  readonly disabled?: boolean;
  /** State of a toggle button. */
  readonly pressed?: boolean;
  /** Tooltip text. Small (icon-only) items show the label when there is none. */
  readonly tooltip?: string;
  /** KeyTip letters. Without it the ribbon assigns one from the label. */
  readonly keyTip?: string;
  /** Entries of a split or dropdown item. */
  readonly menu?: readonly StarRibbonMenuItem[];
  /** Buttons of a button group (`type: 'group'`). */
  readonly items?: readonly StarRibbonItem[];
}

/**
 * Payload of `command`. Buttons send `{ id }`, toggle buttons `{ id, value: next pressed state }`,
 * menu entries of a split or dropdown item `{ id: item id, value: entry id }`.
 */
export interface StarRibbonCommand {
  readonly id: string;
  readonly value?: unknown;
}

/** Context of an `ng-template[starRibbonItem]`. */
export interface StarRibbonItemContext {
  readonly $implicit: StarRibbonItem;
}

/**
 * Custom item of a ribbon group: `<ng-template starRibbonItem="fontSize" let-item>…</ng-template>`
 * renders in place of the item with `id: 'fontSize'` and `type: 'custom'`. Its controls keep
 * their own tab stops; the arrow keys of the group toolbar skip them.
 */
@Directive({ selector: 'ng-template[starRibbonItem]' })
export class StarRibbonItemTemplate {
  /** Id of the custom item. */
  readonly starRibbonItem = input.required<string>();
  readonly template = inject<TemplateRef<StarRibbonItemContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: StarRibbonItemTemplate,
    _context: unknown,
  ): _context is StarRibbonItemContext {
    return true;
  }
}

/**
 * A group of a ribbon tab (Kendo `RibbonGroup`, Syncfusion `e-ribbon-group`): a label, its items
 * and an optional dialog launcher. Write it inside `star-ribbon-tab`.
 */
@Component({
  selector: 'star-ribbon-group',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class StarRibbonGroup {
  readonly label = input.required<string>();
  readonly items = input<readonly StarRibbonItem[]>([]);
  /** Command id of the dialog launcher button. Without it the group has no launcher. */
  readonly dialogLauncher = input<string | null>(null);
  /** Icon of the overflow button when the group is collapsed. */
  readonly icon = input<string | null>(null);
  /** KeyTip of the overflow button when the group is collapsed. */
  readonly keyTip = input<string | null>(null);
  private readonly templates = contentChildren(StarRibbonItemTemplate);

  /** The custom template of an item. @internal */
  templateFor(id: string): TemplateRef<StarRibbonItemContext> | null {
    return this.templates().find((slot) => slot.starRibbonItem() === id)?.template ?? null;
  }
}

/** A tab of the ribbon (Kendo `RibbonTab`, Syncfusion `e-ribbon-tab`). Holds `star-ribbon-group`s. */
@Component({
  selector: 'star-ribbon-tab',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class StarRibbonTab {
  /** Unique key; the value of `selectedTab`. */
  readonly key = input.required<string>();
  readonly label = input.required<string>();
  /** KeyTip letters. Without it the ribbon assigns one from the label. */
  readonly keyTip = input<string | null>(null);
  readonly groups = contentChildren(StarRibbonGroup);
}

/**
 * Backstage (file) view of the ribbon (Syncfusion `RibbonBackstage`, the Kendo file menu): a
 * button before the tabs opens it in place of the tab panel. Its content is projected.
 */
@Component({
  selector: 'star-ribbon-backstage',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-template #body><ng-content /></ng-template>',
})
export class StarRibbonBackstage {
  /** Label of the button. Default: the `ribbonFile` text ("File"). */
  readonly label = input<string | null>(null);
  readonly keyTip = input<string | null>('F');
  /** @internal */
  readonly body = viewChild.required<TemplateRef<unknown>>('body');
}

type KeyTipLevel = 'tabs' | 'items' | 'group';

const SPLIT_MENU = '::menu';

/** A value escaped for a CSS selector: `CSS.escape`, or a plain escape where it is missing. */
function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (text: string) => string } }).CSS;
  return css?.escape ? css.escape(value) : value.replace(/["\\]/g, '\\$&');
}

/**
 * Ribbon (Kendo `Ribbon`, Syncfusion `ejs-ribbon`; DevExtreme has no ribbon): tabs of command
 * groups, as in office applications.
 *
 * - Items: large and small buttons, toggle buttons, split buttons, dropdown menus, button groups
 *   and custom templates. Every item sends `command`; the ribbon never changes the items.
 * - Narrow width: groups get small (icons only) from the last to the first, then collapse to one
 *   overflow button each, which opens the group as a flyout (browser only, `ResizeObserver`).
 * - `collapsed` shows only the tab headers; a tab click shows the panel until the next command.
 * - Keyboard: the tab list is a WAI-ARIA tab list; each group is a WAI-ARIA toolbar (one tab stop,
 *   arrow keys, Home and End). Alt or F10 shows KeyTips (Microsoft Fluent): type the letters of
 *   a tab, then of an item. Escape steps back.
 *
 * ```html
 * <star-ribbon (command)="run($event)">
 *   <star-ribbon-tab key="home" label="Home">
 *     <star-ribbon-group label="Clipboard" [items]="clipboard" dialogLauncher="clipboard-options" />
 *   </star-ribbon-tab>
 * </star-ribbon>
 * ```
 */
@Component({
  selector: 'star-ribbon',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet, StarMenu, StarMenuTrigger, StarTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-ribbon-host',
    '(keydown)': 'onHostKeydown($event)',
    '(keyup)': 'onHostKeyup($event)',
    '(focusout)': 'onFocusOut($event)',
    '(focusin)': 'onFocusIn($event)',
    '(pointerdown)': 'onHostPointerDown()',
  },
  template: `
    <div
      data-star-part="surface"
      class="star-ribbon"
      [class.star-ribbon--collapsed]="collapsed()"
      [class.star-ribbon--peek]="collapsed() && peek()"
      [class.star-ribbon--keytips]="!!keyTipLevel()"
    >
      <div data-star-part="header" class="star-ribbon__header">
        @if (backstage(); as stage) {
          <button
            data-star-part="fileButton"
            type="button"
            class="star-ribbon__file"
            data-keytip="file"
            [attr.aria-expanded]="backstageOpen()"
            [attr.aria-controls]="backstageOpen() ? id + '-backstage' : null"
            (click)="toggleBackstage()"
            #fileButton
          >
            {{ stage.label() ?? text.ribbonFile }}
            <ng-container *ngTemplateOutlet="tip; context: { $implicit: 'file' }" />
          </button>
        }
        <div
          data-star-part="tabsPanel"
          class="star-ribbon__tabs"
          role="tablist"
          [attr.aria-label]="ariaLabel() ?? text.ribbon"
          [attr.aria-describedby]="id + '-hint'"
        >
          @for (tab of tabs(); track tab.key(); let i = $index) {
            <button
              data-star-part="tabButton"
              type="button"
              role="tab"
              class="star-ribbon__tab"
              [class.star-ribbon__tab--active]="tab.key() === activeKey()"
              [id]="id + '-tab-' + i"
              [attr.aria-selected]="tab.key() === activeKey()"
              [attr.aria-controls]="id + '-panel'"
              [attr.tabindex]="tab.key() === activeKey() ? 0 : -1"
              [attr.data-keytip]="'tab:' + tab.key()"
              (click)="selectTab(tab, true)"
              (dblclick)="toggleCollapsed()"
              (keydown)="onTabKeydown($event, i)"
            >
              {{ tab.label() }}
              <ng-container *ngTemplateOutlet="tip; context: { $implicit: 'tab:' + tab.key() }" />
            </button>
          }
        </div>
        <button
          data-star-part="collapseButton"
          type="button"
          class="star-ribbon__collapse"
          [attr.aria-label]="collapsed() ? text.ribbonExpand : text.ribbonCollapse"
          [attr.aria-expanded]="!collapsed()"
          [attr.aria-controls]="id + '-panel'"
          (click)="toggleCollapsed()"
        >
          <i
            data-star-part="collapseIcon"
            class="ph-bold"
            [class.ph-caret-up]="!collapsed()"
            [class.ph-caret-down]="collapsed()"
            aria-hidden="true"
          ></i>
        </button>
      </div>
      <p class="star-sr-only" [id]="id + '-hint'">{{ text.ribbonKeyTipsHint }}</p>

      @if (backstageOpen() && backstage(); as stage) {
        <div
          data-star-part="backstagePanel"
          class="star-ribbon__backstage"
          role="region"
          [id]="id + '-backstage'"
          [attr.aria-label]="stage.label() ?? text.ribbonFile"
        >
          <ng-container *ngTemplateOutlet="stage.body()" />
        </div>
      }

      <div
        data-star-part="panel"
        #panel
        class="star-ribbon__panel"
        role="tabpanel"
        [id]="id + '-panel'"
        [attr.aria-labelledby]="activeTabId()"
        [hidden]="(collapsed() && !peek()) || backstageOpen()"
      >
        @for (group of activeGroups(); track group; let g = $index) {
          <div
            data-star-part="groupPanel"
            class="star-ribbon-group"
            [class.star-ribbon-group--small]="mode(g) === 'small'"
            [class.star-ribbon-group--collapsed]="mode(g) === 'collapsed'"
            [class.star-ribbon-group--open]="mode(g) === 'collapsed' && openGroup() === g"
          >
            <button
              data-star-part="overflowButton"
              type="button"
              class="star-ribbon-group__overflow"
              [attr.tabindex]="mode(g) === 'collapsed' ? 0 : -1"
              [attr.aria-expanded]="openGroup() === g"
              [attr.aria-controls]="id + '-group-' + g"
              [attr.data-keytip]="'group:' + g"
              (click)="toggleGroup(g)"
            >
              <i
                data-star-part="overflowIcon"
                class="star-ribbon-group__overflow-icon"
                [class]="group.icon() ?? 'ph-bold ph-squares-four'"
                aria-hidden="true"
              ></i>
              <span data-star-part="overflowText">{{ group.label() }}</span>
              <i
                data-star-part="overflowToggleIcon"
                class="ph-bold ph-caret-down"
                aria-hidden="true"
              ></i>
              <ng-container *ngTemplateOutlet="tip; context: { $implicit: 'group:' + g }" />
            </button>
            <div
              data-star-part="itemsPanel"
              class="star-ribbon-group__items"
              role="toolbar"
              [id]="id + '-group-' + g"
              [attr.aria-label]="group.label()"
              [attr.data-group]="g"
            >
              @for (item of group.items(); track item.id) {
                <ng-container
                  *ngTemplateOutlet="itemView; context: { $implicit: item, group, g }"
                />
              }
            </div>
            <div data-star-part="footer" class="star-ribbon-group__footer">
              <span data-star-part="label" class="star-ribbon-group__label" aria-hidden="true">{{
                group.label()
              }}</span>
              @if (group.dialogLauncher(); as launcher) {
                <button
                  data-star-part="launcherButton"
                  type="button"
                  class="star-ribbon-group__launcher"
                  [attr.aria-label]="text.ribbonGroupOptions(group.label())"
                  [attr.data-keytip]="'launcher:' + g"
                  [starTooltip]="text.ribbonGroupOptions(group.label())"
                  (click)="emit({ id: launcher }, g)"
                >
                  <i
                    data-star-part="launcherIcon"
                    class="ph-bold ph-arrow-square-down-right star-icon-mirror"
                    aria-hidden="true"
                  ></i>
                  <ng-container *ngTemplateOutlet="tip; context: { $implicit: 'launcher:' + g }" />
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <ng-template #itemView let-item let-group="group" let-g="g">
      @switch (item.type ?? 'button') {
        @case ('group') {
          <div
            starPart="buttonList"
            class="star-ribbon-buttons"
            role="group"
            [attr.aria-label]="item.label"
          >
            @for (child of item.items ?? []; track child.id) {
              <ng-container *ngTemplateOutlet="itemView; context: { $implicit: child, group, g }" />
            }
          </div>
        }
        @case ('custom') {
          @if (group.templateFor(item.id); as template) {
            <div starPart="customPanel" class="star-ribbon-custom">
              <ng-container *ngTemplateOutlet="template; context: { $implicit: item }" />
            </div>
          }
        }
        @case ('split') {
          <div
            starPart="splitButton"
            class="star-ribbon-split"
            [class.star-ribbon-split--large]="item.size === 'large'"
          >
            <button
              data-star-part="commandItem"
              type="button"
              class="star-ribbon-item"
              [class.star-ribbon-item--large]="item.size === 'large'"
              [disabled]="item.disabled"
              [attr.data-focus-key]="item.id"
              [attr.data-keytip]="'item:' + item.id"
              [attr.tabindex]="isStop(g, item.id) ? 0 : -1"
              [starTooltip]="tooltipOf(item, g)"
              (click)="emit({ id: item.id }, g)"
            >
              <ng-container *ngTemplateOutlet="face; context: { $implicit: item }" />
            </button>
            <button
              data-star-part="toggleButton"
              type="button"
              class="star-ribbon-split__toggle"
              [disabled]="item.disabled"
              [attr.aria-label]="text.ribbonSplitMenu(item.label)"
              [attr.data-focus-key]="item.id + splitMenu"
              [attr.tabindex]="isStop(g, item.id + splitMenu) ? 0 : -1"
              [starMenuTrigger]="splitMenuRef"
            >
              <i data-star-part="toggleIcon" class="ph-bold ph-caret-down" aria-hidden="true"></i>
            </button>
            <star-menu
              #splitMenuRef
              [items]="menuItems(item)"
              (itemClick)="runMenu(item, $event, g)"
            />
          </div>
        }
        @case ('dropdown') {
          <button
            starPart="commandItem"
            type="button"
            class="star-ribbon-item star-ribbon-item--dropdown"
            [class.star-ribbon-item--large]="item.size === 'large'"
            [disabled]="item.disabled"
            [attr.data-focus-key]="item.id"
            [attr.data-keytip]="'item:' + item.id"
            [attr.tabindex]="isStop(g, item.id) ? 0 : -1"
            [starTooltip]="tooltipOf(item, g)"
            [starMenuTrigger]="dropdownRef"
          >
            <ng-container *ngTemplateOutlet="face; context: { $implicit: item }" />
            <i
              data-star-part="dropdownIcon"
              class="ph-bold ph-caret-down star-ribbon-item__caret"
              aria-hidden="true"
            ></i>
          </button>
          <star-menu
            #dropdownRef
            [items]="menuItems(item)"
            (itemClick)="runMenu(item, $event, g)"
          />
        }
        @default {
          <button
            starPart="commandItem"
            type="button"
            class="star-ribbon-item"
            [class.star-ribbon-item--large]="item.size === 'large'"
            [class.star-ribbon-item--pressed]="item.type === 'toggle' && item.pressed"
            [disabled]="item.disabled"
            [attr.aria-pressed]="item.type === 'toggle' ? !!item.pressed : null"
            [attr.data-focus-key]="item.id"
            [attr.data-keytip]="'item:' + item.id"
            [attr.tabindex]="isStop(g, item.id) ? 0 : -1"
            [starTooltip]="tooltipOf(item, g)"
            (click)="runItem(item, g)"
          >
            <ng-container *ngTemplateOutlet="face; context: { $implicit: item }" />
          </button>
        }
      }
    </ng-template>

    <ng-template #face let-item>
      @if (item.icon) {
        <i
          starPart="icon"
          class="star-ribbon-item__icon"
          [class]="item.icon"
          aria-hidden="true"
        ></i>
      }
      <span starPart="label" class="star-ribbon-item__label">{{ item.label }}</span>
      <ng-container *ngTemplateOutlet="tip; context: { $implicit: 'item:' + item.id }" />
    </ng-template>

    <ng-template #tip let-target>
      @if (tipOf(target); as letters) {
        <span starPart="keytipText" class="star-ribbon__keytip" aria-hidden="true">{{
          letters
        }}</span>
      }
    </ng-template>
  `,
})
export class StarRibbon {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly announcer = inject(StarAnnouncer);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly id = inject(_IdGenerator).getId('star-ribbon-');
  protected readonly splitMenu = SPLIT_MENU;

  /** Key of the selected tab. Default: the first tab. */
  readonly selectedTab = model<string | null>(null);
  /** Minimised ribbon: only the tab headers show (Kendo `collapsed`). */
  readonly collapsed = model(false);
  /** The backstage view is open. */
  readonly backstageOpen = model(false);
  /** Groups get small and collapse when the ribbon is narrow. Default on. */
  readonly collapseGroups = input(true, { transform: booleanAttribute });
  /**
   * Alt and F10 show the KeyTips from anywhere on the page, not only while the focus is in the
   * ribbon. Use it for the one main ribbon of an application.
   */
  readonly globalKeyTips = input(false, { transform: booleanAttribute });
  /** Name of the tab list. Default: the `ribbon` text. */
  readonly ariaLabel = input<string | null>(null);
  /** An item, a menu entry or a dialog launcher was activated. */
  // The name is the public API of the ribbon; the native `command` event does not bubble.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly command = output<StarRibbonCommand>();

  protected readonly tabs = contentChildren(StarRibbonTab);
  protected readonly backstage = contentChild(StarRibbonBackstage);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly fileButton = viewChild<ElementRef<HTMLButtonElement>>('fileButton');

  protected readonly activeKey = computed(() => {
    const tabs = this.tabs();
    const selected = this.selectedTab();
    return tabs.some((tab) => tab.key() === selected) ? selected : (tabs[0]?.key() ?? null);
  });
  private readonly activeIndex = computed(() =>
    this.tabs().findIndex((tab) => tab.key() === this.activeKey()),
  );
  protected readonly activeTabId = computed(() =>
    this.activeIndex() < 0 ? null : `${this.id}-tab-${this.activeIndex()}`,
  );
  protected readonly activeGroups = computed(() => this.tabs()[this.activeIndex()]?.groups() ?? []);

  // The group state below belongs to the active tab: a new tab starts it again (linkedSignal).
  /** Mode of each group of the active tab (measured in the browser). */
  private readonly modes = linkedSignal<string | null, readonly StarRibbonGroupMode[]>({
    source: this.activeKey,
    computation: () => [],
  });
  /** The collapsed group whose flyout is open. */
  protected readonly openGroup = linkedSignal<string | null, number | null>({
    source: this.activeKey,
    computation: () => null,
  });
  /** The collapsed ribbon shows its panel for now. */
  protected readonly peek = signal(false);
  /** Roving tab stop of each group toolbar (focus key). */
  private readonly stops = linkedSignal<string | null, ReadonlyMap<number, string>>({
    source: this.activeKey,
    computation: () => new Map(),
  });

  protected readonly keyTipLevel = signal<KeyTipLevel | null>(null);
  private readonly keyTipGroup = signal<number | null>(null);
  private typed = '';
  private altAlone = false;
  /** The deferred focus check of a focusout without a target. */
  private focusCheck: ReturnType<typeof setTimeout> | undefined;

  /** KeyTips of the level that shows. */
  private readonly keyTips = computed<ReadonlyMap<string, string>>(() => {
    const level = this.keyTipLevel();
    if (!level) return new Map();
    if (level === 'tabs') {
      const entries: StarKeyTipEntry[] = [];
      const stage = this.backstage();
      if (stage) {
        entries.push({
          id: 'file',
          label: stage.label() ?? this.text.ribbonFile,
          keyTip: stage.keyTip(),
        });
      }
      for (const tab of this.tabs()) {
        entries.push({ id: `tab:${tab.key()}`, label: tab.label(), keyTip: tab.keyTip() });
      }
      return starAssignKeyTips(entries);
    }
    const groups = this.activeGroups();
    const only = level === 'group' ? this.keyTipGroup() : null;
    const entries: StarKeyTipEntry[] = [];
    groups.forEach((group, g) => {
      if (only !== null && g !== only) return;
      if (only === null && this.mode(g) === 'collapsed') {
        entries.push({ id: `group:${g}`, label: group.label(), keyTip: group.keyTip() });
        return;
      }
      const add = (items: readonly StarRibbonItem[]) => {
        for (const item of items) {
          if (item.type === 'group') add(item.items ?? []);
          else if (item.type !== 'custom' && !item.disabled) {
            entries.push({ id: `item:${item.id}`, label: item.label, keyTip: item.keyTip });
          }
        }
      };
      add(group.items());
      if (group.dialogLauncher()) entries.push({ id: `launcher:${g}`, label: group.label() });
    });
    return starAssignKeyTips(entries);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.focusCheck));
    // A new tab or new items: measure the groups again once they are in the DOM.
    effect(() => {
      this.activeGroups().forEach((group) => group.items());
      this.collapsed();
      this.peek();
      this.backstageOpen();
      this.activeKey();
      untracked(() => {
        if (this.browser) afterNextRender(() => this.refit(), { injector: this.injector });
      });
    });
    if (this.browser) this.observe();
  }

  /**
   * Measures the groups and sets their modes for the width of the ribbon. The ribbon calls it when
   * its size, tab or items change; call it after a change it cannot see, for example a font load.
   */
  refit(): void {
    const panel = this.panel()?.nativeElement;
    if (!this.browser || !panel || panel.hidden) return;
    if (!this.collapseGroups()) {
      this.modes.set([]);
      return;
    }
    const available = panel.clientWidth;
    if (!available) return;
    const view = this.doc.defaultView;
    const gap = parseFloat(view?.getComputedStyle(panel).columnGap ?? '') || 0;
    const groups = [...panel.children].filter((child): child is HTMLElement =>
      child.classList.contains('star-ribbon-group'),
    );
    const widths = groups.map((group) => ({
      full: this.measure(panel, group, 'full'),
      small: this.measure(panel, group, 'small'),
      collapsed: this.measure(panel, group, 'collapsed'),
    }));
    const next = starRibbonGroupModes(widths, available, gap);
    const now = this.modes();
    if (next.length !== now.length || next.some((mode, i) => mode !== now[i])) this.modes.set(next);
  }

  /** Width of a copy of `group` in `mode`, out of sight. */
  private measure(panel: HTMLElement, group: HTMLElement, mode: StarRibbonGroupMode): number {
    const copy = group.cloneNode(true) as HTMLElement;
    copy.classList.remove(
      'star-ribbon-group--small',
      'star-ribbon-group--collapsed',
      'star-ribbon-group--open',
    );
    if (mode !== 'full') copy.classList.add(`star-ribbon-group--${mode}`);
    copy.classList.add('star-ribbon-group--measure');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    for (const element of copy.querySelectorAll('[id]')) element.removeAttribute('id');
    panel.appendChild(copy);
    const width = copy.getBoundingClientRect().width;
    copy.remove();
    return width;
  }

  private observe(): void {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const panel = this.panel()?.nativeElement;
      const view = this.doc.defaultView;
      let frame = 0;
      const observer =
        panel && view && typeof view.ResizeObserver === 'function'
          ? new view.ResizeObserver(() => {
              view.cancelAnimationFrame(frame);
              frame = view.requestAnimationFrame(() => this.refit());
            })
          : null;
      if (panel) observer?.observe(panel);
      const onPointer = (event: Event) => {
        const target = event.target as Element | null;
        if (!target || this.host.nativeElement.contains(target) || this.inOverlay(target)) return;
        this.altAlone = false;
        this.hideKeyTips();
        this.openGroup.set(null);
        this.peek.set(false);
      };
      // The window lost the focus (Alt+Tab): an Alt released elsewhere is no lone Alt here, and the
      // KeyTips hide.
      const onBlur = () => {
        this.altAlone = false;
        this.hideKeyTips();
      };
      this.doc.addEventListener('pointerdown', onPointer, true);
      view?.addEventListener('blur', onBlur);
      destroyRef.onDestroy(() => {
        observer?.disconnect();
        this.doc.removeEventListener('pointerdown', onPointer, true);
        view?.removeEventListener('blur', onBlur);
      });
    });
    // The page-wide KeyTip keys.
    effect((onCleanup) => {
      if (!this.globalKeyTips()) return;
      // Behind a modal dialog the page-wide keys belong to the dialog.
      const down = (event: KeyboardEvent) => this.modalOutside() || this.onKeydown(event);
      const up = (event: KeyboardEvent) => this.modalOutside() || this.onKeyup(event);
      this.doc.addEventListener('keydown', down);
      this.doc.addEventListener('keyup', up);
      onCleanup(() => {
        this.doc.removeEventListener('keydown', down);
        this.doc.removeEventListener('keyup', up);
      });
    });
  }

  protected mode(g: number): StarRibbonGroupMode {
    return this.modes()[g] ?? 'full';
  }

  protected tipOf(target: string): string | null {
    return this.keyTips().get(target) ?? null;
  }

  protected tooltipOf(item: StarRibbonItem, g: number): string {
    return item.tooltip ?? (this.mode(g) === 'small' || !item.size ? item.label : '');
  }

  /** Menu entries of a split or dropdown item, as `star-menu` items (the `id` is kept). */
  protected menuItems(item: StarRibbonItem): readonly StarMenuItem[] {
    return item.menu ?? [];
  }

  // ---------------------------------------------------------------- commands

  protected runItem(item: StarRibbonItem, g: number): void {
    this.emit(item.type === 'toggle' ? { id: item.id, value: !item.pressed } : { id: item.id }, g);
  }

  protected runMenu(item: StarRibbonItem, entry: StarMenuItem, g: number): void {
    this.emit({ id: item.id, value: (entry as StarRibbonMenuItem).id }, g);
  }

  protected emit(command: StarRibbonCommand, g: number): void {
    this.command.emit(command);
    if (this.openGroup() === g) {
      this.openGroup.set(null);
      this.focus(`[data-keytip="group:${g}"]`);
    }
    if (this.peek()) {
      this.peek.set(false);
      this.focusActiveTab();
    }
  }

  // ---------------------------------------------------------------- tabs and panels

  protected selectTab(tab: StarRibbonTab, click = false): void {
    const same = tab.key() === this.activeKey();
    this.selectedTab.set(tab.key());
    this.backstageOpen.set(false);
    if (click && this.collapsed()) this.peek.set(same ? !this.peek() : true);
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
    this.peek.set(false);
  }

  protected toggleBackstage(): void {
    this.backstageOpen.update((open) => !open);
    this.peek.set(false);
  }

  protected toggleGroup(g: number): void {
    this.openGroup.update((open) => (open === g ? null : g));
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const tabs = this.tabs();
    const last = tabs.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = keys[starInlineKey(event, this.host.nativeElement)];
    if (next === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    this.selectTab(tabs[next]);
    this.focusTab(next);
  }

  private focusTab(index: number): void {
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.id}-tab-${index}`)?.focus();
  }

  private focusActiveTab(): void {
    this.focusTab(Math.max(0, this.activeIndex()));
  }

  /** Focus keys of the enabled buttons of a group, in order. */
  private focusKeys(g: number): string[] {
    const keys: string[] = [];
    const add = (items: readonly StarRibbonItem[]) => {
      for (const item of items) {
        if (item.type === 'group') add(item.items ?? []);
        else if (item.type === 'custom' || item.disabled) continue;
        else {
          keys.push(item.id);
          if (item.type === 'split') keys.push(item.id + SPLIT_MENU);
        }
      }
    };
    add(this.activeGroups()[g]?.items() ?? []);
    return keys;
  }

  protected isStop(g: number, key: string): boolean {
    const keys = this.focusKeys(g);
    const stop = this.stops().get(g);
    return (stop !== undefined && keys.includes(stop) ? stop : keys[0]) === key;
  }

  protected onFocusIn(event: FocusEvent): void {
    const toolbar = this.toolbarOf(event);
    if (!toolbar) return;
    const g = toolbar.group;
    const key = (event.target as HTMLElement)
      .closest('[data-focus-key]')
      ?.getAttribute('data-focus-key');
    if (key && this.stops().get(g) !== key) {
      this.stops.update((stops) => new Map(stops).set(g, key));
    }
  }

  private toolbarOf(event: Event): { element: HTMLElement; group: number } | null {
    const element = (event.target as Element).closest<HTMLElement>('[role="toolbar"][data-group]');
    return element && this.host.nativeElement.contains(element)
      ? { element, group: Number(element.getAttribute('data-group')) }
      : null;
  }

  private onToolbarKeydown(event: KeyboardEvent): void {
    const bar = this.toolbarOf(event);
    if (!bar) return;
    const g = bar.group;
    const current = (event.target as HTMLElement).closest<HTMLElement>('[data-focus-key]');
    if (!current || event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = [...bar.element.querySelectorAll<HTMLButtonElement>('[data-focus-key]')].filter(
      (button) => !button.disabled,
    );
    const index = buttons.indexOf(current as HTMLButtonElement);
    const last = buttons.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: index >= last ? 0 : index + 1,
      ArrowLeft: index <= 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = keys[starInlineKey(event, this.host.nativeElement)];
    if (next === undefined || !buttons[next]) return;
    event.preventDefault();
    const key = buttons[next].getAttribute('data-focus-key')!;
    this.stops.update((stops) => new Map(stops).set(g, key));
    buttons[next].focus();
  }

  // ---------------------------------------------------------------- keyboard and KeyTips

  protected onHostKeydown(event: KeyboardEvent): void {
    if (!this.keyTipLevel()) this.onToolbarKeydown(event);
    if (!this.globalKeyTips()) this.onKeydown(event);
    else if (!this.keyTipLevel()) this.onEscape(event);
  }

  protected onHostKeyup(event: KeyboardEvent): void {
    if (!this.globalKeyTips()) this.onKeyup(event);
  }

  private onKeydown(event: KeyboardEvent): void {
    if (this.keyTipLevel()) {
      this.onKeyTipKey(event);
      return;
    }
    this.altAlone = event.key === 'Alt';
    if (event.key === 'F10' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.showKeyTips();
      return;
    }
    // With `globalKeyTips` the host listener handles Escape.
    if (!this.globalKeyTips()) this.onEscape(event);
  }

  private onKeyup(event: KeyboardEvent): void {
    if (event.key !== 'Alt' || !this.altAlone) return;
    this.altAlone = false;
    event.preventDefault();
    if (this.keyTipLevel()) this.hideKeyTips();
    else this.showKeyTips();
  }

  /** Escape closes the open flyout, the shown panel of a collapsed ribbon or the backstage. */
  private onEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    const open = this.openGroup();
    if (open !== null) {
      event.preventDefault();
      this.openGroup.set(null);
      this.focus(`[data-keytip="group:${open}"]`);
    } else if (this.peek()) {
      event.preventDefault();
      this.peek.set(false);
      this.focusActiveTab();
    } else if (this.backstageOpen()) {
      event.preventDefault();
      this.backstageOpen.set(false);
      this.fileButton()?.nativeElement.focus();
    }
  }

  private showKeyTips(): void {
    this.typed = '';
    this.keyTipGroup.set(null);
    this.keyTipLevel.set('tabs');
    if (!this.host.nativeElement.contains(this.doc.activeElement)) this.focusActiveTab();
    void this.announcer.announce(this.text.ribbonKeyTipsShown);
  }

  protected onHostPointerDown(): void {
    this.altAlone = false;
    this.hideKeyTips();
  }

  /** True when a modal dialog outside the ribbon is open. */
  private modalOutside(): boolean {
    return ɵstarModalOutside(this.doc, this.host.nativeElement);
  }

  /** Hides the KeyTips. */
  hideKeyTips(): void {
    this.typed = '';
    this.keyTipLevel.set(null);
    this.keyTipGroup.set(null);
  }

  private onKeyTipKey(event: KeyboardEvent): void {
    const key = event.key;
    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.stepBack();
      return;
    }
    if (key === 'Alt') {
      this.altAlone = true;
      return;
    }
    // Alt with a letter is an application or browser shortcut, not a KeyTip.
    if (event.altKey) return;
    if (key === 'F10') {
      event.preventDefault();
      this.hideKeyTips();
      return;
    }
    if (key.length !== 1 || event.ctrlKey || event.metaKey) {
      if (key !== 'Shift') this.hideKeyTips();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.typed += key.toUpperCase();
    const match = starKeyTipMatch(this.keyTips(), this.typed);
    if (match.id) this.activate(match.id);
    else if (!match.partial) this.typed = '';
  }

  private stepBack(): void {
    this.typed = '';
    const level = this.keyTipLevel();
    if (level === 'group') {
      const g = this.keyTipGroup();
      this.openGroup.set(null);
      this.keyTipGroup.set(null);
      this.keyTipLevel.set('items');
      this.focus(`[data-keytip="group:${g}"]`);
    } else if (level === 'items') {
      this.keyTipLevel.set('tabs');
      this.focusActiveTab();
    } else {
      this.hideKeyTips();
    }
  }

  private activate(target: string): void {
    this.typed = '';
    if (target === 'file') {
      this.hideKeyTips();
      this.backstageOpen.set(true);
      this.fileButton()?.nativeElement.focus();
      return;
    }
    if (target.startsWith('tab:')) {
      const index = this.tabs().findIndex((tab) => `tab:${tab.key()}` === target);
      this.selectTab(this.tabs()[index]);
      if (this.collapsed()) this.peek.set(true);
      this.focusTab(index);
      this.keyTipLevel.set('items');
      return;
    }
    if (target.startsWith('group:')) {
      const g = Number(target.slice(6));
      this.openGroup.set(g);
      this.keyTipGroup.set(g);
      this.keyTipLevel.set('group');
      this.focus(`[data-keytip="${cssEscape(target)}"]`);
      return;
    }
    const element = this.host.nativeElement.querySelector<HTMLElement>(
      `[data-keytip="${cssEscape(target)}"]`,
    );
    this.hideKeyTips();
    element?.focus();
    element?.click();
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Element | null;
    if (next && (this.host.nativeElement.contains(next) || this.inOverlay(next))) {
      const open = this.openGroup();
      if (open !== null && !next.closest(`#${this.id}-group-${open}`)) {
        const overflow = next.closest('[data-keytip]')?.getAttribute('data-keytip');
        if (overflow !== `group:${open}`) this.openGroup.set(null);
      }
      return;
    }
    if (!next) {
      // The focus left the page (another window), or a re-render removed the focused element.
      // Hide only when the focus did not land back in the ribbon by the next tick.
      // When the window loses the focus, the active element stays in the ribbon: check hasFocus().
      clearTimeout(this.focusCheck);
      this.focusCheck = setTimeout(() => {
        this.focusCheck = undefined;
        if (!this.doc.hasFocus() || !this.host.nativeElement.contains(this.doc.activeElement)) {
          this.hideKeyTips();
        }
      });
      return;
    }
    this.hideKeyTips();
    this.openGroup.set(null);
    this.peek.set(false);
  }

  private inOverlay(element: Element): boolean {
    return !!element.closest('.cdk-overlay-container');
  }

  private focus(selector: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
