import { OverlayModule } from '@angular/cdk/overlay';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ContentChildren,
  contentChildren,
  Directive,
  effect,
  forwardRef,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  QueryList,
  signal,
  TemplateRef,
  viewChild,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  _animationsDisabled,
  MAT_OPTION_PARENT_COMPONENT,
  MatOption,
  MatOptionParentComponent,
} from '@angular/material/core';
import { _IdGenerator, ActiveDescendantKeyManager } from '@angular/cdk/a11y';
import {
  MAT_AUTOCOMPLETE_DEFAULT_OPTIONS,
  MatAutocompleteDefaultOptions,
} from '@angular/material/autocomplete';
import { coerceStringArray } from '@angular/cdk/coercion';
import { Subscription } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';
import { JsonPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'auto-complete',
  standalone: true,
  imports: [OverlayModule, JsonPipe],
  exportAs: 'autocomplete',
  templateUrl: './auto-complete.html',
  styleUrl: './auto-complete.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MAT_OPTION_PARENT_COMPONENT, useExisting: AutoComplete }],
})
export class AutoComplete<T>
  implements MatOptionParentComponent, OnInit, AfterContentInit, OnDestroy
{
  /** Self reference to the template to be used by the AutoCompleteDirective */
  readonly template = viewChild(TemplateRef);
  protected optionParent = inject<MatOptionParentComponent>(MAT_OPTION_PARENT_COMPONENT, {
    optional: true,
    skipSelf: true,
  });
  protected autoCompleteDefaults = inject<MatAutocompleteDefaultOptions>(
    MAT_AUTOCOMPLETE_DEFAULT_OPTIONS,
    { optional: true }
  );

  multiple = false;

  /** Whether the autocomplete panel should be visible, depending on option length. */
  showPanel = computed(() => !!this.options()?.length);

  id: string = inject(_IdGenerator).getId('auto-complete-');

  /** Reference to all options within the autocomplete. */
  options = contentChildren(MatOption<T>, { descendants: true });

  // All selection, navigation, and filtering logic uses this.options

  // Implement required method from MatOptionParentComponent (if any)
  // For example, if the interface requires a method like 'optionSelectionChanged', add it here:
  // optionSelectionChanged() {}

  /**
   * Takes classes set on the host auto-complete element and applies them to the panel
   * inside the overlay container to allow for easy styling.
   */
  readonly classList = input([''], { transform: coerceStringArray });

  /** Theme color of the panel as a signal input. */
  readonly color = input<string>('');

  /** Aria label of the autocomplete as a signal input. */
  readonly ariaLabel = input<string | null>(null);

  /** Aria-labelledby attribute as a signal input. */
  readonly ariaLabelledby = input<string | null>(null);

  /** Gets the aria-labelledby for the autocomplete panel. */
  protected getPanelAriaLabelledby(labelId: string | null): string | null {
    if (this.ariaLabel()) {
      return null;
    }
    const labelExpression = labelId ? labelId + ' ' : '';
    return this.ariaLabelledby() ? labelExpression + this.ariaLabelledby() : labelId;
  }

  /** Whether the autocomplete panel is open as a signal. */
  protected readonly _isOpen = signal(false);

  /** Whether the autocomplete panel is open. */
  readonly isOpen = computed(() => this._isOpen() && this.showPanel());

  protected _animationsDisabled = _animationsDisabled();

  /** Manages active item in option list based on key events. */
  keyManager = computed(() => {
    return new ActiveDescendantKeyManager<MatOption>(this.options())
      .withWrap()
      .skipPredicate(this._skipPredicate);
  });

  keyManagerChange = computed(() => this.keyManager().change);

  scrollActiveOptionIntoView = effect(() => {
    const keyManagerChange = this.keyManagerChange();
    const activeOption = this.options().at(this.keyManager().activeItemIndex!);
    if (activeOption) {
      const element = activeOption._getHostElement?.();
      element.scrollIntoView({ block: 'nearest' });
    }
  });

  private _activeOptionChanges = Subscription.EMPTY;

  selected = model<T[]>([]);
  compareWith = input<(o1: T, o2: T) => boolean>((o1, o2) => o1 === o2);
  selectionModel!: SelectionModel<T>;

  constructor() {
    this.multiple = this.optionParent?.multiple ?? false;
  }

  ngOnInit() {
    this.selectionModel = new SelectionModel<T>(
      this.multiple,
      this.selected(),
      true,
      this.compareWith()
    );
  }
  ngOnDestroy() {
    this.keyManager()?.destroy();
    this._activeOptionChanges.unsubscribe();
  }

  ngAfterContentInit() {
    this._activeOptionChanges = this.keyManager().change.subscribe((index) => {
      console.log('option index', index, this.options()?.[index]);
      if (this.isOpen()) {
        this.selectionModel.select(this.options()?.[index].value!);
        console.log('option active', this.selectionModel.selected);
      }
    });
  }

  protected _skipPredicate() {
    return false;
  }
}
