import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  StarPart,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
  ɵstarModalOutside,
} from '@star-ng/ui/core';

/** One command of `star-command-palette`. */
export interface StarCommand {
  /** Unique id. The recent list keeps these ids. */
  readonly id: string;
  /** Text of the option. The filter matches it first. */
  readonly label: string;
  /**
   * Heading of the group the command belongs to. Commands without a group form a group without a
   * heading. Groups come in the order of their best match, then of their first command.
   */
  readonly group?: string;
  /** More words the filter matches, for example synonyms. They rank after the label. */
  readonly keywords?: readonly string[];
  /** Shortcut shown at the end of the option, for example `Ctrl+S`. Only shown: it is not bound. */
  readonly shortcut?: string;
  /** Icon classes, for example `ph-bold ph-floppy-disk`. */
  readonly icon?: string;
  /** Shown, but the keyboard skips it and it cannot run. */
  readonly disabled?: boolean;
  /** Runs when the user chooses the command, after the palette closed. */
  readonly run?: (command: StarCommand) => void;
}

/** Context of the `ng-template[starCommand]` slot. */
export interface StarCommandContext {
  /** The command (`let-command`). */
  readonly $implicit: StarCommand;
  /** `true` while the option is the active one (`let-active="active"`). */
  readonly active: boolean;
  /** The filter text (`let-query="query"`). */
  readonly query: string;
}

/**
 * Content of each option of `star-command-palette`: `<ng-template starCommand let-command>`.
 * Do not put focusable elements in it: the focus stays in the search field.
 */
@Directive({
  selector: 'ng-template[starCommand]',
  providers: [{ provide: StarSlot, useExisting: StarCommandTemplate }],
})
export class StarCommandTemplate extends StarSlot<StarCommandContext> {
  readonly name = 'command';

  static ngTemplateContextGuard(
    _dir: StarCommandTemplate,
    _ctx: unknown,
  ): _ctx is StarCommandContext {
    return true;
  }
}

/** One group of options, as the palette shows it. */
interface CommandGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly { readonly command: StarCommand; readonly id: string }[];
}

/** Lower case, without accents: "Café" and "cafe" match. */
export function starNormalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Rank of a match of `query` in `text`, both normalized: 0 when the text starts with the query,
 * 1 when a word of the text starts with it, 2 when the text contains it, `null` when it does not.
 */
function matchRank(text: string, query: string): number | null {
  if (text.startsWith(query)) return 0;
  const index = text.indexOf(query);
  if (index < 0) return null;
  // A word start: the query follows a character that is not a letter or a digit.
  let at = index;
  while (at >= 0) {
    if (at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1])) return 1;
    at = text.indexOf(query, at + 1);
  }
  return 2;
}

/**
 * Score of a command for a query, lower is better; `null` when it does not match. The label
 * ranks before the keywords: label prefix, label word start, label contains, then the same for
 * the keywords.
 */
export function starCommandScore(command: StarCommand, query: string): number | null {
  const normalized = starNormalizeText(query.trim());
  if (!normalized) return 0;
  const label = matchRank(starNormalizeText(command.label), normalized);
  if (label !== null) return label;
  let best: number | null = null;
  for (const keyword of command.keywords ?? []) {
    const rank = matchRank(starNormalizeText(keyword), normalized);
    if (rank !== null && (best === null || rank < best)) best = rank;
  }
  return best === null ? null : best + 3;
}

