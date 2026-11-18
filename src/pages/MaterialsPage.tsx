import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Edit3, Library, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { materialSchema } from '../lib/validation';
import { EDUCATION_LEVELS, type LearningMaterial, type Subject } from '../types/database';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function MaterialsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<LearningMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LearningMaterial | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [subjectId, setSubjectId] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    try {
      const [subjRes, matRes] = await Promise.all([
        supabase
          .from('subjects')
          .select('*')
          .eq('teacher_id', user.id)
          .order('subject_name', { ascending: true }),
        supabase
          .from('learning_materials')
          .select('*, subjects(id, subject_name, education_level)')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (subjRes.error) throw subjRes.error;
      if (matRes.error) throw matRes.error;

      setSubjects((subjRes.data ?? []) as Subject[]);
      setMaterials((matRes.data ?? []) as LearningMaterial[]);
    } catch (err) {
      setError(formatSupabaseError(err, 'Gagal memuat materi pembelajaran.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = useCallback(() => {
    setEditingMaterial(null);
    setSubjectId(subjects[0]?.id ?? '');
    setMaterialName('');
    setMaterialDescription('');
    setClassLevel('');
    setFormError(null);
    setFormOpen(true);
  }, [subjects]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && !loading) {
      openCreateModal();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, loading, openCreateModal]);

  const openEditModal = (mat: LearningMaterial) => {
    setEditingMaterial(mat);
    setSubjectId(mat.subject_id ?? '');
    setMaterialName(mat.material_name);
    setMaterialDescription(mat.material_description ?? '');
    setClassLevel(mat.class_level ?? '');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || submitting) return;
    setFormError(null);

    const parsed = materialSchema.safeParse({
      subject_id: subjectId,
      material_name: materialName,
      material_description: materialDescription || null,
      class_level: classLevel || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Data materi tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingMaterial) {
        const { error: updateErr } = await supabase
          .from('learning_materials')
          .update({
            subject_id: parsed.data.subject_id,
            material_name: parsed.data.material_name,
            material_description: parsed.data.material_description || null,
            class_level: parsed.data.class_level || null,
          })
          .eq('id', editingMaterial.id)
          .eq('teacher_id', user.id);

        if (updateErr) throw updateErr;
        showToast('success', 'Materi diperbarui', parsed.data.material_name);
      } else {
        const { error: insertErr } = await supabase.from('learning_materials').insert({
          teacher_id: user.id,
          subject_id: parsed.data.subject_id,
          material_name: parsed.data.material_name,
          material_description: parsed.data.material_description || null,
          class_level: parsed.data.class_level || null,
        });

        if (insertErr) throw insertErr;
        showToast('success', 'Materi ditambahkan', parsed.data.material_name);
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setFormError(formatSupabaseError(err, 'Gagal menyimpan materi pembelajaran.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!supabase || !user || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('learning_materials')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('teacher_id', user.id);

      if (delErr) throw delErr;
      showToast('success', 'Materi dihapus', deleteTarget.material_name);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast('error', 'Gagal menghapus materi', formatSupabaseError(err));
    } finally {
      setDeleting(false);
    }
  };

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return materials.filter((mat) => {
      if (
        q &&
        !mat.material_name.toLowerCase().includes(q) &&
        !(mat.material_description ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (subjectFilter !== 'all' && mat.subject_id !== subjectFilter) return false;
      if (levelFilter !== 'all') {
        const lvl = (mat.class_level || mat.subjects?.education_level || '').toLowerCase();
        if (!lvl.includes(levelFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [materials, searchQuery, subjectFilter, levelFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Bank Materi Pembelajaran</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Simpan materi pembelajaran agar dapat dipilih ulang dengan cepat saat menyusun rapot.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163561] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Tambah Materi
        </button>
      </div>

      {!loading && subjects.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Anda belum memiliki daftar mata pelajaran.{' '}
          <Link to="/mapel?new=1" className="font-semibold underline">
            Tambahkan Mata Pelajaran terlebih dahulu
          </Link>{' '}
          agar materi dapat dikelompokkan per pelajaran.
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau deskripsi materi..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
          />
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label="Filter Mata Pelajaran"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
        >
          <option value="all">Semua Mata Pelajaran</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.subject_name} {s.education_level ? `(${s.education_level})` : ''}
            </option>
          ))}
        </select>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          aria-label="Filter Jenjang"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
        >
          <option value="all">Semua Jenjang</option>
          {EDUCATION_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadData()}
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
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Library className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {materials.length === 0
                ? 'Belum ada materi pembelajaran tersimpan. Klik Tambah Materi untuk memulai.'
                : 'Tidak ada materi yang sesuai dengan filter pencarian.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="px-5 py-3">Mata Pelajaran</th>
                  <th className="px-4 py-3">Nama Materi</th>
                  <th className="px-4 py-3">Jenjang / Kelas</th>
                  <th className="px-4 py-3">Deskripsi Materi</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredMaterials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#0f274a]">
                      {mat.subjects?.subject_name || '-'}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{mat.material_name}</td>
                    <td className="px-4 py-3.5 text-slate-600">{mat.class_level || '-'}</td>
                    <td className="px-4 py-3.5 max-w-md text-slate-600">
                      <p className="line-clamp-2">{mat.material_description || '-'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(mat)}
                          className="rounded-md border border-slate-200 p-1.5 text-sky-700 hover:bg-sky-50"
                          title="Edit Materi"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(mat)}
                          className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
                          title="Hapus Materi"
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
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingMaterial ? 'Edit Materi Pembelajaran' : 'Tambah Materi Pembelajaran'}
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
                  Mata Pelajaran <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject_name} {s.education_level ? `(${s.education_level})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Materi <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  placeholder="Contoh: Pecahan, Persamaan Linear, Tenses"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Jenjang / Kelas</label>
                <input
                  type="text"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  placeholder="Contoh: SD Kelas 5, SMP Kelas 7"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Deskripsi Singkat Materi</label>
                <textarea
                  rows={3}
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  placeholder="Ringkasan capaian pembelajaran materi ini..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
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
                  disabled={submitting || subjects.length === 0}
                  className="rounded-lg bg-[#0f274a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163561] disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Materi Pembelajaran"
        description={`Apakah Anda yakin ingin menghapus materi "${deleteTarget?.material_name}"? Rapot yang sudah disimpan tetap mempertahankan isi datanya.`}
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
