import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAnnouncer } from '@star-ng/ui/core';
import { STAR_IMAGE_COLORS, StarImageEditor, starImageRender } from '@star-ng/ui/image-editor';

const PNG = 'data:image/png;base64,AAA';

/** jsdom has no canvas: a 2D context that records the calls. */
function fakeCanvas(options: { filter?: boolean; taint?: boolean } = {}) {
  const calls: string[] = [];
  const state: Record<string, unknown> = {};
  if (options.filter) state['filter'] = 'none';
  const context = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name in state) return state[name];
        if (name === 'getImageData') {
          return (_x: number, _y: number, w: number, h: number) => {
            calls.push('getImageData');
            return { data: new Uint8ClampedArray(w * h * 4).fill(200) };
          };
        }
        return (...args: unknown[]) => calls.push(`${name}(${args.map(String).join(',')})`);
      },
      set: (_target, name: string, value) => {
        if (name === 'filter' && options.filter) state['filter'] = value;
        calls.push(`${name}=${value}`);
        return true;
      },
      has: (_target, name: string) => name in state,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
    if (options.taint) throw new DOMException('Tainted', 'SecurityError');
    return 'data:image/png;base64,EDITED';
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    if (options.taint) throw new DOMException('Tainted', 'SecurityError');
    callback(new Blob(['x'], { type: type ?? 'image/png' }));
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 200,
    right: 400,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return calls;
}

/** An image that loads at once with a fixed size. */
class FakeImage {
  /** Size of the next images (a test may load a large photo). */
  static size = { width: 400, height: 200 };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = FakeImage.size.width;
  naturalHeight = FakeImage.size.height;
  private value = '';
  get src() {
    return this.value;
  }
  set src(value: string) {
    this.value = value;
    queueMicrotask(() => (value.includes('broken') ? this.onerror?.() : this.onload?.()));
  }
}

function pointer(target: Element, type: string, x: number, y: number): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  target.dispatchEvent(event);
}

function key(target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

@Component({
  imports: [StarImageEditor],
  template: `<star-image-editor
    [src]="src()"
    [(value)]="value"
    [colors]="colors()"
    imageAlt="Harbour photo"
  />`,
})
class Host {
  readonly editor = viewChild.required(StarImageEditor);
  readonly src = signal<string | null>(PNG);
  readonly value = signal('');
  readonly colors = signal<readonly string[]>(STAR_IMAGE_COLORS);
}

/** Collects animation frames; run() calls every queued callback once. */
function stubFrames() {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(document.defaultView!, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(document.defaultView!, 'cancelAnimationFrame').mockImplementation(() => undefined);
  return {
    pending: () => frames.length,
    run: () => frames.splice(0).forEach((callback) => callback(performance.now())),
  };
}

async function setup(
  options: { filter?: boolean; taint?: boolean; src?: string | null; frames?: boolean } = {},
) {
  const calls = fakeCanvas(options);
  const frames = options.frames ? stubFrames() : null;
  vi.stubGlobal('Image', FakeImage);
  const announce = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [{ provide: StarAnnouncer, useValue: { announce, clear: () => undefined } }],
  });
  const fixture = TestBed.createComponent(Host);
  if (options.src !== undefined) fixture.componentInstance.src.set(options.src);
  await fixture.whenStable();
  await Promise.resolve();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const editor = fixture.componentInstance.editor();
  const tool = (id: string) => root.querySelector<HTMLButtonElement>(`[data-tool="${id}"]`)!;
  const button = (name: string) =>
    [...root.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
    )!;
  const stable = () => fixture.whenStable();
  return { fixture, root, editor, calls, announce, tool, button, stable, frames };
}