/** A parsed hotkey such as `mod+k`. */
interface Hotkey {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly mod: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

function parseHotkey(value: string): Hotkey | null {
  const parts = value
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) return null;
  return {
    key,
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    mod: parts.includes('mod'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
  };
}

function matchesHotkey(event: KeyboardEvent, hotkey: Hotkey): boolean {
  if (event.key?.toLowerCase() !== hotkey.key) return false;
  if (event.altKey !== hotkey.alt || event.shiftKey !== hotkey.shift) return false;
  // `mod` is Control or Command (Meta): one of them, as the platform uses.
  if (hotkey.mod) return event.ctrlKey !== event.metaKey && !(hotkey.ctrl || hotkey.meta);
  return event.ctrlKey === hotkey.ctrl && event.metaKey === hotkey.meta;
}

/**
 * Command palette (PrimeNG `p-commandmenu`): a modal search over commands, opened with a global
 * shortcut (`hotkey`, default Control+K or Command+K) or with `[(visible)]`.
 *
 * The filter ranks a label that starts with the text first, then a word of the label that starts
 * with it, then a label that contains it, then the same for the keywords. It ignores case and
 * accents. With an empty filter the palette shows the recent commands first (kept in memory,
 * `maxRecent`) and then every group.
 *
 * Accessibility: a native modal `<dialog>`. The search field is a `combobox` that keeps the focus;
 * `aria-activedescendant` points to the active option of the `listbox`. Arrow down and Arrow up
 * move, Enter runs the active command, Escape closes, and the focus goes back where it was.
 *
 * ```html
 * <star-command-palette [commands]="commands" (commandRun)="ran($event)" />
 * ```
 *
 * Slots: `ng-template[starCommand]` (option content), `ng-template[starEmpty]` (no match) and
 * `ng-template[starLoading]` (while `loading`).
 */
@Component({
  selector: 'star-command-palette',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: StarCommandPalette }],
  template: `
    <!-- Backdrop click only; keyboard users close with Escape (native cancel event). -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <dialog
      starPart="dialog"
      #dialog
      class="star-dialog star-dialog--modal star-command-palette"
      [attr.aria-label]="ariaLabel() ?? text.commandPalette"
      (cancel)="onCancel($event)"
      (close)="onNativeClose()"
      (click)="onDialogClick($event)"
    >
      <div starPart="search" class="star-command-palette__search">
        <i
          starPart="searchIcon"
          class="ph-bold ph-magnifying-glass star-command-palette__search-icon"
          aria-hidden="true"
        ></i>
        <input
          starPart="input"
          #input
          class="star-command-palette__input"
          type="text"
          role="combobox"
          autocomplete="off"
          spellcheck="false"
          aria-autocomplete="list"
          [attr.aria-expanded]="count() > 0"
          [attr.aria-controls]="listId"
          [attr.aria-activedescendant]="activeId()"
          [attr.aria-label]="ariaLabel() ?? text.commandPalette"
          [attr.placeholder]="placeholder() ?? text.commandPlaceholder"
          [value]="query()"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
        />
      </div>
      <div
        starPart="list"
        class="star-command-palette__list"
        [attr.role]="count() ? 'listbox' : null"
        [id]="listId"
        [attr.aria-label]="ariaLabel() ?? text.commandPalette"
        [attr.aria-busy]="loading() || null"
      >
        @for (group of groups(); track group.key) {
          <div
            starPart="group"
            class="star-command-palette__group"
            role="group"
            [attr.aria-labelledby]="group.label ? listId + '-g-' + $index : null"
          >
            @if (group.label) {
              <div
                starPart="heading"
                class="star-command-palette__heading"
                role="presentation"
                [id]="listId + '-g-' + $index"
              >
                {{ group.label }}
              </div>
            }
            @for (item of group.items; track item.id) {
              @let command = item.command;
              @let active = item.id === activeId();
              <!-- The input keeps the focus; the pointer picks an option. -->
              <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
              <div
                starPart="option"
                class="star-command-palette__option"
                role="option"
                [id]="item.id"
                [class.star-command-palette__option--active]="active"
                [attr.aria-selected]="active"
                [attr.aria-disabled]="command.disabled || null"
                (pointermove)="onPointer(item.id, command)"
                (mousedown)="$event.preventDefault()"
                (click)="choose(command)"
              >
                @if (commandTemplate(); as template) {
                  <ng-container
                    *ngTemplateOutlet="
                      template;
                      context: { $implicit: command, active: active, query: query() }
                    "
                  />
                } @else {
                  @if (command.icon) {
                    <i
                      starPart="icon"
                      class="star-command-palette__icon"
                      [class]="command.icon"
                      aria-hidden="true"
                    ></i>
                  }
                  <span starPart="label" class="star-command-palette__label">{{
                    command.label
                  }}</span>
                  @if (command.shortcut) {
                    <kbd starPart="shortcut" class="star-command-palette__shortcut">{{
                      command.shortcut
                    }}</kbd>
                  }
                }
              </div>
            }
          </div>
        }
        @if (loading()) {
          <div starPart="message" class="star-command-palette__message" role="presentation">
            @if (loadingTemplate(); as template) {
              <ng-container *ngTemplateOutlet="template" />
            } @else {
              {{ text.loading }}
            }
          </div>
        } @else if (!count()) {
          <div starPart="message" class="star-command-palette__message" role="presentation">
            @if (emptyTemplate(); as template) {
              <ng-container *ngTemplateOutlet="template; context: { $implicit: query() }" />
            } @else {
              {{ text.emptyFilterMessage }}
            }
          </div>
        }
      </div>
      <p starPart="srText" class="star-sr-only" aria-live="polite">{{ status() }}</p>
    </dialog>
  `,
})
export class StarCommandPalette {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly document = inject(DOCUMENT);

