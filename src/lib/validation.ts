import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Masukkan alamat email yang valid.'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter.'),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter.'),
    email: z.string().trim().email('Masukkan alamat email yang valid.'),
    phone: z.string().trim().optional(),
    password: z.string().min(6, 'Kata sandi minimal 6 karakter.'),
    confirmPassword: z.string().min(6, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Masukkan alamat email yang valid.'),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Kata sandi baru minimal 6 karakter.'),
    confirmPassword: z.string().min(6, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  });

export const studentSchema = z.object({
  student_name: z.string().trim().min(2, 'Nama siswa wajib diisi (minimal 2 karakter).'),
  education_level: z.string().trim().min(1, 'Jenjang pendidikan wajib dipilih.'),
  class_name: z.string().trim().min(1, 'Kelas wajib diisi.'),
  school_name: z.string().trim().optional().nullable(),
  parent_name: z.string().trim().optional().nullable(),
  academic_year: z.string().trim().min(4, 'Tahun ajaran wajib diisi (misal 2026/2027).'),
  status: z.enum(['active', 'inactive']),
});

export const subjectSchema = z.object({
  subject_name: z.string().trim().min(2, 'Nama mata pelajaran wajib diisi.'),
  education_level: z.string().trim().optional().nullable(),
});

export const materialSchema = z.object({
  subject_id: z.string().trim().min(1, 'Mata pelajaran wajib dipilih.'),
  material_name: z.string().trim().min(2, 'Nama materi wajib diisi.'),
  material_description: z.string().trim().optional().nullable(),
  class_level: z.string().trim().optional().nullable(),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter.'),
  phone: z.string().trim().optional().nullable(),
  subject_specialty: z.string().trim().optional().nullable(),
});

export const reportIdentitySchema = z.object({
  student_id: z.string().uuid('Pilih siswa terlebih dahulu.'),
  semester: z.string().trim().min(1, 'Semester wajib dipilih.'),
  academic_year: z.string().trim().min(4, 'Tahun ajaran wajib diisi.'),
  report_period: z.string().trim().min(2, 'Periode laporan wajib diisi.'),
  report_date: z.string().trim().min(8, 'Tanggal rapot wajib diisi.'),
  report_city: z.string().trim().min(2, 'Kota penandatanganan wajib diisi.'),
});
