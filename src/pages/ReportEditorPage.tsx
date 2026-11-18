import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileText,
  FileWarning,
  Link2,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatSupabaseError, isValidUuid, supabase } from '../lib/supabase';
import {
  formatJakartaTime,
  getDefaultAcademicYear,
  getTodayJakartaISO,
} from '../lib/dateUtils';
import {
  generateAttitudeDescription,
  generateKnowledgeDescription,
  generateSkillDescription,
} from '../lib/descriptionEngine';
import { downloadReportPdf } from '../lib/pdfGenerator';
import { downloadReportWord } from '../lib/wordGenerator';
import {
  ATTITUDE_OPTIONS,
  GRADE_LABELS,
  REPORT_STATUS_LABELS,
  SEMESTER_OPTIONS,
  SKILL_OPTIONS,
  type AttitudeItem,
  type Grade,
  type KnowledgeItem,
  type LearningMaterial,
  type Report,
  type ReportStatus,
  type SkillItem,
  type Student,
  type Subject,
} from '../types/database';
import { ReportDocumentPreview } from '../components/ReportDocumentPreview';

type EditorTab = 'identitas' | 'pengetahuan' | 'sikap' | 'keterampilan' | 'preview';
type AutosaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface ReportDraftForm {
  student_id: string;
  student_name_snapshot: string;
  education_level_snapshot: string;
  class_name_snapshot: string;
  school_name: string;
  parent_name: string;
  semester: string;
  academic_year: string;
  report_period: string;
  report_date: string;
  report_city: string;
  status: ReportStatus;
  knowledge_data: KnowledgeItem[];
  attitude_data: AttitudeItem[];
  skill_data: SkillItem[];
  teacher_notes: string;
  share_token: string | null;
  share_enabled: boolean;
}

function makeRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const GRADES: Grade[] = ['A', 'B', 'C', 'D'];

