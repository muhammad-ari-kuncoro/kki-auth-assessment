const API_BASE = 'http://localhost:8080/api';

export const apiFetch = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

if (!response.ok) {
  if (response.status === 401 && token) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login';
  }
  throw new Error(data?.error || 'Terjadi kesalahan sistem');
}

  return data as T;
};