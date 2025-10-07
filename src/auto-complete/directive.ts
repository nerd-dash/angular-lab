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
import {
  AfterViewInit,
  ChangeDetectorRef,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  InjectionToken,
  Injector,
  input,
  OnDestroy,
  OnInit,
  signal,
  ViewContainerRef,
} from '@angular/core';
import { MAT_FORM_FIELD } from '@angular/material/form-field';
import { MatFormField } from '@angular/material/select';
import { filter, merge, Subscription } from 'rxjs';
import { AutoComplete } from './auto-complete';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
export class AutoCompleteDirective<T> implements OnInit, OnDestroy, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private formField = inject<MatFormField | null>(MAT_FORM_FIELD, { optional: true, host: true });
  private viewContainerRef = inject(ViewContainerRef);
  private injector = inject(Injector);
  private overlay = inject(Overlay);

  private portal!: TemplatePortal;

  autocompleteDisabled = false;
  private panelOpen = signal(false);

  /** Strategy that is used to position the panel. */
  private positionStrategy: FlexibleConnectedPositionStrategy = null!;
  private positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
  ];

  protected overlayRef!: OverlayRef;
  private overlayPanelClass = signal('auto-complete-panel');

  readonly autocomplete = input.required<AutoComplete<T>>();
  readonly multiple = input(false, { transform: coerceBooleanProperty });

  ngOnInit() {
    if (this.multiple()) {
      this.autocomplete().multiple = true;
    }
  }

  ngAfterViewInit() {
    this.overlayRef = this.overlay.create(this.getOverlayConfig());

    this.panelClosingActions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        /* Prevent closing a non attached overlay */
        if (!this.overlayRef.hasAttached()) return;

        const clickTarget = (event as Event)?.target as HTMLElement;
        const inputElement = this.elementRef.nativeElement;

        /* Prevent closing the overlay when clicking inside the input */
        if (clickTarget === inputElement) return;

        this.closeOverlay();
      });
  }

  ngOnDestroy() {
    this.overlayRef.dispose();
  }

  handleFocus() {
    if (this.overlayRef.hasAttached()) return;
    this.openOverlay();
  }

  handleFocusOut() {
    this.overlayRef.hasAttached() && this.closeOverlay();
  }

  openOverlay() {
    if (!this.portal) {
      this.portal = new TemplatePortal(this.autocomplete().template()!, this.viewContainerRef, {
        id: this.formField?.getLabelId(),
      });
    }
    this.overlayRef.attach(this.portal);
    this.panelOpen.set(true);
  }

  closeOverlay() {
    this.overlayRef?.detach();
    this.panelOpen.set(false);
    this.autocomplete().keyManager.setActiveItem(-1);
  }

  /* Stream that emits when a pointer event or a keyboard event outside the overlay is detected. */
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

  private overlayClosingKeydownActions() {
    return this.overlayRef
      .keydownEvents()
      .pipe(filter((event) => this.isKeydownCloseOverlay(event)));
  }

  protected handleKeydown(event: KeyboardEvent) {
    const keyManager = this.autocomplete().keyManager;
    const isActive = this.autocomplete().options.toArray().at(keyManager.activeItemIndex!);
    const multiple = this.autocomplete().multiple;

    if (this.isKeydownCloseOverlay(event)) {
      this.closeOverlay();
    } else if (this.isKeydownOpenOverlay(event)) {
      this.handleFocus();
    }
    // Ctrl+A: Toggle select all options
    if (multiple && event.key === 'a' && event.ctrlKey && this.panelOpen()) {
      event.preventDefault();

      this.autocomplete().options.forEach((opt) => {
        opt?.selected ? opt.deselect?.() : opt.select?.();
      });
    }
    if (isActive && this.panelOpen() && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); // Prevent input from handling the key
      // Select the active option
      isActive.selected ? isActive.deselect(true) : isActive.select(true);
      // Optionally close overlay if desired
      // this.closeOverlay();
      if (!multiple) {
        keyManager.setActiveItem(isActive);
        this.elementRef.nativeElement.focus();
      }

      return;
    }

    keyManager.onKeydown(event);
  }

  private isKeydownCloseOverlay = (event: KeyboardEvent) => {
    return (
      (event.key === 'Escape' && !hasModifierKey(event)) ||
      (event.key === 'ArrowUp' && hasModifierKey(event, 'altKey'))
    );
  };

  private isKeydownOpenOverlay = (event: KeyboardEvent) => {
    return (
      (event.key === 'ArrowDown' && hasModifierKey(event, 'altKey')) ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    );
  };

  private getOverlayConfig(): OverlayConfig {
    return new OverlayConfig({
      positionStrategy: this.getOverlayPosition(),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      width: this.getConnectedOverlayOrigin()?.nativeElement.offsetWidth,
      hasBackdrop: false,
      panelClass: this.overlayPanelClass(),
    });
  }

  private getOverlayPosition(): PositionStrategy {
    // Set default Overlay Position
    const strategy = createFlexibleConnectedPositionStrategy(
      this.injector,
      this.getConnectedOverlayOrigin()!
    )
      .withFlexibleDimensions(false)
      .withPush(false);

    strategy.withPositions(this.positions);
    this.positionStrategy = strategy;
    return this.positionStrategy;
  }

  private getConnectedOverlayOrigin() {
    return this.formField?.getConnectedOverlayOrigin();
  }
}
