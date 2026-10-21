import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import Dashboard from './Dashboard';
import type { User, UserWithSessionCount, AuthResponse, RegisterResponse } from './types';

// --- Helper Auth ---
const isLoggedIn = () => !!localStorage.getItem('auth_token');

const getStoredUser = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem('auth_user') || 'null');
  } catch {
    return null;
  }
};

// --- Route Guard ---
const ProtectedRoute: React.FC<{ children: React.ReactElement; adminOnly?: boolean }> = ({
  children,
  adminOnly,
}) => {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (adminOnly && getStoredUser()?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) =>
  isLoggedIn() ? <Navigate to="/dashboard" replace /> : children;

// --- Navbar ---
const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('auth_token');
  const user = getStoredUser();

  const handleLogout = async () => {
    try {
      await apiFetch<{ message: string }>('/logout', { method: 'POST' });
    } catch (_) {}
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    navigate('/login');
  };

  return (
    <div className="navbar">
      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>KKI Auth System</div>
      <div className="nav-links">
        {token ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/profile">Profil</Link>
            {user?.role === 'admin' && <Link to="/admin">Kelola User</Link>}
            <button onClick={handleLogout} className="danger" style={{ marginLeft: '1rem' }}>
              Keluar
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Masuk</Link>
            <Link to="/register">Daftar</Link>
          </>
        )}
      </div>
    </div>
  );
};

// --- Halaman Login ---
const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<AuthResponse>('/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('auth_user', JSON.stringify(res.user));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login gagal');
    }
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h2>Masuk ke Akun</h2>
      {error && <div className="alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <div className="form-group">
          <label>Username atau Email</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Kata Sandi</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" style={{ width: '100%' }}>Masuk</button>
      </form>
    </div>
  );
};

// --- Halaman Register ---
const Register: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await apiFetch<RegisterResponse>('/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      setSuccess('Pendaftaran berhasil! Mengalihkan ke login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.message || 'Registrasi gagal');
    }
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h2>Pendaftaran Pengguna</h2>
      {error && <div className="alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
      {success && <div className="alert-success" style={{ marginTop: '1rem' }}>{success}</div>}
      <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Kata Sandi</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" style={{ width: '100%' }}>Daftar</button>
      </form>
    </div>
  );
};

// --- Halaman Profil ---
const Profile: React.FC = () => {
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    apiFetch<User>('/profile')
      .then((data) => setProfile(data))
      .catch((_) => {});
  }, []);

  if (!profile) return <div className="card">Memuat data profil...</div>;

  return (
    <div className="card">
      <h2>Profil Pengguna</h2>
      <div style={{ marginTop: '1.5rem', lineHeight: '2' }}>
        <div><strong>User ID:</strong> {profile.id}</div>
        <div><strong>Username:</strong> {profile.username}</div>
        <div><strong>Email:</strong> {profile.email}</div>
        <div>
          <strong>Peran (Role):</strong>{' '}
          <span className={`badge badge-${profile.role}`}>{profile.role}</span>
        </div>
        <div>
          <strong>Tanggal Terdaftar:</strong> {new Date(profile.created_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

// --- Halaman Admin ---
const Admin: React.FC = () => {
  const [users, setUsers] = useState<UserWithSessionCount[]>([]);
  const [message, setMessage] = useState<string>('');

  const loadUsers = () => {
    apiFetch<UserWithSessionCount[]>('/admin/users')
      .then((data) => setUsers(data))
      .catch((_) => {});
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleForceLogout = async (userId: number, username: string) => {
    if (!window.confirm(`Yakin ingin force logout seluruh sesi ${username}?`)) return;
    try {
      const res = await apiFetch<{ message: string }>(`/admin/users/${userId}/force-logout`, {
        method: 'POST',
      });
      setMessage(res.message);
      loadUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal mematikan sesi pengguna');
    }
  };

  return (
    <div className="card">
      <h2>Daftar Seluruh Pengguna (Admin Only)</h2>
      {message && <div className="alert-success" style={{ marginTop: '1rem' }}>{message}</div>}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Sesi Aktif</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
              <td>{u.active_sessions}</td>
              <td>
                <button className="danger" onClick={() => handleForceLogout(u.id, u.username)}>
                  Force Logout
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}