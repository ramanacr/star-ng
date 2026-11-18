import { Clipboard } from '@angular/cdk/clipboard';
import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarUiText, StarAnnouncer, StarClipboard } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import { StarCopy } from '@star-ng/ui/utility';

describe('StarClipboard', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  });

  function stubNavigator(writeText: (text: string) => Promise<void>): void {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  }

  it('uses navigator.clipboard when the browser has it', async () => {
    const written: string[] = [];
    stubNavigator(async (text) => void written.push(text));
    const cdk = vi.spyOn(TestBed.inject(Clipboard), 'copy');
    expect(await TestBed.inject(StarClipboard).copy('ORD-1042')).toBe(true);
    expect(written).toEqual(['ORD-1042']);
    expect(cdk).not.toHaveBeenCalled();
  });

  it('falls back to the CDK copy when the async API is refused', async () => {
    stubNavigator(() => Promise.reject(new Error('NotAllowedError')));
    const cdk = vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
    expect(await TestBed.inject(StarClipboard).copy('INV-2041')).toBe(true);
    expect(cdk).toHaveBeenCalledWith('INV-2041');
  });

  it('resolves with false when both ways fail', async () => {
    stubNavigator(() => Promise.reject(new Error('NotAllowedError')));
    vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(false);
    expect(await TestBed.inject(StarClipboard).copy('x')).toBe(false);
  });

  it('does nothing on the server', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator(writeText);
    expect(await TestBed.inject(StarClipboard).copy('x')).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });
});

@Component({
  imports: [StarCopy],
  template: `<button type="button" [starCopy]="value" (copied)="result.set($event)">Copy</button>`,
})
class Host {
  readonly value = 'ORD-1042';
  readonly result = signal<boolean | null>(null);
}

describe('starCopy', () => {
  async function click(done: boolean, providers: unknown[] = []) {
    TestBed.configureTestingModule({ providers: providers as never[] });
    vi.spyOn(TestBed.inject(StarClipboard), 'copy').mockResolvedValue(done);
    const announce = vi.spyOn(TestBed.inject(StarAnnouncer), 'announce').mockResolvedValue();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    return { fixture, announce };
  }

  it('copies the text on click, emits true and announces "Copied"', async () => {
    const { fixture, announce } = await click(true);
    expect(TestBed.inject(StarClipboard).copy).toHaveBeenCalledWith('ORD-1042');
    expect(fixture.componentInstance.result()).toBe(true);
    expect(announce).toHaveBeenCalledWith('Copied', 'polite', { source: 'starCopy' });
  });

  it('emits false and announces the failure', async () => {
    const { fixture, announce } = await click(false);
    expect(fixture.componentInstance.result()).toBe(false);
    expect(announce).toHaveBeenCalledWith('Copy failed', 'polite', { source: 'starCopy' });
  });

  it('announces in the language of the UI texts', async () => {
    const { announce } = await click(true, [provideStarUiText(STAR_UI_TEXT_DE)]);
    expect(announce).toHaveBeenCalledWith('Kopiert', 'polite', { source: 'starCopy' });
  });
});
