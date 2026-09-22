import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

// A 401 from these means "bad credentials" or "refresh cookie is gone" — not
// "access token expired", so retrying them after a refresh would loop forever.
const NON_RETRYABLE = [
  '/auth/refresh',
  '/auth/login',
  '/auth/google',
  '/auth/logout',
];

/**
 * Attaches `Authorization: Bearer <token>` to API requests, sends cookies so the
 * httpOnly refresh token survives the cross-origin hop, and on a 401 refreshes
 * the access token once and replays the failed request.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  const withAuth = (token: string | null) =>
    req.clone({
      withCredentials: true,
      ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
    });

  return next(withAuth(auth.getToken())).pipe(
    catchError((error: HttpErrorResponse) => {
      // No stored session means there is no refresh cookie to spend — bounce the
      // 401 to the caller instead of redirecting an anonymous visitor to /login.
      const retryable =
        error.status === 401 &&
        auth.isLoggedIn() &&
        !NON_RETRYABLE.some((path) => req.url.includes(path));

      if (!retryable) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap((token) => next(withAuth(token))),
        catchError((refreshError) => {
          auth.logout();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
