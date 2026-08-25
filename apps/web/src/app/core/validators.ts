import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Mirrors the backend password rules in createUserSchema:
 * min 8 chars, >=1 uppercase, >=1 lowercase, >=1 number, >=1 special char.
 * Returns a `passwordStrength` error object with per-rule booleans so the UI
 * can render a live checklist.
 */
export function passwordStrengthValidator(
  control: AbstractControl
): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null;

  const rules = {
    minLength: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^a-zA-Z0-9]/.test(value),
  };

  const passed = Object.values(rules).every(Boolean);
  return passed ? null : { passwordStrength: rules };
}

export interface PasswordRules {
  minLength: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
}
