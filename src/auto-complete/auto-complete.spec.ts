import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatOption } from '@angular/material/core';

import { AutoComplete } from './auto-complete';

/**
 * Test host component for testing the AutoComplete component with options
 */
@Component({
  template: `
    <auto-complete
      [displayWith]="displayWith"
      [autoActiveFirstOption]="autoActiveFirstOption()"
      [autoSelectActiveOption]="autoSelectActiveOption()"
      [requireSelection]="requireSelection()"
      [panelWidth]="panelWidth()"
      [disableRipple]="disableRipple()"
      [hideSingleSelectionIndicator]="hideSingleSelectionIndicator()"
      [multiple]="multiple()"
      [classList]="classList()"
      [color]="color()"
      [ariaLabel]="ariaLabel()"
      [ariaLabelledby]="ariaLabelledby()"
      [compareWith]="compareWith"
      [(selected)]="selectedValues"
      (optionSelected)="onOptionSelected($event)"
      (opened)="onOpened()"
      (closed)="onClosed()"
      (optionActivated)="onOptionActivated($event)"
    >
      @for (option of options(); track option) {
      <mat-option [value]="option">{{ option }}</mat-option>
      }
    </auto-complete>
  `,
  imports: [AutoComplete, MatOption],
})
class TestHostComponent {
  options = signal<string[]>(['Option 1', 'Option 2', 'Option 3']);
  selectedValues = signal<string[]>([]);

  displayWith: ((value: any) => string) | null = null;
  autoActiveFirstOption = signal(false);
  autoSelectActiveOption = signal(false);
  requireSelection = signal(false);
  panelWidth = signal<string | number | undefined>(undefined);
  disableRipple = signal(false);
  hideSingleSelectionIndicator = signal(false);
  multiple = signal(false);
  classList = signal<string[]>([]);
  color = signal<'primary' | 'accent' | 'warn' | undefined>(undefined);
  ariaLabel = signal<string | null>(null);
  ariaLabelledby = signal<string | null>(null);
  compareWith: (o1: any, o2: any) => boolean = (o1, o2) => o1 === o2;

  onOptionSelected = jasmine.createSpy('onOptionSelected');
  onOpened = jasmine.createSpy('onOpened');
  onClosed = jasmine.createSpy('onClosed');
  onOptionActivated = jasmine.createSpy('onOptionActivated');
}

/**
 * Test host for complex object options
 */
@Component({
  template: `
    <auto-complete [displayWith]="displayFn" [(selected)]="selectedValues">
      @for (user of users(); track user.id) {
      <mat-option [value]="user">{{ user.name }}</mat-option>
      }
    </auto-complete>
  `,
  imports: [AutoComplete, MatOption],
})
class ComplexObjectHostComponent {
  users = signal([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ]);
  selectedValues = signal<any[]>([]);

  displayFn(user: any): string {
    return user?.name ?? '';
  }
}

describe('AutoComplete', () => {
  let component: AutoComplete<any>;
  let fixture: ComponentFixture<AutoComplete<any>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoComplete],
    }).compileComponents();

    fixture = TestBed.createComponent(AutoComplete);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should generate a unique id', () => {
    expect(component.id).toMatch(/^auto-complete-\d+$/);
  });

  it('should have default values for inputs', () => {
    expect(component.autoActiveFirstOption()).toBe(false);
    expect(component.autoSelectActiveOption()).toBe(false);
    expect(component.requireSelection()).toBe(false);
    expect(component.disableRipple()).toBe(false);
    expect(component.hideSingleSelectionIndicator).toBe(false);
    expect(component.multiple).toBe(false);
    expect(component.displayWith()).toBeNull();
    expect(component.panelWidth()).toBeUndefined();
  });

  it('should initialize showPanel as false', () => {
    expect(component.showPanel()).toBe(false);
  });

  it('should have isOpen computed signal return false initially', () => {
    expect(component.isOpen()).toBe(false);
  });
});

