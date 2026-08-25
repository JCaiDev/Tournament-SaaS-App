import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { UpdateUserRequest } from '../../models/user';
import {
  PasswordRules,
  passwordStrengthValidator,
} from '../../core/validators';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly initial = computed(() =>
    (this.user()?.name ?? '?').charAt(0).toUpperCase()
  );

  readonly showPassword = signal(false);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly saved = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    birthDate: [''],
    password: ['', [passwordStrengthValidator]],
  });

  get passwordRules(): PasswordRules | null {
    return (
      (this.form.controls.password.errors?.['passwordStrength'] as PasswordRules) ??
      null
    );
  }

  startEdit(): void {
    const u = this.user();
    if (!u) return;
    this.saved.set(false);
    this.serverError.set(null);
    this.form.reset({
      name: u.name,
      email: u.email,
      birthDate: u.birthDate ? u.birthDate.slice(0, 10) : '',
      password: '',
    });
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  save(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateUserRequest = {
      name: raw.name,
      email: raw.email,
    };
    if (raw.birthDate) payload.birthDate = raw.birthDate;
    if (raw.password) payload.password = raw.password;

    this.saving.set(true);
    this.auth.updateMe(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.saved.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.serverError.set(
          err.status === 409
            ? 'That email is already taken.'
            : 'Could not save changes. Please try again.'
        );
      },
    });
  }

  deleteAccount(): void {
    this.deleting.set(true);
    this.auth.deleteMe().subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigate(['/']);
      },
      error: () => {
        this.deleting.set(false);
        this.serverError.set('Could not delete your account. Please try again.');
      },
    });
  }
}
