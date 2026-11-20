import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import {
  StarGaugePointer,
  StarGaugeRange,
  StarLinearGauge,
  StarRadialGauge,
} from '@star-ng/ui/gauge';

@Component({
  imports: [StarLinearGauge, StarRadialGauge],
  template: `
    <star-linear-gauge
      [(value)]="value"
      [min]="0"
      [max]="200"
      [ranges]="ranges"
      [ticks]="{ major: 4, minor: 2 }"
      [labels]="labels()"
      [pointer]="pointer()"
      [orientation]="orientation()"
      [interactive]="interactive()"
      [step]="5"
      locale="en-US"
      ariaLabel="Server load"
    />
    <star-radial-gauge
      [(value)]="value"
      [min]="0"
      [max]="200"
      [ranges]="ranges"
      [pointer]="radialPointer()"
      [interactive]="interactive()"
      [startAngle]="startAngle()"
      [endAngle]="-45"
      [arcWidth]="12"
      locale="en-US"
      ariaLabelledBy="heading"
    />
  `,
})
class Host {
  readonly value = signal(50);
  readonly ranges: readonly StarGaugeRange[] = [
    { from: 0, to: 120, color: 'success' },
    { from: 120, to: 170, color: 'warning' },
    { from: 170, to: 200, color: 'danger' },
    { from: 10, to: 20, color: 3 },
  ];
  readonly labels = signal<boolean | Intl.NumberFormatOptions>(true);
  readonly pointer = signal<StarGaugePointer>('bar');
  readonly radialPointer = signal<StarGaugePointer>('needle');
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
  readonly interactive = signal(false);
  readonly startAngle = signal(225);
}

async function setup(platform?: string) {
  if (platform) {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  }
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    linear: root.querySelector<HTMLElement>('star-linear-gauge')!,
    radial: root.querySelector<HTMLElement>('star-radial-gauge')!,
  };
}

function key(target: Element, name: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
}

