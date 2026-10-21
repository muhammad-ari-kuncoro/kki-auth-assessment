export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface UserWithSessionCount extends User {
  active_sessions: number;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user_id: number;
}

export interface ApiResponse<T = any> {
  message?: string;
  error?: string;
  data?: T;
}