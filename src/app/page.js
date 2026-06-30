'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [officers, setOfficers] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState('Operation');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  
  // Login Inputs
  const [pin, setPin] = useState(''); // For Officer
  const [email, setEmail] = useState(''); // For Coordinator
  const [password, setPassword] = useState(''); // For Coordinator
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    const session = localStorage.getItem('acc_session');
    if (session) {
      router.replace('/dashboard');
    }

    fetchOfficers();
  }, [router]);

  async function fetchOfficers() {
    try {
      const { data, error } = await supabase
        .from('officers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const formatted = data.map(o => ({
          ...o,
          division: o.division || 'Operation'
        }));
        setOfficers(formatted);
        const firstOp = formatted.find(o => o.division === 'Operation') || formatted[0];
        setSelectedOfficerId(firstOp.id);
      } else {
        setOfficers([]);
        setSelectedOfficerId('');
      }
    } catch (err) {
      console.error('Failed to fetch officers from Supabase:', err.message);
      setError('Gagal menghubungkan ke database Supabase. Silakan periksa koneksi Anda.');
      setOfficers([]);
      setSelectedOfficerId('');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isCoordinator) {
      // Coordinator Login via Email and Password
      if (!email || !password) {
        setError('Email dan password tidak boleh kosong.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('coordinators')
          .select('*')
          .eq('email', email.toLowerCase())
          .single();

        if (error) throw error;

        if (data && data.password === password) {
          localStorage.setItem(
            'acc_session',
            JSON.stringify({
              role: 'coordinator',
              coordRole: data.role,
              name: 'Coordinator ' + (data.role === 'master' ? 'Master' : data.role === 'operation' ? 'Operation' : data.role === 'pe' ? 'PE' : data.role === 'cabang' ? 'Cabang' : data.role),
              isMock: false,
            })
          );
          router.replace('/dashboard');
        } else {
          setError('Email atau password Coordinator salah.');
        }
      } catch (err) {
        console.error('Coordinator login error:', err.message);
        setError('Email atau password Coordinator salah / Gagal menghubungi server.');
      }
    } else {
      // Officer Login via Dropdown + PIN
      if (!selectedOfficerId) {
        setError('Silakan pilih nama Officer.');
        setLoading(false);
        return;
      }

      if (!pin) {
        setError('PIN tidak boleh kosong.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('officers')
          .select('id, name, pin, division')
          .eq('id', selectedOfficerId)
          .single();

        if (error) throw error;

        if (data && data.pin === pin) {
          localStorage.setItem(
            'acc_session',
            JSON.stringify({
              role: 'officer',
              id: data.id,
              name: data.name,
              division: data.division || 'Operation',
              isMock: false,
            })
          );
          router.replace('/dashboard');
        } else {
          setError('Password / PIN Officer salah.');
        }
      } catch (err) {
        console.error('Officer login error:', err.message);
        setError('Gagal melakukan login: ' + err.message);
      }
    }
    setLoading(false);
  }

  return (
    <main className="container flex-center" style={{ minHeight: '100vh' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="text-gradient" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>
            S.W.A.T - Tegal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Pipeline Tracking & Management System
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: '#f87171',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="tabs-container" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
            <button
              type="button"
              className={`tab-btn ${!isCoordinator ? 'active' : ''}`}
              onClick={() => {
                setIsCoordinator(false);
                setError('');
                setPin('');
              }}
            >
              Officer Login
            </button>
            <button
              type="button"
              className={`tab-btn ${isCoordinator ? 'active' : ''}`}
              onClick={() => {
                setIsCoordinator(true);
                setError('');
                setEmail('');
                setPassword('');
              }}
            >
              Coordinator Login
            </button>
          </div>

          {!isCoordinator ? (
            // Officer Login Fields
            <div className="animate-fade-in">
              <div className="form-group">
                <label htmlFor="division-select">Pilih Divisi</label>
                <select
                  id="division-select"
                  className="input-control"
                  value={selectedDivision}
                  onChange={(e) => {
                    const newDiv = e.target.value;
                    setSelectedDivision(newDiv);
                    const filtered = officers.filter(o => o.division === newDiv);
                    if (filtered.length > 0) {
                      setSelectedOfficerId(filtered[0].id);
                    } else {
                      setSelectedOfficerId('');
                    }
                  }}
                >
                  <option value="Operation">Operation</option>
                  <option value="PE">PE</option>
                  <option value="Cabang">Cabang</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="officer-select">Pilih Officer</label>
                <select
                  id="officer-select"
                  className="input-control"
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                >
                  {officers.filter(o => o.division === selectedDivision).map((officer) => (
                    <option key={officer.id} value={officer.id}>
                      {officer.name}
                    </option>
                  ))}
                  {officers.filter(o => o.division === selectedDivision).length === 0 && (
                    <option value="">Belum ada officer di divisi ini</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pin-input">Password</label>
                <input
                  id="pin-input"
                  type="password"
                  className="input-control"
                  placeholder="Masukkan Password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
            </div>
          ) : (
            // Coordinator Login Fields
            <div className="animate-fade-in">
              <div className="form-group">
                <label htmlFor="email-input">Email Coordinator</label>
                <input
                  id="email-input"
                  type="email"
                  className="input-control"
                  placeholder="admin@acc.co.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password-input">Password</label>
                <input
                  id="password-input"
                  type="password"
                  className="input-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Memverifikasi...' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  );
}
