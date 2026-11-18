import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { SignalFormControl } from '@angular/forms/signals/compat';
import {
  StarSignatureFormat,
  StarSignaturePad,
  starSignaturePath,
  starSignatureSvg,
} from '@star-ng/ui/signature-pad';

/** jsdom has no canvas: a 2D context that records the calls, and a fixed PNG export. */
function fakeCanvas() {
  const calls: string[] = [];
  const context = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name === 'canvas') return undefined;
        return (...args: unknown[]) => calls.push(`${name}(${args.join(',')})`);
      },
      set: (_target, name: string, value) => {
        calls.push(`${name}=${value}`);
        return true;
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAA');
  return calls;
}

function pointer(
  target: Element,
  type: string,
  x: number,
  y: number,
  init: { pointerType?: string; pressure?: number; pointerId?: number } = {},
): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: init.pointerType ?? 'mouse' },
    pressure: { value: init.pressure ?? 0.5 },
  });
  target.dispatchEvent(event);
  return event;
}

@Component({
  imports: [StarSignaturePad],
  template: `
    <star-signature-pad
      [(value)]="value"
      [valueFormat]="format()"
      [allowTyped]="typed()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      strokeColor="#123456"
      [strokeWidth]="3"
      (touch)="touched = touched + 1"
    />
  `,
})
class Host {
  readonly pad = viewChild.required(StarSignaturePad);
  readonly value = signal('');
  readonly format = signal<StarSignatureFormat>('png');
  readonly typed = signal(false);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
  touched = 0;
}

@Component({
  imports: [StarSignaturePad],
  template: `<star-signature-pad
    [(value)]="value"
    valueFormat="svg"
    exportColor="#0000ff"
    exportBackground="#ffffee"
  />`,
})
class ExportHost {
  readonly value = signal('');
}

@Component({
  imports: [StarSignaturePad],
  template: `<star-signature-pad [(value)]="value" valueFormat="svg" />`,
})
class ThemeHost {
  readonly value = signal('');
}

async function setup() {
  const calls = fakeCanvas();
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const canvas = root.querySelector('canvas')!;
  const button = (name: string) =>
    [...root.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
    ) ?? null;
  const status = () => root.querySelector('[aria-live=polite]')?.textContent?.trim();
  const draw = async (points: [number, number][], init = {}) => {
    pointer(canvas, 'pointerdown', ...points[0], init);
    for (const point of points.slice(1)) pointer(canvas, 'pointermove', ...point, init);
    pointer(canvas, 'pointerup', ...points[points.length - 1], init);
    await fixture.whenStable();
  };
  return { fixture, root, host, canvas, button, status, draw, calls };
}

afterEach(() => vi.restoreAllMocks());

describe('starSignaturePath', () => {
  it('draws a dot for one point, a line for two and quadratic curves for more', () => {
    expect(starSignaturePath([{ x: 1, y: 2, pressure: 0.5 }])).toBe('M1 2L1.01 2');
    expect(
      starSignaturePath([
        { x: 0, y: 0, pressure: 0.5 },
        { x: 10, y: 0, pressure: 0.5 },
      ]),
    ).toBe('M0 0L10 0');
    expect(
      starSignaturePath([
        { x: 0, y: 0, pressure: 0.5 },
        { x: 10, y: 10, pressure: 0.5 },
        { x: 20, y: 0, pressure: 0.5 },
      ]),
    ).toBe('M0 0Q10 10 15 5L20 0');
    expect(starSignaturePath([])).toBe('');
  });
});

describe('starSignatureSvg', () => {
  it('builds an SVG with a path per stroke, the background and an escaped typed name', () => {
    const svg = starSignatureSvg({
      width: 300,
      height: 100,
      strokes: [
        [
          { x: 0, y: 0, pressure: 0.5 },
          { x: 5, y: 5, pressure: 0.5 },
        ],
      ],
      strokeColor: '#000"/><script>',
      strokeWidth: 2,
      backgroundColor: 'white',
      typedText: '<b>Ana</b> & co',
    });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="300" height="100"/);
    expect(svg).toContain('<rect width="100%" height="100%" fill="white"/>');
    expect(svg).toContain('d="M0 0L5 5"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;b&gt;Ana&lt;/b&gt; &amp; co');
  });

  it('scales the width of a pen stroke by its pressure', () => {
    const svg = starSignatureSvg({
      width: 10,
      height: 10,
      strokes: [
        [
          { x: 0, y: 0, pressure: 1 },
          { x: 5, y: 5, pressure: 1 },
        ],
      ],
      strokeColor: '#000',
      strokeWidth: 2,
    });
    expect(svg).toContain('stroke-width="3"');
  });
});