afterEach(() => {
  FakeImage.size = { width: 400, height: 200 };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('StarImageEditor', () => {
  it('is a named group with a toolbar and a described image', async () => {
    const { root } = await setup();
    const host = root.querySelector('star-image-editor')!;
    expect(host.getAttribute('role')).toBe('group');
    expect(host.getAttribute('aria-label')).toBe('Image editor');
    const toolbar = root.querySelector('[role=toolbar]')!;
    expect(toolbar.getAttribute('aria-label')).toBe('Image tools');
    const canvas = root.querySelector('canvas')!;
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Harbour photo');
    const description = root.querySelector(`#${canvas.getAttribute('aria-describedby')}`)!;
    expect(description.textContent?.trim()).toBe('Image 400 × 200 pixels. No edits.');
  });

  it('uses bold icons and a stage that does not scroll while the image is fitted', async () => {
    const { root, tool, stable } = await setup();
    // The docs and most apps load only the bold and fill weights of Phosphor.
    const icons = [...root.querySelectorAll('.star-image-editor__toolbar i')];
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.every((icon) => icon.classList.contains('ph-bold'))).toBe(true);
    const stage = root.querySelector<HTMLElement>('.star-image-editor__stage')!;
    expect(stage.classList).toContain('star-image-editor__stage--fit');
    expect(stage.getAttribute('tabindex')).toBeNull();
    tool('zoomActual').click();
    await stable();
    // At 100 % the stage scrolls, so it takes the focus.
    expect(stage.classList).not.toContain('star-image-editor__stage--fit');
    expect(stage.getAttribute('tabindex')).toBe('0');
  });

  it('moves the focus through the toolbar with the arrow keys (one tab stop)', async () => {
    const { root, stable } = await setup();
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.star-image-editor__tool')];
    expect(buttons.filter((b) => b.tabIndex === 0).length).toBe(1);
    buttons[0].focus();
    key(buttons[0], 'ArrowRight');
    await stable();
    expect(document.activeElement).toBe(buttons[1]);
    key(buttons[1], 'End');
    await stable();
    expect(document.activeElement).toBe(buttons.at(-1));
    expect(buttons.at(-1)!.tabIndex).toBe(0);
    expect(buttons[0].tabIndex).toBe(-1);
    // Undo stays focusable while it has nothing to undo, but says it is disabled.
    const undo = root.querySelector('[data-tool="undo"]')!;
    expect(undo.getAttribute('aria-disabled')).toBe('true');
  });

  it('rotates, flips, undoes and redoes, with announcements and the value', async () => {
    const { root, editor, tool, stable, announce, fixture } = await setup();
    tool('rotateRight').click();
    tool('flipHorizontal').click();
    await stable();
    expect(editor.operations()).toEqual([
      { type: 'rotate', angle: 90 },
      { type: 'flip', axis: 'horizontal' },
    ]);
    expect(editor.outputSize()).toEqual({ width: 200, height: 400 });
    expect(editor.description()).toBe(
      'Image 200 × 400 pixels. Edits: rotated by 90°, flipped horizontally.',
    );
    // The value is encoded after the edits settle (asynchronously).
    expect(fixture.componentInstance.value()).toBe('');
    await vi.waitFor(() =>
      expect(fixture.componentInstance.value()).toBe('data:image/png;base64,eA=='),
    );
    const host = root.querySelector('star-image-editor')!;
    key(host, 'z', { ctrlKey: true });
    await stable();
    expect(editor.operations().length).toBe(1);
    expect(editor.canRedo()).toBe(true);
    expect(announce).toHaveBeenLastCalledWith('Change undone.');
    key(host, 'y', { ctrlKey: true });
    await stable();
    expect(editor.operations().length).toBe(2);
    expect(announce).toHaveBeenLastCalledWith('Change redone.');
    tool('reset').click();
    await stable();
    expect(editor.operations()).toEqual([]);
    expect(editor.canUndo()).toBe(true);
    await vi.waitFor(() => expect(fixture.componentInstance.value()).toBe(''));
    expect(announce).toHaveBeenLastCalledWith('All edits removed.');
  });

  it('encodes the value once after the edits settle, never during a drag', async () => {
    const { root, editor, tool, stable, fixture } = await setup();
    const toBlob = vi.mocked(HTMLCanvasElement.prototype.toBlob);
    toBlob.mockClear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      editor.rotate(90);
      editor.flip('horizontal');
      editor.undo();
      // Nothing is encoded at once: the commit points are coalesced.
      expect(toBlob).not.toHaveBeenCalled();
      expect(fixture.componentInstance.value()).toBe('');
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    await vi.waitFor(() =>
      expect(fixture.componentInstance.value()).toBe('data:image/png;base64,eA=='),
    );
    expect(toBlob).toHaveBeenCalledTimes(1);

    // A drag (pointer moves) is no commit point: no encoding until the stroke ends.
    tool('annotate').click();
    await stable();
    toBlob.mockClear();
    const canvas = root.querySelector('canvas')!;
    pointer(canvas, 'pointerdown', 10, 10);
    for (let i = 1; i <= 5; i++) pointer(canvas, 'pointermove', 10 + i * 6, 10 + i * 3);
    await stable();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(toBlob).not.toHaveBeenCalled();
    pointer(canvas, 'pointerup', 40, 25);
    await vi.waitFor(() => expect(toBlob).toHaveBeenCalledTimes(1));
  });

  it('crops with a fixed ratio and the keyboard, and announces the size', async () => {
    const { root, editor, tool, button, stable, announce } = await setup();
    tool('crop').click();
    await stable();
    expect(tool('crop').getAttribute('aria-pressed')).toBe('true');
    button('1:1').click();
    await stable();
    const box = root.querySelector<HTMLElement>('.star-image-editor__crop')!;
    expect(box.tabIndex).toBe(0);
    expect(box.getAttribute('aria-label')).toBe('Crop area 200 × 200 pixels at 100, 0');
    expect(root.querySelector(`#${box.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'Shift and arrow keys resize it',
    );
    // A step is 1 % of the longer side: 4 pixels.
    key(box, 'ArrowRight');
    await stable();
    expect(editor.cropRect()).toEqual({ x: 104, y: 0, width: 200, height: 200 });
    key(box, 'ArrowLeft', { shiftKey: true });
    await stable();
    expect(editor.cropRect()).toEqual({ x: 104, y: 0, width: 196, height: 196 });
    expect(announce).toHaveBeenLastCalledWith('Crop area 196 × 196 pixels at 104, 0');
    expect(box.style.left).toBe('26%');
    key(box, 'Enter');
    await stable();
    expect(editor.tool()).toBeNull();
    expect(editor.operations()).toEqual([
      { type: 'crop', rect: { x: 104, y: 0, width: 196, height: 196 } },
    ]);
    expect(announce).toHaveBeenLastCalledWith('Crop applied.');
  });

  it('resizes the crop box with a handle and the pointer', async () => {
    const { root, editor, tool, stable } = await setup();
    tool('crop').click();
    await stable();
    const handle = root.querySelector('.star-image-editor__handle--se')!;
    const box = root.querySelector('.star-image-editor__crop')!;
    pointer(handle, 'pointerdown', 400, 200);
    pointer(box, 'pointermove', 300, 150);
    pointer(box, 'pointerup', 300, 150);
    await stable();
    expect(editor.cropRect()).toEqual({ x: 0, y: 0, width: 300, height: 150 });
    // Escape closes the panel without a change and gives the focus back to the tool.
    key(box, 'Escape');
    await stable();
    expect(editor.tool()).toBeNull();
    expect(editor.operations()).toEqual([]);
    expect(document.activeElement).toBe(tool('crop'));
  });

  for (const panel of ['crop', 'resize'] as const) {
    it(`locks the other geometry tools while the ${panel} panel is open`, async () => {
      const { editor, tool, button, stable } = await setup();
      tool(panel).click();
      await stable();
      const locked = [
        'crop',
        'rotate',
        'rotateLeft',
        'rotateRight',
        'flipHorizontal',
        'flipVertical',
        'resize',
      ].filter((id) => id !== panel);
      for (const id of locked) expect(tool(id).getAttribute('aria-disabled'), id).toBe('true');
      // The open tool can still close its panel; colour tools are not geometry.
      expect(tool(panel).getAttribute('aria-disabled')).toBeNull();
      expect(tool('adjust').getAttribute('aria-disabled')).toBeNull();
      for (const id of locked) tool(id).click();
      editor.rotate(90);
      editor.flip('vertical');
      await stable();
      expect(editor.operations()).toEqual([]);
      expect(editor.tool()).toBe(panel);
      button('Cancel').click();
      await stable();
      expect(tool('rotateRight').getAttribute('aria-disabled')).toBeNull();
      tool('rotateRight').click();
      await stable();
      expect(editor.operations()).toEqual([{ type: 'rotate', angle: 90 }]);
    });
  }

  it('draws the preview once per frame, however many pointer moves come', async () => {
    const { root, tool, stable, calls, frames } = await setup({ frames: true });
    frames!.run();
    tool('annotate').click();
    await stable();
    frames!.run();
    const draws = () => calls.filter((call) => call.startsWith('clearRect(')).length;
    const before = draws();
    const canvas = root.querySelector('canvas')!;
    pointer(canvas, 'pointerdown', 10, 10);
    for (let i = 1; i <= 8; i++) pointer(canvas, 'pointermove', 10 + i * 5, 10 + i * 2);
    await stable();
    // Nothing is drawn during the change detection: one frame draws the latest state.
    expect(draws()).toBe(before);
    frames!.run();
    expect(draws()).toBe(before + 1);
  });

  it('renders the preview at view resolution and exports at full size', async () => {
    FakeImage.size = { width: 4000, height: 2000 };
    const { editor, tool, stable, calls, frames } = await setup({ frames: true });
    frames!.run();
    tool('flipVertical').click();
    await stable();
    const from = calls.length;
    frames!.run();
    const drawn = calls.slice(from);
    // The stage is not measured in jsdom (640 × 400): the view is 640 × 320 at a ratio of 1.
    // The flip is replayed at view resolution (at full size it would be translate(0,2000)).
    expect(drawn).toContain('translate(0,320)');
    expect(drawn).toContain('drawImage([object HTMLCanvasElement],0,0,640,320)');
    expect(drawn.some((call) => call.endsWith(',0,0,4000,2000)'))).toBe(false);
    const widths: number[] = [];
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      widths.push(this.width);
      callback(new Blob(['x']));
    });
    await editor.exportImage();
    expect(widths).toEqual([4000]);
  });

  it('rotates by a free angle from a labelled slider', async () => {
    const { root, editor, tool, button, stable } = await setup();
    tool('rotate').click();
    await stable();
    const range = root.querySelector<HTMLInputElement>('input[type=range]')!;
    expect(range.getAttribute('aria-label')).toBe('Angle');
    range.value = '30';
    range.dispatchEvent(new Event('input'));
    await stable();
    button('Apply').click();
    await stable();
    expect(editor.operations()).toEqual([{ type: 'rotate', angle: 30 }]);
  });

  it('resizes with a locked aspect ratio', async () => {
    const { root, editor, tool, button, stable } = await setup();
    tool('resize').click();
    await stable();
    const [width, height] = root.querySelectorAll<HTMLInputElement>('input[type=number]');
    expect(width.closest('label')?.textContent).toContain('Width');
    width.value = '100';
    width.dispatchEvent(new Event('input'));
    await stable();
    expect(height.value).toBe('50');
    button('Keep aspect ratio').click();
    await stable();
    height.value = '80';
    height.dispatchEvent(new Event('input'));
    button('Apply').click();
    await stable();
    expect(editor.operations()).toEqual([{ type: 'resize', width: 100, height: 80 }]);
    expect(editor.description()).toContain('resized to 100 × 80');
  });

  it('adjusts colours with labelled sliders and a canvas filter', async () => {
    const { root, editor, tool, button, stable, calls } = await setup({ filter: true });
    tool('adjust').click();
    await stable();
    const ranges = [...root.querySelectorAll<HTMLInputElement>('input[type=range]')];
    expect(ranges.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Brightness',
      'Contrast',
      'Saturation',
      'Grayscale',
      'Sepia',
    ]);
    ranges[3].value = '100';
    ranges[3].dispatchEvent(new Event('input'));
    await stable();
    button('Apply').click();
    await stable();
    expect(editor.operations()).toEqual([
      {
        type: 'adjust',
        adjustments: { brightness: 100, contrast: 100, saturation: 100, grayscale: 100, sepia: 0 },
      },
    ]);
    expect(editor.description()).toContain('colors adjusted');
    await vi.waitFor(() =>
      expect(calls).toContain('filter=brightness(1) contrast(1) saturate(1) grayscale(1) sepia(0)'),
    );
    expect(calls).not.toContain('getImageData');
  });

  it('falls back to pixel adjustments without ctx.filter', async () => {
    const calls = fakeCanvas({ filter: false });
    const image = new FakeImage() as unknown as HTMLImageElement;
    const canvas = starImageRender(document, image, { width: 2, height: 1 }, [
      {
        type: 'adjust',
        adjustments: { brightness: 50, contrast: 100, saturation: 100, grayscale: 0, sepia: 0 },
      },
    ]);
    expect(canvas).not.toBeNull();
    expect(calls).toContain('getImageData');
    expect(calls.some((call) => call.startsWith('putImageData'))).toBe(true);
    expect(calls.some((call) => call.startsWith('filter='))).toBe(false);
  });

  it('draws annotations with the pointer and lists them for the keyboard', async () => {
    const { root, editor, tool, button, stable, announce } = await setup();
    tool('annotate').click();
    await stable();
    expect(root.querySelector('.star-image-editor__empty-list')?.textContent).toBe(
      'No annotations yet.',
    );
    const canvas = root.querySelector('canvas')!;
    pointer(canvas, 'pointerdown', 10, 10);
    pointer(canvas, 'pointermove', 50, 30);
    pointer(canvas, 'pointerup', 50, 30);
    await stable();
    const [op] = editor.operations();
    expect(op.type).toBe('annotate');
    expect(op.type === 'annotate' && op.annotation.points).toEqual([
      { x: 10, y: 10 },
      { x: 50, y: 30 },
    ]);
    // The palette token is read from the host; jsdom has none, so the light value is used.
    expect(op.type === 'annotate' && op.annotation.color).toBe('#2a78d6');

    button('Ellipse').click();
    button('Add to the image').click();
    await stable();
    const list = root.querySelector<HTMLElement>('[role=listbox]')!;
    const options = [...list.querySelectorAll('[role=option]')];
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Rectangle 1', 'Ellipse 1']);
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(list.getAttribute('aria-activedescendant')).toBe(options[1].id);
    expect(root.querySelector('.star-image-editor__selection')).not.toBeNull();

    key(list, 'ArrowUp');
    await stable();
    expect(list.getAttribute('aria-activedescendant')).toBe(
      list.querySelectorAll('[role=option]')[0].id,
    );
    key(list, 'Delete');
    await stable();
    expect(editor.operations().length).toBe(1);
    expect(announce).toHaveBeenLastCalledWith('Rectangle 1 deleted.');
    expect(editor.description()).toContain('1 annotation');
  });

  it('keeps the focus and the panel when the last annotation is deleted and undone', async () => {
    const { root, editor, tool, button, stable } = await setup();
    tool('annotate').click();
    await stable();
    button('Add to the image').click();
    await stable();
    const list = root.querySelector<HTMLElement>('[role=listbox]')!;
    list.focus();
    key(list, 'Delete');
    await stable();
    expect(root.querySelector('[role=listbox]')).toBeNull();
    expect(document.activeElement).toBe(button('Add to the image'));
    key(document.activeElement!, 'z', { ctrlKey: true });
    await stable();
    expect(editor.tool()).toBe('annotate');
    expect(editor.operations().length).toBe(1);
    expect(root.querySelectorAll('[role=option]').length).toBe(1);
  });

  it('clears the value when a new image comes (review M5)', async () => {
    const { editor, stable, fixture } = await setup();
    editor.rotate(90);
    await vi.waitFor(() => expect(fixture.componentInstance.value()).not.toBe(''));
    fixture.componentInstance.src.set('data:image/png;base64,BBB');
    await stable();
    expect(fixture.componentInstance.value()).toBe('');
    expect(editor.operations()).toEqual([]);
  });

  it('warns in development mode when the image cannot be loaded (review M6)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { editor } = await setup({ src: 'data:image/png;base64,broken' });
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not be loaded')),
    );
    expect(editor.loaded()).toBe(false);
  });

  it('uses the fallback of a var() colour without the token (review M8)', async () => {
    const { root, editor, tool, button, stable, fixture } = await setup();
    fixture.componentInstance.colors.set(['var(--brand-ink, #c00)']);
    await stable();
    tool('annotate').click();
    await stable();
    button('Add to the image').click();
    await stable();
    const op = editor.operations()[0];
    expect(op.type === 'annotate' && op.annotation.color).toBe('#c00');
    expect(root.querySelector('.star-image-editor__swatch')).not.toBeNull();
  });

  it('draws sharper when the window moves to a screen with another pixel ratio (review M9)', async () => {
    const view = document.defaultView!;
    const listeners: (() => void)[] = [];
    const realMatchMedia = view.matchMedia;
    view.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
      removeEventListener: () => undefined,
    })) as unknown as typeof view.matchMedia;
    onTestFinished(() => {
      view.matchMedia = realMatchMedia;
      Object.defineProperty(view, 'devicePixelRatio', { value: 1, configurable: true });
    });
    const { root, stable, frames } = await setup({ frames: true });
    frames!.run();
    const canvas = root.querySelector('canvas')!;
    expect(canvas.width).toBe(400);
    expect(listeners.length).toBeGreaterThan(0);
    Object.defineProperty(view, 'devicePixelRatio', { value: 2, configurable: true });
    listeners.splice(0).forEach((listener) => listener());
    await stable();
    frames!.run();
    expect(canvas.width).toBe(800);
  });

  it('adds a text annotation only with a text', async () => {
    const { root, editor, tool, button, stable } = await setup();
    tool('annotate').click();
    await stable();
    button('Text').click();
    await stable();
    const add = button('Add to the image');
    expect(add.disabled).toBe(true);
    const field = root.querySelector<HTMLInputElement>('.star-image-editor__text')!;
    expect(field.getAttribute('aria-label')).toBe('Annotation text');
    field.value = 'Gate 4';
    field.dispatchEvent(new Event('input'));
    await stable();
    add.click();
    await stable();
    const op = editor.operations()[0];
    expect(op.type === 'annotate' && op.annotation).toMatchObject({ kind: 'text', text: 'Gate 4' });
  });

  it('exports a blob and a data URL', async () => {
    const { editor, tool, stable } = await setup();
    tool('flipVertical').click();
    await stable();
    const png = await editor.exportImage();
    expect(png?.type).toBe('image/png');
    const jpeg = await editor.exportImage({ type: 'image/jpeg', quality: 0.8 });
    expect(jpeg?.type).toBe('image/jpeg');
    expect(editor.toDataUrl()).toBe('data:image/png;base64,EDITED');
  });

  it('returns null and an empty data URL when the browser refuses the canvas', async () => {
    const { editor } = await setup({ taint: true });
    expect(await editor.exportImage()).toBeNull();
    expect(editor.toDataUrl()).toBe('');
  });

  it('does not draw an image of another origin (taint guard)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { editor, root } = await setup({ src: 'https://cdn.other.example/photo.png' });
    expect(editor.loaded()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('https: address'));
    expect(warn.mock.calls[0][0]).not.toContain('cdn.other.example');
    expect(await editor.exportImage()).toBeNull();
    expect(root.querySelector('[data-tool="crop"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(editor.description()).toBe('No image loaded.');
  });

  it('renders on the server and exports nothing there', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const editor = fixture.componentInstance.editor();
    expect(fixture.nativeElement.querySelector('[role=toolbar]')).not.toBeNull();
    expect(editor.loaded()).toBe(false);
    expect(await editor.exportImage()).toBeNull();
    expect(editor.toDataUrl()).toBe('');
    expect(getContext).not.toHaveBeenCalled();
  });
});
