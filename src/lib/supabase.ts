import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://imgzjwvdkshpkocxqizp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltZ3pqd3Zka3NocGtvY3hxaXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MTg4NTUsImV4cCI6MjA4MDI5NDg1NX0.ZNM_VYtksIWRrEGJcQS_Xydm5A8evB6XcuX1-M-RtE0';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient<Database>(
  supabaseUrl || globalThis.location?.origin || 'http://localhost',
  supabaseAnonKey || 'missing-supabase-anon-key'
);