describe('StarSignaturePad', () => {
  it('is a labelled group with a described drawing area and disabled actions while empty', async () => {
    const { root, canvas, button } = await setup();
    const group = root.querySelector('star-signature-pad')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Signature');
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Signature drawing area, empty');
    const hint = root.querySelector(`[id="${group.getAttribute('aria-describedby')}"]`);
    expect(hint?.textContent).toContain('Draw with a mouse, a pen or a finger.');
    expect(button('Clear signature')?.disabled).toBe(true);
    expect(button('Undo')?.disabled).toBe(true);
    expect((canvas as HTMLElement).style.touchAction || 'none').toBe('none');
  });

  it('turns pointer strokes into a PNG data URL and marks the area as signed', async () => {
    const { host, canvas, draw, button, calls } = await setup();
    await draw([
      [10, 10],
      [20, 30],
      [40, 20],
    ]);
    expect(host.value()).toBe('data:image/png;base64,AAA');
    expect(host.pad().strokes().length).toBe(1);
    expect(host.pad().strokes()[0].length).toBe(3);
    expect(canvas.getAttribute('aria-label')).toBe('Signature drawing area, signed');
    expect(button('Clear signature')?.disabled).toBe(false);
    expect(host.touched).toBe(1);
    expect(calls).toContain('strokeStyle=#123456');
    expect(calls.some((call) => call.startsWith('quadraticCurveTo('))).toBe(true);
  });

  it('records the pen pressure, and a fixed pressure for the mouse', async () => {
    const { host, draw } = await setup();
    await draw(
      [
        [1, 1],
        [2, 2],
      ],
      { pointerType: 'pen', pressure: 0.9 },
    );
    await draw(
      [
        [3, 3],
        [4, 4],
      ],
      { pointerType: 'mouse', pressure: 0.2 },
    );
    expect(host.pad().strokes()[0][0].pressure).toBe(0.9);
    expect(host.pad().strokes()[1][0].pressure).toBe(0.5);
  });

  it('builds an SVG value from the stroke points', async () => {
    const { host, fixture, draw } = await setup();
    host.format.set('svg');
    await fixture.whenStable();
    await draw([
      [0, 0],
      [10, 10],
      [20, 0],
    ]);
    expect(host.value().startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const svg = decodeURIComponent(host.value().split(',')[1]);
    expect(svg).toContain('d="M0 0Q10 10 15 5L20 0"');
    // The stored value uses the export ink, not the display ink.
    expect(svg).toContain('stroke="#000000"');
    expect(svg).not.toContain('#123456');
  });

  it('draws the PNG value on an offscreen canvas with the export ink (I1)', async () => {
    const { host, canvas, draw, calls } = await setup();
    const toDataURL = vi.mocked(HTMLCanvasElement.prototype.toDataURL);
    await draw([
      [1, 1],
      [5, 5],
    ]);
    expect(host.value()).toBe('data:image/png;base64,AAA');
    const exported = toDataURL.mock.contexts.at(-1) as HTMLCanvasElement;
    expect(exported).not.toBe(canvas);
    const last = calls.lastIndexOf('strokeStyle=#000000');
    expect(last).toBeGreaterThan(calls.lastIndexOf('strokeStyle=#123456'));
  });

  it('ignores a value that is not a data:image URL, with a dev-mode warning (I2)', async () => {
    const { host, fixture, button } = await setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const image = vi.spyOn(window, 'Image');
    host.value.set('https://example.test/signature.png');
    await fixture.whenStable();
    expect(host.pad().isEmpty()).toBe(true);
    expect(button('Clear signature')?.disabled).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('data:image/');
    expect(image).not.toHaveBeenCalled();
    host.value.set('data:image/png;base64,QUJD');
    await fixture.whenStable();
    expect(host.pad().isEmpty()).toBe(false);
    expect(image).toHaveBeenCalledTimes(1);
  });

  it('falls back to the SVG value when the PNG export throws (I2)', async () => {
    const { host, draw } = await setup();
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockImplementation(() => {
      throw new DOMException('The canvas has been tainted', 'SecurityError');
    });
    await draw([
      [1, 1],
      [4, 4],
    ]);
    expect(host.value().startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
  });

  it('uses exportColor and exportBackground for the value', async () => {
    const fixture = TestBed.createComponent(ExportHost);
    fakeCanvas();
    await fixture.whenStable();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    pointer(canvas, 'pointerdown', 1, 1);
    pointer(canvas, 'pointerup', 2, 2);
    await fixture.whenStable();
    const svg = decodeURIComponent(fixture.componentInstance.value().split(',')[1]);
    expect(svg).toContain('stroke="#0000ff"');
    expect(svg).toContain('<rect width="100%" height="100%" fill="#ffffee"/>');
  });

  it('undoes the last stroke and clears the pad, with live announcements', async () => {
    const { host, fixture, draw, button, status } = await setup();
    await draw([
      [1, 1],
      [2, 2],
    ]);
    await draw([
      [5, 5],
      [6, 6],
    ]);
    button('Undo')!.click();
    await fixture.whenStable();
    expect(host.pad().strokes().length).toBe(1);
    expect(status()).toBe('Last stroke removed');
    expect(host.value()).not.toBe('');
    button('Clear signature')!.click();
    await fixture.whenStable();
    expect(host.pad().strokes().length).toBe(0);
    expect(host.value()).toBe('');
    expect(status()).toBe('Signature cleared');
  });

  it('ignores the pointer while disabled or read-only', async () => {
    const { host, fixture, draw, button } = await setup();
    host.disabled.set(true);
    await fixture.whenStable();
    await draw([
      [1, 1],
      [2, 2],
    ]);
    expect(host.value()).toBe('');
    host.disabled.set(false);
    host.readonly.set(true);
    await fixture.whenStable();
    await draw([
      [1, 1],
      [2, 2],
    ]);
    expect(host.value()).toBe('');
    expect(button('Clear signature')?.disabled).toBe(true);
  });

  it('clears the strokes when the value is emptied from outside', async () => {
    const { host, fixture, draw } = await setup();
    await draw([
      [1, 1],
      [2, 2],
    ]);
    host.value.set('');
    await fixture.whenStable();
    expect(host.pad().strokes().length).toBe(0);
  });

  it('offers a typed name instead of drawing (allowTyped)', async () => {
    const { host, fixture, root, button, calls } = await setup();
    expect(button('Type')).toBeNull();
    host.typed.set(true);
    host.format.set('svg');
    await fixture.whenStable();
    const draw = button('Draw')!;
    const type = button('Type')!;
    expect(draw.getAttribute('aria-pressed')).toBe('true');
    expect(type.getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelector('[aria-describedby]')).toBeTruthy();
    type.click();
    await fixture.whenStable();
    expect(type.getAttribute('aria-pressed')).toBe('true');
    const field = root.querySelector<HTMLInputElement>('input[type=text]')!;
    expect(field.getAttribute('aria-label')).toBe('Type your name');
    expect(document.activeElement).toBe(field);
    field.value = 'Ana <Silva>';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const svg = decodeURIComponent(host.value().split(',')[1]);
    expect(svg).toContain('>Ana &lt;Silva&gt;</text>');
    expect(calls.some((call) => call.startsWith('fillText(Ana <Silva>'))).toBe(true);
    expect(button('Undo')).toBeNull();
    button('Clear signature')!.click();
    await fixture.whenStable();
    expect(field.value).toBe('');
    expect(host.value()).toBe('');
  });
});

describe('StarSignaturePad themes', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('draws with the theme ink, stores the export ink, and redraws on a theme change (I1)', async () => {
    const calls = fakeCanvas();
    const fixture = TestBed.createComponent(ThemeHost);
    const pad = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'star-signature-pad',
    )!;
    await fixture.whenStable();
    pad.style.setProperty('--star-signature-stroke', '#eeeeee');
    const canvas = pad.querySelector('canvas')!;
    pointer(canvas, 'pointerdown', 1, 1);
    pointer(canvas, 'pointerup', 2, 2);
    await fixture.whenStable();
    expect(calls).toContain('strokeStyle=#eeeeee');
    const svg = decodeURIComponent(fixture.componentInstance.value().split(',')[1]);
    expect(svg).toContain('stroke="#000000"');
    pad.style.setProperty('--star-signature-stroke', '#111111');
    document.documentElement.setAttribute('data-theme', 'dark');
    await new Promise((resolve) => setTimeout(resolve));
    expect(calls).toContain('strokeStyle=#111111');
  });
});

