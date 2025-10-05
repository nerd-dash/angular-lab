import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { hasModifierKey } from '@angular/cdk/keycodes';
import {
  ConnectedPosition,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
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
import { MatFormField, MatOption } from '@angular/material/select';
import { filter, merge, Subscription } from 'rxjs';
import { AutoComplete } from './auto-complete';
import { ActiveDescendantKeyManager } from '@angular/cdk/a11y';

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
  private outsideClickSub: Subscription | null = null;
  private overlayPanelClass = signal('auto-complete-panel');

  readonly autocomplete = input.required<AutoComplete<T>>();
  readonly multiple = input(false, { transform: coerceBooleanProperty });

  ngOnInit() {
    this.autocomplete().multiple = this.multiple();
  }

  ngAfterViewInit() {
    this.overlayRef = this.overlay.create(this.getOverlayConfig());

    this.outsideClickSub = this.panelClosingActions().subscribe((event) => {
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
    if (this.outsideClickSub) {
      this.outsideClickSub.unsubscribe();
      this.outsideClickSub = null;
    }

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
  }

  /* Stream that emits when a pointer event or a keyboard event outside the overlay is detected. */
  private panelClosingActions() {
    return merge(
      this.overlayRef.outsidePointerEvents(),
      this.overlayRef.detachments(),
      this.overlayClosingKeydownActions(),
      this.overlayRef.backdropClick(),
      this.autocomplete().keyManager().tabOut
    );
  }

  private overlayClosingKeydownActions() {
    const keyManager = this.autocomplete().keyManager();
    return this.overlayRef
      .keydownEvents()
      .pipe(filter((event) => this.isKeydownCloseOverlay(event, keyManager)));
  }

  protected handleKeydown(event: KeyboardEvent) {
    const keyManager = this.autocomplete().keyManager();
    const isActive = keyManager?.activeItem;

    if (this.isKeydownCloseOverlay(event, keyManager)) {
      this.closeOverlay();
    } else if (this.isKeydownOpenOverlay(event)) {
      this.handleFocus();
    } else if (this.isKeyToRemoveFocusFromOverlay(event, keyManager)) {
      event.preventDefault(); // Prevent input from handling the key
      keyManager.setActiveItem(-1);
      return;
    }

    if (isActive && this.panelOpen() && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); // Prevent input from handling the key
      // Select the active option
      isActive.selected ? isActive.deselect?.() : isActive.select?.();
      // Optionally close overlay if desired
      // this.closeOverlay();
      return;
    }

    keyManager.onKeydown(event);
  }

  private isKeydownCloseOverlay = (
    event: KeyboardEvent,
    keyManager: ActiveDescendantKeyManager<MatOption>
  ) => {
    return (
      (event.key === 'Escape' && !hasModifierKey(event) && !keyManager.activeItem) ||
      (event.key === 'ArrowUp' && hasModifierKey(event, 'altKey'))
    );
  };
  private isKeyToRemoveFocusFromOverlay = (
    event: KeyboardEvent,
    keyManager: ActiveDescendantKeyManager<MatOption>
  ) => event.key === 'Escape' && !hasModifierKey(event) && keyManager.activeItem;

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