  /** The commands. */
  readonly commands = input<readonly StarCommand[]>([]);
  /** Open state. */
  readonly visible = model(false);
  /**
   * Global shortcut that opens and closes the palette, for example `mod+k` (Control+K, or
   * Command+K on a Mac), `ctrl+shift+p` or `/`. `null` or `''` turns it off.
   */
  readonly hotkey = input<string | null>('mod+k');
  /** Placeholder of the search field. Defaults to the `commandPlaceholder` text. */
  readonly placeholder = input<string | null>(null);
  /** Accessible name of the palette. Defaults to the `commandPalette` text. */
  readonly ariaLabel = input<string | null>(null);
  /** Shows the loading slot (or the "Loading" text) after the options, for async commands. */
  readonly loading = input(false, { transform: booleanAttribute });
  /** Number of recent commands shown first with an empty filter. `0` hides them. */
  readonly maxRecent = input(5, { transform: numberAttribute });
  /** The filter text. Two-way, for example to load commands for it. */
  readonly query = model('');

  /** Emits the command the user ran, after its `run` function. */
  readonly commandRun = output<StarCommand>();

  protected readonly listId = inject(_IdGenerator).getId('star-command-palette-');
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly commandTemplate = starSlot<StarCommandContext>(this.slots, this, 'command');
  protected readonly emptyTemplate = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly loadingTemplate = starSlot<object>(this.slots, this, 'loading');

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  /** Ids of the recent commands, the last one first. */
  private readonly recent = signal<readonly string[]>([]);
  private readonly active = signal<string | null>(null);

  /** The groups as shown: recent first (empty filter), then the groups by their best match. */
  protected readonly groups = computed<readonly CommandGroup[]>(() => {
    const query = this.query();
    const commands = this.commands();
    const groups: CommandGroup[] = [];
    let shownAsRecent = new Set<string>();
    if (!query.trim() && this.maxRecent() > 0) {
      const byId = new Map(commands.map((command) => [command.id, command]));
      const recent = this.recent()
        .map((id) => byId.get(id))
        .filter((command): command is StarCommand => !!command)
        .slice(0, this.maxRecent());
      shownAsRecent = new Set(recent.map((command) => command.id));
      if (recent.length) {
        groups.push({
          key: '\u0000recent',
          label: this.text.recentCommands,
          items: recent.map((command, index) => ({
            command,
            id: `${this.listId}-r${index}`,
          })),
        });
      }
    }
    const scored = new Map<
      string,
      { best: number; first: number; items: [number, number, StarCommand][] }
    >();
    commands.forEach((command, index) => {
      if (shownAsRecent.has(command.id)) return;
      const score = starCommandScore(command, query);
      if (score === null) return;
      const name = command.group ?? '';
      let group = scored.get(name);
      if (!group) scored.set(name, (group = { best: score, first: index, items: [] }));
      group.best = Math.min(group.best, score);
      group.items.push([score, index, command]);
    });
    const ordered = [...scored.entries()].sort(
      ([, a], [, b]) => a.best - b.best || a.first - b.first,
    );
    for (const [name, group] of ordered) {
      groups.push({
        key: name,
        label: name,
        items: group.items
          .sort((a, b) => a[0] - b[0] || a[1] - b[1])
          .map(([, index, command]) => ({ command, id: `${this.listId}-o${index}` })),
      });
    }
    return groups;
  });

