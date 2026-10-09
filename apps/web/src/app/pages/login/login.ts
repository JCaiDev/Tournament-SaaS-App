import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ORGANIZER_ROLES } from '../../models/lobby';
import { PrivateUser } from '../../models/user';
import { GoogleAuthService } from '../../services/google-auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
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

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

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
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        this.goToLanding(user);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 401) {
          this.serverError.set(
            'Incorrect email or password. If you signed up with Google, use Sign in with Google.'
          );
        } else {
          this.serverError.set('Something went wrong. Please try again later.');
        }
      },
    });
  }

  private onGoogle(idToken: string): void {
    this.googleError.set(null);
    this.auth.googleLogin(idToken).subscribe({
      next: (user) => this.goToLanding(user),
      error: () => this.googleError.set('Google sign-in failed. Try again.'),
    });
  }

  // Organizers start at "what are you running?"; everyone else at the lobby list.
  private goToLanding(user: PrivateUser): void {
    this.router.navigate([ORGANIZER_ROLES.includes(user.role) ? '/lobbies/new' : '/']);
  }
}
