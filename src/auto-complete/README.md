# AutoComplete Component

A highly customizable, signal-based autocomplete dropdown for Angular v20+.

## Features

- **Signal-based API**: Uses Angular v20+ `input()`, `output()`, `model()`, and `computed()` APIs
- **Single & Multi-Select**: Support for both selection modes with proper state management
- **Keyboard Navigation**: Full keyboard support with ActiveDescendantKeyManager
- **ARIA Accessibility**: Comprehensive ARIA attributes for screen readers
- **Angular Material Integration**: Compatible with MatOption and MatOptgroup
- **Reactive State**: Leverages signals for efficient change detection
- **Global Configuration**: Configure defaults via dependency injection

## Basic Usage

### Single Selection

```html
<auto-complete [ariaLabel]="'Choose an option'">
  <mat-option *ngFor="let option of options" [value]="option"> {{ option.label }} </mat-option>
</auto-complete>
```

### Multiple Selection

```html
<auto-complete [multiple]="true" [(selected)]="selectedValues">
  <mat-option *ngFor="let option of options" [value]="option.id"> {{ option.name }} </mat-option>
</auto-complete>
```

### With Display Function

```html
<auto-complete [displayWith]="displayFn" [autoActiveFirstOption]="true">
  <mat-option *ngFor="let user of users" [value]="user"> {{ user.name }} </mat-option>
</auto-complete>
```

```typescript
export class MyComponent {
  users: User[] = [...];

  displayFn(value: User): string {
    return value?.name ?? '';
  }
}
```

## Global Configuration

You can configure default options globally using Angular's dependency injection system. This allows you to set application-wide defaults for the autocomplete behavior.

### Configure in `app.config.ts`

```typescript
import { ApplicationConfig } from '@angular/core';
import { MAT_AUTOCOMPLETE_DEFAULT_OPTIONS } from '@angular/material/autocomplete';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    {
      provide: MAT_AUTOCOMPLETE_DEFAULT_OPTIONS,
      useValue: {
        autoActiveFirstOption: true,
        autoSelectActiveOption: false,
        hideSingleSelectionIndicator: false,
        requireSelection: false,
        hasBackdrop: false,
        overlayPanelClass: 'custom-autocomplete-panel',
      },
    },
  ],
};
```

### Configure in Module (if using NgModules)

```typescript
import { NgModule } from '@angular/core';
import { MAT_AUTOCOMPLETE_DEFAULT_OPTIONS } from '@angular/material/autocomplete';

@NgModule({
  // ...
  providers: [
    {
      provide: MAT_AUTOCOMPLETE_DEFAULT_OPTIONS,
      useValue: {
        autoActiveFirstOption: true,
        requireSelection: true,
        hideSingleSelectionIndicator: true,
      },
    },
  ],
})
export class AppModule {}
```

### Configuration Options

| Option                         | Type                 | Default | Description                                                          |
| ------------------------------ | -------------------- | ------- | -------------------------------------------------------------------- |
| `autoActiveFirstOption`        | `boolean`            | `false` | Whether the first option should be highlighted when the panel opens  |
| `autoSelectActiveOption`       | `boolean`            | `false` | Whether the active option should be selected as the user navigates   |
| `requireSelection`             | `boolean`            | `false` | Whether the user is required to make a selection                     |
| `hideSingleSelectionIndicator` | `boolean`            | `false` | Whether checkmark indicators are hidden for single-selection options |
| `hasBackdrop`                  | `boolean`            | `false` | Whether the autocomplete has a backdrop                              |
| `overlayPanelClass`            | `string \| string[]` | -       | Class or list of classes to apply to the overlay panel               |

## API Reference

### Inputs

| Input                          | Type                              | Default                | Description                                      |
| ------------------------------ | --------------------------------- | ---------------------- | ------------------------------------------------ |
| `displayWith`                  | `(value: T) => string \| null`    | `null`                 | Function to map option values to display strings |
| `autoActiveFirstOption`        | `boolean`                         | `false`                | Auto-highlight first option on open              |
| `autoSelectActiveOption`       | `boolean`                         | `false`                | Auto-select option during navigation             |
| `requireSelection`             | `boolean`                         | `false`                | Force user to select from options                |
| `panelWidth`                   | `string \| number`                | -                      | Custom panel width                               |
| `disableRipple`                | `boolean`                         | `false`                | Disable Material ripple effects                  |
| `hideSingleSelectionIndicator` | `boolean`                         | `false`                | Hide checkmarks in single-select mode            |
| `multiple`                     | `boolean`                         | `false`                | Enable multiple selection mode                   |
| `classList`                    | `string[]`                        | `[]`                   | CSS classes to apply to panel                    |
| `color`                        | `'primary' \| 'accent' \| 'warn'` | -                      | Material Design theme color                      |
| `ariaLabel`                    | `string`                          | -                      | ARIA label for accessibility                     |
| `ariaLabelledby`               | `string`                          | -                      | ARIA labelledby attribute                        |
| `compareWith`                  | `(o1: T, o2: T) => boolean`       | `(o1, o2) => o1 == o2` | Function to compare option values                |

### Outputs

| Output            | Type                         | Description                                  |
| ----------------- | ---------------------------- | -------------------------------------------- |
| `optionSelected`  | `AutoCompleteSelectedEvent`  | Emits when an option is selected             |
| `opened`          | `void`                       | Emits when the panel opens                   |
| `closed`          | `void`                       | Emits when the panel closes                  |
| `optionActivated` | `AutoCompleteActivatedEvent` | Emits when an option is focused via keyboard |

### Two-way Binding

| Property   | Type  | Description                                      |
| ---------- | ----- | ------------------------------------------------ |
| `selected` | `T[]` | Selected option values (use with `[(selected)]`) |

## Advanced Examples

### Require Selection with Global Config

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: MAT_AUTOCOMPLETE_DEFAULT_OPTIONS,
      useValue: {
        requireSelection: true,
        autoActiveFirstOption: true,
      },
    },
  ],
};
```

```html
<!-- This autocomplete will inherit the global config -->
<auto-complete [ariaLabel]="'Select a country'">
  <mat-option *ngFor="let country of countries" [value]="country"> {{ country.name }} </mat-option>
</auto-complete>
```

### Override Global Defaults

```html
<!-- Override global config for this specific instance -->
<auto-complete
  [requireSelection]="false"
  [autoActiveFirstOption]="false"
  [ariaLabel]="'Optional selection'"
>
  <mat-option *ngFor="let option of options" [value]="option"> {{ option }} </mat-option>
</auto-complete>
```

## Accessibility

The autocomplete component implements ARIA best practices:

- Uses `role="combobox"` on the trigger input
- Provides `aria-autocomplete="list"`
- Uses `aria-activedescendant` for active option tracking
- Supports keyboard navigation (Arrow keys, Enter, Space, Escape)
- Announces option selection to screen readers

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
