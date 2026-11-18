import { booleanAttribute, Directive, inject, input, output } from '@angular/core';
import { STAR_UI_TEXT, StarAnnouncer, StarClipboard } from '@star-ng/ui/core';

/**
 * Copies text to the clipboard when the host is clicked (CDK `cdkCopyToClipboard`; PrimeNG has no
 * directive). After the copy it announces the `copied` UI text ("Copied"), or `copyFailed`, through
 * `StarAnnouncer`, and emits `copied` with `true` or `false`. Put it on a button:
 *
 * ```html
 * <star-button variant="ghost" [starCopy]="order.id" (copied)="done.set($event)">Copy id</star-button>
 * ```
 */
@Directive({
  selector: '[starCopy]',
  host: { '(click)': 'copy()' },
})
export class StarCopy {
  private readonly clipboard = inject(StarClipboard);
  private readonly announcer = inject(StarAnnouncer);
  private readonly text = inject(STAR_UI_TEXT);

  /** The text to copy. */
  readonly starCopy = input.required<string>();
  /** Announces the result to screen readers (default `true`). Set `false` when the page shows it in its own live region. */
  readonly copyAnnounce = input(true, { transform: booleanAttribute });
  /** `true` after a successful copy, `false` when the copy failed. */
  readonly copied = output<boolean>();

  /** Copies the text now. The click on the host calls it. */
  async copy(): Promise<boolean> {
    const done = await this.clipboard.copy(this.starCopy());
    if (this.copyAnnounce()) {
      void this.announcer.announce(done ? this.text.copied : this.text.copyFailed, 'polite', {
        source: 'starCopy',
      });
    }
    this.copied.emit(done);
    return done;
  }
}
