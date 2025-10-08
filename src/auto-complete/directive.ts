import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { hasModifierKey } from '@angular/cdk/keycodes';
import {
  ConnectedPosition,
  createFlexibleConnectedPositionStrategy,
  createRepositionScrollStrategy,
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayConfig,
  OverlayRef,
  PositionStrategy,
  ScrollStrategy,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  InjectionToken,
  Injector,
  input,
  OnDestroy,
  signal,
  ViewContainerRef,
} from '@angular/core';
import { MAT_FORM_FIELD, MatFormField } from '@angular/material/form-field';
import { filter, merge } from 'rxjs';
import { AutoComplete } from './auto-complete';

/** Injection token that determines the scroll handling while the autocomplete panel is open. */
export const MAT_AUTOCOMPLETE_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>(
  'mat-autocomplete-scroll-strategy',
  {
    providedIn: 'root',
    factory: () => {
      const injector = inject(Injector);
      return () => createRepositionScrollStrategy(injector);
    },
  }
);

/**
 * AutoCompleteDirective
 *
 * A directive that connects an input element to an autocomplete panel.
 * Handles overlay management, keyboard navigation, and user interactions.
 *
 * @example
 * ```html
 * <mat-form-field>
 *   <input matInput [autocomplete]="auto" />
 * </mat-form-field>
 *
 * <auto-complete #auto>
 *   <mat-option *ngFor="let option of options" [value]="option">
 *     {{ option }}
 *   </mat-option>
 * </auto-complete>
 * ```
 *
 * ## Features
 * - Automatic overlay positioning
 * - Keyboard navigation support (arrows, Enter, Space, Escape)
 * - Click-outside-to-close functionality
 * - Integration with Material Form Field
 * - Multi-select support with Ctrl+A
 *
 * ## Accessibility
 * - Sets ARIA attributes (role, aria-autocomplete, aria-haspopup)
 * - Integrates with ActiveDescendantKeyManager for keyboard navigation
 * - Supports screen readers
 */
