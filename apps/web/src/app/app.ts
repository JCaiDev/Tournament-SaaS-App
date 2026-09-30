import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ORGANIZER_ROLES } from './models/lobby';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Volleyball Lobbies');
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly canOrganize = computed(() => {
    const role = this.user()?.role;
    return !!role && ORGANIZER_ROLES.includes(role);
  });

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
