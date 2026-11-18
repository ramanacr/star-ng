import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT } from '@star-ng/ui/core';
import { StarMarkdownLite } from './markdown-lite.component';

/** State of one response of `star-ai-prompt`. */
export type StarAiPromptStatus = 'streaming' | 'done' | 'error';

/** One response of `star-ai-prompt`. */
export interface StarAiPromptOutput {
  /** Unique id. Keep it while the text grows. */
  readonly id: string;
  /** The prompt that asked for it. */
  readonly prompt: string;
  /** The response, in the Markdown subset of `star-markdown-lite`. */
  readonly text: string;
  readonly status: StarAiPromptStatus;
}

/**
 * AI prompt panel (Kendo UI `AIPrompt`; PrimeNG, Ignite UI and Syncfusion Angular have none as an
 * Angular control): a prompt field with suggestion chips and a Generate button, and the list of
 * responses with Copy, Retry and, while one streams, Stop.
 *
 * The library makes no network or model call: handle `promptRequest`, add a response with
 * `status: 'streaming'` to `outputs`, grow its text, and set `done` (or `error`). A polite live
 * region says when a response is ready, failed or was copied.
 *
 * Keyboard: Control+Enter (Command+Enter on a Mac) in the prompt sends it; Enter adds a line.
 *
 * ```html
 * <star-ai-prompt [outputs]="outputs()" [suggestions]="ideas" (promptRequest)="ask($event.prompt)"
 *   (retry)="ask($event.prompt)" (stop)="cancel($event.id)" />
 * ```
 */
@Component({
  selector: 'star-ai-prompt',
  imports: [StarMarkdownLite],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-ai-prompt' },
  template: `
    <div class="star-ai-prompt__panel">
      <textarea
        #field
        class="star-input star-ai-prompt__field"
        rows="3"
        [attr.aria-label]="ariaLabel() ?? text.aiPrompt"
        [attr.placeholder]="placeholder() ?? text.aiPromptPlaceholder"
        [disabled]="disabled()"
        [value]="prompt()"
        (input)="prompt.set(field.value)"
        (keydown)="onKeydown($event)"
      ></textarea>
      @if (suggestions().length) {
        <div class="star-ai-prompt__chips" role="group" [attr.aria-label]="text.promptSuggestions">
          @for (suggestion of suggestions(); track $index) {
            <button
              type="button"
              class="star-chip star-ai-prompt__chip"
              [disabled]="disabled()"
              (click)="useSuggestion(suggestion)"
            >
              {{ suggestion }}
            </button>
          }
        </div>
      }
      <div class="star-ai-prompt__bar">
        <button
          type="button"
          class="star-btn star-btn--primary star-btn--sm"
          [disabled]="disabled() || !prompt().trim()"
          (click)="request()"
        >
          <i class="ph ph-sparkle" aria-hidden="true"></i>{{ text.generate }}
        </button>
      </div>
    </div>
    @if (outputs().length) {
      <ul class="star-ai-prompt__outputs" [attr.aria-label]="text.aiResponses">
        @for (output of outputs(); track output.id) {
          @let streaming = output.status === 'streaming';
          <li class="star-ai-prompt__output" [attr.aria-busy]="streaming || null">
            <p class="star-ai-prompt__prompt">
              <i class="ph ph-chat-text" aria-hidden="true"></i>{{ output.prompt }}
            </p>
            @if (output.text) {
              <star-markdown-lite class="star-ai-prompt__text" [text]="output.text" />
            }
            @if (output.status === 'error') {
              <p class="star-ai-prompt__error">
                <i class="ph ph-warning-circle" aria-hidden="true"></i>{{ text.aiResponseFailed }}
              </p>
            }
            <div class="star-ai-prompt__actions">
              @if (streaming) {
                <span class="star-ai-prompt__generating">
                  <i class="ph-bold ph-spinner-gap star-spin" aria-hidden="true"></i
                  >{{ text.aiGenerating }}
                </span>
                <button
                  type="button"
                  class="star-btn star-btn--ghost star-btn--sm"
                  (click)="stop.emit(output)"
                >
                  <i class="ph ph-stop-circle" aria-hidden="true"></i>{{ text.stop }}
                </button>
              } @else {
                @if (output.text) {
                  <button
                    type="button"
                    class="star-btn star-btn--ghost star-btn--sm"
                    (click)="copy(output)"
                  >
                    <i class="ph ph-copy" aria-hidden="true"></i>{{ text.copy }}
                  </button>
                }
                <button
                  type="button"
                  class="star-btn star-btn--ghost star-btn--sm"
                  [disabled]="disabled()"
                  (click)="retry.emit(output)"
                >
                  <i class="ph ph-arrow-clockwise" aria-hidden="true"></i>{{ text.retry }}
                </button>
              }
            </div>
          </li>
        }
      </ul>
    }
    <p class="star-sr-only star-ai-prompt__live" aria-live="polite">{{ status() }}</p>
  `,
})
export class StarAiPrompt {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly document = inject(DOCUMENT);

  /** The responses, in the order shown (put the newest first or last, as you like). */
  readonly outputs = input<readonly StarAiPromptOutput[]>([]);
  /** Prompt ideas shown as chips. A chip fills the prompt field. */
  readonly suggestions = input<readonly string[]>([]);
  /** Placeholder of the prompt field. Defaults to the `aiPromptPlaceholder` text. */
  readonly placeholder = input<string | null>(null);
  /** Accessible name of the prompt field. Defaults to the `aiPrompt` text. */
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Emits the prompt when the user asks for a response. */
  readonly promptRequest = output<{ prompt: string }>();
  /** Emits a response the user wants again. */
  readonly retry = output<StarAiPromptOutput>();
  /** Emits the streaming response the user wants to stop. */
  readonly stop = output<StarAiPromptOutput>();

  /** The text of the prompt field. */
  readonly prompt = signal('');
  protected readonly status = signal('');
  private readonly field = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');
  private readonly previous = new Map<string, StarAiPromptStatus>();
  private toggle = false;

  constructor() {
    // Announce a response that finished or failed while it streamed.
    effect(() => {
      const outputs = this.outputs();
      untracked(() => {
        for (const item of outputs) {
          const before = this.previous.get(item.id);
          if (before === 'streaming' && item.status === 'done') {
            this.announce(this.text.aiResponseReady);
          } else if (before !== undefined && before !== 'error' && item.status === 'error') {
            this.announce(this.text.aiResponseFailed);
          }
          this.previous.set(item.id, item.status);
        }
      });
    });
  }

  /** Sends the prompt (`promptRequest`) and empties the field. */
  request(): void {
    const prompt = this.prompt().trim();
    if (!prompt || this.disabled()) return;
    this.promptRequest.emit({ prompt });
    this.prompt.set('');
    this.field().nativeElement.value = '';
  }

  protected useSuggestion(suggestion: string): void {
    this.prompt.set(suggestion);
    const field = this.field().nativeElement;
    field.value = suggestion;
    field.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
    event.preventDefault();
    this.request();
  }

  protected copy(item: StarAiPromptOutput): void {
    const clipboard = this.document.defaultView?.navigator?.clipboard;
    clipboard?.writeText(item.text).then(
      () => this.announce(this.text.copied),
      () => undefined,
    );
  }

  private announce(message: string): void {
    this.toggle = !this.toggle;
    this.status.set(message + (this.toggle ? '' : ' '));
  }
}
