import { effect, EffectRef, inject, Injector, untracked } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { SignalFormControl } from '@angular/forms/signals/compat';

function signalControls(control: AbstractControl): SignalFormControl<unknown>[] {
  if (control instanceof SignalFormControl) return [control as SignalFormControl<unknown>];
  if (control instanceof FormGroup || control instanceof FormArray) {
    return Object.values(control.controls).flatMap(signalControls);
  }
  return [];
}

/**
 * Keeps a Reactive `FormGroup` (or `FormArray`) in step with the `SignalFormControl`s inside it.
 *
 * Angular 22 updates a parent group when a `SignalFormControl` value changes, but not when a
 * Signal Forms rule (for example `disabled({ when })` or a conditional `required`) changes the
 * child's status without a value change. The group then reports a stale `valid` / `status`.
 * This effect watches every signal control's validity, disabled and pending state and calls
 * `updateValueAndValidity()` on the group when one changes.
 *
 * Call it in an injection context (a field initializer or constructor):
 * ```ts
 * readonly form = new FormGroup({ country: new SignalFormControl<string | null>(null, rules) });
 * private readonly sync = syncSignalFormControls(this.form);
 * ```
 */
export function syncSignalFormControls(
  group: FormGroup | FormArray,
  injector: Injector = inject(Injector),
): EffectRef {
  const controls = signalControls(group);
  return effect(
    () => {
      for (const control of controls) {
        const state = control.fieldTree();
        state.valid();
        state.disabled();
        state.pending();
      }
      untracked(() => group.updateValueAndValidity());
    },
    { injector },
  );
}
