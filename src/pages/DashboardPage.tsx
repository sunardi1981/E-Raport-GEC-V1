import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Clock,
  FileCheck2,
  FileEdit,
  FilePlus2,
  GraduationCap,
  Library,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { formatIndonesianDateTime } from '../lib/dateUtils';
import { REPORT_STATUS_LABELS, type ReportStatus } from '../types/database';

interface DashboardStats {
  activeStudents: number;
  totalReports: number;
  draftReports: number;
  finalReports: number;
  lastUpdatedReportAt: string | null;
}

interface RecentReportRow {
  id: string;
  student_name_snapshot: string | null;
  semester: string;
  academic_year: string;
  status: ReportStatus;
  updated_at: string;
  students: { student_name: string } | null;
}

export function DashboardPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeStudents: 0,
    totalReports: 0,
    draftReports: 0,
    finalReports: 0,
    lastUpdatedReportAt: null,
  });
  const [recentReports, setRecentReports] = useState<RecentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);

    try {
      const [studentsRes, reportsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, status')
          .eq('teacher_id', user.id),
        supabase
          .from('reports')
          .select('id, student_name_snapshot, semester, academic_year, status, updated_at, students(student_name)')
          .eq('teacher_id', user.id)
          .order('updated_at', { ascending: false }),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (reportsRes.error) throw reportsRes.error;

      const studentsList = studentsRes.data ?? [];
      const reportsList = (reportsRes.data ?? []) as unknown as RecentReportRow[];

      const activeStudents = studentsList.filter((s) => s.status === 'active').length;
      const totalReports = reportsList.length;
      const draftReports = reportsList.filter((r) => r.status === 'draft').length;
      const finalReports = reportsList.filter((r) => r.status === 'final').length;
      const lastUpdatedReportAt = reportsList[0]?.updated_at ?? null;

      setStats({
        activeStudents,
        totalReports,
        draftReports,
        finalReports,
        lastUpdatedReportAt,
      });
      setRecentReports(reportsList.slice(0, 8));
    } catch (err) {
      setError(formatSupabaseError(err, 'Gagal memuat ringkasan dashboard.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const teacherName = profile?.full_name || user?.email?.split('@')[0] || 'Guru';

  const statusTextStyle: Record<ReportStatus, string> = {
    draft: 'text-amber-700 bg-amber-50 border-amber-200',
    ready: 'text-sky-700 bg-sky-50 border-sky-200',
    final: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Bimbel Galaxi Edu Center
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[#0f274a]">
            Selamat datang, {teacherName}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Kelola data siswa, mata pelajaran, materi, serta susun rapot perkembangan belajar secara terstruktur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            to="/rapot/baru"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163561] transition-colors whitespace-nowrap"
          >
            <FilePlus2 className="h-4 w-4" />
            Buat Rapot Baru
          </Link>
        </div>
      </section>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* Statistics Grid */}
      <section aria-label="Statistik Rapot">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Siswa Aktif</span>
              <GraduationCap className="h-4 w-4 text-[#0f274a]" />
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? '...' : stats.activeStudents}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Total Rapot</span>
              <FileCheck2 className="h-4 w-4 text-sky-600" />
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? '...' : stats.totalReports}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Rapot Draft</span>
              <FileEdit className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? '...' : stats.draftReports}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Rapot Final</span>
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {loading ? '...' : stats.finalReports}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Terakhir Diperbarui</span>
              <Clock className="h-4 w-4 text-[#c59b27]" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900 tabular-nums leading-snug">
              {loading
                ? '...'
                : stats.lastUpdatedReportAt
                ? formatIndonesianDateTime(stats.lastUpdatedReportAt)
                : 'Belum ada rapot'}
            </p>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h3 className="font-display text-base font-bold text-slate-900">Aksi Cepat</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/siswa?new=1"
            className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-sky-300 hover:bg-sky-50/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0f274a]/10 text-[#0f274a]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Tambah Siswa</p>
              <p className="text-xs text-slate-500">Daftarkan siswa baru</p>
            </div>
          </Link>

          <Link
            to="/rapot/baru"
            className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-sky-300 hover:bg-sky-50/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <FilePlus2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Buat Rapot</p>
              <p className="text-xs text-slate-500">Input penilaian siswa</p>
            </div>
          </Link>

          <Link
            to="/mapel?new=1"
            className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-sky-300 hover:bg-sky-50/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Tambah Mata Pelajaran</p>
              <p className="text-xs text-slate-500">Atur daftar pelajaran</p>
            </div>
          </Link>

          <Link
            to="/materi?new=1"
            className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-sky-300 hover:bg-sky-50/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Library className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Tambah Materi</p>
              <p className="text-xs text-slate-500">Simpan bank materi ajar</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Recent Activity Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">Aktivitas Terakhir</h3>
            <p className="text-xs text-slate-500">Daftar rapot yang terakhir Anda buat atau perbarui.</p>
          </div>
          <Link
            to="/rapot"
            className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap"
          >
            Lihat Semua Rapot
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : recentReports.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileEdit className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Belum ada rapot tersimpan. Klik Buat Rapot untuk memulai.
            </p>
            <Link
              to="/rapot/baru"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163561]"
            >
              <FilePlus2 className="h-4 w-4" />
              Buat Rapot Pertama
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="px-6 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Tahun Ajaran</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Terakhir Diedit</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentReports.map((rep) => {
                  const studentName = rep.students?.student_name || rep.student_name_snapshot || 'Siswa';
                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-slate-900">{studentName}</td>
                      <td className="px-4 py-3.5 text-slate-600">{rep.semester}</td>
                      <td className="px-4 py-3.5 text-slate-600 tabular-nums">{rep.academic_year}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${statusTextStyle[rep.status]}`}
                        >
                          {REPORT_STATUS_LABELS[rep.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 tabular-nums">
                        {formatIndonesianDateTime(rep.updated_at)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Link
                          to={`/rapot/${rep.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0f274a] hover:bg-slate-50 whitespace-nowrap"
                        >
                          Buka / Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
