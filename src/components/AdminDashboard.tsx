import { useState, useEffect } from 'react';
import { Users, UserPlus, LogOut, Settings, Search, CreditCard as Edit, Trash2, Plus, Upload, Download, AlertTriangle, Award, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';

type Student = Database['public']['Tables']['students']['Row'];
type ActivityCategory = Database['public']['Tables']['activity_categories']['Row'];
type SubActivity = Database['public']['Tables']['sub_activities']['Row'];
type StudentAchievement = Database['public']['Tables']['student_achievements']['Row'];
type ParticipationStatus = Database['public']['Tables']['student_achievements']['Row']['participation_status'];

interface AchievementWithDetails extends StudentAchievement {
  students: { student_name: string; index_number: string; grade: string } | null;
  activity_categories: { category_name: string } | null;
  sub_activities: { activity_name: string } | null;
}

export function AdminDashboard() {
  const { signOut, userDetails, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'students' | 'activities' | 'achievements'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [subActivities, setSubActivities] = useState<SubActivity[]>([]);
  const [achievements, setAchievements] = useState<AchievementWithDetails[]>([]);
  const [achievementFilterStudent, setAchievementFilterStudent] = useState<string>('');
  const [achievementFilterCategory, setAchievementFilterCategory] = useState<string>('');
  const [achievementFilterGrade, setAchievementFilterGrade] = useState<string>('');
  const [editingAchievement, setEditingAchievement] = useState<StudentAchievement | null>(null);
  const [achievementForm, setAchievementForm] = useState({
    student_id: '',
    category_id: '',
    sub_activity_id: '',
    score: 0,
    participation_status: 'participated' as ParticipationStatus,
    notes: '',
    recorded_month: new Date().getMonth() + 1,
    recorded_year: new Date().getFullYear(),
  });
  const [showEditAchievement, setShowEditAchievement] = useState(false);
  const [showAddAchievement, setShowAddAchievement] = useState(false);
  const [newAchievement, setNewAchievement] = useState({
    student_id: '',
    category_id: '',
    sub_activity_id: '',
    score: 0,
    participation_status: 'participated' as ParticipationStatus,
    notes: '',
    recorded_month: new Date().getMonth() + 1,
    recorded_year: new Date().getFullYear(),
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingActivity, setEditingActivity] = useState<SubActivity | null>(null);

  const [studentForm, setStudentForm] = useState({
    student_name: '',
    index_number: '',
    grade: '',
    id_card_no: '',
    date_of_birth: '',
    address: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    mail_id: '',
    club: '',
    house: '',
    position: '',
    profile_picture_url: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const [activityForm, setActivityForm] = useState({
    activity_name: '',
    description: '',
    max_score: 100,
  });

  const loadData = async () => {
    setLoading(true);

    const [studentsRes, categoriesRes, subActivitiesRes] = await Promise.all([
      supabase.from('students').select('*').order('student_name'),
      supabase.from('activity_categories').select('*').order('display_order'),
      supabase.from('sub_activities').select('*'),
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (subActivitiesRes.data) setSubActivities(subActivitiesRes.data);

    setLoading(false);
  };

  const loadAchievements = async () => {
    setLoading(true);
    let query = supabase
      .from('student_achievements')
      .select(`
        *,
        students ( student_name, index_number, grade ),
        activity_categories ( category_name ),
        sub_activities ( activity_name )
      `)
      .order('recorded_at', { ascending: false });

    if (achievementFilterStudent) query = query.eq('student_id', achievementFilterStudent);
    if (achievementFilterCategory) query = query.eq('category_id', achievementFilterCategory);

    const { data, error: achError } = await query;
    if (achError) {
      setError(achError.message);
    } else {
      let filtered = (data || []) as AchievementWithDetails[];
      if (achievementFilterGrade) {
        filtered = filtered.filter(a => a.students?.grade === achievementFilterGrade);
      }
      setAchievements(filtered);
    }
    setLoading(false);
  };

  const handleEditAchievement = (achievement: StudentAchievement) => {
    setEditingAchievement(achievement);
    setAchievementForm({
      student_id: achievement.student_id,
      category_id: achievement.category_id,
      sub_activity_id: achievement.sub_activity_id,
      score: achievement.score,
      participation_status: achievement.participation_status,
      notes: achievement.notes || '',
      recorded_month: achievement.recorded_month,
      recorded_year: achievement.recorded_year,
    });
    setShowEditAchievement(true);
  };

  const handleUpdateAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAchievement) return;
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('student_achievements')
        .update({
          student_id: achievementForm.student_id,
          category_id: achievementForm.category_id,
          sub_activity_id: achievementForm.sub_activity_id,
          score: achievementForm.score,
          participation_status: achievementForm.participation_status,
          notes: achievementForm.notes || null,
          recorded_month: achievementForm.recorded_month,
          recorded_year: achievementForm.recorded_year,
        })
        .eq('id', editingAchievement.id);

      if (updateError) throw updateError;

      setSuccess('Achievement record updated successfully!');
      setEditingAchievement(null);
      setShowEditAchievement(false);
      loadAchievements();
    } catch (err: any) {
      setError(err.message || 'Failed to update achievement');
    }
  };

  const handleDeleteAchievement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this achievement record?')) return;
    setError('');
    setSuccess('');

    try {
      const { error: deleteError } = await supabase
        .from('student_achievements')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Achievement record deleted successfully!');
      loadAchievements();
    } catch (err: any) {
      setError(err.message || 'Failed to delete achievement');
    }
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newAchievement.student_id || !newAchievement.category_id || !newAchievement.sub_activity_id) {
      setError('Please select student, category, and sub-activity');
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('student_achievements')
        .insert([{
          student_id: newAchievement.student_id,
          category_id: newAchievement.category_id,
          sub_activity_id: newAchievement.sub_activity_id,
          score: newAchievement.score,
          participation_status: newAchievement.participation_status,
          notes: newAchievement.notes || null,
          recorded_by: user?.id,
          recorded_month: newAchievement.recorded_month,
          recorded_year: newAchievement.recorded_year,
        }]);

      if (insertError) throw insertError;

      setSuccess('Achievement record added successfully!');
      setNewAchievement({
        student_id: '',
        category_id: '',
        sub_activity_id: '',
        score: 0,
        participation_status: 'participated',
        notes: '',
        recorded_month: new Date().getMonth() + 1,
        recorded_year: new Date().getFullYear(),
      });
      setShowAddAchievement(false);
      loadAchievements();
    } catch (err: any) {
      setError(err.message || 'Failed to add achievement');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setStudentForm({ ...studentForm, profile_picture_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const insertData = {
        ...studentForm,
        date_of_birth: studentForm.date_of_birth || null
      };

      const { error: insertError } = await supabase
        .from('students')
        .insert([insertData]);

      if (insertError) throw insertError;

      setSuccess('Student added successfully!');
      setStudentForm({
        student_name: '',
        index_number: '',
        grade: '',
        id_card_no: '',
        date_of_birth: '',
        address: '',
        gender: 'Male',
        mail_id: '',
        club: '',
        house: '',
        position: '',
        profile_picture_url: '',
      });
      setSelectedImage(null);
      setImagePreview('');
      setShowAddStudent(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add student');
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      student_name: student.student_name,
      index_number: student.index_number,
      grade: student.grade,
      id_card_no: student.id_card_no || '',
      date_of_birth: student.date_of_birth || '',
      address: student.address || '',
      gender: student.gender as 'Male' | 'Female' | 'Other',
      mail_id: student.mail_id || '',
      club: student.club || '',
      house: student.house || '',
      position: student.position || '',
      profile_picture_url: student.profile_picture_url || '',
    });
    if (student.profile_picture_url) {
      setImagePreview(student.profile_picture_url);
    }
    setShowAddStudent(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editingStudent) return;

    try {
      const updateData = {
        ...studentForm,
        date_of_birth: studentForm.date_of_birth || null
      };

      const { error: updateError } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', editingStudent.id);

      if (updateError) throw updateError;

      setSuccess('Student updated successfully!');
      setStudentForm({
        student_name: '',
        index_number: '',
        grade: '',
        id_card_no: '',
        date_of_birth: '',
        address: '',
        gender: 'Male',
        mail_id: '',
        club: '',
        house: '',
        position: '',
        profile_picture_url: '',
      });
      setSelectedImage(null);
      setImagePreview('');
      setEditingStudent(null);
      setShowAddStudent(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update student');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Student deleted successfully!');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete student');
    }
  };

  const downloadCSVTemplate = () => {
    const headers = [
      'student_name',
      'index_number',
      'grade',
      'id_card_no',
      'date_of_birth',
      'address',
      'gender',
      'mail_id',
      'club',
      'house',
      'position'
    ];

    const sampleData = [
      '"John Doe","1001","Grade 10","A467595","15-Sep-20","123 Main St, City","Male","john@email.com","Science Club","Red House","Prefect"',
      '"Jane Smith","1002","Grade 11","B123456","22-Aug-19","456 Oak Ave, Town","Female","jane@email.com","Drama Club","Blue House","Captain"'
    ];

    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students_template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClearAllStudents = async () => {
    const studentCount = students.length;

    if (studentCount === 0) {
      setError('No students to delete');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ALL ${studentCount} students?\n\nThis action CANNOT be undone!`;
    if (!confirm(confirmMessage)) return;

    const doubleConfirm = confirm('Final confirmation: Delete ALL student records?');
    if (!doubleConfirm) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data: allStudents, error: fetchError } = await supabase
        .from('students')
        .select('id');

      if (fetchError) throw fetchError;

      if (!allStudents || allStudents.length === 0) {
        setError('No students found to delete');
        setLoading(false);
        return;
      }

      const { error: deleteError, count } = await supabase
        .from('students')
        .delete({ count: 'exact' })
        .in('id', allStudents.map(s => s.id));

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      await loadData();
      setSuccess(`Successfully deleted ${count || studentCount} student record(s)!`);
    } catch (err: any) {
      console.error('Error clearing students:', err);
      setError(err.message || 'Failed to delete students');
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.trim() === '') return null;

    const cleanDate = dateStr.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      return cleanDate;
    }

    const monthMap: { [key: string]: string } = {
      'jan': '01', 'january': '01',
      'feb': '02', 'february': '02',
      'mar': '03', 'march': '03',
      'apr': '04', 'april': '04',
      'may': '05',
      'jun': '06', 'june': '06',
      'jul': '07', 'july': '07',
      'aug': '08', 'august': '08',
      'sep': '09', 'sept': '09', 'september': '09',
      'oct': '10', 'october': '10',
      'nov': '11', 'november': '11',
      'dec': '12', 'december': '12'
    };

    const ddMmmYyPattern = /^(\d{1,2})[\/\-\s]([a-z]+)[\/\-\s](\d{2,4})$/i;
    const match = cleanDate.match(ddMmmYyPattern);

    if (match) {
      const day = match[1].padStart(2, '0');
      const monthStr = match[2].toLowerCase();
      const year = match[3];

      const month = monthMap[monthStr];
      if (!month) return null;

      let fullYear = year;
      if (year.length === 2) {
        const yearNum = parseInt(year);
        fullYear = yearNum <= 50 ? `20${year}` : `19${year}`;
      }

      return `${fullYear}-${month}-${day}`;
    }

    const dateObj = new Date(cleanDate);
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file must have a header row and at least one data row');
      }

      const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^["']|["']$/g, ''));
      const studentsData = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const student: any = {};

        headers.forEach((header, index) => {
          const key = header.toLowerCase().replace(/\s+/g, '_');
          student[key] = values[index] || '';
        });

        const normalizeGender = (gender: string): 'Male' | 'Female' | 'Other' => {
          const g = gender.toLowerCase().trim();
          if (g === 'male' || g === 'm') return 'Male';
          if (g === 'female' || g === 'f') return 'Female';
          if (g === 'other' || g === 'o') return 'Other';
          return 'Male';
        };

        const dateOfBirth = student.date_of_birth || student.dob || '';
        const parsedDate = parseDate(dateOfBirth);

        const studentData = {
          student_name: student.student_name || student.name || '',
          index_number: student.index_number || student.index || '',
          grade: student.grade || '',
          id_card_no: student.id_card_no || student.id_card || '',
          date_of_birth: parsedDate,
          address: student.address || '',
          gender: normalizeGender(student.gender || 'Male'),
          mail_id: student.mail_id || student.email || '',
          club: student.club || '',
          house: student.house || '',
          position: student.position || '',
          profile_picture_url: student.profile_picture_url || '',
        };

        if (!studentData.student_name || !studentData.index_number || !studentData.grade) {
          throw new Error(`Row ${i + 1}: Missing required fields (student_name, index_number, or grade). Please check your CSV file.`);
        }

        studentsData.push(studentData);
      }

      // Get all existing index numbers from database
      const { data: allExistingStudents } = await supabase
        .from('students')
        .select('index_number');

      const existingIndexNumbers = new Set(allExistingStudents?.map(s => s.index_number) || []);
      const usedIndexNumbers = new Set(existingIndexNumbers);

      // Fix duplicate index numbers in CSV and generate unique ones
      const indexNumberCount = new Map<string, number>();

      studentsData.forEach((student, idx) => {
        let indexNumber = student.index_number || '';

        // If index number is empty, generate a new one
        if (!indexNumber) {
          let counter = students.length + idx + 1;
          indexNumber = `STU${String(counter).padStart(4, '0')}`;
          while (usedIndexNumbers.has(indexNumber)) {
            counter++;
            indexNumber = `STU${String(counter).padStart(4, '0')}`;
          }
          student.index_number = indexNumber;
          usedIndexNumbers.add(indexNumber);
          return;
        }

        // Track how many times we've seen this index number
        const count = indexNumberCount.get(indexNumber) || 0;
        indexNumberCount.set(indexNumber, count + 1);

        // If this is a duplicate within the CSV or exists in DB, generate a new unique one
        if (count > 0 || existingIndexNumbers.has(indexNumber)) {
          let counter = 1;
          let newIndexNumber = `${indexNumber}-${counter}`;

          while (usedIndexNumbers.has(newIndexNumber)) {
            counter++;
            newIndexNumber = `${indexNumber}-${counter}`;
          }

          student.index_number = newIndexNumber;
          usedIndexNumbers.add(newIndexNumber);
        } else {
          usedIndexNumbers.add(indexNumber);
        }
      });

      const newStudents = studentsData;

      const { error: insertError } = await supabase
        .from('students')
        .insert(newStudents);

      if (insertError) {
        if (insertError.code === '23505' && insertError.message.includes('students_index_number_key')) {
          throw new Error('Some students have duplicate index numbers that already exist in the database. Please check your CSV file.');
        }
        throw insertError;
      }

      const successMessage = `Successfully uploaded ${newStudents.length} student(s)! Duplicate index numbers were automatically made unique.`;
      setSuccess(successMessage);
      setShowBulkUpload(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to upload students');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedCategory) {
      setError('Please select an activity category');
      return;
    }

    try {
      if (editingActivity) {
        const { error: updateError } = await supabase
          .from('sub_activities')
          .update({
            category_id: selectedCategory,
            ...activityForm,
          })
          .eq('id', editingActivity.id);

        if (updateError) throw updateError;

        setSuccess('Sub-activity updated successfully!');
      } else {
        const { error: insertError } = await supabase
          .from('sub_activities')
          .insert([{
            category_id: selectedCategory,
            ...activityForm,
          }]);

        if (insertError) throw insertError;

        setSuccess('Sub-activity added successfully!');
      }

      setActivityForm({ activity_name: '', description: '', max_score: 100 });
      setEditingActivity(null);
      setSelectedCategory('');
      setShowAddActivity(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save sub-activity');
    }
  };

  const handleEditActivity = (activity: SubActivity) => {
    setEditingActivity(activity);
    setSelectedCategory(activity.category_id);
    setActivityForm({
      activity_name: activity.activity_name,
      description: activity.description || '',
      max_score: activity.max_score,
    });
    setShowAddActivity(true);
  };

  const handleDeleteSubActivity = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sub-activity?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('sub_activities')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Sub-activity deleted successfully!');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete sub-activity');
    }
  };

  const filteredStudents = students.filter(student =>
    student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.index_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <img
                src={`${import.meta.env.BASE_URL}png.png`}
                alt="Faafu Atoll School logo"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">{userDetails?.full_name}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="flex space-x-1 border-b">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-6 py-3 font-medium transition ${
                activeTab === 'students'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-5 h-5 inline mr-2" />
              Students
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className={`px-6 py-3 font-medium transition ${
                activeTab === 'activities'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-5 h-5 inline mr-2" />
              Activities
            </button>
            <button
              onClick={() => {
                setActiveTab('achievements');
                loadAchievements();
              }}
              className={`px-6 py-3 font-medium transition ${
                activeTab === 'achievements'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Award className="w-5 h-5 inline mr-2" />
              Achievement Records
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(error || success) && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            {error || success}
          </div>
        )}

        {activeTab === 'students' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Student Management</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowBulkUpload(!showBulkUpload)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Upload className="w-5 h-5" />
                  <span>Bulk Upload</span>
                </button>
                <button
                  onClick={() => {
                    setEditingStudent(null);
                    setShowAddStudent(!showAddStudent);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Add Student</span>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search students by name, index, or grade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {showBulkUpload && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-gray-900 mb-3">Bulk Upload Students (CSV)</h3>

                <div className="mb-4">
                  <button
                    onClick={downloadCSVTemplate}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV Template</span>
                  </button>
                  <p className="text-xs text-gray-500 mt-2">Download this template to see the correct format</p>
                </div>

                <p className="text-sm text-gray-600 mb-2 font-medium">
                  Required CSV columns: student_name, index_number, grade
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  Optional columns: id_card_no, date_of_birth, address, gender, mail_id, club, house, position
                </p>
                <div className="text-xs text-gray-500 mb-3 space-y-1">
                  <p>• Use the template above to ensure correct formatting</p>
                  <p>• Wrap fields containing commas in double quotes (e.g., "123 Main St, City")</p>
                  <p>• grade: Use format like "Grade 10", "10", "Year 11", etc.</p>
                  <p>• date_of_birth: Supports multiple formats:</p>
                  <p className="ml-4">- DD-MMM-YY (e.g., 15-Sep-20, 22-Aug-19)</p>
                  <p className="ml-4">- YYYY-MM-DD (e.g., 2008-05-15)</p>
                  <p className="ml-4">- Or leave empty</p>
                  <p>• id_card_no: Can include letters and numbers (e.g., A467595, B123456)</p>
                  <p>• gender: Use Male, Female, Other (or M, F - will be auto-normalized)</p>
                  <p>• index_number: Must be unique - duplicates will be made unique automatically</p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleBulkUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                />

                {students.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-green-300">
                    <button
                      onClick={handleClearAllStudents}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Clear All Students ({students.length})</span>
                    </button>
                    <p className="text-xs text-red-600 mt-2 font-medium">Warning: This will permanently delete all student records!</p>
                  </div>
                )}
              </div>
            )}

            {showAddStudent && (
              <form onSubmit={editingStudent ? handleUpdateStudent : handleAddStudent} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-900">{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                    <input
                      type="text"
                      value={studentForm.student_name}
                      onChange={(e) => setStudentForm({ ...studentForm, student_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Index Number</label>
                    <input
                      type="text"
                      value={studentForm.index_number}
                      onChange={(e) => setStudentForm({ ...studentForm, index_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                    <input
                      type="text"
                      value={studentForm.grade}
                      onChange={(e) => setStudentForm({ ...studentForm, grade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID Card No</label>
                    <input
                      type="text"
                      value={studentForm.id_card_no}
                      onChange={(e) => setStudentForm({ ...studentForm, id_card_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={studentForm.date_of_birth}
                      onChange={(e) => setStudentForm({ ...studentForm, date_of_birth: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={studentForm.gender}
                      onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={studentForm.mail_id}
                      onChange={(e) => setStudentForm({ ...studentForm, mail_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Club</label>
                    <input
                      type="text"
                      value={studentForm.club}
                      onChange={(e) => setStudentForm({ ...studentForm, club: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">House</label>
                    <input
                      type="text"
                      value={studentForm.house}
                      onChange={(e) => setStudentForm({ ...studentForm, house: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <input
                      type="text"
                      value={studentForm.position}
                      onChange={(e) => setStudentForm({ ...studentForm, position: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={studentForm.address}
                      onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture</label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                      {imagePreview && (
                        <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border-2 border-gray-300" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Select an image from your device</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {editingStudent ? 'Update Student' : 'Add Student'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddStudent(false);
                      setEditingStudent(null);
                      setStudentForm({
                        student_name: '',
                        index_number: '',
                        grade: '',
                        id_card_no: '',
                        date_of_birth: '',
                        address: '',
                        gender: 'Male',
                        mail_id: '',
                        club: '',
                        house: '',
                        position: '',
                        profile_picture_url: '',
                      });
                      setImagePreview('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Index</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Grade</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Gender</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">House</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{student.student_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.index_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.grade}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.gender}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.house}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditStudent(student)}
                            className="text-blue-600 hover:text-blue-800 transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-red-600 hover:text-red-800 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Activity Management</h2>
              <button
                onClick={() => {
                  setEditingActivity(null);
                  setActivityForm({ activity_name: '', description: '', max_score: 100 });
                  setSelectedCategory('');
                  setShowAddActivity(!showAddActivity);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Add Sub-Activity</span>
              </button>
            </div>

            {showAddActivity && (
              <form onSubmit={handleAddSubActivity} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-900">{editingActivity ? 'Edit Sub-Activity' : 'Add New Sub-Activity'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Activity Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Activity Name</label>
                    <input
                      type="text"
                      value={activityForm.activity_name}
                      onChange={(e) => setActivityForm({ ...activityForm, activity_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Score</label>
                    <input
                      type="number"
                      value={activityForm.max_score}
                      onChange={(e) => setActivityForm({ ...activityForm, max_score: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={activityForm.description}
                      onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    {editingActivity ? 'Update Sub-Activity' : 'Add Sub-Activity'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddActivity(false);
                      setEditingActivity(null);
                      setActivityForm({ activity_name: '', description: '', max_score: 100 });
                      setSelectedCategory('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category.id} className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{category.category_name}</h3>
                  <div className="space-y-2">
                    {subActivities
                      .filter((sub) => sub.category_id === category.id)
                      .map((sub) => (
                        <div key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{sub.activity_name}</p>
                            {sub.description && (
                              <p className="text-sm text-gray-600">{sub.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">Max Score: {sub.max_score}</p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditActivity(sub)}
                              className="text-blue-600 hover:text-blue-800 transition"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubActivity(sub.id)}
                              className="text-red-600 hover:text-red-800 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    {subActivities.filter((sub) => sub.category_id === category.id).length === 0 && (
                      <p className="text-sm text-gray-500 italic">No sub-activities yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <h2 className="text-xl font-bold text-gray-900">Achievement Records</h2>
                <button
                  onClick={() => setShowAddAchievement(!showAddAchievement)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition self-start"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Achievement</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                  <select
                    value={achievementFilterStudent}
                    onChange={(e) => setAchievementFilterStudent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">All Students</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.student_name} ({s.index_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={achievementFilterCategory}
                    onChange={(e) => setAchievementFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.category_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <select
                    value={achievementFilterGrade}
                    onChange={(e) => setAchievementFilterGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">All Grades</option>
                    {[...new Set(students.map(s => s.grade))].sort().map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={loadAchievements}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>

              {showAddAchievement && (
                <form onSubmit={handleAddAchievement} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                  <h3 className="font-semibold text-gray-900">Add New Achievement Record</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                      <select
                        value={newAchievement.student_id}
                        onChange={(e) => setNewAchievement({ ...newAchievement, student_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        required
                      >
                        <option value="">Select Student</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>{s.student_name} ({s.index_number}) - {s.grade}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={newAchievement.category_id}
                        onChange={(e) => setNewAchievement({ ...newAchievement, category_id: e.target.value, sub_activity_id: '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        required
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.category_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Activity</label>
                      <select
                        value={newAchievement.sub_activity_id}
                        onChange={(e) => setNewAchievement({ ...newAchievement, sub_activity_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        required
                        disabled={!newAchievement.category_id}
                      >
                        <option value="">Select Sub-Activity</option>
                        {subActivities.filter(s => s.category_id === newAchievement.category_id).map((s) => (
                          <option key={s.id} value={s.id}>{s.activity_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                      <input
                        type="number"
                        value={newAchievement.score}
                        onChange={(e) => setNewAchievement({ ...newAchievement, score: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Participation Status</label>
                      <select
                        value={newAchievement.participation_status}
                        onChange={(e) => setNewAchievement({ ...newAchievement, participation_status: e.target.value as ParticipationStatus })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="participated">Participated</option>
                        <option value="absent">Absent</option>
                        <option value="excused">Excused</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                      <select
                        value={newAchievement.recorded_month}
                        onChange={(e) => setNewAchievement({ ...newAchievement, recorded_month: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                      <input
                        type="number"
                        value={newAchievement.recorded_year}
                        onChange={(e) => setNewAchievement({ ...newAchievement, recorded_year: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <input
                        type="text"
                        value={newAchievement.notes}
                        onChange={(e) => setNewAchievement({ ...newAchievement, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button type="submit" className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                      <Save className="w-4 h-4" />
                      <span>Save Achievement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddAchievement(false)}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              )}

              {loading ? (
                <p className="text-gray-500 text-center py-8">Loading achievements...</p>
              ) : achievements.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No achievement records found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Student</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Grade</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Sub-Activity</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Score</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Month/Year</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Notes</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {achievements.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{a.students?.student_name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.students?.grade || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.activity_categories?.category_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.sub_activities?.activity_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{a.score}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              a.participation_status === 'participated' ? 'bg-green-50 text-green-700' :
                              a.participation_status === 'absent' ? 'bg-red-50 text-red-700' :
                              'bg-yellow-50 text-yellow-700'
                            }`}>
                              {a.participation_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(2000, a.recorded_month - 1).toLocaleString('default', { month: 'short' })} {a.recorded_year}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{a.notes || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex space-x-2">
                              <button onClick={() => handleEditAchievement(a)} className="text-blue-600 hover:text-blue-800 transition">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteAchievement(a.id)} className="text-red-600 hover:text-red-800 transition">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {showEditAchievement && editingAchievement && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Edit Achievement Record</h3>
                    <button onClick={() => setShowEditAchievement(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleUpdateAchievement} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                        <select
                          value={achievementForm.student_id}
                          onChange={(e) => setAchievementForm({ ...achievementForm, student_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                        >
                          <option value="">Select Student</option>
                          {students.map((s) => (
                            <option key={s.id} value={s.id}>{s.student_name} ({s.index_number}) - {s.grade}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                          value={achievementForm.category_id}
                          onChange={(e) => setAchievementForm({ ...achievementForm, category_id: e.target.value, sub_activity_id: '' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                        >
                          <option value="">Select Category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.category_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Activity</label>
                        <select
                          value={achievementForm.sub_activity_id}
                          onChange={(e) => setAchievementForm({ ...achievementForm, sub_activity_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                          disabled={!achievementForm.category_id}
                        >
                          <option value="">Select Sub-Activity</option>
                          {subActivities.filter(s => s.category_id === achievementForm.category_id).map((s) => (
                            <option key={s.id} value={s.id}>{s.activity_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                        <input
                          type="number"
                          value={achievementForm.score}
                          onChange={(e) => setAchievementForm({ ...achievementForm, score: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Participation Status</label>
                        <select
                          value={achievementForm.participation_status}
                          onChange={(e) => setAchievementForm({ ...achievementForm, participation_status: e.target.value as ParticipationStatus })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          <option value="participated">Participated</option>
                          <option value="absent">Absent</option>
                          <option value="excused">Excused</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                        <select
                          value={achievementForm.recorded_month}
                          onChange={(e) => setAchievementForm({ ...achievementForm, recorded_month: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                        <input
                          type="number"
                          value={achievementForm.recorded_year}
                          onChange={(e) => setAchievementForm({ ...achievementForm, recorded_year: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <input
                          type="text"
                          value={achievementForm.notes}
                          onChange={(e) => setAchievementForm({ ...achievementForm, notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-3 pt-2">
                      <button type="submit" className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                        <Save className="w-4 h-4" />
                        <span>Update Record</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditAchievement(false)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
