import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarTerminal } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-terminal-page',
  imports: [DOCS, StarTerminal, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Terminal"
      lead="A text command line. The user types a command and the handler returns the text to print. Arrow up and down recall earlier commands. The log is a live region, so a screen reader announces each response. The control is always dark, in both themes."
      importFrom="import { StarTerminal, StarTerminalHandler } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Command handler"
        source="terminal/basic"
        [script]="script"
        note="The handler returns a string or a promise of a string. A thrown error prints its message in red. The terminal runs nothing by itself and prints the response as plain text. Try: help, status, date, reboot."
      >
        <div class="docs-stack docs-terminal">
          <star-terminal
            #terminal
            ariaLabel="Diagnostics"
            prompt="app $"
            welcome="Type help for the commands."
            [handler]="runCommand"
            (commandRun)="last.set($event)"
          />
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="terminal.clear()">
              Clear
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="terminal.run('status')">
              Run "status"
            </star-button>
          </div>
          <p class="docs-output" role="status">Last command: {{ last() || 'none' }}</p>
        </div>
      </docs-example>

      <docs-api [of]="['StarTerminal']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
  styles: `
    .docs-terminal {
      max-width: 40rem;
    }
  `,
})
export class TerminalPage {
  protected readonly last = signal('');

  protected readonly runCommand = (command: string): string => {
    switch (command) {
      case 'help':
        return 'Commands: help, status, date';
      case 'status':
        return 'Service: running\nOpen orders: 38';
      case 'date':
        return new Date().toDateString();
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  };

  protected readonly script = `readonly last = signal('');

readonly runCommand = (command: string): string => {
  switch (command) {
    case 'help':
      return 'Commands: help, status, date';
    case 'status':
      return 'Service: running\\nOpen orders: 38';
    case 'date':
      return new Date().toDateString();
    default:
      throw new Error(\`Unknown command: \${command}\`);
  }
};`;

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-tooltip-surface',
      description: 'Background of the terminal (dark in both themes).',
    },
    { name: '--star-terminal-text', description: 'Text color. Set on the terminal.' },
    { name: '--star-terminal-muted', description: 'Color of the welcome text.' },
    { name: '--star-terminal-accent', description: 'Color of the prompt and the caret.' },
    { name: '--star-terminal-error', description: 'Color of an error response.' },
    { name: '--star-type-code', description: 'Font of the terminal.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter', description: 'Runs the typed command and prints the response.' },
    { name: 'Arrow up', description: 'Recalls the previous command.' },
    { name: 'Arrow down', description: 'Recalls the next command, then an empty line.' },
  ];
}
