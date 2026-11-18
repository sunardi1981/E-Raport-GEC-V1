import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Copy,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError, supabase } from '../lib/supabase';
import { formatIndonesianDateTime, getTodayJakartaISO } from '../lib/dateUtils';
import { downloadReportPdf } from '../lib/pdfGenerator';
import { downloadReportWord } from '../lib/wordGenerator';
import {
  REPORT_STATUS_LABELS,
  SEMESTER_OPTIONS,
  type Report,
  type ReportStatus,
} from '../types/database';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function ReportsListPage() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingWordId, setDownloadingWordId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('reports')
        .select('*, students(*)')
        .eq('teacher_id', user.id)
        .order('updated_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setReports((data ?? []) as Report[]);
    } catch (err) {
      setError(formatSupabaseError(err, 'Gagal memuat daftar rapot tersimpan.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const uniqueYears = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.academic_year?.trim()) set.add(r.academic_year.trim());
    });
    return Array.from(set).sort().reverse();
  }, [reports]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reports.filter((r) => {
      const studentName = (r.students?.student_name || r.student_name_snapshot || '').toLowerCase();
      if (q && !studentName.includes(q)) return false;
      if (semesterFilter !== 'all' && r.semester !== semesterFilter) return false;
      if (yearFilter !== 'all' && r.academic_year !== yearFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });

    list.sort((a, b) => {
      const tA = new Date(a.updated_at).getTime();
      const tB = new Date(b.updated_at).getTime();
      return sortOrder === 'newest' ? tB - tA : tA - tB;
    });

    return list;
  }, [reports, searchQuery, semesterFilter, yearFilter, statusFilter, sortOrder]);

  const handleDownloadPdf = async (report: Report) => {
    setDownloadingId(report.id);
    try {
      const studentName = report.students?.student_name || report.student_name_snapshot || 'Siswa';
      const educationLevel = report.students?.education_level || report.education_level_snapshot || '-';
      const className = report.students?.class_name || report.class_name_snapshot || '-';
      const teacherName =
        report.teacher_name_snapshot || profile?.full_name || user?.email?.split('@')[0] || 'Guru GEC';

      const filename = await downloadReportPdf({
        studentName,
        educationLevel,
        className,
        schoolName: report.students?.school_name,
        parentName: report.parent_name || report.students?.parent_name,
        semester: report.semester,
        academicYear: report.academic_year,
        reportPeriod: report.report_period,
        reportDate: report.report_date,
        reportCity: report.report_city || 'Rejang Lebong',
        teacherName,
        knowledgeData: report.knowledge_data ?? [],
        attitudeData: report.attitude_data ?? [],
        skillData: report.skill_data ?? [],
        teacherNotes: report.teacher_notes,
      });
      showToast('success', 'PDF berhasil diunduh', filename);
    } catch {
      showToast('error', 'Gagal mengunduh PDF', 'Terjadi kesalahan saat menyusun dokumen PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadWord = async (report: Report) => {
    setDownloadingWordId(report.id);
    try {
      const studentName = report.students?.student_name || report.student_name_snapshot || 'Siswa';
      const educationLevel = report.students?.education_level || report.education_level_snapshot || '-';
      const className = report.students?.class_name || report.class_name_snapshot || '-';
      const teacherName =
        report.teacher_name_snapshot || profile?.full_name || user?.email?.split('@')[0] || 'Guru GEC';

      const filename = await downloadReportWord({
        studentName,
        educationLevel,
        className,
        schoolName: report.students?.school_name,
        parentName: report.parent_name || report.students?.parent_name,
        semester: report.semester,
        academicYear: report.academic_year,
        reportPeriod: report.report_period,
        reportDate: report.report_date,
        reportCity: report.report_city || 'Rejang Lebong',
        teacherName,
        knowledgeData: report.knowledge_data ?? [],
        attitudeData: report.attitude_data ?? [],
        skillData: report.skill_data ?? [],
        teacherNotes: report.teacher_notes,
      });
      showToast('success', 'Dokumen Word berhasil diunduh', filename);
    } catch {
      showToast('error', 'Gagal mengunduh Word', 'Terjadi kesalahan saat menyusun dokumen Word.');
    } finally {
      setDownloadingWordId(null);
    }
  };

  const handleDuplicate = async (report: Report) => {
    if (!supabase || !user || duplicatingId) return;
    setDuplicatingId(report.id);
    try {
      const { data, error: dupErr } = await supabase
        .from('reports')
        .insert({
          teacher_id: user.id,
          student_id: report.student_id,
          student_name_snapshot: report.student_name_snapshot,
          education_level_snapshot: report.education_level_snapshot,
          class_name_snapshot: report.class_name_snapshot,
          teacher_name_snapshot: profile?.full_name || report.teacher_name_snapshot,
          report_title: report.report_title ? `${report.report_title} (Salinan)` : null,
          semester: report.semester,
          academic_year: report.academic_year,
          report_period: report.report_period,
          report_date: getTodayJakartaISO(),
          report_city: report.report_city || 'Rejang Lebong',
          parent_name: report.parent_name,
          status: 'draft',
          knowledge_data: report.knowledge_data ?? [],
          attitude_data: report.attitude_data ?? [],
          skill_data: report.skill_data ?? [],
          teacher_notes: report.teacher_notes,
          share_enabled: false,
          share_token: null,
        })
        .select('id')
        .single();

      if (dupErr) throw dupErr;
      showToast('success', 'Rapot diduplikasi', 'Salinan draft baru berhasil dibuat.');
      if (data?.id) {
        navigate(`/rapot/${data.id}`);
      } else {
        await loadReports();
      }
    } catch (err) {
      showToast('error', 'Gagal menduplikasi rapot', formatSupabaseError(err));
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!supabase || !user || !deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('reports')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('teacher_id', user.id);

      if (delErr) throw delErr;
      showToast('success', 'Rapot dihapus', 'Dokumen rapot telah dihapus permanen.');
      setDeleteTarget(null);
      await loadReports();
    } catch (err) {
      showToast('error', 'Gagal menghapus rapot', formatSupabaseError(err));
    } finally {
      setDeleting(false);
    }
  };

  const statusStyle: Record<ReportStatus, string> = {
    draft: 'border-amber-200 bg-amber-50 text-amber-800',
    ready: 'border-sky-200 bg-sky-50 text-sky-800',
    final: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Rapot Tersimpan</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Lanjutkan pengisian draft, lihat preview A4, duplikasi, atau cetak PDF rapot milik Anda.
          </p>
        </div>
        <Link
          to="/rapot/baru"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163561] transition-colors whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="h-4 w-4" />
          Buat Rapot Baru
        </Link>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
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
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          aria-label="Filter Semester"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
        >
          <option value="all">Semua Semester</option>
          {SEMESTER_OPTIONS.map((sem) => (
            <option key={sem} value={sem}>
              {sem}
            </option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          aria-label="Filter Tahun Ajaran"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
        >
          <option value="all">Semua Tahun Ajaran</option>
          {uniqueYears.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ReportStatus)}
            aria-label="Filter Status"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
          >
            <option value="all">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="ready">Siap Cetak</option>
            <option value="final">Final</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
            aria-label="Urutkan"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 focus:border-sky-600 focus:outline-none"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadReports()}
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
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileCheck2 className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {reports.length === 0
                ? 'Belum ada rapot tersimpan. Klik Buat Rapot untuk memulai.'
                : 'Tidak ada rapot yang sesuai dengan filter pencarian.'}
            </p>
            {reports.length === 0 && (
              <Link
                to="/rapot/baru"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163561]"
              >
                <FilePlus2 className="h-4 w-4" />
                Buat Rapot
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                  <th className="px-5 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Tahun Ajaran</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Terakhir Diperbarui</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReports.map((rep) => {
                  const sName = rep.students?.student_name || rep.student_name_snapshot || 'Siswa';
                  const sClass = [
                    rep.students?.education_level || rep.education_level_snapshot,
                    rep.students?.class_name || rep.class_name_snapshot,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{sName}</td>
                      <td className="px-4 py-3.5 text-slate-600">{sClass || '-'}</td>
                      <td className="px-4 py-3.5 text-slate-700">{rep.semester}</td>
                      <td className="px-4 py-3.5 text-slate-700 tabular-nums">{rep.academic_year}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${statusStyle[rep.status]}`}
                        >
                          {REPORT_STATUS_LABELS[rep.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 tabular-nums">
                        {formatIndonesianDateTime(rep.updated_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            to={`/rapot/${rep.id}`}
                            title="Edit Rapot"
                            className="rounded-md border border-slate-200 p-1.5 text-[#0f274a] hover:bg-slate-100"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/rapot/${rep.id}?tab=preview`}
                            title="Preview Rapot"
                            className="rounded-md border border-slate-200 p-1.5 text-sky-700 hover:bg-sky-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDownloadPdf(rep)}
                            disabled={downloadingId === rep.id}
                            title="Download PDF"
                            className="rounded-md border border-slate-200 p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadWord(rep)}
                            disabled={downloadingWordId === rep.id}
                            title="Download Word (.docx)"
                            className="rounded-md border border-slate-200 p-1.5 text-sky-700 hover:bg-sky-50 disabled:opacity-40"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDuplicate(rep)}
                            disabled={duplicatingId === rep.id}
                            title="Duplikasi Rapot"
                            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(rep)}
                            title="Hapus Rapot"
                            className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Dokumen Rapot"
        description={`Apakah Anda yakin ingin menghapus rapot milik "${
          deleteTarget?.students?.student_name || deleteTarget?.student_name_snapshot || 'siswa'
        }" (${deleteTarget?.semester} ${deleteTarget?.academic_year})? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Rapot"
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
