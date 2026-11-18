-- ============================================================================
-- GEC RAPOT – DIGITAL STUDENT LEARNING REPORT
-- Complete Supabase PostgreSQL Schema, Indexes, Triggers & Row Level Security
-- Timezone: Asia/Jakarta | Institution: Bimbel Galaxi Edu Center (GEC)
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. UTILITY FUNCTION: AUTOMATIC updated_at TIMESTAMP
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TABLE 1: profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NULL,
  subject_specialty TEXT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  preferences JSONB NOT NULL DEFAULT '{"default_academic_year": "2026/2027", "default_semester": "Semester Ganjil", "default_city": "Rejang Lebong"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile row whenever a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1), 'Guru GEC'),
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    'teacher'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- TABLE 2: students
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  education_level TEXT NOT NULL,
  class_name TEXT NOT NULL,
  school_name TEXT NULL,
  parent_name TEXT NULL,
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON public.students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_education_level ON public.students(education_level);

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- TABLE 3: subjects
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  education_level TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_teacher_id ON public.subjects(teacher_id);

-- ============================================================================
-- TABLE 4: learning_materials
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  material_description TEXT NULL,
  class_level TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_materials_teacher_id ON public.learning_materials(teacher_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_subject_id ON public.learning_materials(subject_id);

-- ============================================================================
-- TABLE 5: reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name_snapshot TEXT NULL,
  education_level_snapshot TEXT NULL,
  class_name_snapshot TEXT NULL,
  teacher_name_snapshot TEXT NULL,
  report_title TEXT,
  semester TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  report_period TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')::date,
  report_city TEXT NOT NULL DEFAULT 'Rejang Lebong',
  parent_name TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'final')),
  knowledge_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  attitude_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  teacher_notes TEXT NULL,
  share_token TEXT UNIQUE NULL,
  share_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_teacher_id ON public.reports(teacher_id);
CREATE INDEX IF NOT EXISTS idx_reports_student_id ON public.reports(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_semester ON public.reports(semester);
CREATE INDEX IF NOT EXISTS idx_reports_academic_year ON public.reports(academic_year);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON public.reports(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_share_token ON public.reports(share_token) WHERE share_token IS NOT NULL AND share_enabled = TRUE;

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - STRICT TEACHER ISOLATION
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. STUDENTS POLICIES
DROP POLICY IF EXISTS "students_select_own" ON public.students;
CREATE POLICY "students_select_own"
  ON public.students FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "students_insert_own" ON public.students;
CREATE POLICY "students_insert_own"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "students_update_own" ON public.students;
CREATE POLICY "students_update_own"
  ON public.students FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "students_delete_own" ON public.students;
CREATE POLICY "students_delete_own"
  ON public.students FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- 3. SUBJECTS POLICIES
DROP POLICY IF EXISTS "subjects_select_own" ON public.subjects;
CREATE POLICY "subjects_select_own"
  ON public.subjects FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "subjects_insert_own" ON public.subjects;
CREATE POLICY "subjects_insert_own"
  ON public.subjects FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "subjects_update_own" ON public.subjects;
CREATE POLICY "subjects_update_own"
  ON public.subjects FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "subjects_delete_own" ON public.subjects;
CREATE POLICY "subjects_delete_own"
  ON public.subjects FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- 4. LEARNING MATERIALS POLICIES
DROP POLICY IF EXISTS "materials_select_own" ON public.learning_materials;
CREATE POLICY "materials_select_own"
  ON public.learning_materials FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "materials_insert_own" ON public.learning_materials;
CREATE POLICY "materials_insert_own"
  ON public.learning_materials FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND (
      subject_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.subjects s
        WHERE s.id = subject_id AND s.teacher_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "materials_update_own" ON public.learning_materials;
CREATE POLICY "materials_update_own"
  ON public.learning_materials FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid()
    AND (
      subject_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.subjects s
        WHERE s.id = subject_id AND s.teacher_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "materials_delete_own" ON public.learning_materials;
CREATE POLICY "materials_delete_own"
  ON public.learning_materials FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- 5. REPORTS POLICIES
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own"
  ON public.reports FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_id AND st.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reports_update_own" ON public.reports;
CREATE POLICY "reports_update_own"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = student_id AND st.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reports_delete_own" ON public.reports;
CREATE POLICY "reports_delete_own"
  ON public.reports FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- ============================================================================
-- SECURE READ-ONLY SHARE RPC FOR PARENTS/GUARDIANS
-- Exposes ONLY the single report matching an active share_token.
-- Never grants unrestricted table access or exposes other reports/students.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_shared_report(p_share_token TEXT)
RETURNS TABLE (
  id UUID,
  report_title TEXT,
  semester TEXT,
  academic_year TEXT,
  report_period TEXT,
  report_date DATE,
  report_city TEXT,
  parent_name TEXT,
  student_name TEXT,
  education_level TEXT,
  class_name TEXT,
  school_name TEXT,
  teacher_name TEXT,
  status TEXT,
  knowledge_data JSONB,
  attitude_data JSONB,
  skill_data JSONB,
  teacher_notes TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.report_title,
    r.semester,
    r.academic_year,
    r.report_period,
    r.report_date,
    r.report_city,
    COALESCE(r.parent_name, s.parent_name),
    COALESCE(r.student_name_snapshot, s.student_name),
    COALESCE(r.education_level_snapshot, s.education_level),
    COALESCE(r.class_name_snapshot, s.class_name),
    s.school_name,
    COALESCE(r.teacher_name_snapshot, p.full_name, 'Guru Bimbel GEC'),
    r.status,
    r.knowledge_data,
    r.attitude_data,
    r.skill_data,
    r.teacher_notes,
    r.updated_at
  FROM public.reports r
  LEFT JOIN public.students s ON s.id = r.student_id
  LEFT JOIN public.profiles p ON p.id = r.teacher_id
  WHERE r.share_token = p_share_token
    AND r.share_enabled = TRUE
    AND LENGTH(TRIM(p_share_token)) >= 16
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_report(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_report(TEXT) TO anon, authenticated;
