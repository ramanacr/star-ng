import { TestBed } from '@angular/core/testing';
import { provideStarNg } from '@star-ng/ui/core';
import { provideStarDatePickerDefaults, StarDatePicker } from '@star-ng/ui/date-picker';
import { provideStarDialogDefaults, StarDialog } from '@star-ng/ui/dialog';
import { StarDrawer } from '@star-ng/ui/drawer';
import { StarListbox } from '@star-ng/ui/listbox';
import {
  provideStarSelectDefaults,
  StarCascadeSelect,
  StarMultiSelect,
  StarSelect,
} from '@star-ng/ui/select';
import { provideStarTableDefaults, StarTable } from '@star-ng/ui/table';
import { provideStarToastDefaults, StarToast, StarToastService } from '@star-ng/ui/toast';

describe('per-control default tokens', () => {
  it('STAR_SELECT_DEFAULTS wins over provideStarNg; an input wins over both', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStarNg({ filterMatchMode: 'endsWith', size: 'small', locale: 'de' }),
        provideStarSelectDefaults({
          filterMatchMode: 'startsWith',
          appendTo: 'body',
          scrollHeight: '20rem',
          showClear: true,
          filterLocale: 'tr',
        }),
      ],
    });
    const select = TestBed.createComponent(StarSelect);
    expect(select.componentInstance.filterMatchMode()).toBe('startsWith');
    expect(select.componentInstance.appendTo()).toBe('body');
    expect(select.componentInstance.scrollHeight()).toBe('20rem');
    expect(select.componentInstance.showClear()).toBe(true);
    expect(select.componentInstance.filterLocale()).toBe('tr');
    // Not in the token: the global value.
    expect(select.componentInstance.size()).toBe('sm');
    select.componentRef.setInput('filterMatchMode', 'equals');
    expect(select.componentInstance.filterMatchMode()).toBe('equals');

    expect(TestBed.createComponent(StarMultiSelect).componentInstance.appendTo()).toBe('body');
    const listbox = TestBed.createComponent(StarListbox).componentInstance;
    expect(listbox.filterMatchMode()).toBe('startsWith');
    expect(listbox.scrollHeight()).toBe('20rem');
    expect(TestBed.createComponent(StarCascadeSelect).componentInstance.showClear()).toBe(true);
  });

  it('STAR_DATE_PICKER_DEFAULTS sets locale, size and the calendar options', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStarNg({ locale: 'de' }),
        provideStarDatePickerDefaults({
          locale: 'es',
          size: 'sm',
          firstDayOfWeek: 1,
          hourFormat: '12',
          showButtonBar: true,
          showWeek: true,
        }),
      ],
    });
    const picker = TestBed.createComponent(StarDatePicker).componentInstance;
    expect(picker.locale()).toBe('es');
    expect(picker.size()).toBe('sm');
    expect(picker.firstDayOfWeek()).toBe(1);
    expect(picker.hourFormat()).toBe('12');
    expect(picker.showButtonBar()).toBe(true);
    expect(picker.showWeek()).toBe(true);
  });

  it('STAR_TABLE_DEFAULTS sets size, striped, stickyHeader and rowsPerPageOptions', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStarTableDefaults({
          size: 'sm',
          striped: true,
          stickyHeader: true,
          rowsPerPageOptions: [5, 10],
        }),
      ],
    });
    const table = TestBed.createComponent(StarTable).componentInstance;
    expect(table.size()).toBe('sm');
    expect(table.striped()).toBe(true);
    expect(table.stickyHeader()).toBe(true);
    expect(table.rowsPerPageOptions()).toEqual([5, 10]);
  });

  it('STAR_DIALOG_DEFAULTS applies to dialogs and drawers', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStarDialogDefaults({
          size: 'lg',
          closable: false,
          closeOnEscape: false,
          dismissableMask: true,
        }),
      ],
    });
    const dialog = TestBed.createComponent(StarDialog).componentInstance;
    expect(dialog.size()).toBe('lg');
    expect(dialog.closable()).toBe(false);
    expect(dialog.closeOnEscape()).toBe(false);
    expect(dialog.dismissableMask()).toBe(true);
    expect(TestBed.createComponent(StarDrawer).componentInstance.dismissableMask()).toBe(true);
  });

  it('STAR_TOAST_DEFAULTS sets the outlet position, stack limit and message life', () => {
    TestBed.configureTestingModule({
      providers: [provideStarToastDefaults({ position: 'bottom-end', stackLimit: 2, life: 1234 })],
    });
    const toast = TestBed.createComponent(StarToast).componentInstance;
    expect(toast.position()).toBe('bottom-end');
    expect(toast.stackLimit()).toBe(2);
    const service = TestBed.inject(StarToastService);
    service.info('Saved');
    expect(service.messages()[0].life).toBe(1234);
    service.show({ summary: 'Own life', life: 50 });
    expect(service.messages()[1].life).toBe(50);
    service.clear();
  });

  it('every token is empty by default', () => {
    expect(TestBed.createComponent(StarDialog).componentInstance.size()).toBe('md');
    expect(TestBed.createComponent(StarToast).componentInstance.position()).toBe('top-right');
    expect(TestBed.createComponent(StarTable).componentInstance.rowsPerPageOptions()).toEqual([
      10, 25, 50,
    ]);
  });
});
