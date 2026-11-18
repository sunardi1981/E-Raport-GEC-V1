import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText, FileWarning, Printer, RefreshCw } from 'lucide-react';
import { isSupabaseConfigured, supabase, formatSupabaseError } from '../lib/supabase';
import type { SharedReportView } from '../types/database';
import { ReportDocumentPreview } from '../components/ReportDocumentPreview';
import { downloadReportPdf } from '../lib/pdfGenerator';
import { downloadReportWord } from '../lib/wordGenerator';
import { useToast } from '../contexts/ToastContext';

export function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const { showToast } = useToast();
  const [report, setReport] = useState<SharedReportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  const loadSharedReport = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Sistem rapot belum terkonfigurasi.');
      setLoading(false);
      return;
    }

    if (!token || token.trim().length < 16) {
      setErrorMsg('Tautan rapot tidak valid.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('get_shared_report', {
        p_share_token: token.trim(),
      });

      if (error) {
        setErrorMsg(formatSupabaseError(error));
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setErrorMsg('Rapot tidak ditemukan atau tautan berbagi telah dinonaktifkan oleh guru.');
        return;
      }
      setReport(row as SharedReportView);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSharedReport();
  }, [loadSharedReport]);

  const handleDownloadPdf = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const filename = await downloadReportPdf({
        studentName: report.student_name,
        educationLevel: report.education_level,
        className: report.class_name,
        schoolName: report.school_name,
        parentName: report.parent_name,
        semester: report.semester,
        academicYear: report.academic_year,
        reportPeriod: report.report_period,
        reportDate: report.report_date,
        reportCity: report.report_city,
        teacherName: report.teacher_name,
        knowledgeData: report.knowledge_data ?? [],
        attitudeData: report.attitude_data ?? [],
        skillData: report.skill_data ?? [],
        teacherNotes: report.teacher_notes,
      });
      showToast('success', 'PDF berhasil diunduh', filename);
    } catch {
      showToast('error', 'Gagal membuat PDF', 'Silakan coba unduh ulang beberapa saat lagi.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadWord = async () => {
    if (!report) return;
    setDownloadingWord(true);
    try {
      const filename = await downloadReportWord({
        studentName: report.student_name,
        educationLevel: report.education_level,
        className: report.class_name,
        schoolName: report.school_name,
        parentName: report.parent_name,
        semester: report.semester,
        academicYear: report.academic_year,
        reportPeriod: report.report_period,
        reportDate: report.report_date,
        reportCity: report.report_city,
        teacherName: report.teacher_name,
        knowledgeData: report.knowledge_data ?? [],
        attitudeData: report.attitude_data ?? [],
        skillData: report.skill_data ?? [],
        teacherNotes: report.teacher_notes,
      });
      showToast('success', 'Dokumen Word berhasil diunduh', filename);
    } catch {
      showToast('error', 'Gagal membuat file Word', 'Silakan coba unduh ulang beberapa saat lagi.');
    } finally {
      setDownloadingWord(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/logo_GEC_4cd69325.png"
              alt="Logo GEC"
              referrerPolicy="no-referrer"
              className="h-9 w-12 rounded object-contain"
            />
            <div>
              <p className="font-display text-sm font-bold text-[#0f274a]">
                GEC RAPOT · Tampilan Orang Tua / Wali (Read-Only)
              </p>
              <p className="text-xs text-slate-500">Bimbingan Belajar Galaxi Edu Center</p>
            </div>
          </div>

          {report && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Printer className="h-4 w-4" />
                Cetak
              </button>
              <button
                type="button"
                onClick={handleDownloadWord}
                disabled={downloadingWord}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700 bg-white px-3.5 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-50 whitespace-nowrap"
              >
                <FileText className="h-4 w-4" />
                {downloadingWord ? 'Menyiapkan Word...' : 'Download Word'}
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f274a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163561] disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Menyiapkan PDF...' : 'Download PDF'}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0f274a] border-t-transparent" />
            <p className="mt-3 text-sm text-slate-600">Memuat dokumen rapot...</p>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <FileWarning className="mx-auto h-10 w-10 text-amber-600" />
            <h1 className="mt-4 font-display text-lg font-bold text-slate-900">
              Dokumen Rapot Tidak Tersedia
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{errorMsg}</p>
            <button
              type="button"
              onClick={() => void loadSharedReport()}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Coba Lagi
            </button>
          </div>
        )}

        {!loading && report && (
          <ReportDocumentPreview
            studentName={report.student_name}
            educationLevel={report.education_level}
            className={report.class_name}
            schoolName={report.school_name}
            parentName={report.parent_name}
            semester={report.semester}
            academicYear={report.academic_year}
            reportPeriod={report.report_period}
            reportDate={report.report_date}
            reportCity={report.report_city}
            teacherName={report.teacher_name}
            knowledgeData={report.knowledge_data ?? []}
            attitudeData={report.attitude_data ?? []}
            skillData={report.skill_data ?? []}
            teacherNotes={report.teacher_notes}
          />
        )}
      </main>
    </div>
  );
}