describe('StarLinearGauge and StarRadialGauge', () => {
  it('are read-only meters with the value, the range and a formatted value text', async () => {
    const { linear, radial } = await setup();
    for (const gauge of [linear, radial]) {
      expect(gauge.getAttribute('role')).toBe('meter');
      expect(gauge.getAttribute('aria-valuenow')).toBe('50');
      expect(gauge.getAttribute('aria-valuemin')).toBe('0');
      expect(gauge.getAttribute('aria-valuemax')).toBe('200');
      expect(gauge.getAttribute('aria-valuetext')).toBe('50');
      expect(gauge.hasAttribute('tabindex')).toBe(false);
      expect(gauge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(linear.getAttribute('aria-label')).toBe('Server load');
    expect(radial.getAttribute('aria-labelledby')).toBe('heading');
    expect(radial.hasAttribute('aria-label')).toBe(false);
  });

  it('formats the labels and the value text with Intl.NumberFormat options', async () => {
    const { fixture, host, linear } = await setup();
    host.value.set(1234.5);
    host.labels.set({ style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 });
    await fixture.whenStable();
    expect(linear.getAttribute('aria-valuenow')).toBe('200');
    expect(linear.getAttribute('aria-valuetext')).toBe('200 kB');
    const labels = [...linear.querySelectorAll('.star-gauge__label')].map((l) => l.textContent);
    expect(labels).toEqual(['0 kB', '50 kB', '100 kB', '150 kB', '200 kB']);
  });

  it('hides the labels when labels is false', async () => {
    const { fixture, host, linear } = await setup();
    host.labels.set(false);
    await fixture.whenStable();
    expect(linear.querySelectorAll('.star-gauge__label').length).toBe(0);
  });

  it('draws major and minor ticks and the ranges with tokens', async () => {
    const { linear, radial } = await setup();
    expect(linear.querySelectorAll('.star-gauge__tick--major').length).toBe(5);
    expect(linear.querySelectorAll('.star-gauge__tick--minor').length).toBe(4);
    const colors = [...linear.querySelectorAll<SVGElement>('.star-gauge__range')].map((r) =>
      r.style.getPropertyValue('--star-gauge-range'),
    );
    expect(colors).toEqual([
      'var(--star-success)',
      'var(--star-warning)',
      'var(--star-danger)',
      'var(--star-chart-3)',
    ]);
    expect(radial.querySelectorAll('.star-gauge__range').length).toBe(4);
  });

  it('fills a bar pointer to the value share', async () => {
    const { fixture, host, linear } = await setup();
    const bar = linear.querySelector<SVGElement>('.star-gauge__bar')!;
    expect(bar.getAttribute('pathLength')).toBe('100');
    expect(bar.style.strokeDasharray).toBe('25 100');
    host.value.set(150);
    await fixture.whenStable();
    expect(bar.style.strokeDasharray).toBe('75 100');
  });

  it('moves a marker or needle pointer along a linear scale', async () => {
    const { fixture, host, linear } = await setup();
    host.pointer.set('marker');
    await fixture.whenStable();
    const marker = linear.querySelector<SVGElement>('.star-gauge__marker')!;
    expect(marker.style.transform).toBe('translate(88px, 0px)');
    host.pointer.set('needle');
    host.value.set(0);
    await fixture.whenStable();
    const needle = linear.querySelector<SVGElement>('.star-gauge__needle')!;
    expect(needle.style.transform).toBe('translate(16px, 0px)');
  });

  it('runs vertically from the bottom', async () => {
    const { fixture, host, linear } = await setup();
    host.orientation.set('vertical');
    host.pointer.set('marker');
    host.value.set(200);
    await fixture.whenStable();
    expect(linear.classList).toContain('star-gauge--vertical');
    expect(linear.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 96 320');
    expect(linear.querySelector<SVGElement>('.star-gauge__marker')!.style.transform).toBe(
      'translate(0px, 16px)',
    );
  });

  it('mirrors a horizontal scale in right-to-left', async () => {
    document.documentElement.dir = 'rtl';
    try {
      const { fixture, host, linear } = await setup();
      host.pointer.set('marker');
      host.value.set(0);
      await fixture.whenStable();
      expect(linear.querySelector<SVGElement>('.star-gauge__marker')!.style.transform).toBe(
        'translate(304px, 0px)',
      );
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('turns the radial needle to the value angle', async () => {
    const { fixture, host, radial } = await setup();
    const needle = radial.querySelector<SVGElement>('.star-gauge__needle')!;
    // 50 of 200 on 225..-45: 225 - 0.25 * 270 = 157.5 degrees (math), -157.5 on screen.
    expect(needle.style.transform).toBe('rotate(-157.5deg)');
    host.value.set(100);
    await fixture.whenStable();
    expect(needle.style.transform).toBe('rotate(-90deg)');
    expect(radial.querySelector('.star-gauge__track')?.getAttribute('d')).toBe(
      'M 46.97 153.03 A 75 75 0 1 1 153.03 153.03',
    );
    expect(radial.querySelector('.star-gauge__track')?.getAttribute('stroke-width')).toBe('12');
  });

  it('draws a radial bar pointer along the arc', async () => {
    const { fixture, host, radial } = await setup();
    host.radialPointer.set('bar');
    await fixture.whenStable();
    const bar = radial.querySelector<SVGElement>('.star-gauge__bar')!;
    expect(bar.style.strokeDasharray).toBe('25 100');
  });

  it('becomes a slider with keyboard support when interactive', async () => {
    const { fixture, host, linear, radial } = await setup();
    host.interactive.set(true);
    await fixture.whenStable();
    expect(linear.getAttribute('role')).toBe('slider');
    expect(linear.getAttribute('tabindex')).toBe('0');
    expect(radial.getAttribute('role')).toBe('slider');
    key(linear, 'ArrowRight');
    await fixture.whenStable();
    expect(host.value()).toBe(55);
    key(linear, 'PageUp');
    await fixture.whenStable();
    expect(host.value()).toBe(75);
    // The radial gauge keeps the default step of 1.
    key(radial, 'ArrowDown');
    await fixture.whenStable();
    expect(host.value()).toBe(74);
    key(radial, 'End');
    await fixture.whenStable();
    expect(host.value()).toBe(200);
    key(linear, 'Home');
    await fixture.whenStable();
    expect(host.value()).toBe(0);
    expect(linear.getAttribute('aria-valuenow')).toBe('0');
  });

  it('swaps the horizontal arrow keys in right-to-left', async () => {
    document.documentElement.dir = 'rtl';
    try {
      const { fixture, host, linear } = await setup();
      host.interactive.set(true);
      await fixture.whenStable();
      key(linear, 'ArrowLeft');
      await fixture.whenStable();
      expect(host.value()).toBe(55);
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('ignores the keyboard when it is read-only', async () => {
    const { fixture, host, linear } = await setup();
    key(linear, 'ArrowRight');
    await fixture.whenStable();
    expect(host.value()).toBe(50);
  });

  it('sets the value from a pointer on the scale', async () => {
    const { fixture, host, linear, radial } = await setup();
    host.interactive.set(true);
    await fixture.whenStable();
    const svg = linear.querySelector('svg')!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 64 }) as DOMRect;
    // x 160 of 320 view units is the middle of the scale (16..304): 100 of 200.
    linear.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 160, clientY: 20, bubbles: true }),
    );
    await fixture.whenStable();
    expect(host.value()).toBe(100);

    const dial = radial.querySelector('svg')!;
    dial.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
    // Straight up from the centre is the middle of the 225..-45 arc.
    radial.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 100, clientY: 10, bubbles: true }),
    );
    await fixture.whenStable();
    expect(host.value()).toBe(100);
  });

  it('drags only after a primary button press on the gauge', async () => {
    const { fixture, host, linear } = await setup();
    host.interactive.set(true);
    await fixture.whenStable();
    const svg = linear.querySelector('svg')!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 64 }) as DOMRect;
    const pointer = (type: string, clientX: number, init: PointerEventInit = {}) => {
      linear.dispatchEvent(
        new PointerEvent(type, { clientX, clientY: 20, bubbles: true, ...init }),
      );
      return fixture.whenStable();
    };

    // A drag that started elsewhere enters the gauge with the button down: no change.
    await pointer('pointermove', 160, { buttons: 1 });
    expect(host.value()).toBe(50);

    // A right-button press changes nothing, and neither does the move after it.
    await pointer('pointerdown', 160, { button: 2, buttons: 2 });
    await pointer('pointermove', 200, { buttons: 2 });
    expect(host.value()).toBe(50);

    // A primary press starts a drag; the move follows; the release ends it.
    await pointer('pointerdown', 160, { button: 0, buttons: 1 });
    expect(host.value()).toBe(100);
    await pointer('pointermove', 232, { buttons: 1 });
    expect(host.value()).toBe(150);
    await pointer('pointerup', 232, { button: 0 });
    await pointer('pointermove', 88, { buttons: 1 });
    expect(host.value()).toBe(150);

    // A cancelled pointer ends the drag too.
    await pointer('pointerdown', 160, { button: 0, buttons: 1 });
    await pointer('pointercancel', 160);
    await pointer('pointermove', 88, { buttons: 1 });
    expect(host.value()).toBe(100);
  });

  it('ends the drag when the pointer capture is lost or the button is up', async () => {
    const { fixture, host, linear } = await setup();
    host.interactive.set(true);
    await fixture.whenStable();
    const svg = linear.querySelector('svg')!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 64 }) as DOMRect;
    const pointer = (type: string, clientX: number, init: PointerEventInit = {}) => {
      linear.dispatchEvent(
        new PointerEvent(type, { clientX, clientY: 20, bubbles: true, ...init }),
      );
      return fixture.whenStable();
    };

    await pointer('pointerdown', 160, { button: 0, buttons: 1 });
    expect(host.value()).toBe(100);
    await pointer('lostpointercapture', 160);
    await pointer('pointermove', 88, { buttons: 1 });
    expect(host.value()).toBe(100);

    // A move without the primary button down does not change the value, even mid-drag.
    await pointer('pointerdown', 160, { button: 0, buttons: 1 });
    await pointer('pointermove', 232, { buttons: 0 });
    expect(host.value()).toBe(100);
  });

  it('renders on the server', async () => {
    const { linear, radial } = await setup('server');
    expect(linear.querySelector('.star-gauge__bar')).not.toBeNull();
    expect(radial.querySelector('.star-gauge__needle')).not.toBeNull();
  });
});