@Directive({
  selector: 'input[autocomplete]',
  standalone: true,
  host: {
    '[attr.role]': 'autocompleteDisabled ? null : "combobox"',
    '[attr.aria-autocomplete]': 'autocompleteDisabled ? null : "list"',
    '[attr.aria-haspopup]': 'autocompleteDisabled ? null : "listbox"',
    '(focusin)': 'handleFocus()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class AutoCompleteDirective<T> implements OnDestroy, AfterViewInit {
  // ========================================
  // Dependencies
  // ========================================
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly formField = inject<MatFormField | null>(MAT_FORM_FIELD, {
    optional: true,
    host: true,
  });
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly overlay = inject(Overlay);

  // ========================================
  // Inputs
  // ========================================
  /** Reference to the autocomplete component instance */
  readonly autocomplete = input.required<AutoComplete<T>>();

  // ========================================
  // Public Properties
  // ========================================
  /** Whether the autocomplete is disabled */
  autocompleteDisabled = false;

  // ========================================
  // Private Properties
  // ========================================
  /** Portal instance for rendering the autocomplete panel */
  private portal: TemplatePortal | null = null;

  /** Reference to the overlay */
  private overlayRef!: OverlayRef;

  /** Signal tracking whether the panel is currently open */
  private readonly panelOpen = signal(false);

  /** Strategy used to position the overlay panel */
  private positionStrategy: FlexibleConnectedPositionStrategy | null = null;

  /** CSS class applied to the overlay panel */
  private readonly overlayPanelClass = signal('auto-complete-panel');

  /** Preferred overlay positions */
  private readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
  ];

  // ========================================
  // Lifecycle Hooks
  // ========================================
  ngAfterViewInit(): void {
    this.overlayRef = this.overlay.create(this.getOverlayConfig());

    // Subscribe to panel closing actions with automatic cleanup
    this.panelClosingActions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // Prevent closing a non-attached overlay
        if (!this.overlayRef.hasAttached()) {
          return;
        }

        const clickTarget = (event as Event)?.target as HTMLElement;
        const inputElement = this.elementRef.nativeElement;

        // Prevent closing when clicking inside the input
        if (clickTarget === inputElement) {
          return;
        }

        this.closeOverlay();
      });
  }

  ngOnDestroy(): void {
    // Clean up overlay resources
    if (this.overlayRef) {
      this.overlayRef.dispose();
    }

    // Clean up portal
    if (this.portal?.isAttached) {
      this.portal.detach();
    }
  }

  // ========================================
  // Public Event Handlers
  // ========================================
  /**
   * Handles focus event on the input element.
   * Opens the autocomplete panel if not already open.
   */
  handleFocus(): void {
    if (!this.overlayRef.hasAttached()) {
      this.openOverlay();
    }
  }

  /**
   * Handles keydown events on the input element.
   * Manages keyboard navigation and option selection.
   *
   * @param event - The keyboard event
   */
  protected handleKeydown(event: KeyboardEvent): void {
    const keyManager = this.autocomplete().keyManager;
    const activeIndex = keyManager.activeItemIndex;
    const isActive =
      activeIndex !== null ? this.autocomplete().options.toArray()[activeIndex] : null;
    const multiple = this.autocomplete().multiple;

    // Handle overlay close keys (Escape, Alt+Up)
    if (this.isKeydownCloseOverlay(event)) {
      this.closeOverlay();
      return;
    }

    // Handle overlay open keys (Arrow keys, Alt+Down)
    if (this.isKeydownOpenOverlay(event)) {
      this.handleFocus();
    }

    // Ctrl+A: Toggle select/deselect all options (multi-select only)
    if (multiple && event.key === 'a' && event.ctrlKey && this.panelOpen()) {
      event.preventDefault();
      this.autocomplete().options.forEach((opt) => {
        opt?.selected ? opt.deselect?.() : opt.select?.();
      });
      return;
    }

    // Enter or Space: Select the active option
    if (isActive && this.panelOpen() && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();

      // Toggle selection
      isActive.selected ? isActive.deselect(true) : isActive.select(true);

      // In single-select mode, close panel and return focus to input
      if (!multiple) {
        keyManager.setActiveItem(isActive);
        this.elementRef.nativeElement.focus();
      }
      return;
    }

    // Delegate all other keyboard events to the key manager
    keyManager.onKeydown(event);
  }

  // ========================================
  // Private Methods - Overlay Management
  // ========================================
  /**
   * Opens the autocomplete overlay panel.
   * Creates the portal if it doesn't exist and attaches it to the overlay.
   */
  private openOverlay(): void {
    const autocomplete = this.autocomplete();

    // Create portal on first open
    if (!this.portal) {
      this.portal = new TemplatePortal(autocomplete.template()!, this.viewContainerRef, {
        id: this.formField?.getLabelId(),
      });
    }

    // Attach portal to overlay
    this.overlayRef.attach(this.portal);
    this.panelOpen.set(true);

    // Update autocomplete state
    (autocomplete as any)['_isOpen'].set(true);

    // Emit opened event
    autocomplete.opened.emit();

    // Auto-activate first option if configured
    if (autocomplete.autoActiveFirstOption()) {
      autocomplete.keyManager.setFirstItemActive();
    }
  }

  /**
   * Closes the autocomplete overlay panel.
   * Detaches the overlay and resets the active item.
   */
  private closeOverlay(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }

    this.panelOpen.set(false);
    this.autocomplete().keyManager.setActiveItem(-1);

    // Update autocomplete state
    (this.autocomplete() as any)['_isOpen'].set(false);

    // Emit closed event
    this.autocomplete().closed.emit();
  }

  /**
   * Returns an observable stream that emits when the panel should close.
   * Combines multiple closing triggers: outside clicks, detachments, keyboard events, etc.
   */
  private panelClosingActions() {
    return merge(
      this.overlayRef.outsidePointerEvents(),
      this.overlayRef.detachments(),
      this.overlayClosingKeydownActions(),
      this.overlayRef.backdropClick(),
      this.autocomplete().keyManager.tabOut,
      this.autocomplete().singleSelectionChange
    );
  }

  /**
   * Filters keydown events to only emit close-triggering keys.
   */
  private overlayClosingKeydownActions() {
    return this.overlayRef
      .keydownEvents()
      .pipe(filter((event) => this.isKeydownCloseOverlay(event)));
  }

  // ========================================
  // Private Methods - Keyboard Helpers
  // ========================================
  /**
   * Determines if a keydown event should close the overlay.
   * @param event - The keyboard event
   * @returns True if the overlay should close
   */
  private isKeydownCloseOverlay(event: KeyboardEvent): boolean {
    return (
      (event.key === 'Escape' && !hasModifierKey(event)) ||
      (event.key === 'ArrowUp' && hasModifierKey(event, 'altKey'))
    );
  }

  /**
   * Determines if a keydown event should open the overlay.
   * @param event - The keyboard event
   * @returns True if the overlay should open
   */
  private isKeydownOpenOverlay(event: KeyboardEvent): boolean {
    return (
      (event.key === 'ArrowDown' && hasModifierKey(event, 'altKey')) ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    );
  }

  // ========================================
  // Private Methods - Configuration
  // ========================================
  /**
   * Constructs the overlay configuration object.
   * Includes position strategy, scroll strategy, dimensions, and styling.
   */
  private getOverlayConfig(): OverlayConfig {
    const autocomplete = this.autocomplete();
    const origin = this.getConnectedOverlayOrigin();

    return new OverlayConfig({
      positionStrategy: this.getOverlayPosition(),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      width: autocomplete.panelWidth() || origin?.nativeElement.offsetWidth,
      hasBackdrop: false,
      panelClass: [this.overlayPanelClass(), ...autocomplete.classList()].filter(Boolean),
    });
  }

  /**
   * Creates and configures the position strategy for the overlay.
   * Uses a flexible connected position strategy with fallback positions.
   */
  private getOverlayPosition(): PositionStrategy {
    const origin = this.getConnectedOverlayOrigin();

    if (!origin) {
      throw new Error('AutoCompleteDirective: Could not find connected overlay origin');
    }

    const strategy = createFlexibleConnectedPositionStrategy(this.injector, origin)
      .withFlexibleDimensions(false)
      .withPush(false)
      .withPositions(this.positions);

    this.positionStrategy = strategy;
    return strategy;
  }

  /**
   * Gets the element reference to use as the overlay origin.
   * Uses the form field's connected overlay origin if available.
   */
  private getConnectedOverlayOrigin(): ElementRef<HTMLElement> | undefined {
    return this.formField?.getConnectedOverlayOrigin();
  }
}
