import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAccordion, StarAccordionPanel } from '@star-ng/ui/accordion';
import { StarHeaderTemplate, StarIconTemplate, StarLoadingTemplate } from '@star-ng/ui/core';
import { StarConfirmHost, StarConfirmService, StarConfirmTemplate } from '@star-ng/ui/dialog';
import { StarChip } from '@star-ng/ui/layout';
import { StarMessage, StarMessageContainer } from '@star-ng/ui/message';
import { StarFieldset, StarFieldsetToggleEvent } from '@star-ng/ui/panel';
import { StarPopover } from '@star-ng/ui/popover';
import { StarTag } from '@star-ng/ui/tag';
import {
  StarBlockUi,
  StarMeterGroup,
  StarMeterGroupItemTemplate,
  StarMeterGroupTemplate,
  StarScrollTop,
  StarSplitter,
  StarSplitterGutter,
  StarSplitterResizeEvent,
} from '@star-ng/ui/utility';

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

@Component({
  imports: [StarConfirmHost, StarConfirmTemplate],
  template: `
    <star-confirm-host>
      <ng-template starConfirmTemplate="header" let-options
        ><b class="own-header">{{ options.header }}!</b></ng-template
      >
      <ng-template starConfirmTemplate="icon"><b class="own-icon">i</b></ng-template>
      <ng-template starConfirmTemplate="acceptIcon"><b class="own-accept">+</b></ng-template>
      <ng-template starConfirmTemplate="rejectIcon"><b class="own-reject">-</b></ng-template>
    </star-confirm-host>
    <star-confirm-host id="footer-host">
      <ng-template starConfirmTemplate="footer" let-accept="accept"
        ><button type="button" class="own-footer" (click)="accept()">Yes</button></ng-template
      >
    </star-confirm-host>
  `,
})
class ConfirmHost {}

describe('Confirm slots', () => {
  it('renders the header, icon and button icon slots and settles from a footer slot', async () => {
    const fixture = TestBed.createComponent(ConfirmHost);
    const service = TestBed.inject(StarConfirmService);
    const answer = service.ask({ header: 'Delete order', message: 'Sure?', icon: 'ph-bold ph-x' });
    await fixture.whenStable();
    const first = (fixture.nativeElement as HTMLElement).querySelector('star-confirm-host')!;
    expect(text(first.querySelector('.own-header'))).toBe('Delete order!');
    expect(first.querySelector('.own-icon')!.closest('[aria-hidden=true]')).not.toBeNull();
    expect(first.querySelector('.own-accept')).not.toBeNull();
    expect(first.querySelector('.own-reject')).not.toBeNull();
    const footer = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '#footer-host .own-footer',
    )!;
    footer.click();
    expect(await answer).toBe(true);
  });
});

@Component({
  imports: [StarPopover, StarHeaderTemplate],
  template: `
    <button type="button" id="anchor" (click)="pop.toggle($event)">Open</button>
    <star-popover #pop ariaLabel="Info" [closeOnEscape]="escape()">
      <ng-template starHeader><b class="own-header">Order 7</b></ng-template>
      <p>Body</p>
    </star-popover>
  `,
})
class PopoverHost {
  readonly escape = signal(false);
}

describe('Popover header and closeOnEscape', () => {
  it('shows the header slot and keeps open on Escape when closeOnEscape is off', async () => {
    const fixture = TestBed.createComponent(PopoverHost);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#anchor')!.click();
    await fixture.whenStable();
    const panel = document.querySelector<HTMLElement>('.star-popover')!;
    expect(text(panel.querySelector('[data-star-part=headerPanel]'))).toBe('Order 7');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(document.querySelector('.star-popover')).not.toBeNull();
  });
});

@Component({
  imports: [StarFieldset, StarHeaderTemplate, StarIconTemplate],
  template: `
    <star-fieldset
      legend="Requester"
      toggleable
      [(collapsed)]="collapsed"
      (beforeToggle)="before($event)"
      (afterToggle)="after.push($event.collapsed)"
    >
      <ng-template starHeader><b class="own-legend">Who asks</b></ng-template>
      <ng-template starIcon="toggle" let-expanded
        ><b class="own-toggle">{{ expanded ? '-' : '+' }}</b></ng-template
      >
      <p>Fields</p>
    </star-fieldset>
  `,
})
class FieldsetHost {
  readonly collapsed = signal(false);
  readonly after: boolean[] = [];
  cancel = false;
  before(event: StarFieldsetToggleEvent): void {
    if (this.cancel) event.cancel();
  }
}

