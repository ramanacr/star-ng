import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTerminal } from 'star-ng/utility';

@Component({
  imports: [StarTerminal],
  template: `
    <star-terminal ariaLabel="Console" prompt="app $" welcome="Type help." [handler]="run" />
  `,
})
class Host {
  readonly run = (command: string) => {
    if (command === 'boom') throw new Error('Unknown command: boom');
    return Promise.resolve(`ran ${command}`);
  };
}

describe('StarTerminal', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('prints the response of a command, shows errors and recalls history', async () => {
    const { fixture, el } = await setup();
    const input = el.querySelector<HTMLInputElement>('.star-terminal__input')!;
    const send = async (text: string) => {
      input.value = text;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await fixture.whenStable();
      await fixture.whenStable();
    };
    expect(el.querySelector('[role="log"]')?.getAttribute('aria-label')).toBe('Console');

    await send('status');
    await send('boom');
    const responses = [...el.querySelectorAll('.star-terminal__response')];
    expect(responses.map((line) => line.textContent)).toEqual([
      'ran status',
      'Unknown command: boom',
    ]);
    expect(responses[1].classList).toContain('star-terminal__response--error');
    expect(input.value).toBe('');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(input.value).toBe('boom');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(input.value).toBe('status');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(input.value).toBe('');
  });
});
