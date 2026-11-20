import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarAiPrompt,
  StarAiPromptOutput,
  StarChat,
  StarChatAuthor,
  StarChatMessage,
  StarChatMessageTemplate,
} from '@star-ng/ui/chat';
import { StarEmptyTemplate } from '@star-ng/ui/core';
import { starParseInline, starParseMarkdownLite, starSafeLink } from './markdown-lite';

const ANA: StarChatAuthor = { id: 'ana', name: 'Ana Silva' };
const BOT: StarChatAuthor = { id: 'bot', name: 'Helper' };
const ME: StarChatAuthor = { id: 'me', name: 'Jonas Berg' };

function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 10, day, hour, minute);
}

const MESSAGES: StarChatMessage[] = [
  { id: '1', author: ANA, text: 'Hello', timestamp: at(17, 9) },
  { id: '2', author: ANA, text: 'Are you there?', timestamp: at(17, 9, 1) },
  { id: '3', author: ME, text: 'Yes **here**', timestamp: at(18, 10), status: 'sent' },
  { id: '4', author: ANA, text: 'Great', timestamp: at(18, 10, 2) },
];

function key(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('markdown-lite', () => {
  it('parses paragraphs, line breaks and fenced code', () => {
    expect(starParseMarkdownLite('One\ntwo\n\nThree\n```ts\nconst a = 1;\n```\nEnd')).toEqual([
      {
        kind: 'paragraph',
        lines: [[{ kind: 'text', text: 'One' }], [{ kind: 'text', text: 'two' }]],
      },
      { kind: 'paragraph', lines: [[{ kind: 'text', text: 'Three' }]] },
      { kind: 'code', language: 'ts', text: 'const a = 1;' },
      { kind: 'paragraph', lines: [[{ kind: 'text', text: 'End' }]] },
    ]);
  });

  it('keeps an open fence (while streaming) as code to the end', () => {
    expect(starParseMarkdownLite('```\nlet x')).toEqual([
      { kind: 'code', language: '', text: 'let x' },
    ]);
  });

  it('parses bold, italic, code and links', () => {
    expect(starParseInline('a **b** *c* `d` [e](https://x.test/?q=1)')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'strong', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'em', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'd' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'e', href: 'https://x.test/?q=1' },
    ]);
  });

  it('keeps unsafe links and raw HTML as text', () => {
    expect(starParseInline('[x](javascript:alert(1)) <b>y</b>')).toEqual([
      { kind: 'text', text: '[x](javascript:alert(1)) <b>y</b>' },
    ]);
    expect(starSafeLink('mailto:a@b.test')).toBe('mailto:a@b.test');
    expect(starSafeLink('data:text/html,x')).toBeNull();
    expect(starSafeLink('java\tscript:x')).toBeNull();
    expect(starSafeLink('/relative')).toBeNull();
  });
});

@Component({
  imports: [StarChat, StarChatMessageTemplate, StarEmptyTemplate],
  template: `
    <star-chat
      [messages]="messages()"
      user="me"
      [typing]="typing()"
      [loading]="loading()"
      locale="en-US"
      (send)="sent.push($event.text)"
      (loadMore)="loads = loads + 1"
    >
      @if (custom()) {
        <ng-template starChatMessage let-message let-own="own" let-first="first">
          <i class="custom">{{ message.text }}|{{ own }}|{{ first }}</i>
        </ng-template>
        <ng-template starEmpty>Say hello</ng-template>
      }
    </star-chat>
  `,
})
class ChatHost {
  readonly chat = viewChild.required(StarChat);
  readonly messages = signal<StarChatMessage[]>(MESSAGES);
  readonly typing = signal<StarChatAuthor[]>([]);
  readonly loading = signal(false);
  readonly custom = signal(false);
  readonly sent: string[] = [];
  loads = 0;
}

