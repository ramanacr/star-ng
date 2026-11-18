import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarOverlayBadge } from '@star-ng/ui/badge';

@Component({
  imports: [StarOverlayBadge],
  template: `
    <star-overlay-badge
      [value]="value()"
      [position]="position()"
      [dot]="dot()"
      severity="danger"
      size="sm"
      [ariaLabel]="label()"
    >
      <button type="button" id="inbox" aria-describedby="inbox-hint">Inbox</button>
    </star-overlay-badge>
  `,
})
class OverlayHost {
  readonly value = signal<number | string | null>(4);
  readonly position = signal<'top-end' | 'top-start' | 'bottom-end' | 'bottom-start'>('top-end');
  readonly dot = signal(false);
  readonly label = signal<string | null>('unread messages');
}

async function setup() {
  const fixture = TestBed.createComponent(OverlayHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = root.querySelector<HTMLElement>('star-overlay-badge')!;
  return { fixture, root, host, badge: () => host.querySelector<HTMLElement>('star-badge')! };
}

describe('StarOverlayBadge', () => {
  it('projects the content and shows the value in a badge at the top end', async () => {
    const { host, badge } = await setup();
    expect(host.classList).toContain('star-overlay-badge');
    expect(host.classList).toContain('star-overlay-badge--top-end');
    expect(host.querySelector('#inbox')?.textContent).toBe('Inbox');
    expect(badge().textContent?.trim()).toBe('4');
    expect(badge().classList).toContain('star-badge--danger');
    expect(badge().classList).toContain('star-badge--sm');
  });

  it('hides the badge from screen readers and describes it with hidden text', async () => {
    const { fixture, host, badge } = await setup();
    expect(badge().getAttribute('aria-hidden')).toBe('true');
    expect(badge().getAttribute('role')).toBeNull();
    const hidden = host.querySelector<HTMLElement>('.star-sr-only')!;
    expect(hidden.textContent?.trim()).toBe('4 unread messages');

    fixture.componentInstance.label.set(null);
    await fixture.whenStable();
    expect(host.querySelector('.star-sr-only')).toBeNull();
  });

  it('links the hidden text to the focusable content with aria-describedby', async () => {
    const { fixture, host } = await setup();
    const button = host.querySelector<HTMLButtonElement>('#inbox')!;
    const hidden = host.querySelector<HTMLElement>('.star-sr-only')!;
    expect(hidden.id).toBeTruthy();
    // The ids already on the element are kept.
    expect(button.getAttribute('aria-describedby')).toBe(`inbox-hint ${hidden.id}`);
    // The copy leaves the reading order: it is the description of the button now.
    expect(hidden.getAttribute('aria-hidden')).toBe('true');

    fixture.componentInstance.value.set(7);
    await fixture.whenStable();
    expect(hidden.textContent?.trim()).toBe('7 unread messages');
    expect(button.getAttribute('aria-describedby')).toBe(`inbox-hint ${hidden.id}`);

    fixture.componentInstance.label.set(null);
    await fixture.whenStable();
    expect(button.getAttribute('aria-describedby')).toBe('inbox-hint');
  });

  it('keeps the text in the reading order when the content has no focusable element', async () => {
    @Component({
      imports: [StarOverlayBadge],
      template: `<star-overlay-badge [value]="2" ariaLabel="new comments"
        ><span class="avatar">SL</span></star-overlay-badge
      >`,
    })
    class StaticHost {}
    const fixture = TestBed.createComponent(StaticHost);
    await fixture.whenStable();
    const hidden = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.star-sr-only',
    )!;
    expect(hidden.textContent?.trim()).toBe('2 new comments');
    expect(hidden.hasAttribute('aria-hidden')).toBe(false);
    expect(document.querySelector(`[aria-describedby~="${hidden.id}"]`)).toBeNull();
  });

  it('changes the corner with position', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.position.set('bottom-start');
    await fixture.whenStable();
    expect(host.classList).toContain('star-overlay-badge--bottom-start');
    expect(host.classList).not.toContain('star-overlay-badge--top-end');
  });

  it('renders a dot with dot or without a value', async () => {
    const { fixture, host, badge } = await setup();
    fixture.componentInstance.dot.set(true);
    await fixture.whenStable();
    expect(badge().classList).toContain('star-badge--dot');
    expect(badge().textContent?.trim()).toBe('');
    // The hidden text has no number for a dot.
    expect(host.querySelector('.star-sr-only')?.textContent?.trim()).toBe('unread messages');

    fixture.componentInstance.dot.set(false);
    fixture.componentInstance.value.set(null);
    await fixture.whenStable();
    expect(badge().classList).toContain('star-badge--dot');
  });

  it('caps a large number with max', async () => {
    const { fixture, badge } = await setup();
    fixture.componentInstance.value.set(250);
    await fixture.whenStable();
    expect(badge().textContent?.trim()).toBe('99+');
  });
});
