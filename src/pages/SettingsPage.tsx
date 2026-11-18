import React, { useEffect, useState } from 'react';
import { Save, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { getDefaultAcademicYear } from '../lib/dateUtils';
import { SEMESTER_OPTIONS } from '../types/database';
import { SupabaseSetupGuide } from '../components/SupabaseSetupGuide';

export function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [defaultAcademicYear, setDefaultAcademicYear] = useState(getDefaultAcademicYear());
  const [defaultSemester, setDefaultSemester] = useState<string>('Semester Ganjil');
  const [defaultCity, setDefaultCity] = useState('Rejang Lebong');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.preferences) {
      setDefaultAcademicYear(profile.preferences.default_academic_year || getDefaultAcademicYear());
      setDefaultSemester(profile.preferences.default_semester || 'Semester Ganjil');
      setDefaultCity(profile.preferences.default_city || 'Rejang Lebong');
    }
  }, [profile]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || saving) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          preferences: {
            default_academic_year: defaultAcademicYear.trim() || getDefaultAcademicYear(),
            default_semester: defaultSemester,
            default_city: defaultCity.trim() || 'Rejang Lebong',
          },
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      showToast('success', 'Pengaturan disimpan', 'Preferensi rapot default berhasil diperbarui.');
    } catch (err) {
      showToast('error', 'Gagal menyimpan pengaturan', formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">Pengaturan Sistem & Rapot</h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Atur nilai bawaan (default) untuk pembuatan rapot baru dan lihat dokumentasi skema Supabase.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
          <Settings className="h-5 w-5 text-[#0f274a]" />
          <h3 className="font-display text-base font-bold text-slate-900">Preferensi Rapot Default</h3>
        </div>

        <form onSubmit={handleSavePreferences} className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Tahun Ajaran Aktif</label>
            <input
              type="text"
              required
              value={defaultAcademicYear}
              onChange={(e) => setDefaultAcademicYear(e.target.value)}
              placeholder="2026/2027"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Semester Default</label>
            <select
              value={defaultSemester}
              onChange={(e) => setDefaultSemester(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
            >
              {SEMESTER_OPTIONS.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Kota Penandatanganan Rapot
            </label>
            <input
              type="text"
              required
              value={defaultCity}
              onChange={(e) => setDefaultCity(e.target.value)}
              placeholder="Rejang Lebong"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
            />
          </div>

          <div className="sm:col-span-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163561] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan Default'}
            </button>
          </div>
        </form>
      </section>

      <SupabaseSetupGuide />
    </div>
  );
}
