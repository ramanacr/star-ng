import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColorPicker, StarKnob } from '@star-ng/ui/knob';

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

@Component({
  imports: [StarKnob, StarColorPicker],
  template: `
    <star-knob [(value)]="knob" [step]="5" ariaLabel="Knob" />
    <star-color-picker [(value)]="color" />
  `,
})
class DialHost {
  readonly knob = signal(50);
  readonly color = signal('#4f46e5');
}

@Component({
  imports: [StarColorPicker],
  template: `
    <div [attr.dir]="dir()">
      <star-color-picker [(value)]="color" ariaLabel="Label color" (touch)="touched = true" />
    </div>
  `,
})
class PanelHost {
  readonly color = signal('#4f46e5');
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  touched = false;
}

@Component({
  imports: [StarColorPicker],
  template: `<star-color-picker [swatches]="swatches()" [value]="'#112233'" />`,
})
class SwatchHost {
  readonly swatches = signal<readonly string[] | undefined>(undefined);
}

describe('Knob, color picker', () => {
  it('knob is a slider with keyboard steps and limits', async () => {
    const fixture = TestBed.createComponent(DialHost);
    await fixture.whenStable();
    const knob = (fixture.nativeElement as HTMLElement).querySelector('[role=slider]')!;
    key(knob, 'ArrowUp');
    expect(fixture.componentInstance.knob()).toBe(55);
    key(knob, 'End');
    expect(fixture.componentInstance.knob()).toBe(100);
  });

  it('color picker takes swatches and validates hex input', async () => {
    const fixture = TestBed.createComponent(DialHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.star-color__swatch')[1].click();
    expect(fixture.componentInstance.color()).toBe('#0369a1');
    const hex = el.querySelector<HTMLInputElement>('.star-color__hex')!;
    hex.value = 'zzz';
    hex.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.color()).toBe('#0369a1');
    hex.value = '16A34A';
    hex.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.color()).toBe('#16a34a');
  });

  describe('color panel', () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve));
    const panel = () => document.querySelector<HTMLElement>('.star-color__panel');
    const area = () => panel()!.querySelector<HTMLElement>('.star-color__area')!;
    const hue = () => panel()!.querySelector<HTMLElement>('.star-color__hue')!;

    afterEach(() =>
      document.querySelectorAll('.star-color__panel').forEach((item) => item.remove()),
    );

    async function setup(dir: 'ltr' | 'rtl' = 'ltr') {
      const fixture = TestBed.createComponent(PanelHost);
      fixture.componentInstance.dir.set(dir);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const tile = el.querySelector<HTMLButtonElement>('.star-color__custom')!;
      const open = async () => {
        tile.click();
        await fixture.whenStable();
        await tick();
        await fixture.whenStable();
      };
      return { fixture, el, host: fixture.componentInstance, tile, open };
    }

    it('has no native color input; the tile opens a labelled StarNG dialog', async () => {
      const { el, tile, open } = await setup();
      expect(el.querySelector('input[type=color]')).toBeNull();
      expect(tile.getAttribute('aria-haspopup')).toBe('dialog');
      expect(tile.getAttribute('aria-label')).toBe('Custom color');
      expect(tile.getAttribute('aria-expanded')).toBe('false');
      await open();
      expect(panel()?.getAttribute('role')).toBe('dialog');
      expect(panel()?.getAttribute('aria-label')).toBe('Custom color');
      expect(panel()?.classList).toContain('star-panel');
      expect(tile.getAttribute('aria-expanded')).toBe('true');
      expect(tile.getAttribute('aria-controls')).toBe(panel()!.id);
      expect(document.activeElement).toBe(area());
    });

    it('gives the area and the hue a slider role with value text', async () => {
      const { open } = await setup();
      await open();
      expect(area().getAttribute('role')).toBe('slider');
      expect(area().getAttribute('aria-label')).toBe('Saturation and brightness');
      expect(area().getAttribute('aria-valuetext')).toBe('Saturation 69%, brightness 90%');
      expect(hue().getAttribute('role')).toBe('slider');
      expect(hue().getAttribute('aria-label')).toBe('Hue');
      expect(hue().getAttribute('aria-valuenow')).toBe('243');
      expect(hue().getAttribute('aria-valuetext')).toBe('243 degrees');
    });

    it('moves the area and the hue with the keyboard; the value stays hex text', async () => {
      const { fixture, host, open } = await setup();
      await open();
      key(area(), 'Home');
      await fixture.whenStable();
      expect(host.color()).toBe('#e6e6e6');
      // A gray has no hue in hex, but the panel keeps the hue it had.
      expect(hue().getAttribute('aria-valuenow')).toBe('243');
      key(area(), 'End');
      await fixture.whenStable();
      expect(host.color()).toBe('#0b00e6');
      key(area(), 'ArrowDown', { shiftKey: true });
      await fixture.whenStable();
      expect(area().getAttribute('aria-valuetext')).toBe('Saturation 100%, brightness 80%');
      key(area(), 'ArrowLeft');
      await fixture.whenStable();
      expect(area().getAttribute('aria-valuetext')).toBe('Saturation 99%, brightness 80%');

      key(hue(), 'End');
      await fixture.whenStable();
      expect(hue().getAttribute('aria-valuenow')).toBe('359');
      key(hue(), 'PageDown');
      key(hue(), 'ArrowLeft');
      await fixture.whenStable();
      expect(hue().getAttribute('aria-valuenow')).toBe('348');
      key(hue(), 'Home');
      await fixture.whenStable();
      expect(hue().getAttribute('aria-valuenow')).toBe('0');
      expect(host.color()).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('follows a typed hex while it is open', async () => {
      const { fixture, el, open } = await setup();
      await open();
      const hex = el.querySelector<HTMLInputElement>('.star-color__hex')!;
      hex.value = '#16a34a';
      hex.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      expect(hue().getAttribute('aria-valuenow')).toBe('142');
    });

    it('mirrors the arrow keys in right-to-left', async () => {
      const { fixture, open } = await setup('rtl');
      await open();
      expect(panel()?.getAttribute('dir')).toBe('rtl');
      key(hue(), 'ArrowLeft');
      await fixture.whenStable();
      expect(hue().getAttribute('aria-valuenow')).toBe('244');
      key(area(), 'ArrowRight');
      await fixture.whenStable();
      expect(area().getAttribute('aria-valuetext')).toBe('Saturation 68%, brightness 90%');
    });

    it('closes on Escape and on Done, gives the focus back to the tile and marks touched', async () => {
      const { fixture, host, tile, open } = await setup();
      await open();
      key(area(), 'Escape');
      await fixture.whenStable();
      expect(tile.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(tile);
      expect(host.touched).toBe(true);

      await open();
      panel()!.querySelector<HTMLButtonElement>('.star-btn')!.click();
      await fixture.whenStable();
      expect(tile.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('default swatches from the theme', () => {
    const swatchLabels = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('.star-color__swatch')).map((node) =>
        node.getAttribute('aria-label'),
      );
    const withTokens = (tokens: Record<string, string>) => {
      const style = document.createElement('style');
      style.textContent = `:root{${Object.entries(tokens)
        .map(([name, value]) => `${name}:${value}`)
        .join(';')}}`;
      document.head.append(style);
      return style;
    };

    it('uses the tokens of the theme, as hex, without duplicates and failures', async () => {
      const style = withTokens({
        '--star-primary': '#ff0000',
        '--star-accent': 'rgb(0, 128, 0)',
        '--star-success': '#f00',
        '--star-warning': 'not-a-color',
        '--star-chart-1': 'rgba(0, 0, 255, 1)',
      });
      try {
        const fixture = TestBed.createComponent(DialHost);
        await fixture.whenStable();
        expect(swatchLabels(fixture.nativeElement)).toEqual(['#ff0000', '#008000', '#0000ff']);
        // The bound value is not changed by the read.
        expect(fixture.componentInstance.color()).toBe('#4f46e5');
      } finally {
        style.remove();
      }
    });

    it('uses an explicit [swatches] list and reads nothing', async () => {
      const style = withTokens({ '--star-primary': '#ff0000' });
      try {
        const fixture = TestBed.createComponent(SwatchHost);
        fixture.componentInstance.swatches.set(['#0f766e', '#b45309']);
        await fixture.whenStable();
        expect(swatchLabels(fixture.nativeElement)).toEqual(['#0f766e', '#b45309']);
      } finally {
        style.remove();
      }
    });

    it('uses the fixed default list when no token gives a color', async () => {
      const fixture = TestBed.createComponent(DialHost);
      await fixture.whenStable();
      const labels = swatchLabels(fixture.nativeElement);
      expect(labels).toHaveLength(8);
      expect(labels[0]).toBe('#4f46e5');
    });
  });

  describe('eye dropper', () => {
    @Component({
      imports: [StarColorPicker],
      template: `<star-color-picker [(value)]="color" (changed)="changes.push($event)" />`,
    })
    class DropperHost {
      readonly color = signal('#4f46e5');
      readonly changes: string[] = [];
    }

    const win = window as unknown as { EyeDropper?: unknown };
    afterEach(() => delete win.EyeDropper);

    it('hides the eye dropper button when the browser has no EyeDropper API', async () => {
      delete win.EyeDropper;
      const fixture = TestBed.createComponent(DropperHost);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.star-color__eyedropper')).toBeNull();
    });

    it('picks a color from the screen, sets the value and emits changed', async () => {
      const open = vi.fn().mockResolvedValue({ sRGBHex: '#16A34A' });
      win.EyeDropper = class {
        open = open;
      };
      const fixture = TestBed.createComponent(DropperHost);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const button = el.querySelector<HTMLButtonElement>('.star-color__eyedropper')!;
      expect(button).not.toBeNull();
      expect(button.getAttribute('aria-label')).toBe('Pick a color from the screen');
      expect(button.type).toBe('button');
      button.click();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      expect(open).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.color()).toBe('#16a34a');
      expect(fixture.componentInstance.changes).toEqual(['#16a34a']);
    });

    it('keeps the value when the user cancels the eye dropper', async () => {
      win.EyeDropper = class {
        open = vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError'));
      };
      const fixture = TestBed.createComponent(DropperHost);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      el.querySelector<HTMLButtonElement>('.star-color__eyedropper')!.click();
      await new Promise((resolve) => setTimeout(resolve));
      expect(fixture.componentInstance.color()).toBe('#4f46e5');
      expect(fixture.componentInstance.changes).toEqual([]);
    });

    it('emits changed when the user picks a swatch', async () => {
      const fixture = TestBed.createComponent(DropperHost);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      el.querySelectorAll<HTMLButtonElement>('.star-color__swatch')[1].click();
      expect(fixture.componentInstance.changes).toEqual([fixture.componentInstance.color()]);
    });
  });
});
