import { _IdGenerator, ActiveDescendantKeyManager } from '@angular/cdk/a11y';
import { coerceBooleanProperty, coerceStringArray } from '@angular/cdk/coercion';
import { SelectionModel } from '@angular/cdk/collections';
import { OverlayModule } from '@angular/cdk/overlay';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ContentChildren,
  DestroyRef,
  inject,
  Injector,
  input,
  model,
  OnDestroy,
  OnInit,
  QueryList,
  signal,
  TemplateRef,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MAT_AUTOCOMPLETE_DEFAULT_OPTIONS,
  MatAutocompleteDefaultOptions,
} from '@angular/material/autocomplete';
import {
  _animationsDisabled,
  MAT_OPTION_PARENT_COMPONENT,
  MatOption,
  MatOptionParentComponent,
  MatOptionSelectionChange,
} from '@angular/material/core';
import { defer, merge, Observable, startWith, Subject, Subscription, switchMap } from 'rxjs';

/**
 * AutoComplete Component
 *
 * A highly customizable, signal-based autocomplete dropdown for Angular v20+.
 * Supports single and multiple selection, keyboard navigation, and ARIA accessibility.
 * Designed for use with standalone components and signals.
 *
 * @template T The type of option values.
 *
 * @example
 * <auto-complete [multiple]="true" [ariaLabel]="'Choose options'">
 *   <mat-option *ngFor="let option of options" [value]="option">{{ option }}</mat-option>
 * </auto-complete>
 */
@Component({
  selector: 'auto-complete',
  standalone: true,
  imports: [OverlayModule],
  exportAs: 'autocomplete',
  templateUrl: './auto-complete.html',
  styleUrl: './auto-complete.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MAT_OPTION_PARENT_COMPONENT, useExisting: AutoComplete }],
})
/**
 * AutoComplete<T>
 *
 * Implements a signal-based autocomplete dropdown panel for Angular forms and inputs.
 * - Supports single and multiple selection modes
 * - Integrates with Angular Material's MatOption
 * - Provides keyboard navigation and ARIA accessibility
 * - Uses signals and computed for reactive state
 *
 * @template T The type of option values.
 */
