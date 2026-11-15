import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

export interface StarTerminalEntry {
  readonly command: string;
  /** Text printed under the command; `null` while the handler runs. */
  readonly response: string | null;
  readonly error?: boolean;
}

/** Runs a command and returns the text to print. A thrown error prints its message in red. */
export type StarTerminalHandler = (command: string) => string | Promise<string>;

/**
 * Terminal (PrimeNG `p-terminal`): a text command line. The user types a command, the
 * `handler` returns the text to print. Up / Down recall earlier commands. The output is a
 * live log, so a screen reader announces each response.
 *
 * `<star-terminal ariaLabel="Diagnostics" prompt="mi $" [handler]="run" welcome="Type help." />`
 *
 * The control does not run anything itself and prints the response as plain text.
 */
@Component({
  selector: 'star-terminal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-terminal', '(click)': 'focus()' },
  template: `
    <div
      #log
      class="star-terminal__log"
      role="log"
      aria-live="polite"
      [attr.aria-label]="ariaLabel()"
    >
      @if (welcome()) {
        <p class="star-terminal__welcome">{{ welcome() }}</p>
      }
      @for (entry of entries(); track $index) {
        <p class="star-terminal__command">
          <span class="star-terminal__prompt" aria-hidden="true">{{ prompt() }}</span>
          {{ entry.command }}
        </p>
        @if (entry.response !== null) {
          <pre
            class="star-terminal__response"
            [class.star-terminal__response--error]="entry.error"
            >{{ entry.response }}</pre>
        }
      }
    </div>
    <div class="star-terminal__line">
      <label class="star-terminal__prompt" [for]="inputId">{{ prompt() }}</label>
      <input
        #input
        type="text"
        class="star-terminal__input"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        [id]="inputId"
        [attr.aria-label]="text.terminalCommand"
        [disabled]="busy()"
        (keydown)="onKeydown($event, input)"
      />
    </div>
  `,
})
export class StarTerminal {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly injector = inject(Injector);
  protected readonly inputId = inject(_IdGenerator).getId('star-terminal-');

  readonly prompt = input('$');
  readonly welcome = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  /** Runs a command. Without a handler the terminal only emits `commandRun`. */
  readonly handler = input<StarTerminalHandler | null>(null);
  readonly commandRun = output<string>();

  protected readonly entries = signal<readonly StarTerminalEntry[]>([]);
  protected readonly busy = signal(false);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly log = viewChild.required<ElementRef<HTMLElement>>('log');
  /** Position in the command history while the user presses Up / Down (-1 = new line). */
  private recall = -1;

  focus(): void {
    // A click that ends a text selection must not move focus away from the selection.
    if (this.input().nativeElement.ownerDocument.getSelection()?.toString()) return;
    this.input().nativeElement.focus();
  }

  /** Removes all printed lines. */
  clear(): void {
    this.entries.set([]);
  }

  /** Prints a command and its response, as if the user typed it. */
  async run(command: string): Promise<void> {
    const text = command.trim();
    if (!text || this.busy()) return;
    this.recall = -1;
    this.commandRun.emit(text);
    const handler = this.handler();
    const index = this.entries().length;
    this.entries.update((entries) => [
      ...entries,
      { command: text, response: handler ? null : '' },
    ]);
    if (handler) {
      this.busy.set(true);
      let response: string;
      let error = false;
      try {
        response = await handler(text);
      } catch (cause) {
        error = true;
        response = cause instanceof Error ? cause.message : String(cause);
      }
      this.entries.update((entries) =>
        entries.map((entry, i) => (i === index ? { ...entry, response, error } : entry)),
      );
      this.busy.set(false);
    }
    afterNextRender(
      () => {
        const log = this.log().nativeElement;
        log.scrollTop = log.scrollHeight;
        this.input().nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected onKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === 'Enter') {
      const value = input.value;
      input.value = '';
      void this.run(value);
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const history = this.entries().map((entry) => entry.command);
    if (!history.length) return;
    event.preventDefault();
    if (event.key === 'ArrowUp') {
      this.recall = this.recall < 0 ? history.length - 1 : Math.max(0, this.recall - 1);
    } else {
      this.recall = this.recall < 0 || this.recall >= history.length - 1 ? -1 : this.recall + 1;
    }
    input.value = this.recall < 0 ? '' : history[this.recall];
  }
}
