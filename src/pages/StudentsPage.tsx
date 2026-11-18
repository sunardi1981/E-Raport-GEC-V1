import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { studentSchema } from '../lib/validation';
import { getDefaultAcademicYear, formatIndonesianDateTime } from '../lib/dateUtils';
import { EDUCATION_LEVELS, type Student, type StudentStatus } from '../types/database';
import { ConfirmDialog } from '../components/ConfirmDialog';

const PAGE_SIZE = 10;

export function StudentsPage() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentStatus>('all');
  const [page, setPage] = useState(1);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [studentName, setStudentName] = useState('');
  const [educationLevel, setEducationLevel] = useState<string>('SD');
  const [className, setClassName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [parentName, setParentName] = useState('');
  const [academicYear, setAcademicYear] = useState(
    profile?.preferences?.default_academic_year || getDefaultAcademicYear()
  );
  const [status, setStatus] = useState<StudentStatus>('active');
  const [formError, setFormError] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', user.id)
        .order('student_name', { ascending: true });

      if (fetchErr) throw fetchErr;
      setStudents((data ?? []) as Student[]);
    } catch (err) {
      setError(formatSupabaseError(err, 'Gagal memuat data siswa.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const openCreateModal = useCallback(() => {
    setEditingStudent(null);
    setStudentName('');
    setEducationLevel('SD');
    setClassName('');
    setSchoolName('');
    setParentName('');
    setAcademicYear(profile?.preferences?.default_academic_year || getDefaultAcademicYear());
    setStatus('active');
    setFormError(null);
    setFormOpen(true);
  }, [profile]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreateModal();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, openCreateModal]);

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setStudentName(student.student_name);
    setEducationLevel(student.education_level);
    setClassName(student.class_name);
    setSchoolName(student.school_name ?? '');
    setParentName(student.parent_name ?? '');
    setAcademicYear(student.academic_year || getDefaultAcademicYear());
    setStatus(student.status);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || submitting) return;
    setFormError(null);

    const parsed = studentSchema.safeParse({
      student_name: studentName,
      education_level: educationLevel,
      class_name: className,
      school_name: schoolName || null,
      parent_name: parentName || null,
      academic_year: academicYear,
      status,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Periksa kembali isian formulir siswa.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingStudent) {
        const { error: updateErr } = await supabase
          .from('students')
          .update({
            student_name: parsed.data.student_name,
            education_level: parsed.data.education_level,
            class_name: parsed.data.class_name,
            school_name: parsed.data.school_name || null,
            parent_name: parsed.data.parent_name || null,
            academic_year: parsed.data.academic_year,
            status: parsed.data.status,
          })
          .eq('id', editingStudent.id)
          .eq('teacher_id', user.id);

        if (updateErr) throw updateErr;
        showToast('success', 'Data siswa diperbarui', parsed.data.student_name);
      } else {
        const { error: insertErr } = await supabase.from('students').insert({
          teacher_id: user.id,
          student_name: parsed.data.student_name,
          education_level: parsed.data.education_level,
          class_name: parsed.data.class_name,
          school_name: parsed.data.school_name || null,
          parent_name: parsed.data.parent_name || null,
          academic_year: parsed.data.academic_year,
          status: parsed.data.status,
        });

        if (insertErr) throw insertErr;
        showToast('success', 'Siswa berhasil ditambahkan', parsed.data.student_name);
      }

      setFormOpen(false);
      await loadStudents();
    } catch (err) {
      setFormError(formatSupabaseError(err, 'Gagal menyimpan data siswa.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!supabase || !user || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('students')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('teacher_id', user.id);

      if (delErr) throw delErr;
      showToast('success', 'Siswa dihapus', `${deleteTarget.student_name} telah dihapus.`);
      setDeleteTarget(null);
      await loadStudents();
    } catch (err) {
      showToast('error', 'Gagal menghapus siswa', formatSupabaseError(err));
    } finally {
      setDeleting(false);
    }
  };

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.class_name?.trim()) set.add(s.class_name.trim());
    });
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !s.student_name.toLowerCase().includes(q)) return false;
      if (levelFilter !== 'all' && s.education_level !== levelFilter) return false;
      if (classFilter !== 'all' && s.class_name !== classFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      return true;
    });
  }, [students, searchQuery, levelFilter, classFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, levelFilter, classFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Manajemen Data Siswa</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Data siswa terisolasi per akun guru. Total{' '}
            <span className="font-semibold tabular-nums text-slate-900">{students.length}</span> siswa terdaftar.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163561] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Tambah Siswa
        </button>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama siswa..."
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

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Filter Kelas"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
        >
          <option value="all">Semua Kelas</option>
          {uniqueClasses.map((cls) => (
            <option key={cls} value={cls}>
              Kelas {cls}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | StudentStatus)}
          aria-label="Filter Status"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadStudents()}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat Ulang
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-11 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UserCheck className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {students.length === 0
                ? 'Belum ada data siswa. Klik Tambah Siswa untuk mendaftarkan siswa pertama.'
                : 'Tidak ada siswa yang sesuai dengan filter pencarian.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="px-5 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Jenjang / Kelas</th>
                  <th className="px-4 py-3">Sekolah Asal</th>
                  <th className="px-4 py-3">Orang Tua / Wali</th>
                  <th className="px-4 py-3">Tahun Ajaran</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{s.student_name}</td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {s.education_level} · {s.class_name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{s.school_name || '-'}</td>
                    <td className="px-4 py-3.5 text-slate-600">{s.parent_name || '-'}</td>
                    <td className="px-4 py-3.5 text-slate-600 tabular-nums">{s.academic_year}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${
                          s.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailStudent(s)}
                          title="Detail Siswa"
                          className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          title="Edit Siswa"
                          className="rounded-md border border-slate-200 p-1.5 text-sky-700 hover:bg-sky-50"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          title="Hapus Siswa"
                          className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
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

        {/* Pagination */}
        {filteredStudents.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-600">
            <span className="tabular-nums">
              Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filteredStudents.length)} dari {filteredStudents.length} siswa
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-medium tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="mt-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Siswa <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Contoh: Aisyah Putri Ramadhani"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Jenjang <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Kelas <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Contoh: 5, VII, XI IPA 1"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Sekolah Asal</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Contoh: SDN 01 Rejang Lebong"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nama Orang Tua / Wali</label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="Contoh: Bapak Hendra Wijaya"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tahun Ajaran</label>
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2026/2027"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StudentStatus)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
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
                  {submitting ? 'Menyimpan...' : editingStudent ? 'Simpan Perubahan' : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">Detail Siswa</h3>
              <button
                type="button"
                onClick={() => setDetailStudent(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Nama Lengkap</dt>
                <dd className="font-semibold text-slate-900 text-right">{detailStudent.student_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Jenjang / Kelas</dt>
                <dd className="font-medium text-slate-800 text-right">
                  {detailStudent.education_level} · Kelas {detailStudent.class_name}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Sekolah Asal</dt>
                <dd className="text-slate-800 text-right">{detailStudent.school_name || '-'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Orang Tua / Wali</dt>
                <dd className="text-slate-800 text-right">{detailStudent.parent_name || '-'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Tahun Ajaran</dt>
                <dd className="tabular-nums text-slate-800 text-right">{detailStudent.academic_year}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium text-slate-800 text-right">
                  {detailStudent.status === 'active' ? 'Aktif' : 'Nonaktif'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Terakhir Diperbarui</dt>
                <dd className="tabular-nums text-xs text-slate-600 text-right">
                  {formatIndonesianDateTime(detailStudent.updated_at)}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const s = detailStudent;
                  setDetailStudent(null);
                  openEditModal(s);
                }}
                className="rounded-lg bg-[#0f274a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163561]"
              >
                Edit Siswa
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Data Siswa"
        description={`Apakah Anda yakin ingin menghapus data siswa "${deleteTarget?.student_name}"? Rapot yang terhubung dengan siswa ini juga akan terhapus permanen.`}
        confirmLabel="Ya, Hapus Siswa"
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
