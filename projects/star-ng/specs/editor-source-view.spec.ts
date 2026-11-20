import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEditor, StarEditorToolbarItem } from '@star-ng/ui/editor';

@Component({
  imports: [StarEditor],
  template: `<star-editor [(value)]="html" [toolbar]="toolbar" ariaLabel="Announcement" />`,
})
class Host {
  readonly html = signal('<h2>Release</h2><p>The <b>new</b> dashboard</p>');
  readonly toolbar: readonly StarEditorToolbarItem[] = ['bold', 'formatBlock', '|', 'source'];
}

describe('StarEditor HTML source view', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the indented source, reads edits back sanitized, and returns to the area', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const area = el.querySelector<HTMLElement>('.star-editor__area')!;
    const source = () => el.querySelector<HTMLTextAreaElement>('textarea')!;
    const button = el.querySelector<HTMLButtonElement>('[aria-label="HTML source"]')!;
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(area.hidden).toBe(true);
    expect(source().getAttribute('aria-label')).toBe('HTML source');
    expect(source().value).toBe('<h2>Release</h2>\n<p>The <b>new</b> dashboard</p>');
    // Other commands are off in the source view.
    expect(el.querySelector('[aria-label="Bold"]')!.getAttribute('aria-disabled')).toBe('true');
    expect(el.querySelector<HTMLSelectElement>('select')!.disabled).toBe(true);

    vi.useFakeTimers();
    source().value = '<h2>Release</h2>\n<center>Now</center>\n<p onclick="x()">Text<b>bold</p>';
    source().dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.html()).toContain('dashboard');
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    await fixture.whenStable();
    expect(fixture.componentInstance.html()).toBe(
      '<h2>Release</h2><div class="star-text-center">Now</div><p>Text<b>bold</b></p>',
    );
    expect(source().getAttribute('aria-invalid')).toBe('true');
    const status = el.querySelector(`#${source().getAttribute('aria-describedby')}`)!;
    expect(status.textContent).toContain('The element <b> is not closed.');
    expect(status.textContent).toContain('Some markup is not allowed');

    button.click();
    await fixture.whenStable();
    expect(el.querySelector('textarea')).toBeNull();
    expect(area.hidden).toBe(false);
    expect(area.innerHTML).toBe(
      '<h2>Release</h2><div class="star-text-center">Now</div><p>Text<b>bold</b></p>',
    );
  });
});

@Component({
  imports: [StarEditor],
  template: `<star-editor [(value)]="html" [toolbar]="['undo', 'source']" ariaLabel="Spaces" />`,
})
class SpacesHost {
  readonly html = signal('<p>x</p> <b>y</b> <i>z</i><span class="note">kept in the area</span>');
}

describe('StarEditor HTML source view without edits', () => {
  it('changes nothing when the source is opened and closed', async () => {
    const fixture = TestBed.createComponent(SpacesHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const area = el.querySelector<HTMLElement>('.star-editor__area')!;
    // Markup that the browser put in the area and the value does not have yet.
    area.insertAdjacentHTML('beforeend', '<span></span>');
    const before = area.innerHTML;
    const source = el.querySelector<HTMLButtonElement>('[aria-label="HTML source"]')!;
    source.click();
    await fixture.whenStable();
    source.click();
    await fixture.whenStable();
    expect(area.innerHTML).toBe(before);
    expect(fixture.componentInstance.html()).toBe(
      '<p>x</p> <b>y</b> <i>z</i><span class="note">kept in the area</span>',
    );
    expect(el.querySelector('[aria-label=Undo]')!.getAttribute('aria-disabled')).toBe('true');
  });
});
