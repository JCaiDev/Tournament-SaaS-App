import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import {
  PasswordRules,
  passwordStrengthValidator,
} from '../../core/validators';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly google = inject(GoogleAuthService);
  private readonly router = inject(Router);

  @ViewChild('googleBtn') set googleBtn(el: ElementRef<HTMLElement> | undefined) {
    if (el) {
      this.google
        .renderButton(el.nativeElement, (idToken) => this.onGoogle(idToken))
        .catch(() => this.googleError.set('Google Sign-In could not load.'));
    }
  }

  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly googleError = signal<string | null>(null);
  readonly success = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    email: ['', [Validators.required, Validators.email]],
    birthDate: ['', [Validators.required]],
    password: ['', [Validators.required, passwordStrengthValidator]],
  });

  get passwordRules(): PasswordRules | null {
    const errors = this.form.controls.password.errors;
    return (errors?.['passwordStrength'] as PasswordRules) ?? null;
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth.signup(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 409) {
          this.serverError.set(
            'That email is already registered. Try logging in instead.'
          );
        } else if (err.status === 400) {
          this.serverError.set('Please check your details and try again.');
        } else {
          this.serverError.set('Something went wrong. Please try again later.');
        }
      },
    });
  }

  private onGoogle(idToken: string): void {
    this.googleError.set(null);
    this.auth.googleLogin(idToken).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.googleError.set('Google sign-in failed. Try again.'),
    });
  }
}
