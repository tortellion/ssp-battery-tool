import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';

export default function Login() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      setError('');
      setMode('confirm');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push('/');
  };

  if (mode === 'confirm') {
    return (
      <div className="login-wrap">
        <div className="login-box" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--gold)', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>Solid State Power</div>
          <div style={{ color: '#f8fafc', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Check your email</div>
          <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.7 }}>
            We sent a confirmation link to <strong style={{ color: '#94a3b8' }}>{email}</strong>.<br />
            Click it to activate your account, then sign in.
          </div>
          <button className="btn btn-gold" style={{ marginTop: 20, width: '100%' }} onClick={() => setMode('signin')}>Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ color: 'var(--gold)', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>Solid State Power</div>
          <div style={{ color: '#f8fafc', fontSize: 18, fontWeight: 700 }}>Battery Configuration Tool</div>
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>INTERNAL — AUTHORIZED USE ONLY</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="fl" style={{ color: '#94a3b8' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ background: '#1a2f50', borderColor: '#2d4a6e', color: '#f8fafc' }} autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="fl" style={{ color: '#94a3b8' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ background: '#1a2f50', borderColor: '#2d4a6e', color: '#f8fafc' }} />
          </div>

          {error && <div style={{ color: '#f87171', fontSize: 11, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

          <button type="submit" className="btn btn-gold btn-full" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#475569' }}>
          {mode === 'signin' ? (
            <>Need an account? <button onClick={() => setMode('signup')} style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Create one</button></>
          ) : (
            <>Already have one? <button onClick={() => setMode('signin')} style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
