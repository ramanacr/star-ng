import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAvatar } from '@star-ng/ui/avatar';
import { StarPickList } from '@star-ng/ui/data-display';
import { StarDatePicker } from '@star-ng/ui/date-picker';
import { StarField } from '@star-ng/ui/field';
import { StarFileUpload } from '@star-ng/ui/file-upload';
import { StarInputTags } from '@star-ng/ui/input-tags';
import { StarListbox } from '@star-ng/ui/listbox';
import { StarCarousel, StarCarouselItem } from '@star-ng/ui/media';
import { StarCascadeSelect, StarSelect } from '@star-ng/ui/select';
import { StarTable } from '@star-ng/ui/table';
import { StarTreeNode, StarTreeSelect } from '@star-ng/ui/tree';
import { StarInplace, StarInplaceContent, StarInplaceDisplay } from '@star-ng/ui/utility';

/**
 * Accessible structure that the axe scan (`e2e/a11y.spec.ts`) found wrong and that is fixed in the
 * library. Each test fails on the old markup. The scan itself needs a real browser; these tests
 * check the role, the name or the attribute in jsdom.
 */

const NODES: StarTreeNode[] = [
  { key: 'a', label: 'Alpha', children: [{ key: 'a1', label: 'Alpha one' }] },
  { key: 'b', label: 'Beta' },
];

interface Place {
  readonly name: string;
  readonly code?: string;
  readonly children?: readonly Place[];
}

const PLACES: Place[] = [
  { name: 'Germany', children: [{ name: 'Munich', code: 'DE-MUC' }] },
  { name: 'Spain', children: [{ name: 'Madrid', code: 'ES-MAD' }] },
];

const ROWS = [
  { id: 'a', name: 'Cable kit' },
  { id: 'b', name: 'Dock lamp' },
];

@Component({
  imports: [
    StarAvatar,
    StarCarousel,
    StarCarouselItem,
    StarCascadeSelect,
    StarDatePicker,
    StarField,
    StarFileUpload,
    StarInplace,
    StarInplaceContent,
    StarInplaceDisplay,
    StarInputTags,
    StarListbox,
    StarPickList,
    StarSelect,
    StarTable,
    StarTreeSelect,
  ],
  template: `
    <star-cascade-select
      id="cascade"
      [options]="places"
      optionLabel="name"
      optionValue="code"
      [(value)]="place"
      required
      ariaLabel="City"
    />
    <star-tree-select
      id="tree"
      [nodes]="nodes"
      [value]="picked()"
      placeholder="Pick a node"
      ariaLabel="Department"
    />
    <star-inplace id="inplace" ariaLabel="Edit name">
      <ng-template starInplaceDisplay>A. Rivera</ng-template>
      <ng-template starInplaceContent><input /></ng-template>
    </star-inplace>
    <star-table
      id="table"
      [value]="rows"
      [columns]="[{ field: 'name', header: 'Product', editable: true }]"
      dataKey="id"
      ariaLabel="Orders"
      resizableColumns
      paginator
    />
    <star-date-picker id="date" ariaLabel="Delivery date" />
    <star-field label="Regions">
      <star-input-tags id="tags" />
    </star-field>
    <star-input-tags id="tags-off" ariaLabel="Frozen regions" [value]="['north']" disabled />
    <star-listbox id="empty-list" [options]="[]" ariaLabel="Empty list" />
    <star-pick-list id="pick" [source]="[]" [target]="[]" />
    <star-select id="busy" [options]="[]" loading ariaLabel="Busy" />
    <star-file-upload id="upload" accept=".pdf" />
    <star-avatar id="avatar-plain" />
    <star-avatar id="avatar-named" name="Jane Doe" />
    <star-carousel id="carousel" [items]="[1, 2]" ariaLabel="Photos">
      <ng-template starCarouselItem let-n>{{ n }}</ng-template>
    </star-carousel>
  `,
})
class Host {
  readonly places = PLACES;
  readonly place = signal<string | null>(null);
  readonly nodes = NODES;
  readonly picked = signal<readonly string[]>([]);
  readonly rows = ROWS;
}

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, el };
}

const text = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('accessible names contain the visible text (WCAG 2.5.3)', () => {
  it('cascade select: the name is the label and the text on the button', async () => {
    const { fixture, host, el } = await setup();
    const trigger = el.querySelector<HTMLElement>('#cascade button')!;
    expect(trigger.getAttribute('aria-label')).toBe(`City: ${text(trigger)}`);
    host.place.set('ES-MAD');
    await fixture.whenStable();
    expect(text(trigger)).toBe('Madrid');
    expect(trigger.getAttribute('aria-label')).toBe('City: Madrid');
  });

  it('cascade select: a button has no aria-required', async () => {
    const { el } = await setup();
    expect(el.querySelector('#cascade button')!.hasAttribute('aria-required')).toBe(false);
  });

  it('tree select: the name is the label and the text on the button', async () => {
    const { fixture, host, el } = await setup();
    const trigger = el.querySelector<HTMLElement>('#tree button')!;
    expect(trigger.getAttribute('aria-label')).toBe('Department: Pick a node');
    host.picked.set(['b']);
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-label')).toBe(`Department: ${text(trigger)}`);
  });

  it('inplace: the button has no aria-label, its text is the label and the value', async () => {
    const { el } = await setup();
    const display = el.querySelector<HTMLElement>('#inplace .star-inplace__display')!;
    expect(display.hasAttribute('aria-label')).toBe(false);
    expect(text(display)).toBe('Edit name: A. Rivera');
  });

  it('table: an edit button has the action and the value as its text', async () => {
    const { el } = await setup();
    const button = el.querySelector<HTMLElement>('#table button.star-table__edit')!;
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(text(button)).toBe('Edit Product: Cable kit');
  });
});

