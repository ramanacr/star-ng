import {
  computed,
  Directive,
  inject,
  InjectionToken,
  input,
  Signal,
  TemplateRef,
} from '@angular/core';

/**
 * Provided by each control that supports template slots. A slot directive injects the
 * nearest one, so a slot belongs to the control it is written inside.
 */
export const STAR_SLOT_HOST = new InjectionToken<object>('STAR_SLOT_HOST');

/** Base of all slot directives. Controls query it with `contentChildren(StarSlot, { descendants: true })`. */
@Directive()
export abstract class StarSlot<C = unknown> {
  /** Slot name, for example `'empty'`. */
  abstract readonly name: string;
  readonly template = inject<TemplateRef<C>>(TemplateRef);
  /** The control that owns this slot, or `null` when written outside any control. */
  readonly host = inject(STAR_SLOT_HOST, { optional: true });

  /** Extra key for slots that can repeat, such as icons. */
  slotKey(): string {
    return '';
  }
}

/** The first slot with this name that belongs to `host`. */
export function starSlot<C>(
  slots: Signal<readonly StarSlot[]>,
  host: object,
  name: string,
): Signal<TemplateRef<C> | null> {
  return computed(
    () =>
      (slots().find((slot) => slot.host === host && slot.name === name)?.template as
        TemplateRef<C> | undefined) ?? null,
  );
}

/** Slots with this name that belong to `host`, by `slotKey()`. The last one wins on a duplicate key. */
export function starSlotMap<C>(
  slots: Signal<readonly StarSlot[]>,
  host: object,
  name: string,
): Signal<ReadonlyMap<string, TemplateRef<C>>> {
  return computed(() => {
    const map = new Map<string, TemplateRef<C>>();
    for (const slot of slots()) {
      if (slot.host === host && slot.name === name) {
        map.set(slot.slotKey(), slot.template as TemplateRef<C>);
      }
    }
    return map;
  });
}

/** Header content of a control. PrimeNG `#header` template. */
@Directive({
  selector: 'ng-template[starHeader]',
  providers: [{ provide: StarSlot, useExisting: StarHeaderTemplate }],
})
export class StarHeaderTemplate extends StarSlot<object> {
  readonly name = 'header';
}

/** Footer content of a control. PrimeNG `#footer` template. */
@Directive({
  selector: 'ng-template[starFooter]',
  providers: [{ provide: StarSlot, useExisting: StarFooterTemplate }],
})
export class StarFooterTemplate extends StarSlot<object> {
  readonly name = 'footer';
}

/** Context of the empty slot. */
export interface StarEmptyContext {
  /** Filter text, `''` when there is none. */
  readonly $implicit: string;
}

/** Content shown when there is nothing to list. PrimeNG `#empty` template. */
@Directive({
  selector: 'ng-template[starEmpty]',
  providers: [{ provide: StarSlot, useExisting: StarEmptyTemplate }],
})
export class StarEmptyTemplate extends StarSlot<StarEmptyContext> {
  readonly name = 'empty';

  static ngTemplateContextGuard(_dir: StarEmptyTemplate, _ctx: unknown): _ctx is StarEmptyContext {
    return true;
  }
}

/** Content shown while data loads. PrimeNG `#loader` template. */
@Directive({
  selector: 'ng-template[starLoading]',
  providers: [{ provide: StarSlot, useExisting: StarLoadingTemplate }],
})
export class StarLoadingTemplate extends StarSlot<object> {
  readonly name = 'loading';
}

/** Context of the group slot. */
export interface StarGroupContext {
  /** Group label. */
  readonly $implicit: string;
  readonly count: number;
}

/** Group heading row. PrimeNG `#group` template. */
@Directive({
  selector: 'ng-template[starGroup]',
  providers: [{ provide: StarSlot, useExisting: StarGroupTemplate }],
})
export class StarGroupTemplate extends StarSlot<StarGroupContext> {
  readonly name = 'group';

  static ngTemplateContextGuard(_dir: StarGroupTemplate, _ctx: unknown): _ctx is StarGroupContext {
    return true;
  }
}

/** Icons a control lets you replace. */
export type StarIconSlotName = 'dropdown' | 'clear' | 'filter' | 'check' | 'toggle';

/** Replaces one built-in icon: `<ng-template starIcon="clear">…</ng-template>`. PrimeNG `#clearicon`, `#dropdownicon` and similar templates. */
@Directive({
  selector: 'ng-template[starIcon]',
  providers: [{ provide: StarSlot, useExisting: StarIconTemplate }],
})
export class StarIconTemplate extends StarSlot<object> {
  readonly name = 'icon';
  readonly starIcon = input.required<StarIconSlotName>();

  override slotKey(): string {
    return this.starIcon();
  }
}

/** All shared slot directives, for one-line imports. */
export const STAR_SLOTS = [
  StarHeaderTemplate,
  StarFooterTemplate,
  StarEmptyTemplate,
  StarLoadingTemplate,
  StarGroupTemplate,
  StarIconTemplate,
] as const;
