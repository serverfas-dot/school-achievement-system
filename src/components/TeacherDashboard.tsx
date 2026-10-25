import { useState, useEffect } from 'react';
import { Calendar, CheckSquare, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';

type Student = Database['public']['Tables']['students']['Row'];
type ActivityCategory = Database['public']['Tables']['activity_categories']['Row'];
type SubActivity = Database['public']['Tables']['sub_activities']['Row'];
type AttendanceStatus = Database['public']['Tables']['attendance_records']['Row']['attendance_status'];
type WinnerPosition = 1 | 2 | 3 | null;

interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  winnerPosition: WinnerPosition;
  notes: string;
}

interface SavedAttendanceRecord {
  student_id: string;
  attendance_status: AttendanceStatus;
  notes: string | null;
  students: {
    student_name: string;
    index_number: string;
  };
}

export function TeacherDashboard() {
  const { userDetails, user } = useAuth();
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [subActivities, setSubActivities] = useState<SubActivity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubActivity, setSelectedSubActivity] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [activityDate, setActivityDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [grades, setGrades] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recordedMonth, setRecordedMonth] = useState<number>(new Date().getMonth() + 1);
  const [recordedYear, setRecordedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'mark' | 'view'>('mark');
  const [savedAttendance, setSavedAttendance] = useState<SavedAttendanceRecord[]>([]);

  const loadData = async () => {
    setLoading(true);

    const [categoriesRes, subActivitiesRes, studentsRes] = await Promise.all([
      supabase.from('activity_categories').select('*').order('display_order'),
      supabase.from('sub_activities').select('*'),
      supabase.from('students').select('*').order('student_name'),
    ]);

    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (subActivitiesRes.data) setSubActivities(subActivitiesRes.data);
    if (studentsRes.data) {
      setStudents(studentsRes.data);
      const uniqueGrades = [...new Set(studentsRes.data.map(s => s.grade))].sort();
      setGrades(uniqueGrades);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedGrade && selectedSubActivity && viewMode === 'mark') {
      const gradeStudents = students.filter(s => s.grade === selectedGrade);
      const newAttendance: Record<string, AttendanceRecord> = {};
      gradeStudents.forEach(student => {
        newAttendance[student.id] = {
          studentId: student.id,
          status: 'present',
          winnerPosition: null,
          notes: '',
        };
      });
      setAttendance(newAttendance);
    } else if (selectedGrade && selectedSubActivity && viewMode === 'view') {
      loadSavedAttendance();
    }
  }, [selectedGrade, selectedSubActivity, students, viewMode, activityDate]);

  const loadSavedAttendance = async () => {
    if (!selectedSubActivity || !selectedGrade || !activityDate) return;

    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          student_id,
          attendance_status,
          notes,
          students (
            student_name,
            index_number
          )
        `)
        .eq('sub_activity_id', selectedSubActivity)
        .eq('grade', selectedGrade)
        .eq('activity_date', activityDate);

      if (error) throw error;

      setSavedAttendance(data || []);
    } catch (err) {
      console.error('Error loading saved attendance:', err);
      setSavedAttendance([]);
    }
  };

  const handleAttendanceChange = (studentId: string, field: 'status' | 'winnerPosition' | 'notes', value: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: field === 'winnerPosition' ? (value ? Number(value) as WinnerPosition : null) : value,
      },
    }));
  };

  const handleSubmitAttendance = async () => {
    if (!selectedSubActivity || !selectedGrade) {
      setError('Please select a sub-activity and grade');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (activityDate < today) {
      setError('Cannot mark attendance for past dates. Please select today or a future date.');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const attendanceRecords = Object.values(attendance).map(record => ({
        student_id: record.studentId,
        sub_activity_id: selectedSubActivity,
        grade: selectedGrade,
        attendance_status: record.status,
        marked_by: user?.id,
        activity_date: activityDate,
        notes: record.notes || null,
      }));

      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert(attendanceRecords);

      if (insertError) throw insertError;

      const achievementRecords = Object.values(attendance)
        .filter(record => record.status === 'present')
        .map(record => ({
          student_id: record.studentId,
          category_id: selectedCategory,
          sub_activity_id: selectedSubActivity,
          participation_status: 'participated' as const,
          recorded_by: user?.id,
          recorded_month: recordedMonth,
          recorded_year: recordedYear,
          notes: record.notes || null,
          winner_position: record.winnerPosition,
        }));

      if (achievementRecords.length > 0) {
        const { error: achievementError } = await supabase
          .from('student_achievements')
          .insert(achievementRecords);

        if (achievementError) throw achievementError;
      }

      setSuccess('Attendance and achievements recorded successfully!');
      setAttendance({});
      setSelectedSubActivity('');
    } catch (err: any) {
      setError(err.message || 'Failed to record attendance');
    }
  };

  const filteredSubActivities = subActivities.filter(
    sub => sub.category_id === selectedCategory
  );

  const gradeStudents = students.filter(s => s.grade === selectedGrade);

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
                <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
                <p className="text-sm text-gray-600">{userDetails?.full_name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">Loading records...</div>
        )}
        {(error || success) && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            {error || success}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {viewMode === 'mark' ? 'Mark Activity Attendance' : 'View Past Attendance'}
                </h2>
                <p className="text-sm text-gray-600">
                  {viewMode === 'mark' ? (
                    <>
                      Mark <span className="font-medium text-green-700">Present (P)</span> for students who participated in the activity.
                      Mark <span className="font-medium text-red-700">Absent (AB)</span> for students who did not participate.
                    </>
                  ) : (
                    'View attendance records for past activities. Select date and activity to view.'
                  )}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setViewMode('mark')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                    viewMode === 'mark'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Mark Attendance</span>
                </button>
                <button
                  onClick={() => setViewMode('view')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                    viewMode === 'view'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>View Past</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Activity Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubActivity('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Activity</label>
              <select
                value={selectedSubActivity}
                onChange={(e) => setSelectedSubActivity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={!selectedCategory}
              >
                <option value="">Select Sub-Activity</option>
                {filteredSubActivities.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.activity_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grade/Class</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select Grade</option>
                {grades.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Activity Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Record Month</label>
              <select
                value={recordedMonth}
                onChange={(e) => setRecordedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Record Year</label>
              <input
                type="number"
                value={recordedYear}
                onChange={(e) => setRecordedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {selectedSubActivity && selectedGrade && viewMode === 'mark' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">
                Students in Grade {selectedGrade}
              </h3>
              <button
                onClick={handleSubmitAttendance}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <CheckSquare className="w-5 h-5" />
                <span>Submit Attendance</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Student Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Index Number</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Attendance Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Winner</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {gradeStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{student.student_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{student.index_number}</td>
                      <td className="px-4 py-3">
                        <select
                          value={attendance[student.id]?.status || 'present'}
                          onChange={(e) => handleAttendanceChange(student.id, 'status', e.target.value)}
                          className={`px-3 py-1 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium ${
                            attendance[student.id]?.status === 'present'
                              ? 'bg-green-50 border-green-300 text-green-700'
                              : attendance[student.id]?.status === 'absent'
                              ? 'bg-red-50 border-red-300 text-red-700'
                              : 'bg-gray-50 border-gray-300 text-gray-700'
                          }`}
                        >
                          <option value="present">Present (P)</option>
                          <option value="absent">Absent (AB)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={attendance[student.id]?.winnerPosition ?? ''}
                          onChange={(e) => handleAttendanceChange(student.id, 'winnerPosition', e.target.value)}
                          disabled={attendance[student.id]?.status !== 'present'}
                          className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">No winner</option>
                          <option value="1">Winner 1</option>
                          <option value="2">Winner 2</option>
                          <option value="3">Winner 3</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={attendance[student.id]?.notes || ''}
                          onChange={(e) => handleAttendanceChange(student.id, 'notes', e.target.value)}
                          placeholder="Optional notes..."
                          className="w-full px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedSubActivity && selectedGrade && viewMode === 'view' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900">
                Attendance Records for Grade {selectedGrade} on {new Date(activityDate).toLocaleDateString()}
              </h3>
            </div>

            {savedAttendance.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">No attendance records found for this date and activity.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Student Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Index Number</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Attendance Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {savedAttendance.map((record: any) => (
                      <tr key={record.student_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{record.students?.student_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.students?.index_number}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            record.attendance_status === 'present'
                              ? 'bg-green-50 text-green-700'
                              : record.attendance_status === 'absent'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-gray-50 text-gray-700'
                          }`}>
                            {record.attendance_status === 'present' ? 'Present (P)' : 'Absent (AB)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
