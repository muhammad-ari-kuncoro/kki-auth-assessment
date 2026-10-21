import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import type { User, UserWithSessionCount } from './types';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user: User | null = JSON.parse(localStorage.getItem('auth_user') || 'null');
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState<UserWithSessionCount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadUsers = () => {
    if (!isAdmin) return;
    setLoading(true);
    apiFetch<UserWithSessionCount[]>('/admin/users')
      .then((data) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch<{ message: string }>('/logout', { method: 'POST' });
    } catch (_) {}
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    navigate('/login');
  };

  const totalSessions = users.reduce((sum, u) => sum + u.active_sessions, 0);
  const totalAdmins = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Halo, {user?.username} 👋</h2>
          <p className="dashboard-sub">
            Login sebagai <span className={`badge badge-${user?.role}`}>{user?.role}</span>
          </p>
        </div>
        <div className="dashboard-actions">
          <button className="btn-outline" onClick={() => navigate('/profile')}>
            Profil
          </button>
          {isAdmin && (
            <button className="btn-outline" onClick={() => navigate('/admin')}>
              Kelola User
            </button>
          )}
          <button className="danger" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </div>

      {isAdmin ? (
        <>
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-value">{users.length}</div>
              <div className="stat-label">Total User</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalSessions}</div>
              <div className="stat-label">Sesi Aktif</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalAdmins}</div>
              <div className="stat-label">Admin</div>
            </div>
          </div>

          <div className="dashboard-footer">
            <button className="btn-outline" onClick={loadUsers} disabled={loading}>
              {loading ? 'Memuat...' : 'Refresh Data'}
            </button>
          </div>
        </>
      ) : (
        <div className="dashboard-welcome">
          Selamat datang! Lihat detail akun lo di halaman Profil.
        </div>
      )}
    </div>
  );
};

export default Dashboard;