describe('StarSignaturePad resize (I3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('scales the strokes to the new size and keeps them inside the value', async () => {
    fakeCanvas();
    let size = { width: 400, height: 100 };
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          x: 0,
          y: 0,
          right: size.width,
          bottom: size.height,
          width: size.width,
          height: size.height,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    let resize = () => undefined as void;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe(): void {}
        disconnect(): void {}
      },
    );
    const fixture = TestBed.createComponent(ThemeHost);
    await fixture.whenStable();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    const svgOf = () => decodeURIComponent(fixture.componentInstance.value().split(',')[1]);
    pointer(canvas, 'pointerdown', 300, 50);
    pointer(canvas, 'pointermove', 390, 50);
    pointer(canvas, 'pointerup', 390, 50);
    await fixture.whenStable();
    expect(svgOf()).toContain('width="400"');
    size = { width: 200, height: 100 };
    resize();
    await fixture.whenStable();
    // The value follows the resize at once, with the old stroke scaled into the new width.
    expect(svgOf()).toContain('width="200"');
    expect(svgOf()).toContain('d="M150 50L195 50"');
    pointer(canvas, 'pointerdown', 10, 10);
    pointer(canvas, 'pointermove', 20, 20);
    pointer(canvas, 'pointerup', 20, 20);
    await fixture.whenStable();
    const svg = svgOf();
    expect(svg).toContain('d="M150 50L195 50"');
    expect(svg).toContain('d="M10 10L20 20"');
    const xs = [...svg.matchAll(/[ML](\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));
    expect(Math.max(...xs)).toBeLessThanOrEqual(200);
  });
});

