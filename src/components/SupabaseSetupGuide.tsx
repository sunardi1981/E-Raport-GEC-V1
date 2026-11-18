import { useState } from 'react';
import { Check, Copy, Database, ExternalLink, ShieldCheck } from 'lucide-react';
import schemaSql from '../../supabase/migrations/001_gec_rapot_schema.sql?raw';

export function SupabaseSetupGuide() {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const envSnippet = `VITE_SUPABASE_URL=https://project-id-anda.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...`;

  const handleCopySql = async () => {
    await navigator.clipboard.writeText(schemaSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCopyEnv = async () => {
    await navigator.clipboard.writeText(envSnippet);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const steps = [
    {
      title: '1. Buat Project Supabase',
      desc: 'Masuk ke supabase.com, buat project baru, pilih region terdekat (misal Singapore ap-southeast-1), dan simpan password database.',
    },
    {
      title: '2. Ambil URL & Anon Public Key',
      desc: 'Buka Project Settings → Data API / API Keys. Salin Project URL dan anon/public key (jangan gunakan service_role key di frontend).',
    },
    {
      title: '3. Konfigurasi Environment Variables',
      desc: 'Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY ke file .env atau menu Secrets / Environment Variables pada platform hosting.',
    },
    {
      title: '4. Jalankan SQL Schema & RLS',
      desc: 'Buka menu SQL Editor di Supabase Dashboard, tempel script SQL migrasi di bawah ini, lalu klik Run untuk membuat 5 tabel, index, trigger profil otomatis, dan kebijakan RLS.',
    },
    {
      title: '5. Aktifkan Email Auth & URL Redirect',
      desc: 'Pada Authentication → Providers → Email, pastikan Email Provider aktif. Tambahkan URL aplikasi Anda pada Authentication → URL Configuration → Redirect URLs agar fitur Reset Password bekerja.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0f274a] text-white">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Panduan Koneksi Supabase & Migrasi Database
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Konfigurasi wajib agar autentikasi guru, RLS multi-user, dan autosave rapot terhubung ke PostgreSQL Supabase.
              </p>
            </div>
          </div>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#0f274a] hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            Buka Supabase Dashboard
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <ol className="mt-5 space-y-4">
          {steps.map((step) => (
            <li key={step.title} className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-[#0f274a]">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.desc}</p>
            </li>
          ))}
        </ol>

        {/* Env Snippet */}
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Template Environment Variables (.env)</p>
            <button
              type="button"
              onClick={handleCopyEnv}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {copiedEnv ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedEnv ? 'Tersalin' : 'Salin .env'}
            </button>
          </div>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3.5 font-mono text-xs text-slate-100">
            {envSnippet}
          </pre>
        </div>

        {/* Full SQL Migration */}
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-semibold text-slate-900">
                SQL Schema + Index + Trigger + RLS (supabase/migrations/001_gec_rapot_schema.sql)
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f274a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#163561] whitespace-nowrap shrink-0"
            >
              {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSql ? 'SQL Tersalin' : 'Salin Semua SQL'}
            </button>
          </div>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
            {schemaSql}
          </pre>
        </div>
      </div>
    </div>
  );
}
