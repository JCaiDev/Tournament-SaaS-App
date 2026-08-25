import { Component, computed, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface TimeOption {
  value: string; // "HH:mm"
  label: string; // "7:30 PM"
}

// Every 15 minutes across the day — clean, predictable slots for a drop-in.
const BASE_TIME_OPTIONS: TimeOption[] = buildTimeOptions();

@Component({
  selector: 'app-datetime-picker',
  templateUrl: './datetime-picker.html',
  styleUrl: './datetime-picker.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatetimePicker),
      multi: true,
    },
  ],
})
export class DatetimePicker implements ControlValueAccessor {
  readonly date = signal('');
  readonly time = signal('');
  readonly disabled = signal(false);

  // Keep any prefilled off-grid time (e.g. 7:11 PM) selectable.
  readonly timeOptions = computed<TimeOption[]>(() => {
    const t = this.time();
    if (t && !BASE_TIME_OPTIONS.some((o) => o.value === t)) {
      return [{ value: t, label: formatTime(t) }, ...BASE_TIME_OPTIONS].sort((a, b) =>
        a.value.localeCompare(b.value),
      );
    }
    return BASE_TIME_OPTIONS;
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    if (value && value.includes('T')) {
      const [d, t] = value.split('T');
      this.date.set(d);
      this.time.set((t ?? '').slice(0, 5));
    } else {
      this.date.set('');
      this.time.set('');
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onDateInput(value: string): void {
    this.date.set(value);
    this.emit();
  }

  onTimeInput(value: string): void {
    this.time.set(value);
    this.emit();
  }

  markTouched(): void {
    this.onTouched();
  }

  private emit(): void {
    const d = this.date();
    const t = this.time();
    // Only surface a value once both halves are chosen; otherwise stay empty so `required` still trips.
    this.onChange(d && t ? `${d}T${t}` : '');
  }
}

function buildTimeOptions(): TimeOption[] {
  const opts: TimeOption[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const value = minutesToValue(minutes);
    opts.push({ value, label: formatTime(value) });
  }
  return opts;
}

function minutesToValue(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${pad(hh)}:${pad(mm)}`;
}

function formatTime(value: string): string {
  const [hhRaw, mmRaw] = value.split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  const period = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${pad(mm)} ${period}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
