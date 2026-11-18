import { Component, Type, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarChart } from '@star-ng/ui/chart';
import { provideStarNg, StarConfig } from '@star-ng/ui/core';
import { StarCalendar, StarDatePicker, StarTimePicker } from '@star-ng/ui/date-picker';
import { StarInput } from '@star-ng/ui/field';
import { StarFileUpload } from '@star-ng/ui/file-upload';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarTimeline } from '@star-ng/ui/layout';
import { StarListbox } from '@star-ng/ui/listbox';
import {
  StarCascadeSelect,
  StarMultiSelect,
  StarOptionListBase,
  StarSelect,
} from '@star-ng/ui/select';
import { StarTable } from '@star-ng/ui/table';
import { StarTree, StarTreeSelect } from '@star-ng/ui/tree';

@Component({
  imports: [StarInput],
  template: `
    <input starInput aria-label="Plain" />
    <input starInput aria-label="Set" size="sm" variant="outlined" />
  `,
})
class InputHost {
  readonly inputs = viewChildren(StarInput);
  readonly plain = () => this.inputs()[0];
  readonly set = () => this.inputs()[1];
}

function configure(config: StarConfig): void {
  TestBed.configureTestingModule({ providers: [provideStarNg(config)] });
}

describe('provideStarNg defaults in the controls', () => {
  it('keeps the built-in defaults without a configuration', () => {
    const select = TestBed.createComponent(StarSelect).componentInstance;
    expect(select.filterMatchMode()).toBe('contains');
    expect(select.appendTo()).toBe('self');
    expect(select.size()).toBe('md');
    expect(select.filterLocale()).toBeNull();
    const host = TestBed.createComponent(InputHost);
    host.detectChanges();
    expect(host.componentInstance.plain().variant()).toBe('outlined');
  });

  it('starInput reads size and inputVariant; an input set in the template wins', () => {
    configure({ size: 'large', inputVariant: 'filled' });
    const host = TestBed.createComponent(InputHost);
    host.detectChanges();
    const { plain, set } = host.componentInstance;
    expect(plain().size()).toBe('lg');
    expect(plain().variant()).toBe('filled');
    expect(set().size()).toBe('sm');
    expect(set().variant()).toBe('outlined');
    const element = host.nativeElement.querySelector('input') as HTMLInputElement;
    expect(element.classList).toContain('star-input--filled');
    expect(element.classList).toContain('star-input--lg');
  });

  it('input number reads inputVariant and locale', () => {
    configure({ inputVariant: 'filled', locale: 'de-DE' });
    const fixture = TestBed.createComponent(StarInputNumber);
    fixture.componentRef.setInput('value', 1234.5);
    fixture.detectChanges();
    expect(fixture.componentInstance.locale()).toBe('de-DE');
    expect(fixture.nativeElement.classList).toContain('star-number--filled');
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).value).toBe(
      '1.234,5',
    );
  });

  it('the select family reads filterMatchMode, appendTo, size and locale', () => {
    configure({
      filterMatchMode: 'startsWith',
      overlay: { appendTo: 'body' },
      size: 'small',
      locale: 'de',
    });
    for (const type of [StarSelect, StarMultiSelect] as Type<
      StarOptionListBase<unknown, unknown>
    >[]) {
      const control = TestBed.createComponent(type).componentInstance;
      expect(control.filterMatchMode()).toBe('startsWith');
      expect(control.appendTo()).toBe('body');
      expect(control.size()).toBe('sm');
      expect(control.filterLocale()).toBe('de');
    }
    const listbox = TestBed.createComponent(StarListbox).componentInstance;
    expect(listbox.filterMatchMode()).toBe('startsWith');
    expect(listbox.filterLocale()).toBe('de');
    expect(TestBed.createComponent(StarCascadeSelect).componentInstance.size()).toBe('sm');
  });

  it('an input binding wins over the configuration', () => {
    configure({ filterMatchMode: 'startsWith', size: 'small' });
    const fixture = TestBed.createComponent(StarSelect);
    fixture.componentRef.setInput('filterMatchMode', 'equals');
    fixture.componentRef.setInput('size', 'md');
    expect(fixture.componentInstance.filterMatchMode()).toBe('equals');
    expect(fixture.componentInstance.size()).toBe('md');
  });

  it('a size that the control does not have keeps the built-in default', () => {
    configure({ size: 'large' });
    expect(TestBed.createComponent(StarSelect).componentInstance.size()).toBe('md');
  });

  it('date pickers, calendar, chart, file upload and timeline read locale; date and time pickers read size', () => {
    configure({ locale: 'es', size: 'small' });
    const picker = TestBed.createComponent(StarDatePicker).componentInstance;
    expect(picker.locale()).toBe('es');
    expect(picker.size()).toBe('sm');
    expect(TestBed.createComponent(StarTimePicker).componentInstance.size()).toBe('sm');
    expect(TestBed.createComponent(StarCalendar).componentInstance.locale()).toBe('es');
    expect(TestBed.createComponent(StarChart).componentInstance.locale()).toBe('es');
    expect(TestBed.createComponent(StarFileUpload).componentInstance.locale()).toBe('es');
    expect(TestBed.createComponent(StarTimeline).componentInstance.locale()).toBe('es');
  });

  it('tree and tree select read locale as filterLocale; table reads size', () => {
    configure({ locale: 'tr', size: 'small' });
    expect(TestBed.createComponent(StarTree).componentInstance.filterLocale()).toBe('tr');
    expect(TestBed.createComponent(StarTreeSelect).componentInstance.filterLocale()).toBe('tr');
    expect(TestBed.createComponent(StarTable).componentInstance.size()).toBe('sm');
  });

  it('table reads filterMatchMode for the global filter and locale for its filters', () => {
    configure({ filterMatchMode: 'startsWith', locale: 'de' });
    const table = TestBed.createComponent(StarTable).componentInstance;
    expect(table.globalFilterMatchMode()).toBe('startsWith');
    expect(table.filterLocale()).toBe('de');
  });
});