describe('roles and attributes that ARIA allows', () => {
  it('date picker: the text field has no aria-expanded, the button has it', async () => {
    const { fixture, el } = await setup();
    const input = el.querySelector<HTMLElement>('#date input')!;
    const toggle = el.querySelector<HTMLElement>('#date .star-date__toggle')!;
    expect(input.hasAttribute('aria-expanded')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-haspopup')).toBe('dialog');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(
      document.querySelector('.star-date__panel')!.id,
    );
  });

  it('select: the loading icon is an image with a name', async () => {
    const { el } = await setup();
    const icon = el.querySelector('#busy i[aria-label]')!;
    expect(icon.getAttribute('role')).toBe('img');
    expect(icon.getAttribute('aria-label')).toBe('Loading');
  });

  it('file upload: the alert is a block, the list inside it keeps its role', async () => {
    const { fixture, el } = await setup();
    const upload = fixture.debugElement.query((d) => d.nativeElement.id === 'upload')
      .componentInstance as StarFileUpload;
    upload.add([new File(['x'], 'run.exe', { type: 'application/x-msdownload' })]);
    await fixture.whenStable();
    const list = el.querySelector('#upload .star-upload__errors')!;
    expect(list.tagName).toBe('UL');
    expect(list.hasAttribute('role')).toBe(false);
    expect(list.parentElement!.getAttribute('role')).toBe('alert');
  });

  it('avatar: without a name it is hidden from assistive technology, with a name it is an image', async () => {
    const { el } = await setup();
    const plain = el.querySelector('#avatar-plain')!;
    expect(plain.hasAttribute('role')).toBe(false);
    expect(plain.getAttribute('aria-hidden')).toBe('true');
    const named = el.querySelector('#avatar-named')!;
    expect(named.getAttribute('role')).toBe('img');
    expect(named.getAttribute('aria-label')).toBe('Jane Doe');
    expect(named.hasAttribute('aria-hidden')).toBe(false);
  });

  it('table: a resize handle has the values that a focusable separator needs', async () => {
    const { el } = await setup();
    const handle = el.querySelector<HTMLElement>('#table [role="separator"]')!;
    expect(handle.getAttribute('aria-valuenow')).not.toBeNull();
    expect(handle.getAttribute('aria-valuemin')).toBe('48');
    expect(Number(handle.getAttribute('aria-valuemax'))).toBeGreaterThanOrEqual(
      Number(handle.getAttribute('aria-valuenow')),
    );
  });
});

describe('structure that ARIA requires', () => {
  it('a listbox with no options holds no text: the empty message is outside', async () => {
    const { el } = await setup();
    const list = el.querySelector<HTMLElement>('#empty-list [role="listbox"]')!;
    expect(list.textContent!.trim()).toBe('');
    expect(el.querySelector('#empty-list .star-listbox__empty')!.parentElement).not.toBe(list);
  });

  it('a pick list with an empty list holds no text in the listbox', async () => {
    const { el } = await setup();
    const lists = el.querySelectorAll<HTMLElement>('#pick [role="listbox"]');
    expect(lists.length).toBe(2);
    for (const list of Array.from(lists)) expect(list.textContent!.trim()).toBe('');
    expect(el.querySelectorAll('#pick .star-listbox__empty').length).toBe(2);
  });
});

describe('scrollable regions can be reached with the keyboard', () => {
  it('carousel: the track is a focusable group with the name of the carousel', async () => {
    const { el } = await setup();
    const track = el.querySelector<HTMLElement>('#carousel .star-carousel__track')!;
    expect(track.getAttribute('tabindex')).toBe('0');
    expect(track.getAttribute('role')).toBe('group');
    expect(track.getAttribute('aria-label')).toBe('Photos');
  });
});

describe('names that axe could not find', () => {
  it('input tags: the label of the field points at the input', async () => {
    const { el } = await setup();
    const label = el.querySelector<HTMLLabelElement>('star-field label')!;
    const input = el.querySelector<HTMLInputElement>('#tags input')!;
    expect(label.htmlFor).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toContain(
      el.querySelector('#tags .star-sr-only')!.id,
    );
  });

  it('input tags: a disabled list is marked as disabled, so its faded chips are inactive', async () => {
    const { el } = await setup();
    expect(el.querySelector('#tags-off .star-tags__list')!.getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(el.querySelector('#tags .star-tags__list')!.hasAttribute('aria-disabled')).toBe(false);
  });

  it('table: the paginator is named after the table', async () => {
    const { el } = await setup();
    expect(el.querySelector('#table nav.star-paginator__pages')!.getAttribute('aria-label')).toBe(
      'Pagination: Orders',
    );
  });
});
