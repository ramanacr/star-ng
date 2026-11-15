import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from 'star-ng/button';

@Component({
  selector: 'app-root',
  imports: [StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <star-button
      variant="primary"
      leadingIcon="ph-bold ph-check"
      (pressed)="count.set(count() + 1)"
    >
      Saved {{ count() }} times
    </star-button>
  `,
})
export class App {
  readonly count = signal(0);
}
