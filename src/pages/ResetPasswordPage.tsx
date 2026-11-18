import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { resetPasswordSchema } from '../lib/validation';
import { useToast } from '../contexts/ToastContext';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError('Konfigurasi Supabase belum tersedia.');
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Input tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (updateErr) {
        setError(formatSupabaseError(updateErr));
        return;
      }
      setDone(true);
      showToast('success', 'Kata sandi diperbarui', 'Silakan gunakan kata sandi baru Anda.');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1800);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f274a] text-white">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">Atur Ulang Kata Sandi</h1>
            <p className="text-xs text-slate-500">GEC RAPOT · Akun Guru</p>
          </div>
        </div>

        {done ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Kata sandi berhasil diperbarui
            </div>
            <p className="mt-1 text-xs">Mengalihkan ke dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="new-pw" className="block text-xs font-semibold text-slate-700">
                Kata Sandi Baru
              </label>
              <input
                id="new-pw"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label htmlFor="confirm-pw" className="block text-xs font-semibold text-slate-700">
                Konfirmasi Kata Sandi Baru
              </label>
              <input
                id="confirm-pw"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#0f274a] py-2.5 text-sm font-semibold text-white hover:bg-[#163561] disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-xs font-medium text-slate-500 hover:text-slate-900">
                Kembali ke halaman Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
