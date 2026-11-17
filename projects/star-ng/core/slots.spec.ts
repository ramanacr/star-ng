import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  contentChildren,
  forwardRef,
  signal,
  Signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STAR_SLOT_HOST, STAR_SLOTS, StarSlot, starSlot, starSlotMap } from './slots';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'test-host-a',
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => HostA) }],
  template: `<span class="out">
      @if (empty(); as tpl) {
        <ng-container [ngTemplateOutlet]="tpl" />
      } @else {
        default
      }
    </span>
    <ng-content />`,
})
class HostA {
  protected readonly slots = contentChildren(StarSlot, { descendants: true });
  readonly empty = starSlot<unknown>(this.slots, this, 'empty');
  readonly icons = starSlotMap<unknown>(this.slots, this, 'icon');
}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'test-host-b',
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => HostB) }],
  template: `<span class="out">
    @if (empty(); as tpl) {
      <ng-container [ngTemplateOutlet]="tpl" />
    } @else {
      default
    }
  </span>`,
})
class HostB {
  protected readonly slots = contentChildren(StarSlot, { descendants: true });
  readonly empty = starSlot<unknown>(this.slots, this, 'empty');
}

@Component({
  imports: [HostA, HostB, STAR_SLOTS],
  template: `
    <test-host-a #a>
      <ng-template starEmpty>A</ng-template>
      <test-host-b><ng-template starEmpty>B</ng-template></test-host-b>
    </test-host-a>
  `,
})
class NestedHost {}

@Component({
  imports: [HostA, STAR_SLOTS],
  template: `<test-host-a>
    @if (show()) {
      <ng-template starEmpty>A</ng-template>
    }
  </test-host-a>`,
})
class IfHost {
  readonly show = signal(true);
}

@Component({
  imports: [HostA, STAR_SLOTS],
  template: `<test-host-a>
    <ng-template starIcon="clear">x</ng-template>
    <ng-template starIcon="dropdown">v</ng-template>
  </test-host-a>`,
})
class IconHost {
  readonly a = viewChild(HostA);
}

@Component({
  imports: [STAR_SLOTS],
  template: `<ng-template starEmpty>orphan</ng-template>`,
})
class OrphanHost {
  readonly slot = viewChild(StarSlot);
}

function text(root: HTMLElement, selector: string): string {
  return (root.querySelector(selector)?.textContent ?? '').trim();
}

describe('template slots', () => {
  it('nested hosts keep their own slots', async () => {
    const fixture = TestBed.createComponent(NestedHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el, 'test-host-a > .out')).toBe('A');
    expect(text(el, 'test-host-b > .out')).toBe('B');
  });

  it('slot inside @if is found and removed', async () => {
    const fixture = TestBed.createComponent(IfHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el, 'test-host-a > .out')).toBe('A');
    fixture.componentInstance.show.set(false);
    await fixture.whenStable();
    expect(text(el, 'test-host-a > .out')).toBe('default');
  });

  it('starSlotMap keys icon slots by name', async () => {
    const fixture = TestBed.createComponent(IconHost);
    await fixture.whenStable();
    const map: Signal<ReadonlyMap<string, TemplateRef<unknown>>> =
      fixture.componentInstance.a()!.icons;
    expect([...map().keys()].sort()).toEqual(['clear', 'dropdown']);
  });

  it('a slot outside any host is ignored', async () => {
    const fixture = TestBed.createComponent(OrphanHost);
    await fixture.whenStable();
    expect(fixture.componentInstance.slot()!.host).toBeNull();
  });
});
