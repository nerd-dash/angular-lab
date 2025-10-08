import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatOption } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AutoComplete } from '../auto-complete/auto-complete';
import { AutoCompleteDirective } from '../auto-complete/directive';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { EMPTY, interval, map } from 'rxjs';
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
    JsonPipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  // Observable that emits 3 random foods every 3 seconds
  readonly randomFoods = signal([
    'Pizza',
    'Pasta',
    'Sushi',
    'Burger',
    'Salad',
    'Tacos',
    // 'Ramen',
    // 'Steak',
    // 'Falafel',
    // 'Curry',
    // 'Dumplings',
    // 'Paella',
    // 'Biryani',
    // 'Gnocchi',
    // 'Bruschetta',
    // 'Gelato',
    // 'Tiramisu',
  ]);

  ngOnInit(): void {}

  _randomFood = toSignal(interval(3000).pipe(map(() => this.getRandomFoods(3))), {
    initialValue: this.randomFoods(),
  });

  private getRandomFoods(count: number): string[] {
    const shuffled = this.randomFoods().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  trackFn(item: string) {
    return item.toLowerCase();
  }
}
