import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

/** What the link popover gives back. */
export interface StarEditorLinkValue {
  readonly url: string;
  /** Open the link in a new tab: `target="_blank"` with `rel="noopener noreferrer"`. */
  readonly newTab: boolean;
}

/**
 * The address when it is safe for a link, else `null`. Allowed: `http:`, `https:`, `mailto:`,
 * `tel:`, and addresses on the same site (`/path`, `#anchor`). Spaces around are removed; a host
 * name without a scheme (`example.com/a`) gets `https://`.
 */
export function starEditorSafeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url || /[\s<>"]/.test(url)) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  if (/^[/#](?!\/)/.test(url)) return url;
  // No scheme: only a host name like "example.com/orders" becomes an https address.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(url))
    return `https://${url}`;
  return null;
}

/** Sets `href`, and `target` with `rel` for a new tab, on a link element. */
export function starEditorSetLink(anchor: HTMLAnchorElement, value: StarEditorLinkValue): void {
  anchor.setAttribute('href', value.url);
  if (value.newTab) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  } else {
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  }
}

/**
 * The link popover of `star-editor` (internal): an address field, "Open in a new tab", and the
 * buttons Apply, Remove (for an existing link) and Cancel. Escape cancels. It is not modal: it
 * sits under the toolbar, and the editor gives the focus back to the text.
 */
@Component({
  selector: 'star-editor-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor__link',
    role: 'group',
    '[attr.aria-label]': 'text.editorLink',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <!-- novalidate and type="text": the browser check of type="url" refuses a host name
      without a scheme and a path on the site, which the editor accepts. -->
    <form class="star-editor__link-form" novalidate (submit)="submit($event)">
      <label class="star-editor__link-label" [for]="inputId">{{ text.editorLinkPrompt }}</label>
      <input
        #address
        class="star-input star-input--sm"
        type="text"
        inputmode="url"
        autocomplete="url"
        [id]="inputId"
        [value]="url()"
        [attr.aria-invalid]="error() ? 'true' : null"
        [attr.aria-describedby]="error() ? errorId : null"
        (input)="url.set(address.value); error.set(false)"
      />
      @if (error()) {
        <span class="star-editor__link-error" [id]="errorId">{{ text.editorLinkInvalid }}</span>
      }
      <label class="star-editor__link-check">
        <input type="checkbox" [checked]="newTab()" (change)="newTab.set(box.checked)" #box />
        {{ text.editorLinkNewTab }}
      </label>
      <div class="star-editor__link-actions">
        <button type="submit" class="star-btn star-btn--primary star-btn--sm">
          {{ text.editorLinkApply }}
        </button>
        @if (editing()) {
          <button
            type="button"
            class="star-btn star-btn--ghost star-btn--sm"
            (click)="remove.emit()"
          >
            {{ text.editorLinkRemove }}
          </button>
        }
        <button
          type="button"
          class="star-btn star-btn--ghost star-btn--sm"
          (click)="dismissed.emit()"
        >
          {{ text.editorLinkCancel }}
        </button>
      </div>
    </form>
  `,
})
export class StarEditorLink {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  protected readonly inputId = this.ids.getId('star-editor-link-');
  protected readonly errorId = this.ids.getId('star-editor-link-error-');

  /** The address of the link at the caret, `''` for a new link. */
  readonly initialUrl = input('');
  readonly initialNewTab = input(false);
  /** True when the caret is in a link: the Remove button shows. */
  readonly editing = input(false);

  readonly apply = output<StarEditorLinkValue>();
  readonly remove = output<void>();
  readonly dismissed = output<void>();

  protected readonly url = linkedSignal(() => this.initialUrl());
  protected readonly newTab = linkedSignal(() => this.initialNewTab());
  protected readonly error = signal(false);
  private readonly address = viewChild.required<ElementRef<HTMLInputElement>>('address');

  constructor() {
    const injector = inject(Injector);
    afterNextRender(
      () => {
        const field = this.address().nativeElement;
        field.focus();
        field.select();
      },
      { injector },
    );
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const url = starEditorSafeUrl(this.url());
    if (!url) {
      this.error.set(true);
      this.address().nativeElement.focus();
      return;
    }
    this.apply.emit({ url, newTab: this.newTab() });
  }

  protected onEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}
