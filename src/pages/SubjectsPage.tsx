import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Edit3, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { subjectSchema } from '../lib/validation';
import { EDUCATION_LEVELS, type Subject } from '../types/database';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function SubjectsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [subjectName, setSubjectName] = useState('');
  const [educationLevel, setEducationLevel] = useState<string>('SD');
  const [formError, setFormError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('subjects')
        .select('*')
        .eq('teacher_id', user.id)
        .order('subject_name', { ascending: true });

      if (fetchErr) throw fetchErr;
      setSubjects((data ?? []) as Subject[]);
    } catch (err) {
      setError(formatSupabaseError(err, 'Gagal memuat daftar mata pelajaran.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  const openCreateModal = useCallback(() => {
    setEditingSubject(null);
    setSubjectName('');
    setEducationLevel('SD');
    setFormError(null);
    setFormOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreateModal();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, openCreateModal]);

  const openEditModal = (subj: Subject) => {
    setEditingSubject(subj);
    setSubjectName(subj.subject_name);
    setEducationLevel(subj.education_level || 'SD');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || submitting) return;
    setFormError(null);

    const parsed = subjectSchema.safeParse({
      subject_name: subjectName,
      education_level: educationLevel || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Isian mata pelajaran tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSubject) {
        const { error: updateErr } = await supabase
          .from('subjects')
          .update({
            subject_name: parsed.data.subject_name,
            education_level: parsed.data.education_level || null,
          })
          .eq('id', editingSubject.id)
          .eq('teacher_id', user.id);

        if (updateErr) throw updateErr;
        showToast('success', 'Mata pelajaran diperbarui', parsed.data.subject_name);
      } else {
        const { error: insertErr } = await supabase.from('subjects').insert({
          teacher_id: user.id,
          subject_name: parsed.data.subject_name,
          education_level: parsed.data.education_level || null,
        });

        if (insertErr) throw insertErr;
        showToast('success', 'Mata pelajaran ditambahkan', parsed.data.subject_name);
      }
      setFormOpen(false);
      await loadSubjects();
    } catch (err) {
      setFormError(formatSupabaseError(err, 'Gagal menyimpan mata pelajaran.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!supabase || !user || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('subjects')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('teacher_id', user.id);

      if (delErr) throw delErr;
      showToast('success', 'Mata pelajaran dihapus', deleteTarget.subject_name);
      setDeleteTarget(null);
      await loadSubjects();
    } catch (err) {
      showToast('error', 'Gagal menghapus mata pelajaran', formatSupabaseError(err));
    } finally {
      setDeleting(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subjects.filter((subj) => {
      if (q && !subj.subject_name.toLowerCase().includes(q)) return false;
      if (levelFilter !== 'all' && subj.education_level !== levelFilter) return false;
      return true;
    });
  }, [subjects, searchQuery, levelFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Daftar Mata Pelajaran</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Kelola mata pelajaran khusus akun Anda untuk digunakan saat mengisi penilaian rapot.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163561] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Tambah Mata Pelajaran
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari mata pelajaran..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          aria-label="Filter Jenjang"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
        >
          <option value="all">Semua Jenjang</option>
          {EDUCATION_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              Jenjang {lvl}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadSubjects()}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat Ulang
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {subjects.length === 0
                ? 'Belum ada mata pelajaran. Tambahkan mata pelajaran pertama Anda.'
                : 'Tidak ada mata pelajaran yang sesuai dengan pencarian.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="w-14 px-5 py-3">No</th>
                  <th className="px-4 py-3">Mata Pelajaran</th>
                  <th className="px-4 py-3">Jenjang</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSubjects.map((subj, idx) => (
                  <tr key={subj.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{subj.subject_name}</td>
                    <td className="px-4 py-3.5 text-slate-600">{subj.education_level || 'Semua Jenjang'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(subj)}
                          className="rounded-md border border-slate-200 p-1.5 text-sky-700 hover:bg-sky-50"
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(subj)}
                          className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Mata Pelajaran <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="Contoh: Matematika, Bahasa Inggris, IPA"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Jenjang</label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                >
                  {EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#0f274a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163561] disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Mata Pelajaran"
        description={`Hapus mata pelajaran "${deleteTarget?.subject_name}"? Materi pembelajaran yang terkait dengan mata pelajaran ini juga akan terhapus.`}
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