  /** Options in the order shown. */
  private readonly options = computed(() => this.groups().flatMap((group) => group.items));
  protected readonly count = computed(() => this.options().length);
  /** Id of the active option: the chosen one while it is shown and enabled, else the first enabled. */
  protected readonly activeId = computed(() => {
    const enabled = this.options().filter((item) => !item.command.disabled);
    const chosen = this.active();
    return enabled.find((item) => item.id === chosen)?.id ?? enabled[0]?.id ?? null;
  });
  protected readonly status = computed(() =>
    this.visible() && !this.loading() ? this.text.resultsAvailable(this.count()) : '',
  );

  constructor() {
    afterRenderEffect({
      write: () => {
        const element = this.dialog().nativeElement;
        const visible = this.visible();
        if (visible && !element.open) {
          element.showModal?.();
          this.input().nativeElement.focus();
        } else if (!visible && element.open) {
          element.close();
        }
      },
    });
    // The active option stays in view while the arrow keys move it.
    afterRenderEffect(() => {
      const id = this.activeId();
      if (!id || !this.visible()) return;
      this.dialog()
        .nativeElement.querySelector<HTMLElement>(`[id="${id}"]`)
        ?.scrollIntoView?.({ block: 'nearest' });
    });
    // The global shortcut, in the browser only.
    const onKeydown = (event: KeyboardEvent) => this.onDocumentKeydown(event);
    afterNextRender(() => this.document.addEventListener('keydown', onKeydown));
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('keydown', onKeydown));
  }

  /** Opens the palette with an empty filter. */
  show(): void {
    if (this.visible()) return;
    this.query.set('');
    this.active.set(null);
    this.visible.set(true);
  }

  /** Closes the palette. */
  hide(): void {
    this.visible.set(false);
  }

  /** Opens or closes the palette. */
  toggle(): void {
    if (this.visible()) this.hide();
    else this.show();
  }

  /** Closes the palette, keeps the command as recent, runs it and emits `commandRun`. */
  choose(command: StarCommand): void {
    if (command.disabled) return;
    this.hide();
    this.recent.update((ids) =>
      [command.id, ...ids.filter((id) => id !== command.id)].slice(0, 20),
    );
    command.run?.(command);
    this.commandRun.emit(command);
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(null);
  }

  protected onPointer(id: string, command: StarCommand): void {
    if (!command.disabled) this.active.set(id);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const enabled = this.options().filter((item) => !item.command.disabled);
    const index = enabled.findIndex((item) => item.id === this.activeId());
    switch (event.key) {
      case 'ArrowDown':
        if (!enabled.length) return;
        this.active.set(enabled[(index + 1) % enabled.length].id);
        break;
      case 'ArrowUp':
        if (!enabled.length) return;
        this.active.set(enabled[(index - 1 + enabled.length) % enabled.length].id);
        break;
      case 'PageDown':
      case 'PageUp':
        if (!enabled.length) return;
        this.active.set(enabled[event.key === 'PageDown' ? enabled.length - 1 : 0].id);
        break;
      case 'Enter': {
        if (event.isComposing) return;
        const item = enabled[index];
        if (!item) return;
        this.choose(item.command);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    const value = this.hotkey();
    const hotkey = value ? parseHotkey(value) : null;
    if (!hotkey || event.defaultPrevented || !matchesHotkey(event, hotkey)) return;
    // An app modal dialog is open: the shortcut must not open the palette over it.
    if (ɵstarModalOutside(this.document, this.dialog().nativeElement)) return;
    // A one-key shortcut such as "/" must not fire while the user types in a field.
    if (!hotkey.ctrl && !hotkey.meta && !hotkey.mod && !hotkey.alt && this.isTyping(event)) return;
    event.preventDefault();
    this.toggle();
  }

  private isTyping(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    return !!target?.closest?.(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    );
  }

  protected onCancel(event: Event): void {
    // We own the state: Escape closes through `visible`.
    event.preventDefault();
    this.hide();
  }

  protected onNativeClose(): void {
    if (this.visible()) this.visible.set(false);
  }

  protected onDialogClick(event: MouseEvent): void {
    // A click on the <dialog> itself landed on the backdrop.
    if (event.target === this.dialog().nativeElement) this.hide();
  }
}
