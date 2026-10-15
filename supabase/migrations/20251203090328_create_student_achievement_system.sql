/*
  # Faafu Atoll School Student Achievement System

  ## Overview
  Complete student achievement tracking system with role-based access control
  
  ## New Tables
  
  ### 1. `user_roles`
  User authentication and role management
  - `id` (uuid, primary key) - Unique identifier
  - `email` (text, unique) - User email
  - `role` (text) - User role: super_admin, admin, teacher, public
  - `full_name` (text) - Full name
  - `created_at` (timestamptz) - Creation timestamp
  - `created_by` (uuid) - Reference to creator
  
  ### 2. `students`
  Complete student profile information
  - `id` (uuid, primary key) - Unique identifier
  - `student_name` (text) - Full name
  - `index_number` (text) - Student index number
  - `grade` (text) - Current grade/class
  - `id_card_no` (text) - National ID card number
  - `date_of_birth` (date) - Date of birth
  - `address` (text) - Residential address
  - `gender` (text) - Gender
  - `mail_id` (text) - Email address
  - `club` (text) - School club membership
  - `house` (text) - House assignment
  - `position` (text) - Student position/role
  - `attendance_percent` (decimal) - Overall attendance percentage
  - `profile_picture_url` (text) - Photo URL
  - `created_at` (timestamptz) - Record creation date
  - `updated_at` (timestamptz) - Last update date
  
  ### 3. `activity_categories`
  Main activity weeks/categories
  - `id` (uuid, primary key) - Unique identifier
  - `category_name` (text) - Activity week name
  - `description` (text) - Description
  - `display_order` (integer) - Display order
  - `is_active` (boolean) - Active status
  
  ### 4. `sub_activities`
  Individual activities under each category
  - `id` (uuid, primary key) - Unique identifier
  - `category_id` (uuid) - Reference to activity_categories
  - `activity_name` (text) - Name of sub-activity
  - `description` (text) - Description
  - `max_score` (integer) - Maximum possible score
  - `is_active` (boolean) - Active status
  
  ### 5. `student_achievements`
  Student achievement records for each activity
  - `id` (uuid, primary key) - Unique identifier
  - `student_id` (uuid) - Reference to students
  - `category_id` (uuid) - Reference to activity_categories
  - `sub_activity_id` (uuid) - Reference to sub_activities
  - `score` (decimal) - Score achieved
  - `participation_status` (text) - participated, absent, excused
  - `notes` (text) - Additional notes
  - `recorded_by` (uuid) - Teacher who recorded
  - `recorded_month` (integer) - Month (1-12)
  - `recorded_year` (integer) - Year
  - `recorded_at` (timestamptz) - Timestamp
  
  ### 6. `attendance_records`
  Activity attendance tracking
  - `id` (uuid, primary key) - Unique identifier
  - `student_id` (uuid) - Reference to students
  - `sub_activity_id` (uuid) - Reference to sub_activities
  - `grade` (text) - Class/grade
  - `attendance_status` (text) - present, absent, excused
  - `marked_by` (uuid) - Teacher who marked attendance
  - `activity_date` (date) - Date of activity
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz) - Record creation
  
  ## Security
  - Enable RLS on all tables
  - Super admin can manage all users and view all data
  - Admin can manage students and view all achievements
  - Teachers can mark attendance and record achievements
  - Public can only search and view student profiles
  
  ## Important Notes
  1. All timestamps use timestamptz for proper timezone handling
  2. Monthly and yearly tracking via recorded_month and recorded_year fields
  3. Comprehensive audit trail with created_by and recorded_by fields
  4. Flexible activity system supporting unlimited sub-activities
*/

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'teacher', 'public')),
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_roles(id)
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  index_number text UNIQUE NOT NULL,
  grade text NOT NULL,
  id_card_no text,
  date_of_birth date,
  address text,
  gender text CHECK (gender IN ('Male', 'Female', 'Other')),
  mail_id text,
  club text,
  house text,
  position text,
  attendance_percent decimal(5,2) DEFAULT 0,
  profile_picture_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create activity_categories table
CREATE TABLE IF NOT EXISTS activity_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text UNIQUE NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create sub_activities table
CREATE TABLE IF NOT EXISTS sub_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES activity_categories(id) ON DELETE CASCADE,
  activity_name text NOT NULL,
  description text,
  max_score integer DEFAULT 100,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create student_achievements table
CREATE TABLE IF NOT EXISTS student_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  category_id uuid REFERENCES activity_categories(id) ON DELETE CASCADE,
  sub_activity_id uuid REFERENCES sub_activities(id) ON DELETE CASCADE,
  score decimal(5,2) DEFAULT 0,
  participation_status text DEFAULT 'participated' CHECK (participation_status IN ('participated', 'absent', 'excused')),
  notes text,
  recorded_by uuid REFERENCES user_roles(id),
  recorded_month integer CHECK (recorded_month >= 1 AND recorded_month <= 12),
  recorded_year integer,
  recorded_at timestamptz DEFAULT now()
);

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  sub_activity_id uuid REFERENCES sub_activities(id) ON DELETE CASCADE,
  grade text NOT NULL,
  attendance_status text DEFAULT 'present' CHECK (attendance_status IN ('present', 'absent', 'excused')),
  marked_by uuid REFERENCES user_roles(id),
  activity_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Super admin can view all users"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can insert users"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can update users"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can delete users"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- RLS Policies for students
CREATE POLICY "Authenticated users can view students"
  ON students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can view students"
  ON students FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Admin can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admin can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admin can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for activity_categories
CREATE POLICY "Everyone can view activity categories"
  ON activity_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can view activity categories"
  ON activity_categories FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Admin can manage activity categories"
  ON activity_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for sub_activities
CREATE POLICY "Everyone can view sub activities"
  ON sub_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can view sub activities"
  ON sub_activities FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Admin can manage sub activities"
  ON sub_activities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for student_achievements
CREATE POLICY "Everyone can view achievements"
  ON student_achievements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can view achievements"
  ON student_achievements FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Teachers can insert achievements"
  ON student_achievements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

CREATE POLICY "Teachers can update achievements"
  ON student_achievements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

CREATE POLICY "Admin can delete achievements"
  ON student_achievements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for attendance_records
CREATE POLICY "Everyone can view attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can insert attendance"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

CREATE POLICY "Teachers can update attendance"
  ON attendance_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin', 'teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role IN ('super_admin', 'admin', 'teacher')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
CREATE INDEX IF NOT EXISTS idx_students_index_number ON students(index_number);
CREATE INDEX IF NOT EXISTS idx_achievements_student ON student_achievements(student_id);
CREATE INDEX IF NOT EXISTS idx_achievements_month_year ON student_achievements(recorded_year, recorded_month);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(activity_date);

-- Insert default activity categories
INSERT INTO activity_categories (category_name, description, display_order) VALUES
  ('Dhivehi Week', 'Dhivehi language and culture activities', 1),
  ('Islam Week', 'Islamic studies and activities', 2),
  ('English Week', 'English language activities', 3),
  ('Maths Week', 'Mathematics activities and competitions', 4),
  ('Quruaan Week', 'Quran recitation and memorization', 5),
  ('Arts Week', 'Arts and creative activities', 6),
  ('Environment Week', 'Environmental awareness activities', 7),
  ('Sports Week', 'Sports and physical activities', 8),
  ('Atoll Inter House Week', 'Inter-house competitions at atoll level', 9),
  ('Inter School Week', 'Inter-school competitions', 10),
  ('Others Week', 'Other miscellaneous activities', 11)
ON CONFLICT (category_name) DO NOTHING;