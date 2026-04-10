import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Login failed. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-800/80 bg-slate-900/85 p-10 shadow-glow">
      <div className="mb-8 space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Login to Zone Weaver</p>
        <h1 className="text-3xl font-semibold text-white">Secure access to your zone network</h1>
        <p className="text-slate-400">Enter your email and password to continue managing H3 zones, devices, and alerts.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="text-sm text-slate-300">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-2 w-full rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none ring-1 ring-transparent transition focus:border-teal-400 focus:ring-teal-500/20"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="mt-2 w-full rounded-3xl border border-slate-800/90 bg-slate-950/90 px-4 py-3 text-slate-100 outline-none ring-1 ring-transparent transition focus:border-teal-400 focus:ring-teal-500/20"
          />
        </label>
        {error && <p className="rounded-3xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-3xl bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <div className="mt-8 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-5 text-sm text-slate-400">
        <p className="font-semibold text-white">Secure mobile and web onboarding</p>
        <p className="mt-2">Use your registered credentials to access the Zone Weaver dashboard and API explorer.</p>
      </div>
      <p className="mt-6 text-sm text-slate-400">
        New here?{' '}
        <Link to="/register" className="text-teal-300 hover:text-teal-200">
          Create an account
        </Link>
      </p>
    </div>
  );
}
