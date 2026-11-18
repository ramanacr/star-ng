import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { STAR_ANNOUNCER_DEDUPE_MS, StarAnnouncer } from '@star-ng/ui/core';

describe('StarAnnouncer', () => {
  let calls: [string, string | undefined][];

  beforeEach(() => {
    calls = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: LiveAnnouncer,
          useValue: {
            announce: (message: string, politeness?: string) => {
              calls.push([message, politeness]);
              return Promise.resolve();
            },
            clear: () => calls.push(['', 'clear']),
          },
        },
      ],
    });
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('announces through the CDK LiveAnnouncer, polite by default', async () => {
    const announcer = TestBed.inject(StarAnnouncer);
    await announcer.announce('Saved');
    await announcer.announce('Error in row 3', 'assertive');
    expect(calls).toEqual([
      ['Saved', 'polite'],
      ['Error in row 3', 'assertive'],
    ]);
  });

  it('drops the same message with the same politeness inside the de-duplication window', async () => {
    const announcer = TestBed.inject(StarAnnouncer);
    await announcer.announce('Copied');
    await announcer.announce('Copied');
    await announcer.announce('Copied', 'assertive');
    expect(calls).toEqual([
      ['Copied', 'polite'],
      ['Copied', 'assertive'],
    ]);
    vi.advanceTimersByTime(STAR_ANNOUNCER_DEDUPE_MS + 1);
    await announcer.announce('Copied');
    expect(calls.length).toBe(3);
  });

  it('announces a different message at once, and ignores empty text', async () => {
    const announcer = TestBed.inject(StarAnnouncer);
    await announcer.announce('One');
    await announcer.announce('  ');
    await announcer.announce('Two');
    await announcer.announce('One');
    expect(calls.map(([message]) => message)).toEqual(['One', 'Two', 'One']);
  });

  it('clear() empties the live region and forgets the last message', async () => {
    const announcer = TestBed.inject(StarAnnouncer);
    await announcer.announce('Done');
    announcer.clear();
    await announcer.announce('Done');
    expect(calls).toEqual([
      ['Done', 'polite'],
      ['', 'clear'],
      ['Done', 'polite'],
    ]);
  });
});