describe('Fieldset slots and toggle events', () => {
  it('renders the legend and toggle icon slots and lets beforeToggle cancel', async () => {
    const fixture = TestBed.createComponent(FieldsetHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('legend button')!;
    expect(text(button)).toBe('-Who asks');
    fixture.componentInstance.cancel = true;
    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.collapsed()).toBe(false);
    fixture.componentInstance.cancel = false;
    button.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(fixture.componentInstance.after).toEqual([true]);
    expect(text(el.querySelector('.own-toggle'))).toBe('+');
  });
});

@Component({
  imports: [StarMessage, StarMessageContainer, StarIconTemplate],
  template: `
    <star-message id="icons" closable>
      <ng-template starIcon="icon"><b class="own-icon">!</b></ng-template>
      <ng-template starIcon="close"><b class="own-close">x</b></ng-template>
      Saved.
    </star-message>
    <star-message id="container" (closed)="closed = true">
      <ng-template starMessageContainer let-close
        ><button type="button" class="own-close-all" (click)="close()">Done</button></ng-template
      >
    </star-message>
  `,
})
class MessageHost {
  closed = false;
}

describe('Message slots', () => {
  it('replaces the icons and the whole content', async () => {
    const fixture = TestBed.createComponent(MessageHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#icons .own-icon')!.closest('[aria-hidden=true]')).not.toBeNull();
    expect(el.querySelector('#icons .own-close')!.closest('button')).not.toBeNull();
    expect(el.querySelector('#container [data-star-part=text]')).toBeNull();
    el.querySelector<HTMLElement>('.own-close-all')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.closed).toBe(true);
    expect(el.querySelector<HTMLElement>('#container')!.hidden).toBe(true);
  });
});

@Component({
  imports: [StarMeterGroup, StarMeterGroupTemplate, StarMeterGroupItemTemplate],
  template: `
    <star-meter-group
      ariaLabel="Storage"
      [items]="items"
      [max]="100"
      orientation="vertical"
      labelPosition="start"
      labelOrientation="vertical"
    >
      <ng-template starMeterGroupTemplate="start" let-items
        ><b class="own-start">{{ items.length }}</b></ng-template
      >
      <ng-template starMeterGroupTemplate="end" let-total="totalPercent"
        ><b class="own-end">{{ total }}%</b></ng-template
      >
      <ng-template starMeterGroupTemplate="label" let-items
        ><b class="own-label">{{ items[0].label }}</b></ng-template
      >
      <ng-template starMeterGroupItem="meter" let-item let-percent="percent"
        ><b class="own-meter">{{ item.label }} {{ percent }}</b></ng-template
      >
    </star-meter-group>
  `,
})
class MeterHost {
  readonly items = [
    { label: 'Apps', value: 20 },
    { label: 'Media', value: 30 },
  ];
}

