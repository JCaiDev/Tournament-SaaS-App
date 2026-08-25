import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { GoogleCredentialResponse } from '../core/google';

/**
 * Thin wrapper around the Google Identity Services (GSI) script that is loaded
 * in index.html. Waits for the script, initializes it once, and renders the
 * official "Sign in with Google" button into a host element.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private initialized = false;

  /** Resolves once window.google.accounts.id is available. */
  private waitForScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (window.google?.accounts?.id) {
          resolve();
        } else if (Date.now() - start > 8000) {
          reject(new Error('Google Sign-In failed to load.'));
        } else {
          setTimeout(tick, 100);
        }
      };
      tick();
    });
  }

  /**
   * Render the Google button into `host`. `onCredential` is called with the
   * Google id_token when the user completes sign-in.
   */
  async renderButton(
    host: HTMLElement,
    onCredential: (idToken: string) => void
  ): Promise<void> {
    await this.waitForScript();
    const id = window.google!.accounts.id;

    if (!this.initialized) {
      id.initialize({
        client_id: environment.googleClientId,
        callback: (response: GoogleCredentialResponse) =>
          onCredential(response.credential),
      });
      this.initialized = true;
    }

    id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 320,
    });
  }
}