export function ReportEditorPage() {
  const { id: routeReportId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const isNewMode = !routeReportId;

  // Loading & Security states
  const [initializing, setInitializing] = useState(true);
  const [accessState, setAccessState] = useState<'ok' | 'not_found' | 'forbidden' | 'error'>('ok');
  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null);

  // Reference data from Supabase
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);

  // Active tab
  const initialTab = (searchParams.get('tab') as EditorTab) || 'identitas';
  const [activeTab, setActiveTab] = useState<EditorTab>(
    ['identitas', 'pengetahuan', 'sikap', 'keterampilan', 'preview'].includes(initialTab)
      ? initialTab
      : 'identitas'
  );

  // Form state
  const [form, setForm] = useState<ReportDraftForm>(() => ({
    student_id: '',
    student_name_snapshot: '',
    education_level_snapshot: '',
    class_name_snapshot: '',
    school_name: '',
    parent_name: '',
    semester: profile?.preferences?.default_semester || 'Semester Ganjil',
    academic_year: profile?.preferences?.default_academic_year || getDefaultAcademicYear(),
    report_period: `${profile?.preferences?.default_semester || 'Semester Ganjil'} ${
      profile?.preferences?.default_academic_year || getDefaultAcademicYear()
    }`,
    report_date: getTodayJakartaISO(),
    report_city: profile?.preferences?.default_city || 'Rejang Lebong',
    status: 'draft',
    knowledge_data: [],
    attitude_data: [],
    skill_data: [],
    teacher_notes: '',
    share_token: null,
    share_enabled: false,
  }));

  // Autosave orchestration refs (prevents duplicate inserts & race conditions)
  const reportIdRef = useRef<string | null>(routeReportId ?? null);
  const formRef = useRef<ReportDraftForm>(form);
  formRef.current = form;
  const saveTimerRef = useRef<number | null>(null);
  const saveSeqRef = useRef(0);
  const isDirtyRef = useRef(false);
  const isHydratedRef = useRef(false);

  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  // Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [updatingShare, setUpdatingShare] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);

  const teacherName =
    profile?.full_name || user?.email?.split('@')[0] || 'Guru Bimbel GEC';

  // Fetch students, subjects, materials + existing report (if editing)
  const initializeEditor = useCallback(async () => {
    if (!supabase || !user) return;
    setInitializing(true);
    setAccessState('ok');
    setLoadErrorMsg(null);
    isHydratedRef.current = false;

    try {
      // Validate UUID if editing existing report
      if (!isNewMode && !isValidUuid(routeReportId)) {
        setAccessState('not_found');
        setInitializing(false);
        return;
      }

      const [studentsRes, subjectsRes, materialsRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('teacher_id', user.id)
          .order('student_name', { ascending: true }),
        supabase
          .from('subjects')
          .select('*')
          .eq('teacher_id', user.id)
          .order('subject_name', { ascending: true }),
        supabase
          .from('learning_materials')
          .select('*, subjects(id, subject_name, education_level)')
          .eq('teacher_id', user.id)
          .order('material_name', { ascending: true }),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (materialsRes.error) throw materialsRes.error;

      setStudents((studentsRes.data ?? []) as Student[]);
      setSubjects((subjectsRes.data ?? []) as Subject[]);
      setMaterials((materialsRes.data ?? []) as LearningMaterial[]);

      if (!isNewMode && routeReportId) {
        const { data: reportRow, error: repErr } = await supabase
          .from('reports')
          .select('*, students(*)')
          .eq('id', routeReportId)
          .maybeSingle();

        if (repErr) throw repErr;

        if (!reportRow) {
          // Either doesn't exist or blocked by RLS because another teacher owns it
          setAccessState('not_found');
          setInitializing(false);
          return;
        }

        const rep = reportRow as Report;
        if (rep.teacher_id !== user.id) {
          setAccessState('forbidden');
          setInitializing(false);
          return;
        }

        reportIdRef.current = rep.id;
        setForm({
          student_id: rep.student_id,
          student_name_snapshot: rep.students?.student_name || rep.student_name_snapshot || '',
          education_level_snapshot: rep.students?.education_level || rep.education_level_snapshot || '',
          class_name_snapshot: rep.students?.class_name || rep.class_name_snapshot || '',
          school_name: rep.students?.school_name || '',
          parent_name: rep.parent_name || rep.students?.parent_name || '',
          semester: rep.semester || 'Semester Ganjil',
          academic_year: rep.academic_year || getDefaultAcademicYear(),
          report_period: rep.report_period || `${rep.semester} ${rep.academic_year}`,
          report_date: rep.report_date || getTodayJakartaISO(),
          report_city: rep.report_city || 'Rejang Lebong',
          status: rep.status || 'draft',
          knowledge_data: Array.isArray(rep.knowledge_data) ? rep.knowledge_data : [],
          attitude_data: Array.isArray(rep.attitude_data) ? rep.attitude_data : [],
          skill_data: Array.isArray(rep.skill_data) ? rep.skill_data : [],
          teacher_notes: rep.teacher_notes || '',
          share_token: rep.share_token,
          share_enabled: Boolean(rep.share_enabled),
        });
        setLastSavedAt(rep.updated_at);
        setAutosaveState('saved');
      } else {
        reportIdRef.current = null;
        setAutosaveState('idle');
      }

      isHydratedRef.current = true;
    } catch (err) {
      setAccessState('error');
      setLoadErrorMsg(formatSupabaseError(err, 'Gagal memuat data rapot.'));
    } finally {
      setInitializing(false);
    }
  }, [user, isNewMode, routeReportId]);

  useEffect(() => {
    void initializeEditor();
  }, [initializeEditor]);

  // Warn before closing tab when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current && (autosaveState === 'unsaved' || autosaveState === 'saving')) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autosaveState]);

  // Check duplicate report warning
  useEffect(() => {
    let active = true;
    async function checkDuplicate() {
      if (!supabase || !user || !form.student_id || !form.semester || !form.academic_year) {
        setDuplicateWarning(false);
        return;
      }
      let query = supabase
        .from('reports')
        .select('id')
        .eq('teacher_id', user.id)
        .eq('student_id', form.student_id)
        .eq('semester', form.semester)
        .eq('academic_year', form.academic_year)
        .eq('report_period', form.report_period.trim());

      if (reportIdRef.current) {
        query = query.neq('id', reportIdRef.current);
      }
      const { data } = await query.limit(1);
      if (active) {
        setDuplicateWarning((data?.length ?? 0) > 0);
      }
    }
    void checkDuplicate();
    return () => {
      active = false;
    };
  }, [user, form.student_id, form.semester, form.academic_year, form.report_period]);

  // Core persistence function (Upsert/Update using single stable UUID)
  const persistReport = useCallback(
    async (explicit = false) => {
      if (!supabase || !user) return;
      const snapshot = formRef.current;

      if (!snapshot.student_id) {
        if (explicit) {
          showToast('warning', 'Pilih Siswa Terlebih Dahulu', 'Siswa wajib dipilih sebelum menyimpan rapot.');
        }
        return;
      }

      const seq = ++saveSeqRef.current;
      setAutosaveState('saving');

      const payload = {
        teacher_id: user.id,
        student_id: snapshot.student_id,
        student_name_snapshot: snapshot.student_name_snapshot || null,
        education_level_snapshot: snapshot.education_level_snapshot || null,
        class_name_snapshot: snapshot.class_name_snapshot || null,
        teacher_name_snapshot: teacherName,
        report_title: `Rapot ${snapshot.student_name_snapshot} - ${snapshot.semester} ${snapshot.academic_year}`,
        semester: snapshot.semester,
        academic_year: snapshot.academic_year.trim() || getDefaultAcademicYear(),
        report_period:
          snapshot.report_period.trim() || `${snapshot.semester} ${snapshot.academic_year}`,
        report_date: snapshot.report_date || getTodayJakartaISO(),
        report_city: snapshot.report_city.trim() || 'Rejang Lebong',
        parent_name: snapshot.parent_name.trim() || null,
        status: snapshot.status,
        knowledge_data: snapshot.knowledge_data,
        attitude_data: snapshot.attitude_data,
        skill_data: snapshot.skill_data,
        teacher_notes: snapshot.teacher_notes.trim() || null,
      };

      try {
        if (!reportIdRef.current) {
          const { data: created, error: insertErr } = await supabase
            .from('reports')
            .insert(payload)
            .select('id, updated_at')
            .single();

          if (insertErr) throw insertErr;
          if (created?.id) {
            reportIdRef.current = created.id;
            // Sync URL cleanly to /rapot/:id without reloading component
            window.history.replaceState(null, '', `/rapot/${created.id}`);
          }
          if (seq === saveSeqRef.current) {
            isDirtyRef.current = false;
            setAutosaveState('saved');
            setLastSavedAt(created?.updated_at ?? new Date().toISOString());
          }
        } else {
          const { data: updated, error: updateErr } = await supabase
            .from('reports')
            .update(payload)
            .eq('id', reportIdRef.current)
            .eq('teacher_id', user.id)
            .select('updated_at')
            .single();

          if (updateErr) throw updateErr;
          if (seq === saveSeqRef.current) {
            isDirtyRef.current = false;
            setAutosaveState('saved');
            setLastSavedAt(updated?.updated_at ?? new Date().toISOString());
          }
        }

        if (explicit) {
          showToast('success', 'Rapot tersimpan', 'Seluruh perubahan telah disimpan ke Supabase.');
        }
      } catch (err) {
        if (seq === saveSeqRef.current) {
          setAutosaveState('error');
        }
        if (explicit) {
          showToast('error', 'Gagal menyimpan rapot', formatSupabaseError(err));
        }
      }
    },
    [user, teacherName, showToast]
  );

  // Debounced autosave scheduler (1000ms)
  const scheduleAutosave = useCallback(() => {
    if (!isHydratedRef.current) return;
    isDirtyRef.current = true;
    setAutosaveState('unsaved');

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void persistReport(false);
    }, 1000);
  }, [persistReport]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const updateForm = (updater: (prev: ReportDraftForm) => ReportDraftForm) => {
    setForm((prev) => updater(prev));
    scheduleAutosave();
  };

  const handleSelectStudent = (studentId: string) => {
    const selected = students.find((s) => s.id === studentId);
    updateForm((prev) => ({
      ...prev,
      student_id: studentId,
      student_name_snapshot: selected?.student_name ?? '',
      education_level_snapshot: selected?.education_level ?? '',
      class_name_snapshot: selected?.class_name ?? '',
      school_name: selected?.school_name ?? '',
      parent_name: selected?.parent_name ?? prev.parent_name,
      academic_year: selected?.academic_year || prev.academic_year,
    }));
  };

  // --- BAGIAN A: PENGETAHUAN HANDLERS ---
  const addKnowledgeRow = () => {
    const defaultSubject = subjects[0]?.subject_name || '';
    const defaultSubjectId = subjects[0]?.id || null;
    const defaultGrade: Grade = 'A';
    updateForm((prev) => ({
      ...prev,
      knowledge_data: [
        ...prev.knowledge_data,
        {
          id: makeRowId(),
          subject_id: defaultSubjectId,
          subject: defaultSubject,
          material: '',
          grade: defaultGrade,
          description: generateKnowledgeDescription(defaultSubject, '', defaultGrade),
          description_mode: 'auto',
        },
      ],
    }));
  };

  const updateKnowledgeRow = (
    rowId: string,
    patch: Partial<KnowledgeItem>,
    forceAutoRegen = false
  ) => {
    updateForm((prev) => ({
      ...prev,
      knowledge_data: prev.knowledge_data.map((row) => {
        if (row.id !== rowId) return row;
        const next: KnowledgeItem = { ...row, ...patch };
        if (forceAutoRegen) {
          next.description_mode = 'auto';
          next.description = generateKnowledgeDescription(
            next.subject,
            next.material,
            next.grade
          );
        } else if (
          next.description_mode === 'auto' &&
          patch.description === undefined &&
          (patch.subject !== undefined || patch.material !== undefined || patch.grade !== undefined)
        ) {
          next.description = generateKnowledgeDescription(
            next.subject,
            next.material,
            next.grade
          );
        }
        return next;
      }),
    }));
  };

  const removeKnowledgeRow = (rowId: string) => {
    updateForm((prev) => ({
      ...prev,
      knowledge_data: prev.knowledge_data.filter((r) => r.id !== rowId),
    }));
  };

  // --- BAGIAN B: SIKAP HANDLERS ---
  const addAttitudeRow = () => {
    const defaultAttitude = ATTITUDE_OPTIONS[0];
    const defaultGrade: Grade = 'A';
    updateForm((prev) => ({
      ...prev,
      attitude_data: [
        ...prev.attitude_data,
        {
          id: makeRowId(),
          attitude: defaultAttitude,
          custom_attitude: '',
          grade: defaultGrade,
          description: generateAttitudeDescription(defaultAttitude, defaultGrade),
          description_mode: 'auto',
        },
      ],
    }));
  };

  const updateAttitudeRow = (
    rowId: string,
    patch: Partial<AttitudeItem>,
    forceAutoRegen = false
  ) => {
    updateForm((prev) => ({
      ...prev,
      attitude_data: prev.attitude_data.map((row) => {
        if (row.id !== rowId) return row;
        const next: AttitudeItem = { ...row, ...patch };
        const effectiveLabel =
          next.attitude === 'Sikap lainnya' && next.custom_attitude?.trim()
            ? next.custom_attitude.trim()
            : next.attitude;
        if (forceAutoRegen) {
          next.description_mode = 'auto';
          next.description = generateAttitudeDescription(effectiveLabel, next.grade);
        } else if (
          next.description_mode === 'auto' &&
          patch.description === undefined &&
          (patch.attitude !== undefined ||
            patch.custom_attitude !== undefined ||
            patch.grade !== undefined)
        ) {
          next.description = generateAttitudeDescription(effectiveLabel, next.grade);
        }
        return next;
      }),
    }));
  };

  const removeAttitudeRow = (rowId: string) => {
    updateForm((prev) => ({
      ...prev,
      attitude_data: prev.attitude_data.filter((r) => r.id !== rowId),
    }));
  };

  // --- BAGIAN C: KETERAMPILAN HANDLERS ---
  const addSkillRow = () => {
    const defaultSkill = SKILL_OPTIONS[0];
    const defaultGrade: Grade = 'A';
    updateForm((prev) => ({
      ...prev,
      skill_data: [
        ...prev.skill_data,
        {
          id: makeRowId(),
          skill: defaultSkill,
          custom_skill: '',
          grade: defaultGrade,
          description: generateSkillDescription(defaultSkill, defaultGrade),
          description_mode: 'auto',
        },
      ],
    }));
  };

  const updateSkillRow = (
    rowId: string,
    patch: Partial<SkillItem>,
    forceAutoRegen = false
  ) => {
    updateForm((prev) => ({
      ...prev,
      skill_data: prev.skill_data.map((row) => {
        if (row.id !== rowId) return row;
        const next: SkillItem = { ...row, ...patch };
        const effectiveLabel =
          next.skill === 'Keterampilan lainnya' && next.custom_skill?.trim()
            ? next.custom_skill.trim()
            : next.skill;
        if (forceAutoRegen) {
          next.description_mode = 'auto';
          next.description = generateSkillDescription(effectiveLabel, next.grade);
        } else if (
          next.description_mode === 'auto' &&
          patch.description === undefined &&
          (patch.skill !== undefined || patch.custom_skill !== undefined || patch.grade !== undefined)
        ) {
          next.description = generateSkillDescription(effectiveLabel, next.grade);
        }
        return next;
      }),
    }));
  };

  const removeSkillRow = (rowId: string) => {
    updateForm((prev) => ({
      ...prev,
      skill_data: prev.skill_data.filter((r) => r.id !== rowId),
    }));
  };

  // --- PDF & SHARE LINK ---
  const handleDownloadPdf = async () => {
    if (!form.student_id) {
      showToast('warning', 'Pilih siswa terlebih dahulu', 'Identitas siswa dibutuhkan untuk membuat PDF.');
      return;
    }
    setDownloadingPdf(true);
    try {
      const filename = await downloadReportPdf({
        studentName: form.student_name_snapshot || 'Siswa',
        educationLevel: form.education_level_snapshot || '-',
        className: form.class_name_snapshot || '-',
        schoolName: form.school_name,
        parentName: form.parent_name,
        semester: form.semester,
        academicYear: form.academic_year,
        reportPeriod: form.report_period,
        reportDate: form.report_date,
        reportCity: form.report_city,
        teacherName,
        knowledgeData: form.knowledge_data,
        attitudeData: form.attitude_data,
        skillData: form.skill_data,
        teacherNotes: form.teacher_notes,
      });
      showToast('success', 'PDF berhasil diunduh', filename);
    } catch {
      showToast('error', 'Gagal mengunduh PDF', 'Silakan coba kembali.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadWord = async () => {
    if (!form.student_id) {
      showToast('warning', 'Pilih siswa terlebih dahulu', 'Identitas siswa dibutuhkan untuk membuat dokumen Word.');
      return;
    }
    setDownloadingWord(true);
    try {
      const filename = await downloadReportWord({
        studentName: form.student_name_snapshot || 'Siswa',
        educationLevel: form.education_level_snapshot || '-',
        className: form.class_name_snapshot || '-',
        schoolName: form.school_name,
        parentName: form.parent_name,
        semester: form.semester,
        academicYear: form.academic_year,
        reportPeriod: form.report_period,
        reportDate: form.report_date,
        reportCity: form.report_city,
        teacherName,
        knowledgeData: form.knowledge_data,
        attitudeData: form.attitude_data,
        skillData: form.skill_data,
        teacherNotes: form.teacher_notes,
      });
      showToast('success', 'Dokumen Word berhasil diunduh', filename);
    } catch {
      showToast('error', 'Gagal mengunduh Word', 'Silakan coba kembali.');
    } finally {
      setDownloadingWord(false);
    }
  };

  const handleToggleShare = async (enable: boolean) => {
    if (!supabase || !user) return;
    if (!reportIdRef.current) {
      await persistReport(true);
    }
    if (!reportIdRef.current) return;

    setUpdatingShare(true);
    try {
      const nextToken = enable ? form.share_token || createShareToken() : form.share_token;
      const { error } = await supabase
        .from('reports')
        .update({
          share_token: nextToken,
          share_enabled: enable,
        })
        .eq('id', reportIdRef.current)
        .eq('teacher_id', user.id);

      if (error) throw error;
      setForm((prev) => ({
        ...prev,
        share_token: nextToken,
        share_enabled: enable,
      }));
      showToast(
        'success',
        enable ? 'Tautan berbagi diaktifkan' : 'Tautan berbagi dinonaktifkan',
        enable
          ? 'Orang tua/wali dapat melihat rapot secara read-only melalui tautan ini.'
          : 'Tautan berbagi tidak lagi dapat diakses.'
      );
    } catch (err) {
      showToast('error', 'Gagal memperbarui status berbagi', formatSupabaseError(err));
    } finally {
      setUpdatingShare(false);
    }
  };

  const handleRegenerateShareToken = async () => {
    if (!supabase || !user || !reportIdRef.current) return;
    setUpdatingShare(true);
    try {
      const nextToken = createShareToken();
      const { error } = await supabase
        .from('reports')
        .update({
          share_token: nextToken,
          share_enabled: true,
        })
        .eq('id', reportIdRef.current)
        .eq('teacher_id', user.id);

      if (error) throw error;
      setForm((prev) => ({
        ...prev,
        share_token: nextToken,
        share_enabled: true,
      }));
      showToast('success', 'Token baru dibuat', 'Tautan lama otomatis tidak berlaku lagi.');
    } catch (err) {
      showToast('error', 'Gagal membuat token baru', formatSupabaseError(err));
    } finally {
      setUpdatingShare(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (!form.share_token) return '';
    return `${window.location.origin}/share/${form.share_token}`;
  }, [form.share_token]);

  const handleTabChange = (nextTab: EditorTab) => {
    setActiveTab(nextTab);
    if (reportIdRef.current) {
      setSearchParams(nextTab === 'identitas' ? {} : { tab: nextTab }, { replace: true });
    }
  };

  // --- SECURITY / ERROR SCREENS ---
  if (initializing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0f274a]" />
        <p className="mt-3 text-sm font-medium text-slate-600">Memuat data rapot dari Supabase...</p>
      </div>
    );
  }

  if (accessState === 'not_found') {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
        <FileWarning className="mx-auto h-11 w-11 text-amber-600" />
        <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Rapot Tidak Ditemukan</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Dokumen rapot dengan ID tersebut tidak ditemukan atau Anda tidak memiliki hak akses pada rapot ini.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/rapot"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Daftar Rapot Tersimpan
          </Link>
          <Link
            to="/rapot/baru"
            className="rounded-lg bg-[#0f274a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163561]"
          >
            Buat Rapot Baru
          </Link>
        </div>
      </div>
    );
  }

  if (accessState === 'forbidden') {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center">
        <ShieldAlert className="mx-auto h-11 w-11 text-red-600" />
        <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Akses Ditolak</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Anda tidak diizinkan mengakses atau mengubah rapot milik guru lain.
        </p>
        <Link
          to="/rapot"
          className="mt-6 inline-block rounded-lg bg-[#0f274a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163561]"
        >
          Kembali ke Rapot Saya
        </Link>
      </div>
    );
  }

  if (accessState === 'error') {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-600" />
        <h2 className="mt-4 font-display text-lg font-bold text-slate-900">Gagal Memuat Rapot</h2>
        <p className="mt-2 text-sm text-slate-600">{loadErrorMsg}</p>
        <button
          type="button"
          onClick={() => void initializeEditor()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2 text-sm font-semibold text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </button>
      </div>
    );
  }

  const tabs: { key: EditorTab; label: string; count?: number }[] = [
    { key: 'identitas', label: '1. Identitas Siswa' },
    { key: 'pengetahuan', label: '2. Pengetahuan', count: form.knowledge_data.length },
    { key: 'sikap', label: '3. Sikap', count: form.attitude_data.length },
    { key: 'keterampilan', label: '4. Keterampilan', count: form.skill_data.length },
    { key: 'preview', label: '5. Preview' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Toolbar & Autosave Indicator */}
      <div className="no-print flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/rapot')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali
          </button>

          {/* Autosave Status Indicator */}
          <div className="text-xs">
            {autosaveState === 'idle' && (
              <span className="text-slate-500">Pilih siswa untuk memulai autosave</span>
            )}
            {autosaveState === 'unsaved' && (
              <span className="font-medium text-amber-700">Belum disimpan</span>
            )}
            {autosaveState === 'saving' && (
              <span className="inline-flex items-center gap-1.5 font-medium text-sky-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menyimpan...
              </span>
            )}
            {autosaveState === 'saved' && (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 tabular-nums">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tersimpan pada {formatJakartaTime(lastSavedAt)} WIB
              </span>
            )}
            {autosaveState === 'error' && (
              <button
                type="button"
                onClick={() => void persistReport(true)}
                className="inline-flex items-center gap-1.5 font-semibold text-red-600 underline hover:text-red-700"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Gagal menyimpan – klik untuk mencoba lagi
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={form.status}
            onChange={(e) =>
              updateForm((prev) => ({ ...prev, status: e.target.value as ReportStatus }))
            }
            aria-label="Status Rapot"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-sky-600 focus:outline-none"
          >
            {(Object.keys(REPORT_STATUS_LABELS) as ReportStatus[]).map((st) => (
              <option key={st} value={st}>
                Status: {REPORT_STATUS_LABELS[st]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void persistReport(true)}
            disabled={autosaveState === 'saving' || !form.student_id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0f274a] hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            Simpan
          </button>

          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            disabled={!form.student_id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <Share2 className="h-3.5 w-3.5" />
            Bagikan Rapot
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('preview')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f274a] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#163561] whitespace-nowrap"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview Rapot
          </button>
        </div>
      </div>

      {/* Duplicate Warning */}
      {duplicateWarning && (
        <div className="no-print flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <span className="font-semibold">Peringatan duplikasi rapot:</span> Anda sudah memiliki rapot lain untuk siswa, semester, tahun ajaran, dan periode laporan yang sama. Anda tetap dapat melanjutkan jika memang membutuhkan rapot tambahan.
          </div>
        </div>
      )}

      {/* Multi-Step Tabs */}
      <div className="no-print flex overflow-x-auto border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2 gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-[#0f274a] text-[#0f274a]'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  ({tab.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: IDENTITAS SISWA */}
      {activeTab === 'identitas' && (
        <section className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">Identitas Siswa & Periode Rapot</h2>
              <p className="text-xs text-slate-500">
                Pilih siswa untuk mengisi nama, jenjang, kelas, dan nama orang tua secara otomatis.
              </p>
            </div>
            {students.length === 0 && (
              <Link
                to="/siswa?new=1"
                className="text-xs font-semibold text-sky-700 underline"
              >
                + Tambah Siswa Terlebih Dahulu
              </Link>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Pilih Siswa <span className="text-red-600">*</span>
              </label>
              <select
                value={form.student_id}
                onChange={(e) => handleSelectStudent(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              >
                <option value="">-- Pilih Siswa --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.student_name} ({s.education_level} · Kelas {s.class_name})
                    {s.status === 'inactive' ? ' [Nonaktif]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Siswa</label>
              <input
                type="text"
                readOnly
                value={form.student_name_snapshot}
                placeholder="Terisi otomatis"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Jenjang / Kelas</label>
              <input
                type="text"
                readOnly
                value={
                  form.student_id
                    ? `${form.education_level_snapshot} / Kelas ${form.class_name_snapshot}`
                    : ''
                }
                placeholder="Terisi otomatis"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Nama Orang Tua / Wali</label>
              <input
                type="text"
                value={form.parent_name}
                onChange={(e) => updateForm((p) => ({ ...p, parent_name: e.target.value }))}
                placeholder="Contoh: Bapak Hendra Wijaya"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Guru Pengajar (Otomatis)</label>
              <input
                type="text"
                readOnly
                value={teacherName}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Semester</label>
              <select
                value={form.semester}
                onChange={(e) => {
                  const sem = e.target.value;
                  updateForm((p) => ({
                    ...p,
                    semester: sem,
                    report_period: `${sem} ${p.academic_year}`,
                  }));
                }}
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
              <label className="block text-xs font-semibold text-slate-700">Tahun Ajaran</label>
              <input
                type="text"
                value={form.academic_year}
                onChange={(e) => {
                  const yr = e.target.value;
                  updateForm((p) => ({
                    ...p,
                    academic_year: yr,
                    report_period: `${p.semester} ${yr}`,
                  }));
                }}
                placeholder="2026/2027"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Periode Laporan</label>
              <input
                type="text"
                value={form.report_period}
                onChange={(e) => updateForm((p) => ({ ...p, report_period: e.target.value }))}
                placeholder="Contoh: Semester Ganjil 2026/2027"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Kota Penandatanganan</label>
                <input
                  type="text"
                  value={form.report_city}
                  onChange={(e) => updateForm((p) => ({ ...p, report_city: e.target.value }))}
                  placeholder="Rejang Lebong"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Tanggal Rapot</label>
                <input
                  type="date"
                  value={form.report_date}
                  onChange={(e) => updateForm((p) => ({ ...p, report_date: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Catatan Tambahan Guru (Opsional)
              </label>
              <textarea
                rows={3}
                value={form.teacher_notes}
                onChange={(e) => updateForm((p) => ({ ...p, teacher_notes: e.target.value }))}
                placeholder="Pesan penyemangat atau saran belajar di rumah untuk orang tua/wali..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => handleTabChange('pengetahuan')}
              className="rounded-lg bg-[#0f274a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#163561]"
            >
              Lanjut ke Penilaian Pengetahuan
            </button>
          </div>
        </section>
      )}

      {/* TAB 2: BAGIAN A - PENGETAHUAN */}
      {activeTab === 'pengetahuan' && (
        <section className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Bagian A · Kognitif / Pengetahuan
              </h2>
              <p className="text-xs text-slate-500">
                Pilih mata pelajaran, materi, dan predikat A–D untuk menghasilkan deskripsi otomatis secara instan.
              </p>
            </div>
            <button
              type="button"
              onClick={addKnowledgeRow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f274a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#163561] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Tambah Baris Pengetahuan
            </button>
          </div>

          {form.knowledge_data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-600">Belum ada baris penilaian pengetahuan.</p>
              <button
                type="button"
                onClick={addKnowledgeRow}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0f274a] hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Tambah Baris Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {form.knowledge_data.map((row, idx) => {
                const matchedSubject = subjects.find(
                  (s) => s.id === row.subject_id || s.subject_name === row.subject
                );
                const subjectMaterials = matchedSubject
                  ? materials.filter((m) => m.subject_id === matchedSubject.id)
                  : materials;

                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#0f274a] tabular-nums">
                        Baris #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-500">
                          Mode: {row.description_mode === 'manual' ? 'Edit Manual' : 'Otomatis'}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeKnowledgeRow(row.id)}
                          aria-label={`Hapus baris ${idx + 1}`}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-12">
                      {/* Mata Pelajaran */}
                      <div className="md:col-span-3 space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Mata Pelajaran
                        </label>
                        {subjects.length > 0 && (
                          <select
                            value={matchedSubject?.id ?? '__manual__'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__manual__') {
                                updateKnowledgeRow(row.id, { subject_id: null });
                              } else {
                                const subj = subjects.find((s) => s.id === val);
                                updateKnowledgeRow(row.id, {
                                  subject_id: subj?.id ?? null,
                                  subject: subj?.subject_name ?? '',
                                });
                              }
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium focus:border-sky-600 focus:outline-none"
                          >
                            {subjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.subject_name} {s.education_level ? `(${s.education_level})` : ''}
                              </option>
                            ))}
                            <option value="__manual__">-- Input Manual --</option>
                          </select>
                        )}
                        {(subjects.length === 0 || !matchedSubject) && (
                          <input
                            type="text"
                            value={row.subject}
                            onChange={(e) =>
                              updateKnowledgeRow(row.id, { subject: e.target.value, subject_id: null })
                            }
                            placeholder="Ketik nama mata pelajaran..."
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-sky-600 focus:outline-none"
                          />
                        )}
                      </div>

                      {/* Materi */}
                      <div className="md:col-span-4 space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Materi yang Dipelajari
                        </label>
                        {subjectMaterials.length > 0 && (
                          <select
                            value={
                              subjectMaterials.some((m) => m.material_name === row.material)
                                ? row.material
                                : '__manual__'
                            }
                            onChange={(e) => {
                              if (e.target.value !== '__manual__') {
                                updateKnowledgeRow(row.id, { material: e.target.value });
                              }
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium focus:border-sky-600 focus:outline-none"
                          >
                            <option value="__manual__">-- Pilih dari Bank Materi / Ketik Manual --</option>
                            {subjectMaterials.map((m) => (
                              <option key={m.id} value={m.material_name}>
                                {m.material_name}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          value={row.material}
                          onChange={(e) => updateKnowledgeRow(row.id, { material: e.target.value })}
                          placeholder="Ketik atau pilih materi (misal: Pecahan)..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-sky-600 focus:outline-none"
                        />
                      </div>

                      {/* Pemahaman / Predikat */}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">Pemahaman</label>
                        <select
                          value={row.grade}
                          onChange={(e) =>
                            updateKnowledgeRow(row.id, { grade: e.target.value as Grade })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-[#0f274a] focus:border-sky-600 focus:outline-none"
                        >
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g} · {GRADE_LABELS[g]}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Deskripsi Perkembangan */}
                      <div className="md:col-span-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            Deskripsi Perkembangan
                          </label>
                          {row.description_mode === 'manual' && (
                            <button
                              type="button"
                              onClick={() => updateKnowledgeRow(row.id, {}, true)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Generate Ulang Deskripsi
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={3}
                          value={row.description}
                          onChange={(e) =>
                            updateKnowledgeRow(row.id, {
                              description: e.target.value,
                              description_mode: 'manual',
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs leading-relaxed focus:border-sky-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => handleTabChange('identitas')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('sikap')}
              className="rounded-lg bg-[#0f274a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#163561]"
            >
              Lanjut ke Penilaian Sikap
            </button>
          </div>
        </section>
      )}

      {/* TAB 3: BAGIAN B - SIKAP */}
      {activeTab === 'sikap' && (
        <section className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Bagian B · Afektif / Sikap
              </h2>
              <p className="text-xs text-slate-500">
                Pilih aspek sikap belajar siswa dan predikatnya untuk menghasilkan narasi sikap yang sesuai.
              </p>
            </div>
            <button
              type="button"
              onClick={addAttitudeRow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f274a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#163561] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Tambah Baris Sikap
            </button>
          </div>

          {form.attitude_data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-600">Belum ada baris penilaian sikap.</p>
              <button
                type="button"
                onClick={addAttitudeRow}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0f274a] hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Tambah Baris Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {form.attitude_data.map((row, idx) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#0f274a] tabular-nums">
                      Sikap #{idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-500">
                        Mode: {row.description_mode === 'manual' ? 'Edit Manual' : 'Otomatis'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttitudeRow(row.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">Aspek Sikap</label>
                      <select
                        value={row.attitude}
                        onChange={(e) => updateAttitudeRow(row.id, { attitude: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium focus:border-sky-600 focus:outline-none"
                      >
                        {ATTITUDE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {row.attitude === 'Sikap lainnya' && (
                        <input
                          type="text"
                          value={row.custom_attitude ?? ''}
                          onChange={(e) =>
                            updateAttitudeRow(row.id, { custom_attitude: e.target.value })
                          }
                          placeholder="Tuliskan sikap khusus..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-sky-600 focus:outline-none"
                        />
                      )}
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">Predikat</label>
                      <select
                        value={row.grade}
                        onChange={(e) =>
                          updateAttitudeRow(row.id, { grade: e.target.value as Grade })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-[#0f274a] focus:border-sky-600 focus:outline-none"
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g} · {GRADE_LABELS[g]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-6 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Deskripsi Perkembangan
                        </label>
                        {row.description_mode === 'manual' && (
                          <button
                            type="button"
                            onClick={() => updateAttitudeRow(row.id, {}, true)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Generate Ulang Deskripsi
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={row.description}
                        onChange={(e) =>
                          updateAttitudeRow(row.id, {
                            description: e.target.value,
                            description_mode: 'manual',
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs leading-relaxed focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => handleTabChange('pengetahuan')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('keterampilan')}
              className="rounded-lg bg-[#0f274a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#163561]"
            >
              Lanjut ke Penilaian Keterampilan
            </button>
          </div>
        </section>
      )}

      {/* TAB 4: BAGIAN C - KETERAMPILAN */}
      {activeTab === 'keterampilan' && (
        <section className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Bagian C · Psikomotor / Keterampilan
              </h2>
              <p className="text-xs text-slate-500">
                Evaluasi keterampilan praktik belajar siswa dengan template deskripsi otomatis atau kustom.
              </p>
            </div>
            <button
              type="button"
              onClick={addSkillRow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f274a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#163561] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Tambah Baris Keterampilan
            </button>
          </div>

          {form.skill_data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-600">Belum ada baris penilaian keterampilan.</p>
              <button
                type="button"
                onClick={addSkillRow}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0f274a] hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Tambah Baris Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {form.skill_data.map((row, idx) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#0f274a] tabular-nums">
                      Keterampilan #{idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-500">
                        Mode: {row.description_mode === 'manual' ? 'Edit Manual' : 'Otomatis'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSkillRow(row.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Aspek Keterampilan
                      </label>
                      <select
                        value={row.skill}
                        onChange={(e) => updateSkillRow(row.id, { skill: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium focus:border-sky-600 focus:outline-none"
                      >
                        {SKILL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {row.skill === 'Keterampilan lainnya' && (
                        <input
                          type="text"
                          value={row.custom_skill ?? ''}
                          onChange={(e) => updateSkillRow(row.id, { custom_skill: e.target.value })}
                          placeholder="Tuliskan keterampilan khusus..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs focus:border-sky-600 focus:outline-none"
                        />
                      )}
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">Predikat</label>
                      <select
                        value={row.grade}
                        onChange={(e) => updateSkillRow(row.id, { grade: e.target.value as Grade })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-[#0f274a] focus:border-sky-600 focus:outline-none"
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g} · {GRADE_LABELS[g]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-6 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Deskripsi Perkembangan
                        </label>
                        {row.description_mode === 'manual' && (
                          <button
                            type="button"
                            onClick={() => updateSkillRow(row.id, {}, true)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Generate Ulang Deskripsi
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={row.description}
                        onChange={(e) =>
                          updateSkillRow(row.id, {
                            description: e.target.value,
                            description_mode: 'manual',
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs leading-relaxed focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => handleTabChange('sikap')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('preview')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#163561]"
            >
              <Eye className="h-4 w-4" />
              Lihat Preview Rapot A4
            </button>
          </div>
        </section>
      )}

      {/* TAB 5: PREVIEW A4 & PDF */}
      {activeTab === 'preview' && (
        <section className="space-y-6">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => handleTabChange('identitas')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Form
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                disabled={!form.student_id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <Share2 className="h-4 w-4" />
                Bagikan ke Orang Tua
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                Cetak
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadWord()}
                disabled={downloadingWord || !form.student_id}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-700 bg-white px-4 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-40 whitespace-nowrap"
              >
                <FileText className="h-4 w-4" />
                {downloadingWord ? 'Membuat Word...' : 'Download Word'}
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={downloadingPdf || !form.student_id}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0f274a] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163561] disabled:opacity-40 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                {downloadingPdf ? 'Membuat PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>

          <ReportDocumentPreview
            studentName={form.student_name_snapshot || 'Pilih Siswa'}
            educationLevel={form.education_level_snapshot || '-'}
            className={form.class_name_snapshot || '-'}
            schoolName={form.school_name}
            parentName={form.parent_name}
            semester={form.semester}
            academicYear={form.academic_year}
            reportPeriod={form.report_period}
            reportDate={form.report_date}
            reportCity={form.report_city}
            teacherName={teacherName}
            knowledgeData={form.knowledge_data}
            attitudeData={form.attitude_data}
            skillData={form.skill_data}
            teacherNotes={form.teacher_notes}
          />
        </section>
      )}

      {/* Share Report Modal */}
      {shareModalOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <Link2 className="h-5 w-5 text-[#0f274a]" />
                <h3 className="font-display text-lg font-bold text-slate-900">Bagikan Rapot (Read-Only)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-sm leading-relaxed text-slate-600">
                Aktifkan tautan berbagi aman agar orang tua/wali dapat membaca dan mengunduh PDF hanya untuk rapot siswa ini saja tanpa mengakses dashboard guru.
              </p>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Status Berbagi: {form.share_enabled ? 'Aktif' : 'Nonaktif'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {form.share_enabled
                      ? 'Orang tua/wali yang memiliki tautan dapat melihat rapot.'
                      : 'Tautan tidak aktif dan tidak dapat dibuka siapa pun.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={updatingShare}
                  onClick={() => void handleToggleShare(!form.share_enabled)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                    form.share_enabled
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#0f274a] hover:bg-[#163561]'
                  }`}
                >
                  {updatingShare
                    ? 'Memproses...'
                    : form.share_enabled
                    ? 'Cabut / Nonaktifkan'
                    : 'Aktifkan Tautan'}
                </button>
              </div>

              {form.share_enabled && shareUrl && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tautan Aman Orang Tua / Wali
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(shareUrl);
                        setCopiedShareUrl(true);
                        setTimeout(() => setCopiedShareUrl(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f274a] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#163561] whitespace-nowrap"
                    >
                      {copiedShareUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedShareUrl ? 'Tersalin' : 'Salin'}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={updatingShare}
                    onClick={() => void handleRegenerateShareToken()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Buat Ulang Token Baru (Cabut Link Lama)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
