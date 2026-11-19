import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { starParseMarkdownLite } from './markdown-lite';

/**
 * Renders text in the Markdown subset of `starParseMarkdownLite` (paragraphs, line breaks, bold,
 * italic, inline code, fenced code blocks and links). Everything is bound as text: raw HTML in the
 * source shows as text. Links open in a new tab with `rel="noopener noreferrer"`; only `http:`,
 * `https:` and `mailto:` addresses become links. `star-chat` and `star-ai-prompt` use it.
 *
 * `<star-markdown-lite [text]="message.text" />`
 */
@Component({
  selector: 'star-markdown-lite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-md' },
  template: `
    @for (block of blocks(); track $index) {
      @if (block.kind === 'code') {
        <pre
          class="star-md__pre"
        ><code [attr.data-language]="block.language || null">{{ block.text }}</code></pre>
      } @else {
        <p class="star-md__p">
          @for (line of block.lines; track $index; let last = $last) {
            @for (part of line; track $index) {
              @if (part.kind === 'strong') {
                <strong>{{ part.text }}</strong>
              } @else if (part.kind === 'em') {
                <em>{{ part.text }}</em>
              } @else if (part.kind === 'code') {
                <code class="star-md__code">{{ part.text }}</code>
              } @else if (part.kind === 'link') {
                <a [href]="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
              } @else {
                <ng-container>{{ part.text }}</ng-container>
              }
            }
            @if (!last) {
              <br />
            }
          }
        </p>
      }
    }
  `,
})
export class StarMarkdownLite {
  /** The source text. */
  readonly text = input('');
  protected readonly blocks = computed(() => starParseMarkdownLite(this.text()));
}