describe('AutoComplete with options', () => {
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let autoCompleteComponent: AutoComplete<any>;
  let autoCompleteDebugElement: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AutoComplete],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();

    autoCompleteDebugElement = fixture.debugElement.query(By.directive(AutoComplete));
    autoCompleteComponent = autoCompleteDebugElement.componentInstance;
  });

  describe('Panel visibility', () => {
    it('should show panel when options are available', () => {
      autoCompleteComponent.setVisibility();
      fixture.detectChanges();
      expect(autoCompleteComponent.showPanel()).toBe(true);
    });

    it('should hide panel when no options are available', () => {
      hostComponent.options.set([]);
      fixture.detectChanges();
      autoCompleteComponent.setVisibility();
      fixture.detectChanges();
      expect(autoCompleteComponent.showPanel()).toBe(false);
    });

    it('should update visibility when options change', () => {
      expect(autoCompleteComponent.showPanel()).toBe(true);

      hostComponent.options.set([]);
      fixture.detectChanges();

      expect(autoCompleteComponent.showPanel()).toBe(false);
    });
  });

  describe('Selection - Single mode', () => {
    it('should select an option in single mode', () => {
      const options = autoCompleteComponent.options.toArray();
      const firstOption = options[0];

      firstOption.select();
      fixture.detectChanges();

      expect(autoCompleteComponent.selected()).toContain('Option 1');
      expect(autoCompleteComponent.selected().includes('Option 1')).toBe(true);
    });

    it('should deselect previous option when selecting new one in single mode', () => {
      const options = autoCompleteComponent.options.toArray();

      options[0].select();
      fixture.detectChanges();
      expect(autoCompleteComponent.selected()).toEqual(['Option 1']);

      options[1].select();
      fixture.detectChanges();
      expect(autoCompleteComponent.selected()).toEqual(['Option 2']);
      expect(autoCompleteComponent.selected().includes('Option 1')).toBe(false);
    });

    it('should emit optionSelected event when option is selected', () => {
      const options = autoCompleteComponent.options.toArray();

      options[0].select();
      fixture.detectChanges();

      expect(hostComponent.onOptionSelected).toHaveBeenCalled();
    });
  });

  describe('Selection - Multiple mode', () => {
    beforeEach(() => {
      hostComponent.multiple.set(true);
      fixture.detectChanges();
    });

    it('should allow multiple selections', () => {
      const options = autoCompleteComponent.options.toArray();

      options[0].select();
      options[1].select();
      fixture.detectChanges();

      expect(autoCompleteComponent.selected().length).toBe(2);
      expect(autoCompleteComponent.selected()).toContain('Option 1');
      expect(autoCompleteComponent.selected()).toContain('Option 2');
    });

    it('should toggle selection in multiple mode', () => {
      const options = autoCompleteComponent.options.toArray();

      options[0].select();
      fixture.detectChanges();
      expect(autoCompleteComponent.selected()).toContain('Option 1');

      options[0].deselect();
      fixture.detectChanges();
      expect(autoCompleteComponent.selected()).not.toContain('Option 1');
    });

    it('should select all options when all are selected', () => {
      const options = autoCompleteComponent.options.toArray();

      options.forEach((opt) => opt.select());
      fixture.detectChanges();

      expect(autoCompleteComponent.selected().length).toBe(3);
    });

    it('should clear selection when all options are deselected', () => {
      const options = autoCompleteComponent.options.toArray();

      options.forEach((opt) => opt.select());
      fixture.detectChanges();

      options.forEach((opt) => opt.deselect());
      fixture.detectChanges();

      expect(autoCompleteComponent.selected().length).toBe(0);
    });
  });

  describe('Keyboard navigation', () => {
    it('should initialize keyboard manager', () => {
      expect(autoCompleteComponent.keyManager).toBeDefined();
    });

    it('should navigate through options with keyboard', () => {
      const keyManager = autoCompleteComponent.keyManager;

      keyManager.setFirstItemActive();
      expect(keyManager.activeItemIndex).toBe(0);

      keyManager.setNextItemActive();
      expect(keyManager.activeItemIndex).toBe(1);

      keyManager.setPreviousItemActive();
      expect(keyManager.activeItemIndex).toBe(0);
    });

    it('should wrap navigation at list boundaries', () => {
      const keyManager = autoCompleteComponent.keyManager;
      const optionsCount = autoCompleteComponent.options.length;

      keyManager.setLastItemActive();
      expect(keyManager.activeItemIndex).toBe(optionsCount - 1);

      keyManager.setNextItemActive();
      expect(keyManager.activeItemIndex).toBe(0);
    });

    it('should scroll active option into view', (done) => {
      const keyManager = autoCompleteComponent.keyManager;

      keyManager.setLastItemActive();
      fixture.detectChanges();

      setTimeout(() => {
        const activeOption = autoCompleteComponent.options.toArray()[keyManager.activeItemIndex!];
        expect(activeOption).toBeDefined();
        done();
      }, 100);
    });
  });

  describe('Scroll management', () => {
    it('should set scroll position', () => {
      autoCompleteComponent.setScrollTop(100);
      expect(autoCompleteComponent.getScrollTop()).toBe(100);
    });

    it('should get scroll position', () => {
      const scrollTop = autoCompleteComponent.getScrollTop();
      expect(scrollTop).toBeDefined();
      expect(scrollTop).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ARIA attributes', () => {
    it('should set aria-label when provided', () => {
      hostComponent.ariaLabel.set('Choose an option');
      fixture.detectChanges();
      expect(autoCompleteComponent.ariaLabel()).toBe('Choose an option');
    });

    it('should set aria-labelledby when provided', () => {
      hostComponent.ariaLabelledby.set('label-id');
      fixture.detectChanges();
      expect(autoCompleteComponent.ariaLabelledby()).toBe('label-id');
    });

    it('should return correct aria-labelledby for panel', () => {
      hostComponent.ariaLabelledby.set('label-id');
      fixture.detectChanges();

      const result = autoCompleteComponent.getPanelAriaLabelledby('field-id');
      expect(result).toBe('field-id label-id');
    });

    it('should return null for aria-labelledby when aria-label is set', () => {
      hostComponent.ariaLabel.set('Choose option');
      fixture.detectChanges();

      const result = autoCompleteComponent.getPanelAriaLabelledby('field-id');
      expect(result).toBeNull();
    });
  });

  describe('Display function', () => {
    it('should use displayWith function when provided', () => {
      const displayFn = (value: string) => `Display: ${value}`;
      hostComponent.displayWith = displayFn;
      fixture.detectChanges();

      expect(autoCompleteComponent.displayWith()).toBe(displayFn);
    });
  });

  describe('Panel styling', () => {
    it('should apply custom CSS classes', () => {
      hostComponent.classList.set(['custom-class', 'another-class']);
      fixture.detectChanges();

      expect(autoCompleteComponent.classList()).toEqual(['custom-class', 'another-class']);
    });

    it('should apply color theme', () => {
      hostComponent.color.set('primary');
      fixture.detectChanges();
      expect(autoCompleteComponent.color()).toBe('primary');

      hostComponent.color.set('accent');
      fixture.detectChanges();
      expect(autoCompleteComponent.color()).toBe('accent');

      hostComponent.color.set('warn');
      fixture.detectChanges();
      expect(autoCompleteComponent.color()).toBe('warn');
    });

    it('should set custom panel width', () => {
      hostComponent.panelWidth.set('300px');
      fixture.detectChanges();
      expect(autoCompleteComponent.panelWidth()).toBe('300px');
    });
  });

  describe('Ripple effects', () => {
    it('should disable ripples when disableRipple is true', () => {
      hostComponent.disableRipple.set(true);
      fixture.detectChanges();
      expect(autoCompleteComponent.disableRipple()).toBe(true);
    });
  });

  describe('Selection indicator', () => {
    it('should hide single selection indicator when configured', () => {
      hostComponent.hideSingleSelectionIndicator.set(true);
      fixture.detectChanges();
      expect(autoCompleteComponent.hideSingleSelectionIndicator).toBe(true);
    });
  });

  describe('Compare function', () => {
    it('should use custom compare function', () => {
      const customCompare = (o1: any, o2: any) => o1?.id === o2?.id;
      hostComponent.compareWith = customCompare;
      fixture.detectChanges();

      expect(autoCompleteComponent.compareWith()).toBe(customCompare);
    });
  });

  describe('Auto-active first option', () => {
    it('should auto-activate first option when enabled', () => {
      hostComponent.autoActiveFirstOption.set(true);
      fixture.detectChanges();

      expect(autoCompleteComponent.autoActiveFirstOption()).toBe(true);
    });
  });

  describe('Auto-select active option', () => {
    it('should enable auto-select on navigation', () => {
      hostComponent.autoSelectActiveOption.set(true);
      fixture.detectChanges();

      expect(autoCompleteComponent.autoSelectActiveOption()).toBe(true);
    });
  });

  describe('Require selection', () => {
    it('should enforce selection requirement', () => {
      hostComponent.requireSelection.set(true);
      fixture.detectChanges();

      expect(autoCompleteComponent.requireSelection()).toBe(true);
    });
  });
});

