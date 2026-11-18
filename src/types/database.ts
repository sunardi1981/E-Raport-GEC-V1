export type Grade = 'A' | 'B' | 'C' | 'D';

export type DescriptionMode = 'auto' | 'manual';

export type ReportStatus = 'draft' | 'ready' | 'final';

export type StudentStatus = 'active' | 'inactive';

export interface TeacherPreferences {
  default_academic_year: string;
  default_semester: string;
  default_city: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  subject_specialty: string | null;
  role: string;
  preferences: TeacherPreferences;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  teacher_id: string;
  student_name: string;
  education_level: string;
  class_name: string;
  school_name: string | null;
  parent_name: string | null;
  academic_year: string;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  teacher_id: string;
  subject_name: string;
  education_level: string | null;
  created_at: string;
}

export interface LearningMaterial {
  id: string;
  teacher_id: string;
  subject_id: string | null;
  material_name: string;
  material_description: string | null;
  class_level: string | null;
  created_at: string;
  subjects?: {
    id: string;
    subject_name: string;
    education_level: string | null;
  } | null;
}

export interface KnowledgeItem {
  id: string;
  subject_id?: string | null;
  subject: string;
  material: string;
  grade: Grade;
  description: string;
  description_mode: DescriptionMode;
}

export interface AttitudeItem {
  id: string;
  attitude: string;
  custom_attitude?: string;
  grade: Grade;
  description: string;
  description_mode: DescriptionMode;
}

export interface SkillItem {
  id: string;
  skill: string;
  custom_skill?: string;
  grade: Grade;
  description: string;
  description_mode: DescriptionMode;
}

export interface Report {
  id: string;
  teacher_id: string;
  student_id: string;
  student_name_snapshot: string | null;
  education_level_snapshot: string | null;
  class_name_snapshot: string | null;
  teacher_name_snapshot: string | null;
  report_title: string | null;
  semester: string;
  academic_year: string;
  report_period: string;
  report_date: string;
  report_city: string;
  parent_name: string | null;
  status: ReportStatus;
  knowledge_data: KnowledgeItem[];
  attitude_data: AttitudeItem[];
  skill_data: SkillItem[];
  teacher_notes: string | null;
  share_token: string | null;
  share_enabled: boolean;
  created_at: string;
  updated_at: string;
  students?: Student | null;
}

export interface SharedReportView {
  id: string;
  report_title: string | null;
  semester: string;
  academic_year: string;
  report_period: string;
  report_date: string;
  report_city: string;
  parent_name: string | null;
  student_name: string;
  education_level: string;
  class_name: string;
  school_name: string | null;
  teacher_name: string;
  status: ReportStatus;
  knowledge_data: KnowledgeItem[];
  attitude_data: AttitudeItem[];
  skill_data: SkillItem[];
  teacher_notes: string | null;
  updated_at: string;
}

export const EDUCATION_LEVELS = ['SD', 'SMP', 'SMA', 'Umum / Khusus'] as const;

export const SEMESTER_OPTIONS = ['Semester Ganjil', 'Semester Genap'] as const;

export const GRADE_LABELS: Record<Grade, string> = {
  A: 'Sangat Baik',
  B: 'Baik',
  C: 'Cukup',
  D: 'Kurang',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: 'Draft',
  ready: 'Siap Cetak',
  final: 'Final',
};

export const ATTITUDE_OPTIONS = [
  'Disiplin',
  'Tanggung Jawab',
  'Percaya Diri',
  'Keaktifan',
  'Kerja Sama',
  'Ketekunan',
  'Kemandirian',
  'Menghargai',
  'Fokus',
  'Sikap lainnya',
] as const;

export const SKILL_OPTIONS = [
  'Membaca',
  'Menulis',
  'Berhitung',
  'Menyelesaikan soal',
  'Menjelaskan konsep',
  'Mempraktikkan materi',
  'Menyelesaikan tugas',
  'Menggunakan alat belajar',
  'Keterampilan lainnya',
] as const;
