import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { STAR_UI_TEXT, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

export type StarMessageSeverity = 'success' | 'info' | 'warn' | 'error';

const ICONS: Record<StarMessageSeverity, string> = {
  success: 'ph-fill ph-check-circle',
  info: 'ph-fill ph-info',
  warn: 'ph-fill ph-warning',
  error: 'ph-fill ph-warning-circle',
};

/**
 * Inline message (PrimeNG `p-message`): severity, icon, optional close and auto-hide `life`.
 * `<star-message severity="warn" closable>Draft not saved.</star-message>`
 */
@Component({
  selector: 'star-message',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-message star-message--' + severity() + ' star-message--' + variant()",
    '[attr.role]': "severity() === 'error' ? 'alert' : 'status'",
    '[hidden]': '!visible()',
  },
  template: `
    <i starPart="icon" class="star-message__icon" [class]="iconClass()" aria-hidden="true"></i>
    <div starPart="text" class="star-message__text"><ng-content /></div>
    @if (closable()) {
      <button
        starPart="close"
        type="button"
        class="star-message__close"
        [attr.aria-label]="text.close"
        (click)="close()"
      >
        <i starPart="closeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
      </button>
    }
  `,
})
export class StarMessage implements OnInit {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly destroyRef = inject(DestroyRef);

  readonly severity = input<StarMessageSeverity>('info');
  readonly variant = input<'soft' | 'outlined'>('soft');
  readonly icon = input<string | null>(null);
  readonly closable = input(false, { transform: booleanAttribute });
  /** Milliseconds before the message hides itself (0 = stays). */
  readonly life = input(0);
  readonly closed = output<void>();

  protected readonly visible = signal(true);
  protected readonly iconClass = computed(() => this.icon() ?? ICONS[this.severity()]);

  ngOnInit(): void {
    const life = this.life();
    if (life > 0) {
      const timer = setTimeout(() => this.close(), life);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    }
  }

  close(): void {
    this.visible.set(false);
    this.closed.emit();
  }
}
