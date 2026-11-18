import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Database, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { forgotPasswordSchema, loginSchema, registerSchema } from '../lib/validation';
import { SupabaseSetupGuide } from '../components/SupabaseSetupGuide';

type AuthMode = 'login' | 'register' | 'forgot';

export function LoginPage() {
  const { user, loading, isConfigured } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<AuthMode>('login');
  const [showSetupGuide, setShowSetupGuide] = useState(!isConfigured);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);

    if (!supabase) {
      setFormError('Koneksi Supabase belum dikonfigurasi pada environment variables.');
      return;
    }

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data login tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) {
        setFormError(formatSupabaseError(error));
        return;
      }
      showToast('success', 'Berhasil masuk', 'Selamat datang di GEC RAPOT.');
    } catch (err) {
      setFormError(formatSupabaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);

    if (!supabase) {
      setFormError('Koneksi Supabase belum dikonfigurasi pada environment variables.');
      return;
    }

    const parsed = registerSchema.safeParse({
      fullName,
      email,
      phone,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data pendaftaran tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: parsed.data.fullName,
            phone: parsed.data.phone ?? '',
          },
        },
      });
      if (error) {
        setFormError(formatSupabaseError(error));
        return;
      }
      if (data.session) {
        showToast('success', 'Akun guru berhasil dibuat', 'Selamat datang di GEC RAPOT.');
      } else {
        setInfoMessage(
          'Pendaftaran berhasil. Silakan periksa email Anda untuk konfirmasi akun sebelum masuk.'
        );
        setMode('login');
      }
    } catch (err) {
      setFormError(formatSupabaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setInfoMessage(null);

    if (!supabase) {
      setFormError('Koneksi Supabase belum dikonfigurasi pada environment variables.');
      return;
    }

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Email tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setFormError(formatSupabaseError(error));
        return;
      }
      setInfoMessage(
        'Tautan reset kata sandi telah dikirim ke email Anda. Periksa kotak masuk atau folder spam.'
      );
    } catch (err) {
      setFormError(formatSupabaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-12">
        {/* Left Institutional Column */}
        <div className="hidden lg:col-span-6 lg:flex lg:flex-col lg:justify-between bg-[#0f274a] p-10 text-white">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-14 items-center justify-center rounded-lg bg-white p-1">
                <img
                  src="/assets/aistudio/logo_GEC_4cd69325.png"
                  alt="Logo Galaxi Edu Center"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-display text-lg font-extrabold tracking-tight">GEC RAPOT</p>
                <p className="text-xs text-sky-200">Bimbel Galaxi Edu Center</p>
              </div>
            </div>

            <div className="mt-10 max-w-lg">
              <h1 className="font-display text-3xl font-bold leading-tight text-balance">
                Sistem Laporan Hasil Belajar Digital Guru Galaxi Edu Center
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Kelola data siswa, mata pelajaran, materi pembelajaran, deskripsi perkembangan otomatis berbasis predikat, draft autosave, hingga ekspor PDF standar A4 secara terisolasi dan aman untuk setiap guru.
              </p>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <img
              src="/src/assets/images/gec_academic_banner_1795008503268.jpg"
              alt="Ruang belajar Galaxi Edu Center"
              referrerPolicy="no-referrer"
              className="h-60 w-full object-cover"
            />
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 text-xs text-slate-300">
              <span>Penilaian Kognitif · Afektif · Psikomotor</span>
              <span className="font-medium text-amber-300">Format Resmi A4</span>
            </div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:col-span-6 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            {/* Mobile Brand Header */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <img
                src="/assets/aistudio/logo_GEC_4cd69325.png"
                alt="Logo GEC"
                referrerPolicy="no-referrer"
                className="h-11 w-14 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
              />
              <div>
                <p className="font-display text-lg font-extrabold text-[#0f274a]">GEC RAPOT</p>
                <p className="text-xs text-slate-500">Digital Student Learning Report</p>
              </div>
            </div>

            {!isConfigured && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div className="text-sm text-amber-950">
                    <p className="font-semibold">Supabase Belum Terkonfigurasi</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-900">
                      Environment variables <code className="font-mono font-semibold">VITE_SUPABASE_URL</code> dan{' '}
                      <code className="font-mono font-semibold">VITE_SUPABASE_ANON_KEY</code> belum diatur. Aplikasi belum terhubung ke database Supabase.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowSetupGuide((prev) => !prev)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
                    >
                      <Database className="h-3.5 w-3.5" />
                      {showSetupGuide ? 'Sembunyikan Panduan Setup' : 'Lihat Panduan Setup & SQL'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  {mode === 'login' && 'Masuk Akun Guru'}
                  {mode === 'register' && 'Registrasi Akun Guru'}
                  {mode === 'forgot' && 'Lupa Kata Sandi'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {mode === 'login' && 'Masuk menggunakan email dan kata sandi guru Bimbel GEC.'}
                  {mode === 'register' && 'Buat akun baru untuk mengelola siswa dan rapot Anda sendiri.'}
                  {mode === 'forgot' && 'Masukkan email terdaftar untuk menerima tautan reset kata sandi.'}
                </p>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {infoMessage && (
                <div
                  role="status"
                  className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900"
                >
                  {infoMessage}
                </div>
              )}

              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700">
                      Email Guru
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@galaxiedu.id"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                        Kata Sandi
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setFormError(null);
                          setInfoMessage(null);
                        }}
                        className="text-xs font-medium text-sky-700 hover:underline"
                      >
                        Lupa kata sandi?
                      </button>
                    </div>
                    <div className="relative mt-1.5">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !isConfigured}
                    className="w-full rounded-lg bg-[#0f274a] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#163561] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Memeriksa Akun...' : 'Masuk ke Dashboard'}
                  </button>

                  <p className="pt-2 text-center text-xs text-slate-600">
                    Belum memiliki akun guru?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setFormError(null);
                        setInfoMessage(null);
                      }}
                      className="font-semibold text-[#0f274a] hover:underline"
                    >
                      Daftar Akun Guru
                    </button>
                  </p>
                </form>
              )}

              {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700">
                      Nama Lengkap Guru
                    </label>
                    <div className="relative mt-1.5">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="reg-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Contoh: Siti Rahmawati, S.Pd."
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700">
                      Email
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="reg-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@galaxiedu.id"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700">
                      Nomor HP / WhatsApp (Opsional)
                    </label>
                    <div className="relative mt-1.5">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="reg-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0812xxxxxxxx"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700">
                      Kata Sandi
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-confirm" className="block text-xs font-semibold text-slate-700">
                      Konfirmasi Kata Sandi
                    </label>
                    <input
                      id="reg-confirm"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !isConfigured}
                    className="w-full rounded-lg bg-[#0f274a] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#163561] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Mendaftarkan...' : 'Buat Akun Guru'}
                  </button>

                  <p className="pt-2 text-center text-xs text-slate-600">
                    Sudah punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setFormError(null);
                      }}
                      className="font-semibold text-[#0f274a] hover:underline"
                    >
                      Kembali ke Login
                    </button>
                  </p>
                </form>
              )}

              {mode === 'forgot' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-700">
                      Email Terdaftar
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="forgot-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@galaxiedu.id"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !isConfigured}
                    className="w-full rounded-lg bg-[#0f274a] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#163561] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Mengirim Tautan...' : 'Kirim Tautan Reset Password'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setFormError(null);
                      setInfoMessage(null);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 pt-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Kembali ke halaman masuk
                  </button>
                </form>
              )}
            </div>

            {isConfigured && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowSetupGuide((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#0f274a]"
                >
                  <Database className="h-3.5 w-3.5" />
                  {showSetupGuide ? 'Tutup Panduan SQL & Setup' : 'Panduan Setup Supabase & SQL Schema'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSetupGuide && (
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-4 sm:px-8">
          <SupabaseSetupGuide />
        </div>
      )}
    </div>
  );
}
