import { useState } from 'react';
import { Search, Award, Calendar, TrendingUp, User, LogIn, Trophy, Star, Medal, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Student = Database['public']['Tables']['students']['Row'];

interface AchievementEntry {
  id: string;
  activity_name: string;
  score: number;
  participation_status: string;
  recorded_month: number;
  recorded_year: number;
  notes: string | null;
}

interface YearGroup {
  year: number;
  categories: {
    category_name: string;
    activities: AchievementEntry[];
  }[];
}

export function PublicDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<'name' | 'index'>('name');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setNotFound(false);
    setStudent(null);
    setYearGroups([]);

    try {
      const query = supabase.from('students').select('*');

      if (searchBy === 'name') {
        query.ilike('student_name', `%${searchTerm}%`);
      } else {
        query.eq('index_number', searchTerm);
      }

      const { data: studentData, error: studentError } = await query.limit(1).maybeSingle();

      if (studentError) throw studentError;

      if (!studentData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setStudent(studentData);

      let achievementsQuery = supabase
        .from('student_achievements')
        .select(`
          id,
          score,
          participation_status,
          notes,
          recorded_month,
          recorded_year,
          activity_categories (category_name),
          sub_activities (activity_name)
        `)
        .eq('student_id', studentData.id);

      if (selectedYear !== null) {
        achievementsQuery = achievementsQuery.eq('recorded_year', selectedYear);
      }

      if (selectedMonth !== null) {
        achievementsQuery = achievementsQuery.eq('recorded_month', selectedMonth);
      }

      achievementsQuery = achievementsQuery.order('recorded_year', { ascending: false })
        .order('recorded_month', { ascending: false });

      const { data: achievementsData, error: achievementsError } = await achievementsQuery;

      if (achievementsError) throw achievementsError;

      const yearMap: Record<number, Record<string, {
        category_name: string;
        activities: AchievementEntry[];
      }>> = {};

      achievementsData?.forEach((achievement: any) => {
        const year = achievement.recorded_year;
        const categoryName = achievement.activity_categories?.category_name || 'Uncategorized';

        if (!yearMap[year]) yearMap[year] = {};

        if (!yearMap[year][categoryName]) {
          yearMap[year][categoryName] = {
            category_name: categoryName,
            activities: [],
          };
        }

        yearMap[year][categoryName].activities.push({
          id: achievement.id,
          activity_name: achievement.sub_activities?.activity_name || 'Unknown',
          score: achievement.score,
          participation_status: achievement.participation_status,
          recorded_month: achievement.recorded_month,
          recorded_year: achievement.recorded_year,
          notes: achievement.notes,
        });
      });

      const groups: YearGroup[] = Object.keys(yearMap)
        .map(Number)
        .sort((a, b) => b - a)
        .map(year => ({
          year,
          categories: Object.values(yearMap[year]),
        }));

      setYearGroups(groups);
    } catch (err) {
      console.error('Error searching student:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalScore = () => {
    let total = 0;
    yearGroups.forEach(yg => {
      yg.categories.forEach(cat => {
        cat.activities.forEach(act => {
          if (act.participation_status === 'participated') {
            total += act.score;
          }
        });
      });
    });
    return total;
  };

  const countAchievements = () => {
    let count = 0;
    yearGroups.forEach(yg => {
      yg.categories.forEach(cat => {
        cat.activities.forEach(act => {
          if (act.participation_status === 'participated' && act.score > 0) count++;
        });
      });
    });
    return count;
  };

  const countParticipations = () => {
    let count = 0;
    yearGroups.forEach(yg => {
      yg.categories.forEach(cat => {
        cat.activities.forEach(act => {
          if (act.participation_status === 'participated') count++;
        });
      });
    });
    return count;
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getStatusIcon = (status: string, score: number) => {
    if (status === 'participated' && score > 0) return <Trophy className="w-5 h-5 text-amber-500" />;
    if (status === 'participated') return <Medal className="w-5 h-5 text-blue-500" />;
    if (status === 'absent') return <Target className="w-5 h-5 text-red-400" />;
    return <Star className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white shadow-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Faafu Atoll School
              </h1>
              <p className="text-lg text-gray-600">Student Achievement Public Portal</p>
            </div>
            <button
              onClick={() => window.location.href = '?login=true'}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
            >
              <LogIn className="w-5 h-5" />
              <span>Admin Login</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Search className="w-6 h-6 mr-2 text-blue-600" />
            Search Student Achievement Profile
          </h2>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search By</label>
                <select
                  value={searchBy}
                  onChange={(e) => setSearchBy(e.target.value as 'name' | 'index')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="name">Student Name</option>
                  <option value="index">Index Number</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {searchBy === 'name' ? 'Student Name' : 'Index Number'}
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchBy === 'name' ? 'Enter student name' : 'Enter index number'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <select
                  value={selectedYear ?? ''}
                  onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">All Years</option>
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Month (Optional)</label>
                <select
                  value={selectedMonth ?? ''}
                  onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">All Months</option>
                  {months.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {notFound && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
            <p className="text-yellow-800 font-medium">No student found with the provided information.</p>
          </div>
        )}

        {student && (
          <>
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <User className="w-6 h-6 mr-2 text-blue-600" />
                Student Profile
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 flex flex-col items-center">
                  {student.profile_picture_url ? (
                    <img
                      src={student.profile_picture_url}
                      alt={student.student_name}
                      className="w-40 h-40 rounded-full object-cover border-4 border-blue-100 shadow-lg"
                    />
                  ) : (
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center border-4 border-blue-100 shadow-lg">
                      <User className="w-20 h-20 text-white" />
                    </div>
                  )}
                  <h3 className="mt-4 text-xl font-bold text-gray-900 text-center">{student.student_name}</h3>
                  <p className="text-gray-600">{student.index_number}</p>
                </div>

                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Grade</p>
                    <p className="text-lg font-semibold text-gray-900">{student.grade}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Gender</p>
                    <p className="text-lg font-semibold text-gray-900">{student.gender || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Date of Birth</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">ID Card No</p>
                    <p className="text-lg font-semibold text-gray-900">{student.id_card_no || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">House</p>
                    <p className="text-lg font-semibold text-gray-900">{student.house || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Club</p>
                    <p className="text-lg font-semibold text-gray-900">{student.club || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Position</p>
                    <p className="text-lg font-semibold text-gray-900">{student.position || 'N/A'}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                    <p className="text-sm text-gray-600 mb-2">Attendance</p>
                    <p className="text-lg font-semibold text-gray-900 mb-2">
                      {student.attendance_percent || 0}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${student.attendance_percent || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                    <p className="text-sm text-gray-600 mb-2">Two Activity Participation</p>
                    <p className="text-lg font-semibold text-gray-900 mb-2">
                      {student.two_activity_participation_percent || 0}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${student.two_activity_participation_percent || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                    <p className="text-sm text-gray-600 mb-1">Address</p>
                    <p className="text-lg font-semibold text-gray-900">{student.address || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                    <p className="text-sm text-gray-600 mb-1">Email</p>
                    <p className="text-lg font-semibold text-gray-900">{student.mail_id || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Award className="w-6 h-6 mr-2 text-blue-600" />
                  Achievement Records
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700 font-medium">
                      {selectedMonth ? months[selectedMonth - 1] : 'All Months'} {selectedYear ?? 'All Years'}
                    </span>
                  </div>
                  {yearGroups.length > 0 && (
                    <>
                      <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <span className="text-blue-900 font-bold">Total Score: {calculateTotalScore()}</span>
                      </div>
                      <div className="flex items-center space-x-2 bg-amber-50 px-4 py-2 rounded-lg">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <span className="text-amber-900 font-bold">Achievements: {countAchievements()}</span>
                      </div>
                      <div className="flex items-center space-x-2 bg-green-50 px-4 py-2 rounded-lg">
                        <Medal className="w-5 h-5 text-green-600" />
                        <span className="text-green-900 font-bold">Participations: {countParticipations()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {yearGroups.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No achievement records found for the selected period.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {yearGroups.map((yearGroup, ygIndex) => (
                    <div key={ygIndex} className="rounded-xl overflow-hidden border border-gray-200">
                      <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white flex items-center">
                          <Calendar className="w-5 h-5 mr-2" />
                          {yearGroup.year}
                        </h3>
                        <span className="text-blue-100 text-sm font-medium">
                          {yearGroup.categories.reduce((sum, c) => sum + c.activities.length, 0)} record(s)
                        </span>
                      </div>

                      <div className="p-6 space-y-6 bg-gray-50">
                        {yearGroup.categories.map((category, catIndex) => (
                          <div key={catIndex} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                            <div className="bg-gray-100 px-5 py-3 border-b border-gray-200">
                              <h4 className="text-lg font-bold text-gray-800 flex items-center">
                                <Award className="w-5 h-5 mr-2 text-blue-500" />
                                {category.category_name}
                              </h4>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {category.activities.map((activity, actIndex) => (
                                <div key={actIndex} className="flex items-start justify-between p-4 hover:bg-blue-50/50 transition">
                                  <div className="flex items-start space-x-3 flex-1">
                                    <div className="mt-1">
                                      {getStatusIcon(activity.participation_status, activity.score)}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-900">{activity.activity_name}</p>
                                      <p className="text-sm text-gray-500 mt-0.5">
                                        {months[activity.recorded_month - 1]} {activity.recorded_year}
                                      </p>
                                      {activity.notes && (
                                        <div className="mt-2 inline-flex items-start bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                                          <Trophy className="w-4 h-4 text-amber-500 mr-1.5 mt-0.5 flex-shrink-0" />
                                          <span className="text-sm text-amber-900 font-medium">{activity.notes}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end space-y-2 ml-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                      activity.participation_status === 'participated'
                                        ? 'bg-green-100 text-green-700'
                                        : activity.participation_status === 'absent'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {activity.participation_status}
                                    </span>
                                    {activity.participation_status === 'participated' && (
                                      <span className="text-2xl font-bold text-blue-600">
                                        {activity.score}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
