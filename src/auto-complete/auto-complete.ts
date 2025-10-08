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
  ElementRef,
  inject,
  Injector,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
  QueryList,
  signal,
  TemplateRef,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MAT_AUTOCOMPLETE_DEFAULT_OPTIONS,
  MatAutocomplete,
  MatAutocompleteActivatedEvent,
  MatAutocompleteDefaultOptions,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import {
  _animationsDisabled,
  MAT_OPTION_PARENT_COMPONENT,
  MatOptgroup,
  MatOption,
  MatOptionParentComponent,
  MatOptionSelectionChange,
} from '@angular/material/core';
import { defer, merge, Observable, startWith, Subject, Subscription, switchMap } from 'rxjs';

/**
 * Event emitted when an option is selected from the autocomplete.
 */
export interface AutoCompleteSelectedEvent {
  source: AutoComplete<any>;
  option: MatOption<any>;
}

/**
 * Event emitted when an option is activated (focused) in the autocomplete.
 */
export interface AutoCompleteActivatedEvent {
  source: AutoComplete<any>;
  option: MatOption<any> | null;
}

/**
 * AutoComplete Component
 *
 * A highly customizable, signal-based autocomplete dropdown for Angular v20+.
 * Supports single and multiple selection, keyboard navigation, and ARIA accessibility.
 * Designed for use with standalone components and the modern Angular signal API.
 *
 * ## Features
 * - **Signal-based API**: Uses Angular v20+ input(), output(), model(), and computed() APIs
 * - **Single & Multi-Select**: Support for both selection modes with proper state management
 * - **Keyboard Navigation**: Full keyboard support with ActiveDescendantKeyManager
 * - **ARIA Accessibility**: Comprehensive ARIA attributes for screen readers
 * - **Angular Material Integration**: Compatible with MatOption and MatOptgroup
 * - **Reactive State**: Leverages signals for efficient change detection
 * - **Scroll Management**: Programmatic control over panel scrolling
 * - **Theme Support**: Material Design theming with color inputs
 *
 * ## Public API
 * The component provides a public API compatible with Angular Material's MatAutocomplete:
 * - `displayWith`: Function to map values to display strings
 * - `autoActiveFirstOption`: Auto-highlight first option on open
 * - `autoSelectActiveOption`: Auto-select option during navigation
 * - `requireSelection`: Force user to select from options
 * - `panelWidth`: Custom panel width
 * - `disableRipple`: Disable Material ripple effects
 * - `hideSingleSelectionIndicator`: Hide checkmarks in single-select mode
 *
 * ## Events
 * - `optionSelected`: Emits when an option is selected
 * - `opened`: Emits when the panel opens
 * - `closed`: Emits when the panel closes
 * - `optionActivated`: Emits when an option is focused via keyboard
 *
 * @template T The type of option values.
 *
 * @example
 * ```html
 * <!-- Single selection -->
 * <auto-complete [ariaLabel]="'Choose an option'">
 *   <mat-option *ngFor="let option of options" [value]="option">
 *     {{ option.label }}
 *   </mat-option>
 * </auto-complete>
 *
 * <!-- Multiple selection -->
 * <auto-complete [multiple]="true" [(selected)]="selectedValues">
 *   <mat-option *ngFor="let option of options" [value]="option.id">
 *     {{ option.name }}
 *   </mat-option>
 * </auto-complete>
 *
 * <!-- With display function -->
 * <auto-complete [displayWith]="displayFn" [autoActiveFirstOption]="true">
 *   <mat-option *ngFor="let user of users" [value]="user">
 *     {{ user.name }}
 *   </mat-option>
 * </auto-complete>
 * ```
 *
 * @example
 * ```typescript
 * // Component usage
 * export class MyComponent {
 *   options = ['Option 1', 'Option 2', 'Option 3'];
 *   selectedValues = model<string[]>([]);
 *
 *   displayFn(value: User): string {
 *     return value?.name ?? '';
 *   }
 * }
 * ```
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
   * Function to map an option's value to its display value in the trigger input.
   * Useful when working with complex objects as option values.
   *
   * @example
   * displayWith = input<(value: User) => string>((user) => user?.name ?? '');
   */
  readonly displayWith = input<((value: T) => string) | null>(null);
  /**
   * Whether the first option should be highlighted when the panel opens.
   * Can be configured globally through MAT_AUTOCOMPLETE_DEFAULT_OPTIONS.
   * @default false
   */
  readonly autoActiveFirstOption = input(
    this.autoCompleteDefaults?.autoActiveFirstOption ?? false,
    { transform: coerceBooleanProperty }
  );
  /**
   * Whether the active option should be selected as the user navigates with keyboard.
   * When enabled, the value updates as the user arrows through options.
   * @default false
   */
  readonly autoSelectActiveOption = input(
    this.autoCompleteDefaults?.autoSelectActiveOption ?? false,
    { transform: coerceBooleanProperty }
  );
  /**
   * Whether the user is required to make a selection from the options.
   * If enabled and user leaves without selecting, the value is reset.
   * @default false
   */
  readonly requireSelection = input(this.autoCompleteDefaults?.requireSelection ?? false, {
    transform: coerceBooleanProperty,
  });
  /**
   * Specify the width of the autocomplete panel.
   * Can be any CSS sizing value, otherwise matches the trigger width.
   */
  readonly panelWidth = input<string | number | undefined>(undefined);
  /**
   * Whether ripples are disabled within the autocomplete panel options.
   * @default false
   */
  readonly disableRipple = input(false, { transform: coerceBooleanProperty });
  /**
   * Signal-based input for hiding single selection indicator.
   * When true, checkmark indicators are hidden for single-selection options.
   * @default false
   */
  readonly _hideSingleSelectionIndicator = input(
    this.autoCompleteDefaults?.hideSingleSelectionIndicator ?? false,
    {
      transform: coerceBooleanProperty,
      alias: 'hideSingleSelectionIndicator',
    }
  );
  /**
   * Getter for compatibility with MatOptionParentComponent interface.
   * Returns true if hiding is enabled on this component or parent.
   */
  get hideSingleSelectionIndicator(): boolean {
    return this._hideSingleSelectionIndicator();
  }
  /**
   * Signal-based input for multiple selection mode.
   * When true, allows selecting multiple options at once.
   * @default false
   */
  readonly _multiple = input(false, {
    transform: coerceBooleanProperty,
    alias: 'multiple',
  });

  /**
   * Getter for compatibility with MatOptionParentComponent interface.
   * Returns true if multiple selection is enabled on this component or parent.
   */
  get multiple(): boolean {
    return this._multiple();
  }
  /**
   * CSS classes to apply to the autocomplete panel for custom styling.
   * Classes are applied to the overlay panel element.
   */
  readonly classList = input([''], { transform: coerceStringArray });
  /**
   * Theme color for the autocomplete panel (primary, accent, or warn).
   * Supports Material Design theme palettes.
   */
  readonly color = input<'primary' | 'accent' | 'warn' | undefined>();
  /**
   * ARIA label for the autocomplete panel.
   * Used for accessibility when no visual label is present.
   */
  readonly ariaLabel = input<string | null>(null);
  /**
   * ARIA labelledby attribute for the autocomplete panel.
   * References the ID of an element that labels the autocomplete.
   */
  readonly ariaLabelledby = input<string | null>(null);
  /**
   * Function to compare option values for selection state.
   * Used to determine if an option should be marked as selected.
   * @default (o1, o2) => o1 == o2
   */
  readonly compareWith = input<(o1: T, o2: T) => boolean>((o1, o2) => o1 == o2);

  // Template reference
  /**
   * Reference to the panel template for overlay rendering.
   * Used by the autocomplete trigger directive.
   */
  readonly template = viewChild(TemplateRef);

  /**
   * Element reference for the panel containing the autocomplete options.
   * Used for scroll position management and DOM manipulation.
   */
  readonly panel = viewChild('panel', { read: ElementRef });

  // State
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
   * QueryList of all MatOptgroup children in the panel.
   */
  @ContentChildren(MatOptgroup, { descendants: true }) optionGroups!: QueryList<MatOptgroup>;
  /**
   * Keyboard manager for navigating options.
   */
  keyManager!: ActiveDescendantKeyManager<MatOption<T>>;
  /**
   * Signal model for selected option values.
   */
  selected = model<T[]>([]); // signal-based API
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
   * Emits when an option is selected.
   */
  /**
   * Emits when an option is selected.
   */
  readonly optionSelected = output<MatAutocompleteSelectedEvent>();
  /**
   * Emits when the panel is opened.
   */
  readonly opened = output<void>();
  /**
   * Emits when the panel is closed.
   */
  readonly closed = output<void>();
  /**
   * Emits when an option is activated (focused).
   */
  readonly optionActivated = output<MatAutocompleteActivatedEvent>();
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

  /**
   * Gets the aria-labelledby attribute value for the autocomplete panel.
   * @param labelId The label ID from the form field
   * @returns The aria-labelledby string or null
   */
  getPanelAriaLabelledby(labelId: string | null): string | null {
    if (typeof this.ariaLabel === 'function' ? this.ariaLabel() : this.ariaLabel) {
      return null;
    }
    const labelExpression = labelId ? labelId + ' ' : '';
    return typeof this.ariaLabelledby === 'function'
      ? this.ariaLabelledby()
        ? labelExpression + this.ariaLabelledby()
        : labelId
      : labelId;
  }

  /**
   * Manually sets the panel scroll position.
   */
  setScrollTop(scrollTop: number): void {
    this.panel()!.nativeElement.scrollTop = scrollTop;
  }

  /**
   * Gets the panel's scroll position.
   */
  getScrollTop(): number {
    return this.panel()?.nativeElement.scrollTop ?? 0;
  }

  /**
   * Updates panel visibility based on options.
   */
  setVisibility(): void {
    this.showPanel.set(this.options.length > 0);
    this.cdr.markForCheck();
  }

  /**
   * Emits the select event for an option.
   */
  emitSelectEvent(option: MatOption<T>): void {
    const event = new MatAutocompleteSelectedEvent(this as unknown as MatAutocomplete, option);
    this.optionSelected.emit(event);
  }

  /**
   * Constructor: initializes multiple selection from parent context.
   */
  ngOnInit(): void {
    this.selectionModel = new SelectionModel<T>(this._multiple());
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
   * Subscriptions are delegated to private methods for clarity and maintainability.
   */
  ngAfterContentInit(): void {
    this.keyManager = new ActiveDescendantKeyManager<MatOption<T>>(this.options)
      .withWrap()
      .skipPredicate(() => this.skipPredicate());

    this.setVisibility();

    this._subscribeToOptionSelectionChanges();
    this._subscribeToOptionsChanges();
    this._subscribeToKeyManagerChanges();
  }

  /**
   * Subscribes to option selection change events and updates selection state.
   * Ensures correct selection logic for single and multiple modes.
   */
  private _subscribeToOptionSelectionChanges(): void {
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
  }

  /**
   * Subscribes to changes in the options QueryList and updates panel visibility and selection.
   * Ensures the panel reflects the current set of options and their selection state.
   */
  private _subscribeToOptionsChanges(): void {
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
      this.setVisibility();
    });
  }

  /**
   * Subscribes to key manager active item changes and scrolls the active option into view.
   * Maintains accessibility and user experience for keyboard navigation.
   */
  private _subscribeToKeyManagerChanges(): void {
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
  skipPredicate(): boolean {
    return false;
  }
}
