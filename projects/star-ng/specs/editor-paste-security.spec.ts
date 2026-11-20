import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  STAR_EDITOR_SANITIZE_DEFAULTS,
  StarEditor,
  StarEditorSanitizeConfig,
} from '@star-ng/ui/editor';

@Component({
  imports: [StarEditor],
  template: `<star-editor [(value)]="html" [sanitize]="rules()" ariaLabel="Announcement" />`,
})
class Host {
  readonly html = signal('<p>Start</p>');
  readonly rules = signal<StarEditorSanitizeConfig>(STAR_EDITOR_SANITIZE_DEFAULTS);
}

/** A paste event with clipboard data (jsdom has no ClipboardEvent). */
function paste(target: Element, data: Record<string, string>): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => data[type] ?? '' },
  });
  target.dispatchEvent(event);
  return event;
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const area = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
    '.star-editor__area',
  )!;
  const range = document.createRange();
  range.setStart(area.querySelector('p')!.firstChild!, 5);
  range.collapse(true);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
  return { fixture, area, host: fixture.componentInstance };
}

describe('StarEditor paste cleanup and security', () => {
  it('cleans a Word paste: lists from list paragraphs, no Office markup', async () => {
    const { area, host } = await setup();
    paste(area, {
      'text/html':
        '<p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp;</span></span>One<o:p></o:p></p><p class="MsoListParagraphCxSpLast" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp;</span></span>Two</p>',
      'text/plain': 'One\nTwo',
    });
    expect(host.html()).toContain('<ul><li>One</li><li>Two</li></ul>');
    expect(host.html()).not.toMatch(/Mso|mso-|o:p/);
  });

  it('pastes plain text after Ctrl+Shift+V', async () => {
    const { area, host } = await setup();
    area.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true }),
    );
    paste(area, { 'text/html': '<b>Bold</b>', 'text/plain': ' plain' });
    expect(host.html()).toBe('<p>Start plain</p>');
    // The next paste has its formats again.
    paste(area, { 'text/html': '<b>Bold</b>', 'text/plain': 'Bold' });
    expect(host.html()).toContain('<b>Bold</b>');
  });

  it('follows the allow-list of the sanitize input', async () => {
    const { fixture, area, host } = await setup((h) => {
      h.rules.set({
        ...STAR_EDITOR_SANITIZE_DEFAULTS,
        tags: STAR_EDITOR_SANITIZE_DEFAULTS.tags.filter((tag) => tag !== 'u'),
        protocols: ['https:'],
      });
      h.html.set(
        '<p>Start <u>under</u> <a href="http://example.com">http</a> <a href="https://example.com">https</a></p>',
      );
    });
    await fixture.whenStable();
    expect(area.innerHTML).toBe(
      '<p>Start under <a>http</a> <a href="https://example.com">https</a></p>',
    );
    area.dispatchEvent(new Event('input'));
    expect(host.html()).toBe(area.innerHTML);
  });

  it('never runs pasted script: XSS vectors through the paste path', async () => {
    const { area, host } = await setup();
    for (const vector of [
      '<img src=x onerror=alert(1)>',
      '<a href="java&#x09;script:alert(1)">x</a>',
      '<svg><script>alert(1)</script></svg>',
      '<p style="background:url(javascript:alert(1))">x</p>',
      '<iframe src="https://example.com"></iframe>',
    ]) {
      paste(area, { 'text/html': vector, 'text/plain': 'x' });
    }
    expect(host.html()).not.toMatch(/onerror|javascript:|<svg|<script|url\(|<iframe/i);
  });
});