export class AutoComplete<T>
  implements MatOptionParentComponent, OnInit, OnDestroy, AfterContentInit
{
  // Dependency injection
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly optionParent = inject<MatOptionParentComponent>(MAT_OPTION_PARENT_COMPONENT, {
    optional: true,
    skipSelf: true,
  });
  private readonly autoCompleteDefaults = inject<MatAutocompleteDefaultOptions>(
    MAT_AUTOCOMPLETE_DEFAULT_OPTIONS,
    { optional: true }
  );

  // Inputs
  /**
   * Whether multiple options can be selected.
   * @default false
   */
  readonly multipleInput = input(false, { transform: coerceBooleanProperty, alias: 'multiple' });
  /**
   * CSS classes to apply to the autocomplete panel.
   */
  readonly classList = input([''], { transform: coerceStringArray });
  /**
   * Theme color for the autocomplete panel.
   */
  readonly color = input<string>('');
  /**
   * ARIA label for the autocomplete panel.
   */
  readonly ariaLabel = input<string | null>(null);
  /**
   * ARIA labelledby attribute for the autocomplete panel.
   */
  readonly ariaLabelledby = input<string | null>(null);
  /**
   * Function to compare option values for selection.
   * @param o1 First value
   * @param o2 Second value
   * @returns True if values are considered equal
   */
  readonly compareWith = input<(o1: T, o2: T) => boolean>((o1, o2) => o1 == o2);

  // Template reference
  /**
   * Reference to the panel template for overlay rendering.
   */
  readonly template = viewChild(TemplateRef);

  // State
  /**
   * Whether multiple selection is enabled (internal state).
   */
  multiple = false;
  /**
   * Whether the autocomplete panel should be visible, based on option count.
   */
  showPanel = signal(false);
  /**
   * Unique ID for the autocomplete panel (used for ARIA attributes).
   */
  id: string = inject(_IdGenerator).getId('auto-complete-');
  private readonly _initialized = new Subject<void>();
  /**
   * QueryList of all MatOption children in the panel.
   */
  @ContentChildren(MatOption, { descendants: true }) options!: QueryList<MatOption>;
  /**
   * Keyboard manager for navigating options.
   */
  keyManager!: ActiveDescendantKeyManager<MatOption<T>>;
  /**
   * Signal model for selected option values.
   */
  selected = model<T[]>([]);
  /**
   * SelectionModel for managing selected options.
   */
  protected selectionModel!: SelectionModel<T>;

  // Panel open state
  /**
   * Internal signal for panel open state.
   */
  private readonly _isOpen = signal(false);
  /**
   * Computed signal for panel open state (visible and open).
   */
  readonly isOpen = computed(() => this._isOpen() && this.showPanel());
  /**
   * Whether panel animations are disabled (from Angular Material).
   */
  protected readonly _animationsDisabled = _animationsDisabled();

  // Events
  /**
   * Emits whenever an option is selected in single-selection mode.
   */
  private readonly singleSelectionChangeSubject = new Subject<void>();
  /**
   * Observable for single selection change events.
   */
  readonly singleSelectionChange = this.singleSelectionChangeSubject.asObservable();
  /**
   * Subscription for active option changes (keyboard navigation).
   */
  private activeOptionChanges = Subscription.EMPTY;

  /**
   * Combined stream of all child MatOption selection change events.
   * Used to reactively update selection state.
   */
  readonly optionSelectionChanges: Observable<MatOptionSelectionChange> = defer(() => {
    const options = this.options;
    if (options) {
      return options.changes.pipe(
        startWith(options),
        switchMap(() => merge(...options.map((option) => option.onSelectionChange)))
      );
    }
    return this._initialized.pipe(switchMap(() => this.optionSelectionChanges));
  });

  /** Gets the aria-labelledby for the autocomplete panel. */
  /**
   * Gets the aria-labelledby attribute value for the autocomplete panel.
   * @param labelId The label ID from the form field
   * @returns The aria-labelledby string or null
   */
  protected getPanelAriaLabelledby(labelId: string | null): string | null {
    if (this.ariaLabel()) {
      return null;
    }
    const labelExpression = labelId ? labelId + ' ' : '';
    return this.ariaLabelledby() ? labelExpression + this.ariaLabelledby() : labelId;
  }

  /**
   * Constructor: initializes multiple selection from parent context.
   */
  constructor() {
    this.multiple = this.optionParent?.multiple ?? false;
  }

  /**
   * Angular lifecycle: initializes selection model and multiple state.
   */
  ngOnInit(): void {
    this.multiple = this.multipleInput();
    this.selectionModel = new SelectionModel<T>(this.multipleInput());
  }

  /**
   * Angular lifecycle: cleans up subscriptions and key manager.
   */
  ngOnDestroy(): void {
    this.keyManager?.destroy();
    this.activeOptionChanges.unsubscribe();
  }

  /**
   * Angular lifecycle: initializes key manager, selection logic, and subscriptions.
   * Handles option selection, panel visibility, and keyboard navigation.
   */
  ngAfterContentInit(): void {
    this.keyManager = new ActiveDescendantKeyManager<MatOption<T>>(this.options)
      .withWrap()
      .skipPredicate(() => this._skipPredicate());

    this.showPanel.set(this.options.length > 0);

    this.optionSelectionChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.cdr.markForCheck();
      const option = event.source.value;
      this.selectionModel.toggle(option);
      if (this.multiple) {
        if (this.options.toArray().every((opt) => opt.selected)) {
          this.selectionModel.setSelection(...this.options.map((opt) => opt.value));
        }
        if (this.options.toArray().every((opt) => !opt?.selected)) {
          this.selectionModel.clear();
        }
      }
      this.selected.set(this.selectionModel.selected);
      if (!this.multiple) {
        this.options.forEach((opt) => opt.deselect(false));
        this.options.find((opt) => this.selectionModel.isSelected(opt.value))?.select(false);
        this.singleSelectionChangeSubject.next();
      }
    });

    this.options.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((changes) => {
      this.cdr.markForCheck();
      this.showPanel.set(false);
      changes.forEach((op: MatOption<T>) => {
        if (this.selectionModel.isSelected(op.value)) {
          op.select(false);
        } else {
          op.deselect(false);
        }
      });
      this.showPanel.set(changes.length > 0);
    });

    this.keyManager.change.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cdr.markForCheck();
      const activeOption = this.options.toArray().at(this.keyManager?.activeItemIndex!);
      if (activeOption) {
        const element = activeOption._getHostElement?.();
        element.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /**
   * Predicate for skipping options in keyboard navigation (override for custom logic).
   * @returns False by default (no options skipped)
   */
  protected _skipPredicate(): boolean {
    return false;
  }
}
