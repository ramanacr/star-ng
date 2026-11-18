import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAppBar, StarAppBarPosition } from './app-bar';

@Component({
  imports: [StarAppBar],
  template: `
    <star-app-bar
      id="main"
      title="Orders"
      [position]="position()"
      [elevated]="elevated()"
      [dense]="dense()"
      [landmark]="landmark()"
    >
      <button starAppBarStart type="button" class="menu" aria-label="Menu">=</button>
      <span class="count">(12)</span>
      <button starAppBarEnd type="button" class="search" aria-label="Search">?</button>
    </star-app-bar>
    <star-app-bar id="custom"><strong class="brand">Projects</strong></star-app-bar>
  `,
})
class Host {
  readonly position = signal<StarAppBarPosition>('static');
  readonly elevated = signal(false);
  readonly dense = signal(false);
  readonly landmark = signal(true);
}

describe('StarAppBar', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const bar = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!;
    return { fixture, host: fixture.componentInstance, bar };
  }

  it('is a header with the banner landmark and the three areas', async () => {
    const { bar } = await setup();
    const header = bar('main').querySelector('header')!;
    expect(header.getAttribute('role')).toBe('banner');
    expect(header.querySelector('.star-app-bar__start .menu')).not.toBeNull();
    expect(header.querySelector('.star-app-bar__end .search')).not.toBeNull();
    expect(header.querySelector('.star-app-bar__title')?.textContent?.trim()).toBe('Orders(12)');
  });

  it('does not keep the title attribute as a tooltip', async () => {
    const { bar } = await setup();
    expect(bar('main').hasAttribute('title')).toBe(false);
  });

  it('takes the title from the content', async () => {
    const { bar } = await setup();
    expect(bar('custom').querySelector('.star-app-bar__title .brand')?.textContent).toBe(
      'Projects',
    );
  });

  it('turns the landmark off', async () => {
    const { fixture, host, bar } = await setup();
    host.landmark.set(false);
    await fixture.whenStable();
    expect(bar('main').querySelector('header')!.getAttribute('role')).toBe('none');
  });

  it('sets the position, elevated and dense classes', async () => {
    const { fixture, host, bar } = await setup();
    expect(bar('main').classList).toContain('star-app-bar--static');
    host.position.set('sticky');
    host.elevated.set(true);
    host.dense.set(true);
    await fixture.whenStable();
    expect(bar('main').classList).toContain('star-app-bar--sticky');
    expect(bar('main').classList).not.toContain('star-app-bar--static');
    expect(bar('main').classList).toContain('star-app-bar--elevated');
    expect(bar('main').classList).toContain('star-app-bar--dense');
    host.position.set('fixed');
    await fixture.whenStable();
    expect(bar('main').classList).toContain('star-app-bar--fixed');
  });
});
