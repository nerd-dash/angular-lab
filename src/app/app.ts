import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatOption } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AutoComplete } from '../auto-complete/auto-complete';
import { AutoCompleteDirective } from '../auto-complete/directive';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { interval, map } from 'rxjs';
import { AsyncPipe, JsonPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatOption,
    AutoComplete,
    AutoCompleteDirective,
    FormsModule,
    MatAutocompleteModule,
    JsonPipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true,
})
export class App {
  protected readonly value = signal(['Sushi']);
  // Observable that emits 3 random foods every 3 seconds
  readonly randomFoods = toSignal(
    interval(3000).pipe(
      map(() => {
        const foods = [
          'Pizza',
          'Pasta',
          'Sushi',
          'Burger',
          'Salad',
          'Tacos',
          'Ramen',
          'Steak',
          'Falafel',
        ];
        return foods;
        // .map((f) => ({ f, sort: Math.random() }))
        // .sort((a, b) => a.sort - b.sort)
        // .slice(0, 3)
        // .map((x) => x.f);
      })
    )
  );
}