describe('Meter group slots and layout', () => {
  it('renders the slots and the orientation classes, keeping the meter roles', async () => {
    const fixture = TestBed.createComponent(MeterHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = el.querySelector('star-meter-group')!;
    expect(host.classList).toContain('star-meter-group--vertical');
    expect(host.classList).toContain('star-meter-group--label-start');
    expect(text(el.querySelector('.own-start'))).toBe('2');
    expect(text(el.querySelector('.own-end'))).toBe('50%');
    expect(text(el.querySelector('.own-label'))).toBe('Apps');
    const meters = [...el.querySelectorAll('[role=meter]')];
    expect(meters.map((m) => text(m))).toEqual(['Apps 20', 'Media 30']);
    // The label row comes before the bar with labelPosition start.
    const children = [...host.children].map((c) => c.getAttribute('data-star-part'));
    expect(children.indexOf('labelPanel')).toBeLessThan(children.indexOf('barPanel'));
  });
});

@Component({
  imports: [StarSplitter, StarSplitterGutter],
  template: `
    <star-splitter
      stateKey="n2-split"
      [(size)]="size"
      (resizeStart)="events.push('start')"
      (resizeEnd)="ends.push($event)"
    >
      <ng-template starSplitterGutter><b class="own-gutter">||</b></ng-template>
      <div starSplitterStart>A</div>
      <div starSplitterEnd>B</div>
    </star-splitter>
  `,
})
class SplitterHost {
  readonly size = signal(50);
  readonly events: string[] = [];
  readonly ends: StarSplitterResizeEvent[] = [];
}

describe('Splitter gutter, state and resize events', () => {
  beforeEach(() => localStorage.removeItem('n2-split'));

  it('renders the gutter slot, emits the resize events and keeps the size', async () => {
    const fixture = TestBed.createComponent(SplitterHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const gutter = el.querySelector<HTMLElement>('[role=separator]')!;
    expect(gutter.querySelector('.own-gutter')!.closest('[aria-hidden=true]')).not.toBeNull();
    gutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    gutter.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.size()).toBe(52);
    expect(fixture.componentInstance.events).toEqual(['start']);
    expect(fixture.componentInstance.ends).toEqual([{ size: 52 }]);
    expect(localStorage.getItem('n2-split')).toBe('52');
    fixture.destroy();
    const again = TestBed.createComponent(SplitterHost);
    await again.whenStable();
    expect(again.componentInstance.size()).toBe(52);
  });
});

@Component({
  imports: [StarAccordion, StarAccordionPanel, StarHeaderTemplate, StarIconTemplate],
  template: `
    <star-accordion
      [(value)]="open"
      (opened)="log.push('open:' + $event)"
      (closed)="log.push('close:' + $event)"
    >
      <star-accordion-panel value="a" header="Shipping">
        <ng-template starHeader><b class="own-header">Ship it</b></ng-template>
        <ng-template starIcon="toggle" let-expanded
          ><b class="own-toggle">{{ expanded ? '-' : '+' }}</b></ng-template
        >
        Body
      </star-accordion-panel>
    </star-accordion>
  `,
})
class AccordionHost {
  readonly open = signal<readonly string[]>([]);
  readonly log: string[] = [];
}

describe('Accordion slots and events', () => {
  it('renders the header and toggle icon slots and emits opened and closed', async () => {
    const fixture = TestBed.createComponent(AccordionHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const header = el.querySelector<HTMLButtonElement>('.star-accordion__header')!;
    expect(text(header)).toBe('Ship it+');
    header.click();
    await fixture.whenStable();
    header.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.log).toEqual(['open:a', 'close:a']);
  });
});

@Component({
  imports: [StarChip, StarTag, StarScrollTop, StarBlockUi, StarIconTemplate, StarLoadingTemplate],
  template: `
    <star-chip label="Design" removable>
      <ng-template starIcon="remove"><b class="own-remove">x</b></ng-template>
    </star-chip>
    <star-tag value="Closed">
      <ng-template starIcon="icon"><b class="own-tag">v</b></ng-template>
    </star-tag>
    <div id="box" style="height: 50px; overflow: auto">
      <div style="height: 500px"></div>
      <star-scroll-top target="parent" ariaLabel="Back up" [threshold]="10">
        <ng-template starIcon="icon"><b class="own-up">^</b></ng-template>
      </star-scroll-top>
    </div>
    <star-block-ui blocked>
      <ng-template starLoading><b class="own-block">Saving</b></ng-template>
      <p>Form</p>
    </star-block-ui>
  `,
})
class SmallHost {}

describe('Chip, tag, scroll top and block UI slots', () => {
  it('renders the icon slots, the parent target and the block slot', async () => {
    const fixture = TestBed.createComponent(SmallHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.own-remove')!.closest('button')).not.toBeNull();
    expect(el.querySelector('.own-tag')!.closest('[aria-hidden=true]')).not.toBeNull();
    const top = el.querySelector<HTMLButtonElement>('star-scroll-top button')!;
    expect(top.getAttribute('aria-label')).toBe('Back up');
    expect(top.querySelector('.own-up')).not.toBeNull();
    const box = el.querySelector<HTMLElement>('#box')!;
    Object.defineProperty(box, 'scrollTop', { value: 100, configurable: true });
    box.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(el.querySelector('star-scroll-top')!.classList).toContain('star-scroll-top--visible');
    expect(text(el.querySelector('.star-block-ui__mask'))).toBe('Saving');
  });
});
