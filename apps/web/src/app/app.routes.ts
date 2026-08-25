import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { LobbyDetail } from './pages/lobby-detail/lobby-detail';
import { Login } from './pages/login/login';
import { Signup } from './pages/signup/signup';
import { Profile } from './pages/profile/profile';
import { authGuard } from './core/auth.guard';
import { CreateLobby } from './pages/create-lobby/create-lobby';
import { EditLobby } from './pages/edit-lobby/edit-lobby';

export const routes: Routes = [
  { path: '', component: Home, title: 'Active Lobbies · Volleyball' },
  { path: 'lobbies/new', component: CreateLobby, title: 'Host a Game · Volleyball', canActivate: [authGuard]},
  { path: 'lobbies/:id', component: LobbyDetail, title: 'Lobby Details · Volleyball' },
  { path: 'lobbies/:id/edit', component: EditLobby, title: 'Edit Lobby · Volleyball', canActivate: [authGuard] },
  { path: 'login', component: Login, title: 'Log in · Volleyball' },
  { path: 'signup', component: Signup, title: 'Sign up · Volleyball' },
  { path: 'profile', component: Profile, title: 'My Profile · Volleyball', canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