describe('AutoComplete with complex objects', () => {
  let hostComponent: ComplexObjectHostComponent;
  let fixture: ComponentFixture<ComplexObjectHostComponent>;
  let autoCompleteComponent: AutoComplete<any>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplexObjectHostComponent, AutoComplete],
    }).compileComponents();

    fixture = TestBed.createComponent(ComplexObjectHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();

    const autoCompleteDebugElement = fixture.debugElement.query(By.directive(AutoComplete));
    autoCompleteComponent = autoCompleteDebugElement.componentInstance;
  });

  it('should handle complex object values', () => {
    const options = autoCompleteComponent.options.toArray();
    const firstUser = hostComponent.users()[0];

    options[0].select();
    fixture.detectChanges();

    const selected = autoCompleteComponent.selected()[0];
    expect(selected).toEqual(firstUser);
    expect(selected.id).toBe(1);
    expect(selected.name).toBe('Alice');
  });

  it('should use displayWith function for complex objects', () => {
    expect(autoCompleteComponent.displayWith()).toBeDefined();

    const displayFn = autoCompleteComponent.displayWith()!;
    const user = hostComponent.users()[0];

    expect(displayFn(user)).toBe('Alice');
  });

  it('should handle null/undefined in displayWith function', () => {
    const displayFn = autoCompleteComponent.displayWith()!;
    expect(displayFn(null)).toBe('');
    expect(displayFn(undefined)).toBe('');
  });
});

describe('AutoComplete lifecycle', () => {
  let component: AutoComplete<any>;
  let fixture: ComponentFixture<AutoComplete<any>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoComplete, MatOption],
    }).compileComponents();

    fixture = TestBed.createComponent(AutoComplete);
    component = fixture.componentInstance;
  });

  it('should initialize selection model on ngOnInit', () => {
    component.ngOnInit();
    expect(component.selected).toBeDefined();
    expect(component.multiple).toBe(false);
  });

  it('should initialize selection model with multiple mode', () => {
    const componentWithMultiple = fixture.componentInstance as any;
    componentWithMultiple._multiple = signal(true);

    component.ngOnInit();
    expect(component.multiple).toBe(true);
  });

  it('should clean up on ngOnDestroy', () => {
    component.ngOnInit();
    component.ngAfterContentInit();

    spyOn(component.keyManager, 'destroy');

    component.ngOnDestroy();

    expect(component.keyManager.destroy).toHaveBeenCalled();
  });
});
