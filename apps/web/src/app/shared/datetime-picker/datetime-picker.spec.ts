import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatetimePicker } from './datetime-picker';

describe('DatetimePicker time dropdown', () => {
  let fixture: ComponentFixture<DatetimePicker>;
  let picker: DatetimePicker;
  let changes: string[];

  beforeEach(() => {
    fixture = TestBed.createComponent(DatetimePicker);
    picker = fixture.componentInstance;
    changes = [];
    picker.registerOnChange((value) => changes.push(value));
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.dt-trigger');
  }

  function list(): HTMLUListElement | null {
    return fixture.nativeElement.querySelector('.dt-list');
  }

  function openList(): HTMLUListElement {
    trigger().click();
    fixture.detectChanges();
    return list()!;
  }

  function press(key: string): void {
    list()!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  function firstVisibleRow(ul: HTMLUListElement): string {
    const rows = Array.from(ul.children) as HTMLElement[];
    return rows.find((row) => row.offsetTop >= ul.scrollTop)!.textContent!.trim();
  }

  it('opens scrolled to 5:00 PM when empty', () => {
    const ul = openList();

    expect(firstVisibleRow(ul)).toBe('5:00 PM');
    expect(ul.querySelector('.dt-option-active')!.textContent!.trim()).toBe('5:00 PM');
  });

  it('opens scrolled to the selected time', () => {
    picker.writeValue('2026-10-01T19:30');
    fixture.detectChanges();

    expect(firstVisibleRow(openList())).toBe('7:30 PM');
  });

  it('shows about 8 rows at a time', () => {
    const ul = openList();
    const rowHeight = (ul.children[0] as HTMLElement).offsetHeight;

    expect(Math.round(ul.clientHeight / rowHeight)).toBe(8);
  });

  it('picks a time with the arrow keys and Enter', () => {
    picker.writeValue('2026-10-01T'); // date chosen, time still empty
    fixture.detectChanges();
    openList();

    press('ArrowDown'); // 5:00 PM -> 5:15 PM
    press('Enter');

    expect(list()).toBeNull();
    expect(changes.at(-1)).toBe('2026-10-01T17:15');
    expect(trigger().textContent!.trim()).toBe('5:15 PM');
  });

  it('closes on Escape without changing the value', () => {
    openList();
    press('ArrowDown');
    press('Escape');

    expect(list()).toBeNull();
    expect(changes).toEqual([]);
  });
});
