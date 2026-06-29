'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [officers, setOfficers] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  
  // Login Inputs
  const [pin, setPin] = useState(''); // For Officer
  const [email, setEmail] = useState(''); // For Coordinator
  const [password, setPassword] = useState(''); // For Coordinator
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);

  // Default mock data in case Supabase is not connected
  const mockOfficers = [
    { id: 'mock-1', name: 'Budi Pratama (Mock)', pin: '1234' },
    { id: 'mock-2', name: 'Siti Aminah (Mock)', pin: '5678' },
    { id: 'mock-3', name: 'Andi Wijaya (Mock)', pin: '1111' },
  ];

  useEffect(() => {
    // Check if already logged in
    const session = localStorage.getItem('acc_session');
    if (session) {
      router.push('/dashboard');
    }

    fetchOfficers();
  }, [router]);

  async function fetchOfficers() {
    try {
      const { data, error } = await supabase
        .from('officers')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setOfficers(data);
        setSelectedOfficerId(data[0].id);
        setIsMockMode(false);
      } else {
        // No officers in DB, use mock
        setOfficers(mockOfficers);
        setSelectedOfficerId(mockOfficers[0].id);
        setIsMockMode(true);
      }
    } catch (err) {
      console.warn('Failed to fetch officers from Supabase, entering Mock Mode:', err.message);
      setOfficers(mockOfficers);
      setSelectedOfficerId(mockOfficers[0].id);
      setIsMockMode(true);
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

      const coordinatorEmail = process.env.NEXT_PUBLIC_COORDINATOR_EMAIL || 'admin@acc.co.id';
      const coordinatorPassword = process.env.NEXT_PUBLIC_COORDINATOR_PASSWORD || 'admin123';

      if (email.toLowerCase() === coordinatorEmail.toLowerCase() && password === coordinatorPassword) {
        // Save session
        localStorage.setItem(
          'acc_session',
          JSON.stringify({
            role: 'coordinator',
            name: 'Coordinator',
            isMock: isMockMode,
          })
        );
        router.push('/dashboard');
      } else {
        setError('Email atau password Coordinator salah.');
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

      if (isMockMode) {
        const matchedMock = mockOfficers.find(
          (o) => o.id === selectedOfficerId && o.pin === pin
        );
        if (matchedMock) {
          localStorage.setItem(
            'acc_session',
            JSON.stringify({
              role: 'officer',
              id: matchedMock.id,
              name: matchedMock.name,
              isMock: true,
            })
          );
          router.push('/dashboard');
        } else {
          setError('PIN Officer salah (Untuk mock: Budi=1234, Siti=5678, Andi=1111).');
        }
      } else {
        try {
          // Fetch officer pin
          const { data, error } = await supabase
            .from('officers')
            .select('id, name, pin')
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
                isMock: false,
              })
            );
            router.push('/dashboard');
          } else {
            setError('PIN Officer salah.');
          }
        } catch (err) {
          setError('Gagal melakukan login: ' + err.message);
        }
      }
    }
    setLoading(false);
  }

  return (
    <main className="container flex-center" style={{ minHeight: '100vh' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="text-gradient" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>
            ACC Prospect
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Pipeline Tracking & Management System
          </p>
        </div>

        {isMockMode && (
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: '#93c5fd',
              textAlign: 'center',
            }}
          >
            <strong>Mode Demo Aktif:</strong> Database Supabase belum terkoneksi.<br />
            • Officer PIN: Budi=1234, Siti=5678, Andi=1111<br />
            • Coord: admin@acc.co.id / admin123
          </div>
        )}

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
                <label htmlFor="officer-select">Pilih Officer</label>
                <select
                  id="officer-select"
                  className="input-control"
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                >
                  {officers.map((officer) => (
                    <option key={officer.id} value={officer.id}>
                      {officer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="pin-input">4-Digit PIN</label>
                <input
                  id="pin-input"
                  type="password"
                  className="input-control"
                  placeholder="••••"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
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
