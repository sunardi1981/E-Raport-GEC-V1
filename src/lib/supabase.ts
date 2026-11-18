import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    (supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://'))
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Konfigurasi Supabase belum tersedia. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sudah diatur.'
    );
  }
  return supabase;
}

export function formatSupabaseError(error: unknown, fallback = 'Terjadi kesalahan saat memproses data.'): string {
  if (!error) return fallback;
  const err = error as { message?: string; code?: string; status?: number };
  const msg = err.message ?? '';

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Gagal terhubung ke server Supabase. Periksa koneksi internet Anda dan coba kembali.';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Email atau kata sandi yang Anda masukkan salah.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Email Anda belum dikonfirmasi. Silakan periksa kotak masuk email Anda.';
  }
  if (msg.includes('User already registered')) {
    return 'Email ini sudah terdaftar. Silakan masuk atau gunakan menu Lupa Kata Sandi.';
  }
  if (msg.includes('Password should be at least')) {
    return 'Kata sandi minimal harus terdiri dari 6 karakter.';
  }
  if (err.code === '42501' || msg.toLowerCase().includes('row-level security')) {
    return 'Akses ditolak oleh kebijakan keamanan database (RLS). Anda tidak memiliki izin pada data ini.';
  }
  if (err.code === '23505') {
    return 'Data yang sama sudah ada di database.';
  }
  if (err.code === '23503') {
    return 'Data terkait tidak ditemukan atau tidak dapat dihapus karena masih digunakan pada rapot.';
  }
  return msg || fallback;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}
