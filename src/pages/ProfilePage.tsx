import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Save, UserCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { profileSchema, resetPasswordSchema } from '../lib/validation';

export function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [subjectSpecialty, setSubjectSpecialty] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setSubjectSpecialty(profile.subject_specialty || '');
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || savingProfile) return;

    const parsed = profileSchema.safeParse({
      full_name: fullName,
      phone: phone || null,
      subject_specialty: subjectSpecialty || null,
    });
    if (!parsed.success) {
      showToast('error', 'Validasi Gagal', parsed.error.issues[0]?.message);
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: parsed.data.full_name,
          phone: parsed.data.phone || null,
          subject_specialty: parsed.data.subject_specialty || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      showToast('success', 'Profil diperbarui', 'Nama guru akan otomatis digunakan pada rapot baru.');
    } catch (err) {
      showToast('error', 'Gagal memperbarui profil', formatSupabaseError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || savingPassword) return;

    const parsed = resetPasswordSchema.safeParse({
      password: newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      showToast('error', 'Validasi Gagal', parsed.error.issues[0]?.message);
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      showToast('success', 'Kata sandi diperbarui', 'Gunakan kata sandi baru saat login berikutnya.');
    } catch (err) {
      showToast('error', 'Gagal mengganti kata sandi', formatSupabaseError(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Profil Guru</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Informasi profil ini akan tercantum secara otomatis pada tanda tangan rapot.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap shrink-0"
        >
          <LogOut className="h-4 w-4" />
          Logout Akun
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Form */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
            <UserCircle2 className="h-5 w-5 text-[#0f274a]" />
            <h3 className="font-display text-base font-bold text-slate-900">Data Identitas Guru</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Login</label>
              <input
                type="email"
                disabled
                value={user?.email ?? ''}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nama Lengkap & Gelar <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Contoh: Siti Rahmawati, S.Pd."
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Nomor HP / WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Mata Pelajaran Utama yang Diampu
              </label>
              <input
                type="text"
                value={subjectSpecialty}
                onChange={(e) => setSubjectSpecialty(e.target.value)}
                placeholder="Contoh: Matematika, IPA, Bahasa Inggris"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163561] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </div>
          </form>
        </section>

        {/* Change Password Form */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
            <KeyRound className="h-5 w-5 text-[#0f274a]" />
            <h3 className="font-display text-base font-bold text-slate-900">Keamanan & Kata Sandi</h3>
          </div>

          <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Kata Sandi Baru</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Konfirmasi Kata Sandi Baru
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              Pembaruan kata sandi diproses langsung melalui Supabase Authentication secara terenkripsi.
            </p>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {savingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
