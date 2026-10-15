export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'public';
export type Gender = 'Male' | 'Female' | 'Other';
export type ParticipationStatus = 'participated' | 'absent' | 'excused';
export type AttendanceStatus = 'present' | 'absent' | 'excused';

export interface Database {
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          full_name: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          role: UserRole;
          full_name: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          role?: UserRole;
          full_name?: string;
          created_at?: string;
          created_by?: string | null;
        };
      };
      user_role_assignments: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          assigned_by: string | null;
          assigned_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: UserRole;
          assigned_by?: string | null;
          assigned_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: UserRole;
          assigned_by?: string | null;
          assigned_at?: string;
          is_active?: boolean;
        };
      };
      students: {
        Row: {
          id: string;
          student_name: string;
          index_number: string;
          grade: string;
          id_card_no: string | null;
          date_of_birth: string | null;
          address: string | null;
          gender: Gender | null;
          mail_id: string | null;
          club: string | null;
          house: string | null;
          position: string | null;
          attendance_percent: number;
          activity_participation_percent: number;
          two_activity_participation_percent: number;
          profile_picture_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_name: string;
          index_number: string;
          grade: string;
          id_card_no?: string | null;
          date_of_birth?: string | null;
          address?: string | null;
          gender?: Gender | null;
          mail_id?: string | null;
          club?: string | null;
          house?: string | null;
          position?: string | null;
          attendance_percent?: number;
          activity_participation_percent?: number;
          two_activity_participation_percent?: number;
          profile_picture_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_name?: string;
          index_number?: string;
          grade?: string;
          id_card_no?: string | null;
          date_of_birth?: string | null;
          address?: string | null;
          gender?: Gender | null;
          mail_id?: string | null;
          club?: string | null;
          house?: string | null;
          position?: string | null;
          attendance_percent?: number;
          activity_participation_percent?: number;
          two_activity_participation_percent?: number;
          profile_picture_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_categories: {
        Row: {
          id: string;
          category_name: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_name: string;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_name?: string;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      sub_activities: {
        Row: {
          id: string;
          category_id: string;
          activity_name: string;
          description: string | null;
          max_score: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          activity_name: string;
          description?: string | null;
          max_score?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          activity_name?: string;
          description?: string | null;
          max_score?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      student_achievements: {
        Row: {
          id: string;
          student_id: string;
          category_id: string;
          sub_activity_id: string;
          score: number;
          participation_status: ParticipationStatus;
          notes: string | null;
          recorded_by: string | null;
          recorded_month: number;
          recorded_year: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          category_id: string;
          sub_activity_id: string;
          score?: number;
          participation_status?: ParticipationStatus;
          notes?: string | null;
          recorded_by?: string | null;
          recorded_month: number;
          recorded_year: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          category_id?: string;
          sub_activity_id?: string;
          score?: number;
          participation_status?: ParticipationStatus;
          notes?: string | null;
          recorded_by?: string | null;
          recorded_month?: number;
          recorded_year?: number;
          recorded_at?: string;
        };
      };
      attendance_records: {
        Row: {
          id: string;
          student_id: string;
          sub_activity_id: string;
          grade: string;
          attendance_status: AttendanceStatus;
          marked_by: string | null;
          activity_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          sub_activity_id: string;
          grade: string;
          attendance_status?: AttendanceStatus;
          marked_by?: string | null;
          activity_date?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          sub_activity_id?: string;
          grade?: string;
          attendance_status?: AttendanceStatus;
          marked_by?: string | null;
          activity_date?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