describe('StarSignaturePad on the server', () => {
  it('does not touch the canvas while rendered on the server', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const image = vi.spyOn(window, 'Image');
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set('data:image/png;base64,BBB');
    await fixture.whenStable();
    expect(getContext).not.toHaveBeenCalled();
    expect(image).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pad().isEmpty()).toBe(false);
  });
});

describe('StarSignaturePad forms', () => {
  @Component({
    imports: [StarSignaturePad, FormField],
    template: `<star-signature-pad [formField]="f.signature" />`,
  })
  class SignalHost {
    readonly pad = viewChild.required(StarSignaturePad);
    readonly model = signal({ signature: '' });
    readonly f = form(this.model, (p) => required(p.signature));
  }

  @Component({
    imports: [StarSignaturePad, FormField],
    template: `<star-signature-pad [formField]="group.controls.signature.fieldTree" />`,
  })
  class ReactiveHost {
    readonly group = new FormGroup({
      signature: new SignalFormControl('', (p) => required(p)),
    });
  }

  it('is invalid while empty under a Signal Forms required rule, valid once signed', async () => {
    fakeCanvas();
    const fixture = TestBed.createComponent(SignalHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    expect(host.f.signature().invalid()).toBe(true);
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    pointer(canvas, 'pointerdown', 1, 1);
    pointer(canvas, 'pointerup', 2, 2);
    await fixture.whenStable();
    expect(host.model().signature).toBe('data:image/png;base64,AAA');
    expect(host.f.signature().valid()).toBe(true);
    expect(host.f.signature().touched()).toBe(true);
  });

  it('works in a Reactive FormGroup through SignalFormControl', async () => {
    fakeCanvas();
    const fixture = TestBed.createComponent(ReactiveHost);
    await fixture.whenStable();
    const group = fixture.componentInstance.group;
    expect(group.valid).toBe(false);
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    pointer(canvas, 'pointerdown', 1, 1);
    pointer(canvas, 'pointerup', 2, 2);
    await fixture.whenStable();
    expect(group.value.signature).toBe('data:image/png;base64,AAA');
    expect(group.valid).toBe(true);
  });
});
