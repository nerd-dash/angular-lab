import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutoComplete } from './auto-complete';

describe('AutoComplete', () => {
  let component: AutoComplete;
  let fixture: ComponentFixture<AutoComplete>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AutoComplete]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AutoComplete);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