async function setupChat() {
  const fixture = TestBed.createComponent(ChatHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const composer = root.querySelector<HTMLTextAreaElement>('textarea')!;
  const sendButton = root.querySelector<HTMLButtonElement>('button[aria-label=Send]')!;
  const live = () => root.querySelector('.star-chat__live')?.textContent?.trim();
  const messages = () => [...root.querySelectorAll<HTMLElement>('.star-chat__message')];
  return { fixture, root, host, composer, sendButton, live, messages };
}

describe('StarChat', () => {
  it('lists messages in a labelled, focusable region with day separators', async () => {
    const { root, messages } = await setupChat();
    const region = root.querySelector('.star-chat__scroll')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('Messages');
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('aria-live')).toBeNull();
    const days = [...root.querySelectorAll('[role=separator]')].map((d) =>
      d.getAttribute('aria-label'),
    );
    expect(days).toEqual(['Tuesday, November 17, 2026', 'Wednesday, November 18, 2026']);
    expect(messages().length).toBe(4);
  });

  it('aligns own messages to the end and groups consecutive messages by author', async () => {
    const { messages } = await setupChat();
    const [first, second, own, last] = messages();
    expect(own.classList).toContain('star-chat__message--own');
    expect(first.classList).not.toContain('star-chat__message--own');
    expect(first.classList).toContain('star-chat__message--first');
    expect(second.classList).not.toContain('star-chat__message--first');
    expect(first.querySelector('.star-chat__author')?.textContent?.trim()).toBe('Ana Silva');
    expect(second.querySelector('.star-chat__author')).toBeNull();
    // Every message names its author for screen readers.
    expect(second.querySelector('.star-sr-only')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Ana Silva at 9:01 AM:',
    );
    expect(last.classList).toContain('star-chat__message--first');
    expect(own.querySelector('.star-chat__text strong')?.textContent).toBe('here');
    expect(own.querySelector('.star-chat__status')?.getAttribute('aria-label')).toBe('Sent');
  });

  it('renders links safely and raw HTML as text', async () => {
    const { host, fixture, root } = await setupChat();
    host.messages.set([
      {
        id: 'x',
        author: ANA,
        text: 'See [docs](https://example.test) <img src=x onerror=alert(1)>',
        timestamp: at(18, 11),
      },
    ]);
    await fixture.whenStable();
    const link = root.querySelector<HTMLAnchorElement>('.star-chat__text a')!;
    expect(link.getAttribute('href')).toBe('https://example.test');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(root.querySelector('.star-chat__text img')).toBeNull();
    expect(root.querySelector('.star-chat__text')?.textContent).toContain('<img src=x');
  });

  it('sends with Enter and the button, keeps Shift+Enter for a new line', async () => {
    const { host, fixture, composer, sendButton } = await setupChat();
    expect(composer.getAttribute('aria-label')).toBe('Message');
    expect(sendButton.disabled).toBe(true);
    composer.value = 'Hi there';
    composer.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(sendButton.disabled).toBe(false);
    const shift = key(composer, 'Enter', { shiftKey: true });
    expect(shift.defaultPrevented).toBe(false);
    expect(host.sent).toEqual([]);
    const enter = key(composer, 'Enter');
    await fixture.whenStable();
    expect(enter.defaultPrevented).toBe(true);
    expect(host.sent).toEqual(['Hi there']);
    expect(composer.value).toBe('');
    composer.value = '  second  ';
    composer.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    sendButton.click();
    await fixture.whenStable();
    expect(host.sent).toEqual(['Hi there', 'second']);
  });

  it('shows who is typing', async () => {
    const { host, fixture, root } = await setupChat();
    expect(root.querySelector('.star-chat__typing')).toBeNull();
    host.typing.set([ANA]);
    await fixture.whenStable();
    expect(root.querySelector('.star-chat__typing')?.textContent?.trim()).toBe(
      'Ana Silva is typing',
    );
    host.typing.set([ANA, BOT]);
    await fixture.whenStable();
    expect(root.querySelector('.star-chat__typing')?.textContent?.trim()).toBe(
      'Ana Silva and Helper are typing',
    );
  });

  it('announces a new message from others once it is sent, not every streamed token', async () => {
    const { host, fixture, live } = await setupChat();
    expect(live()).toBe('');
    host.messages.update((list) => [
      ...list,
      { id: '5', author: BOT, text: 'Thin', timestamp: at(18, 12), status: 'sending' },
    ]);
    await fixture.whenStable();
    expect(live()).toBe('');
    host.messages.update((list) =>
      list.map((m) => (m.id === '5' ? { ...m, text: 'Thinking done' } : m)),
    );
    await fixture.whenStable();
    expect(live()).toBe('');
    host.messages.update((list) =>
      list.map((m) => (m.id === '5' ? { ...m, status: 'sent' as const } : m)),
    );
    await fixture.whenStable();
    expect(live()).toBe('New message from Helper: Thinking done');
    host.messages.update((list) => [
      ...list,
      { id: '6', author: ME, text: 'Mine', timestamp: at(18, 12, 1), status: 'sent' },
    ]);
    await fixture.whenStable();
    expect(live()).toBe('New message from Helper: Thinking done');
  });

  it('skips the time of an invalid timestamp instead of throwing (m5)', async () => {
    const { host, fixture, messages } = await setupChat();
    host.messages.set([
      { id: 'a', author: ANA, text: 'Fine', timestamp: at(18, 9) },
      { id: 'b', author: ANA, text: 'Broken', timestamp: 'not a date' },
    ]);
    await fixture.whenStable();
    expect(messages().length).toBe(2);
    expect(messages()[1].querySelector('time')).toBeNull();
  });

  it('gives every day separator its own key (m6)', async () => {
    const { host, fixture, root } = await setupChat();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    host.messages.set([
      { id: 'a', author: ANA, text: 'One', timestamp: at(17, 9) },
      { id: 'b', author: ANA, text: 'Two', timestamp: at(18, 9) },
      { id: 'c', author: ANA, text: 'Three', timestamp: at(17, 10) },
    ]);
    await fixture.whenStable();
    expect(root.querySelectorAll('[role=separator]').length).toBe(3);
    expect(warn.mock.calls.some((call) => String(call[0]).includes('NG0955'))).toBe(false);
    warn.mockRestore();
  });

  it('announces several messages that complete together once, and not a replaced conversation (m7)', async () => {
    const { host, fixture, live } = await setupChat();
    host.messages.update((list) => [
      ...list,
      { id: 'n1', author: BOT, text: 'One', timestamp: at(18, 12) },
      { id: 'n2', author: ANA, text: 'Two', timestamp: at(18, 12, 1) },
    ]);
    await fixture.whenStable();
    expect(live()).toBe('2 new messages');
    const region = fixture.nativeElement.querySelector('.star-chat__live') as HTMLElement;
    const before = region.textContent;
    // Another conversation with one message from someone else: history, no announcement.
    host.messages.set([
      { id: 'x1', author: ME, text: 'Mine', timestamp: at(18, 13), status: 'sent' },
      { id: 'x2', author: BOT, text: 'Other chat', timestamp: at(18, 14) },
    ]);
    await fixture.whenStable();
    expect(region.textContent).toBe(before);
    expect(live()).not.toContain('Other chat');
  });

  it('asks for older messages at the top and keeps the scroll position', async () => {
    const { host, fixture, root } = await setupChat();
    const scroll = root.querySelector<HTMLElement>('.star-chat__scroll')!;
    let height = 500;
    Object.defineProperty(scroll, 'scrollHeight', { get: () => height, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { get: () => 200, configurable: true });
    scroll.scrollTop = 0;
    scroll.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(host.loads).toBe(1);
    // A second scroll event while loading asks for nothing.
    host.loading.set(true);
    await fixture.whenStable();
    scroll.dispatchEvent(new Event('scroll'));
    expect(host.loads).toBe(1);
    height = 800;
    host.messages.update((list) => [
      { id: '0', author: ANA, text: 'Older', timestamp: at(16, 8) },
      ...list,
    ]);
    host.loading.set(false);
    await fixture.whenStable();
    expect(scroll.scrollTop).toBe(300);
  });

  it('renders the starChatMessage and starEmpty slots', async () => {
    const { host, fixture, root } = await setupChat();
    host.custom.set(true);
    await fixture.whenStable();
    expect(root.querySelector('.custom')?.textContent).toBe('Hello|false|true');
    host.messages.set([]);
    await fixture.whenStable();
    expect(root.querySelector('.star-chat__empty')?.textContent?.trim()).toBe('Say hello');
  });
});

@Component({
  imports: [StarAiPrompt],
  template: `
    <star-ai-prompt
      [outputs]="outputs()"
      [suggestions]="['Summarize', 'Translate']"
      (promptRequest)="requests.push($event.prompt)"
      (retry)="retries.push($event.id)"
      (stop)="stops.push($event.id)"
    />
  `,
})
class PromptHost {
  readonly outputs = signal<StarAiPromptOutput[]>([]);
  readonly requests: string[] = [];
  readonly retries: string[] = [];
  readonly stops: string[] = [];
}

describe('StarAiPrompt', () => {
  async function setup() {
    const fixture = TestBed.createComponent(PromptHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const field = root.querySelector<HTMLTextAreaElement>('textarea')!;
    const button = (name: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name,
      );
    const live = () => root.querySelector('.star-ai-prompt__live')?.textContent?.trim();
    return { fixture, root, host: fixture.componentInstance, field, button, live };
  }

  it('fills the prompt from a suggestion and requests it with Generate or Control+Enter', async () => {
    const { fixture, root, host, field, button } = await setup();
    expect(field.getAttribute('aria-label')).toBe('Prompt');
    const chips = root.querySelector('[role=group]')!;
    expect(chips.getAttribute('aria-label')).toBe('Prompt suggestions');
    expect(button('Generate')?.disabled).toBe(true);
    button('Summarize')!.click();
    await fixture.whenStable();
    expect(field.value).toBe('Summarize');
    expect(document.activeElement).toBe(field);
    button('Generate')!.click();
    await fixture.whenStable();
    expect(host.requests).toEqual(['Summarize']);
    expect(field.value).toBe('');
    field.value = 'Write a haiku';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const plain = key(field, 'Enter');
    expect(plain.defaultPrevented).toBe(false);
    key(field, 'Enter', { ctrlKey: true });
    await fixture.whenStable();
    expect(host.requests).toEqual(['Summarize', 'Write a haiku']);
  });

  it('shows outputs with Copy and Retry, Stop while streaming, and announces the end', async () => {
    const { fixture, root, host, button, live } = await setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    host.outputs.set([{ id: 'o1', prompt: 'Summarize', text: 'Part', status: 'streaming' }]);
    await fixture.whenStable();
    const list = root.querySelector('.star-ai-prompt__outputs')!;
    expect(list.getAttribute('aria-label')).toBe('Responses');
    const item = root.querySelector('.star-ai-prompt__output')!;
    expect(item.getAttribute('aria-busy')).toBe('true');
    expect(button('Retry')).toBeUndefined();
    button('Stop')!.click();
    expect(host.stops).toEqual(['o1']);
    host.outputs.set([{ id: 'o1', prompt: 'Summarize', text: 'Part **two**', status: 'done' }]);
    await fixture.whenStable();
    expect(live()).toBe('Response ready');
    expect(item.querySelector('strong')?.textContent).toBe('two');
    expect(button('Stop')).toBeUndefined();
    button('Retry')!.click();
    expect(host.retries).toEqual(['o1']);
    button('Copy')!.click();
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith('Part **two**');
    expect(live()).toBe('Copied');
  });

  it('names the send shortcut and shows it as a hint (m16)', async () => {
    const { root, field } = await setup();
    expect(field.getAttribute('aria-keyshortcuts')).toBe('Control+Enter Meta+Enter');
    const hint = root.querySelector(`[id="${field.getAttribute('aria-describedby')}"]`);
    expect(hint?.textContent?.trim()).toBe('Press Control+Enter to send.');
  });

  it('announces a failed copy (m16)', async () => {
    const { fixture, host, button, live } = await setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    host.outputs.set([{ id: 'o3', prompt: 'X', text: 'Done', status: 'done' }]);
    await fixture.whenStable();
    button('Copy')!.click();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    expect(live()).toBe('Copy failed');
  });

  it('shows a failed output', async () => {
    const { fixture, root, host, live } = await setup();
    host.outputs.set([{ id: 'o2', prompt: 'X', text: '', status: 'streaming' }]);
    await fixture.whenStable();
    host.outputs.set([{ id: 'o2', prompt: 'X', text: '', status: 'error' }]);
    await fixture.whenStable();
    expect(root.querySelector('.star-ai-prompt__error')?.textContent?.trim()).toBe(
      'The response failed.',
    );
    expect(live()).toBe('The response failed.');
  });
});
