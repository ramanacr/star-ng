import { Component, NgZone, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideStarClock,
  provideStarNg,
  StarClock,
  starFormatFileSize,
  starFormatRelativeTime,
  starInitials,
  starTextParts,
} from '@star-ng/ui/core';
import {
  STAR_PIPES,
  StarFileSizePipe,
  StarHighlightPipe,
  StarInitialsPipe,
  StarRelativeTimePipe,
} from '@star-ng/ui/utility';

const NOW = new Date('2026-03-10T12:00:00Z').getTime();
const MINUTE = 60_000;

describe('starFileSize', () => {
  it('formats bytes in steps of 1024 with the locale', () => {
    expect(starFormatFileSize(512, 'en-US')).toBe('512 byte');
    expect(starFormatFileSize(1536, 'en-US')).toBe('1.5 kB');
    expect(starFormatFileSize(1258291, 'en-US')).toBe('1.2 MB');
    expect(starFormatFileSize(1258291, 'de-DE')).toBe('1,2 MB');
    expect(starFormatFileSize(3 * 1024 ** 4, 'en-US')).toBe('3 TB');
    expect(starFormatFileSize(1300, 'en-US', 2)).toBe('1.27 kB');
  });

  it('gives empty text for no value', () => {
    expect(starFormatFileSize(null)).toBe('');
    expect(starFormatFileSize(Number.NaN)).toBe('');
  });

  it('the pipe takes the locale of provideStarNg when no argument sets one', () => {
    TestBed.configureTestingModule({ providers: [provideStarNg({ locale: 'de-DE' })] });
    const pipe = TestBed.runInInjectionContext(() => new StarFileSizePipe());
    expect(pipe.transform(1536)).toBe('1,5 kB');
    expect(pipe.transform(1536, 'en-US')).toBe('1.5 kB');
  });
});

describe('starRelativeTime', () => {
  it('chooses the largest unit and follows the locale', () => {
    expect(starFormatRelativeTime(NOW - 5 * MINUTE, NOW, 'en')).toBe('5 minutes ago');
    expect(starFormatRelativeTime(NOW + 2 * 24 * 60 * MINUTE, NOW, 'en')).toBe('in 2 days');
    expect(starFormatRelativeTime(NOW - 24 * 60 * MINUTE, NOW, 'en')).toBe('yesterday');
    expect(starFormatRelativeTime(NOW - 30_000, NOW, 'en')).toBe('30 seconds ago');
    expect(starFormatRelativeTime(NOW - 3 * 365 * 24 * 60 * MINUTE, NOW, 'en')).toBe('3 years ago');
    expect(starFormatRelativeTime(NOW - 5 * MINUTE, NOW, 'es')).toBe('hace 5 minutos');
    expect(starFormatRelativeTime(NOW - 5 * MINUTE, NOW, 'de')).toBe('vor 5 Minuten');
  });

  it('accepts ISO text and Date, and gives empty text for an invalid date', () => {
    expect(starFormatRelativeTime('2026-03-10T11:00:00Z', new Date(NOW), 'en')).toBe('1 hour ago');
    expect(starFormatRelativeTime('not a date', NOW)).toBe('');
    expect(starFormatRelativeTime(null, NOW)).toBe('');
  });

  it('the pipe passes numeric options', () => {
    const pipe = TestBed.runInInjectionContext(() => new StarRelativeTimePipe());
    expect(pipe.transform(NOW - 24 * 60 * MINUTE, NOW, 'en', { numeric: 'always' })).toBe(
      '1 day ago',
    );
  });
});

describe('StarClock', () => {
  afterEach(() => vi.useRealTimers());

  it('moves on every tick in the browser', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ providers: [provideStarClock(10_000)] });
    const clock = TestBed.inject(StarClock);
    expect(clock.now()).toBe(NOW);
    vi.advanceTimersByTime(10_000);
    expect(clock.now()).toBe(NOW + 10_000);
  });

  it('runs its timer outside the Angular zone', () => {
    const zone = TestBed.inject(NgZone);
    const outside = vi.spyOn(zone, 'runOutsideAngular');
    TestBed.inject(StarClock);
    expect(outside).toHaveBeenCalled();
  });

  it('does not tick on the server', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const clock = TestBed.inject(StarClock);
    vi.advanceTimersByTime(120_000);
    expect(clock.now()).toBe(NOW);
  });
});

describe('starHighlight', () => {
  it('splits the text into matching parts without case and accents', () => {
    expect(starTextParts('Málaga and Malmö', 'mal')).toEqual([
      { text: 'Mál', match: true },
      { text: 'aga and ', match: false },
      { text: 'Mal', match: true },
      { text: 'mö', match: false },
    ]);
    expect(starTextParts('Berlin', 'lin', 'endsWith')).toEqual([
      { text: 'Ber', match: false },
      { text: 'lin', match: true },
    ]);
    expect(starTextParts('Berlin', 'ber', 'endsWith')).toEqual([{ text: 'Berlin', match: false }]);
    expect(starTextParts('Berlin', '', 'contains')).toEqual([{ text: 'Berlin', match: false }]);
    expect(starTextParts('Berlin', 'er', 'notContains')).toEqual([
      { text: 'Berlin', match: false },
    ]);
  });

  it('escapes the text and marks the matches', () => {
    const pipe = TestBed.runInInjectionContext(() => new StarHighlightPipe());
    expect(pipe.transform('<b>Zürich</b>', 'zur')).toBe(
      '&lt;b&gt;<mark class="star-highlight">Zür</mark>ich&lt;/b&gt;',
    );
    expect(pipe.transform(null, 'x')).toBe('');
  });

  it('renders <mark> through [innerHTML]', () => {
    @Component({
      imports: [STAR_PIPES],
      template: `<span [innerHTML]="'Málaga' | starHighlight: query()"></span>`,
    })
    class Host {
      readonly query = signal('ala');
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const mark = fixture.nativeElement.querySelector('mark') as HTMLElement;
    expect(mark.textContent).toBe('ála');
    expect(mark.className).toBe('star-highlight');
  });
});

describe('starInitials', () => {
  it('takes the first letters of the name parts', () => {
    expect(starInitials('Ada Lovelace')).toBe('AL');
    expect(starInitials('maria.garcia@example.com')).toBe('MG');
    expect(starInitials('Jean Paul Sartre', 3)).toBe('JPS');
    expect(starInitials('')).toBe('');
    expect(TestBed.runInInjectionContext(() => new StarInitialsPipe()).transform('élise roy')).toBe(
      'ÉR',
    );
  });
});