@Component({
  imports: [StarLinearGauge, FormField],
  template: `<star-linear-gauge interactive [formField]="model.load" ariaLabel="Load" />`,
})
class FormHost {
  readonly data = signal({ load: 30 });
  readonly model = form(this.data);
}

describe('StarLinearGauge in Signal Forms', () => {
  it('reads and writes the field value', async () => {
    const fixture = TestBed.createComponent(FormHost);
    await fixture.whenStable();
    const gauge = (fixture.nativeElement as HTMLElement).querySelector('star-linear-gauge')!;
    expect(gauge.getAttribute('aria-valuenow')).toBe('30');
    key(gauge, 'ArrowUp');
    await fixture.whenStable();
    expect(fixture.componentInstance.data().load).toBe(31);
  });
});

@Component({
  imports: [StarLinearGauge],
  template: `<star-linear-gauge
    interactive
    [(value)]="value"
    [min]="min()"
    [max]="max()"
    [step]="step()"
    ariaLabel="Load"
  />`,
})
class BoundsHost {
  readonly value = signal(40);
  readonly min = signal<number | undefined>(100);
  readonly max = signal<number | undefined>(0);
  readonly step = signal(0);
}

describe('StarLinearGauge bounds and step', () => {
  it('swaps a min above the max, and uses the default for a bound that is not finite', async () => {
    const fixture = TestBed.createComponent(BoundsHost);
    await fixture.whenStable();
    const gauge = (fixture.nativeElement as HTMLElement).querySelector('star-linear-gauge')!;
    expect(gauge.getAttribute('aria-valuemin')).toBe('0');
    expect(gauge.getAttribute('aria-valuemax')).toBe('100');
    expect(gauge.getAttribute('aria-valuenow')).toBe('40');
    fixture.componentInstance.min.set(NaN);
    fixture.componentInstance.max.set(Infinity);
    await fixture.whenStable();
    expect(gauge.getAttribute('aria-valuemin')).toBe('0');
    expect(gauge.getAttribute('aria-valuemax')).toBe('100');
  });

  it('uses a step of 1 when the step is not above zero', async () => {
    const fixture = TestBed.createComponent(BoundsHost);
    await fixture.whenStable();
    const gauge = (fixture.nativeElement as HTMLElement).querySelector('star-linear-gauge')!;
    key(gauge, 'ArrowUp');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe(41);
    fixture.componentInstance.step.set(-5);
    await fixture.whenStable();
    key(gauge, 'ArrowDown');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe(40);
  });
});
