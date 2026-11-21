import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarMessage } from './message';

@Component({
  imports: [StarMessage],
  template: `
    @if (shown()) {
      <star-message closable [life]="life()" (closed)="closes = closes + 1">Saved</star-message>
    }
  `,
})
class Host {
  readonly life = signal(1000);
  readonly shown = signal(true);
  closes = 0;
}

describe('StarMessage life', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      hidden: () => element.querySelector('star-message')!.hasAttribute('hidden'),
      closeButton: () => element.querySelector<HTMLButtonElement>('[data-star-part=closeButton]'),
    };
  }

  it('closes itself after life and emits closed once', () => {
    const { fixture, host, hidden } = setup();
    vi.advanceTimersByTime(999);
    fixture.detectChanges();
    expect(hidden()).toBe(false);
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(hidden()).toBe(true);
    expect(host.closes).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(host.closes).toBe(1);
  });

  it('a close by the user clears the timer: closed emits once', () => {
    const { fixture, host, closeButton } = setup();
    vi.advanceTimersByTime(400);
    closeButton()!.click();
    fixture.detectChanges();
    expect(host.closes).toBe(1);
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(host.closes).toBe(1);
  });

  it('a new life starts the timer again', () => {
    const { fixture, host, hidden } = setup();
    vi.advanceTimersByTime(800);
    host.life.set(1000);
    host.life.set(2000);
    fixture.detectChanges();
    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    expect(hidden()).toBe(false);
    expect(host.closes).toBe(0);
    vi.advanceTimersByTime(500);
    fixture.detectChanges();
    expect(hidden()).toBe(true);
    expect(host.closes).toBe(1);
  });

  it('destroying the message clears the timer', () => {
    const { fixture, host } = setup();
    host.shown.set(false);
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);
    expect(host.closes).toBe(0);
  });

  it('life 0 keeps the message', () => {
    const { fixture, host, hidden } = setup();
    host.life.set(0);
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(hidden()).toBe(false);
    expect(host.closes).toBe(0);
  });
});
