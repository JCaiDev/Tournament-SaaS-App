import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  PrivateUser,
  SignupRequest,
  SignupResponse,
  UpdateUserRequest,
} from '../models/user';

const TOKEN_KEY = 'vb_access_token';
const USER_KEY = 'vb_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** The signed-in user, or null. Reactive — components read it as a signal. */
  readonly currentUser = signal<PrivateUser | null>(this.readStoredUser());
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** POST /users — create an account. Does NOT log the user in (no token returned). */
  signup(data: SignupRequest): Observable<PrivateUser> {
    return this.http
      .post<SignupResponse>(`${this.base}/users`, data)
      .pipe(map((res) => res.user));
  }

  /** POST /auth/google — exchange a Google id_token for our JWT + user. */
  googleLogin(idToken: string): Observable<PrivateUser> {
    return this.http
      .post<AuthResponse>(`${this.base}/auth/google`, { idToken })
      .pipe(
        tap((res) => this.setSession(res.accessToken, res.user)),
        map((res) => res.user)
      );
  }

  /**
   * POST /auth/login — email/password login.
   * NOTE: this endpoint is NOT implemented on the backend yet. It is wired up
   * here so that once you build it (verify the argon2 hash + sign a JWT that
   * returns { user, accessToken }), this method works with no frontend changes.
   */
  login(data: LoginRequest): Observable<PrivateUser> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, data).pipe(
      tap((res) => this.setSession(res.accessToken, res.user)),
      map((res) => res.user)
    );
  }

  /** PATCH /users/me — update the signed-in user. */
  updateMe(data: UpdateUserRequest): Observable<PrivateUser> {
    return this.http
      .patch<{ success: boolean; updatedUser: PrivateUser }>(
        `${this.base}/users/me`,
        data
      )
      .pipe(
        map((res) => res.updatedUser),
        tap((user) => {
          this.currentUser.set(user);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        })
      );
  }

  /** DELETE /users/me — soft-delete the account, then clear the session. */
  deleteMe(): Observable<void> {
    return this.http.delete<unknown>(`${this.base}/users/me`).pipe(
      map(() => undefined),
      tap(() => this.logout())
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
  }

  private setSession(token: string, user: PrivateUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private readStoredUser(): PrivateUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PrivateUser;
    } catch {
      return null;
    }
  }
}
