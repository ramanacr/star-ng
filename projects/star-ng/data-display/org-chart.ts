import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  inject,
  input,
  model,
  output,
  TemplateRef,
} from '@angular/core';
import { STAR_UI_TEXT, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

export interface StarOrgNode<T = unknown> {
  /** Unique id of the node in the chart. */
  readonly key: string;
  readonly label: string;
  /** Second line, for example a role. */
  readonly subtitle?: string;
  readonly data?: T;
  readonly children?: readonly StarOrgNode<T>[];
}

export interface StarOrgNodeContext<T> {
  readonly $implicit: StarOrgNode<T>;
  readonly level: number;
}

/** Custom node content: `<ng-template starOrgNode let-node>…</ng-template>`. */
@Directive({ selector: 'ng-template[starOrgNode]' })
export class StarOrgNodeTemplate<T = unknown> {
  readonly template = inject<TemplateRef<StarOrgNodeContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: StarOrgNodeTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarOrgNodeContext<T> {
    return true;
  }
}

/**
 * Organization chart (PrimeNG `p-organizationchart`): a hierarchy drawn top-down with
 * connector lines. The markup is a nested list, so assistive technology reads the levels.
 * A node with children has a button that hides or shows its branch.
 *
 * `<star-org-chart ariaLabel="Safety team" [value]="team" [(collapsedKeys)]="closed" selectable />`
 */
@Component({
  selector: 'star-org-chart',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-org' },
  template: `
    <div starPart="scroll" class="star-org__scroll">
      <ul
        starPart="level"
        class="star-org__level star-org__level--root"
        [attr.aria-label]="ariaLabel()"
      >
        <ng-container *ngTemplateOutlet="branch; context: { $implicit: value(), level: 0 }" />
      </ul>
    </div>

    <ng-template #branch let-node let-level="level">
      <li starPart="branch" class="star-org__branch">
        <div
          starPart="node"
          class="star-org__node"
          [class.star-org__node--selected]="selectedKey() === node.key"
          [class.star-org__node--parent]="!!node.children?.length && !isCollapsed(node)"
        >
          @if (selectable()) {
            <button
              starPart="card"
              type="button"
              class="star-org__card star-org__card--button"
              [attr.aria-pressed]="selectedKey() === node.key"
              (click)="select(node)"
            >
              <ng-container *ngTemplateOutlet="content; context: { $implicit: node, level }" />
            </button>
          } @else {
            <div starPart="card" class="star-org__card">
              <ng-container *ngTemplateOutlet="content; context: { $implicit: node, level }" />
            </div>
          }
          @if (node.children?.length) {
            <button
              starPart="toggle"
              type="button"
              class="star-org__toggle"
              [attr.aria-expanded]="!isCollapsed(node)"
              [attr.aria-label]="
                (isCollapsed(node) ? text.expandRow : text.collapseRow) + ': ' + node.label
              "
              (click)="toggle(node)"
            >
              <i
                starPart="icon"
                class="ph-bold"
                [class.ph-caret-down]="isCollapsed(node)"
                [class.ph-caret-up]="!isCollapsed(node)"
                aria-hidden="true"
              ></i>
            </button>
          }
        </div>
        @if (node.children?.length && !isCollapsed(node)) {
          <ul starPart="level" class="star-org__level">
            @for (child of node.children; track child.key) {
              <ng-container
                *ngTemplateOutlet="branch; context: { $implicit: child, level: level + 1 }"
              />
            }
          </ul>
        }
      </li>
    </ng-template>

    <ng-template #content let-node let-level="level">
      @if (nodeTemplate(); as custom) {
        <ng-container *ngTemplateOutlet="custom.template; context: { $implicit: node, level }" />
      } @else {
        <span starPart="label" class="star-org__label">{{ node.label }}</span>
        @if (node.subtitle) {
          <span starPart="subtitle" class="star-org__subtitle">{{ node.subtitle }}</span>
        }
      }
    </ng-template>
  `,
})
export class StarOrgChart<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);

  /** Root node of the chart. */
  readonly value = input.required<StarOrgNode<T>>();
  readonly ariaLabel = input<string | null>(null);
  /** Keys of the nodes whose branch is hidden. Two-way. */
  readonly collapsedKeys = model<readonly string[]>([]);
  /** Nodes are buttons; one node can be selected. */
  readonly selectable = input(false, { transform: (value: boolean | '') => value === '' || value });
  readonly selectedKey = model<string | null>(null);
  readonly nodeSelect = output<StarOrgNode<T>>();

  protected readonly nodeTemplate = contentChild(StarOrgNodeTemplate);

  protected isCollapsed(node: StarOrgNode<T>): boolean {
    return this.collapsedKeys().includes(node.key);
  }

  protected toggle(node: StarOrgNode<T>): void {
    this.collapsedKeys.update((keys) =>
      keys.includes(node.key) ? keys.filter((key) => key !== node.key) : [...keys, node.key],
    );
  }

  protected select(node: StarOrgNode<T>): void {
    this.selectedKey.set(node.key);
    this.nodeSelect.emit(node);
  }
}
