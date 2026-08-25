import { Role } from './lobby';

// Mirrors the backend `privateUserSelect` returned by POST /users and
// POST /auth/google. Dates arrive as ISO strings over JSON.
export interface PrivateUser {
  id: string;
  email: string;
  name: string;
  birthDate: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
  pictureUrl: string | null;
}

// POST /users — matches createUserSchema (role defaults to PLAYER on the server)
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  birthDate: string; // ISO date (yyyy-mm-dd)
}

// POST /auth/login — NOTE: this endpoint does not exist on the backend yet.
export interface LoginRequest {
  email: string;
  password: string;
}

// POST /auth/google — { user, accessToken }
export interface AuthResponse {
  user: PrivateUser;
  accessToken: string;
}

// POST /users — { message, user }
export interface SignupResponse {
  message: string;
  user: PrivateUser;
}

// PATCH /users/me — matches updateUserSchema (all optional)
export interface UpdateUserRequest {
  name?: string;
  email?: string;
  birthDate?: string;
  password?: string;
}
