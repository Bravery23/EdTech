import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, Users, ShieldCheck, Database, 
  Settings, Bell, Search, Plus, Filter, 
  MoreHorizontal, Trash2, Edit, CheckCircle, 
  AlertTriangle, Activity, Server, Cpu, 
  LogOut, ChevronRight, Download, Upload,
  UserPlus, Key, Globe, Shield, Sparkles, User, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminDashboardProps {
  onLogout: () => void;
}

type AdminTab = 'overview' | 'users' | 'classes' | 'rag-config' | 'settings';

const API = 'http://localhost:8000/api/v1';

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const { user: currentUser, token } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', full_name: '', password: '', role: 'student' });
  const [isCreating, setIsCreating] = useState(false);
  
  // Data for classes tab
  const [schoolClasses, setSchoolClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [classTeachers, setClassTeachers] = useState<any[]>([]);
  const [showClassModal, setShowClassModal] = useState(false);
  
  // Forms for assignment
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');

  // Create class state
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [createClassForm, setCreateClassForm] = useState({ name: '', grade_level: 10, academic_year: '2023-2024' });
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    fetchUsers();
    fetchClasses();
    fetchSubjects();
  }, [token]);

    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API}/users/`, { headers });
        if (res.ok) setUsers(await res.json());
      } catch (e) { console.error(e); }
    };

  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API}/classes/`, { headers });
      if (res.ok) setSchoolClasses(await res.json());
    } catch (e) { console.error(e); }
  };
  
  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API}/subjects/`, { headers });
      if (res.ok) setSubjects(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Bạn có chắc muốn xóa người dùng này?')) return;
    try {
      const res = await fetch(`${API}/users/${userId}`, { method: 'DELETE', headers });
      if (res.ok || res.status === 204) {
        setUsers(prev => prev.filter(u => u.id !== userId));
      }
    } catch (e) { console.error(e); }
  };

  const openClassModal = async (cls: any) => {
    setSelectedClass(cls);
    setShowClassModal(true);
    // Fetch students and teachers
    try {
      const resS = await fetch(`${API}/classes/${cls.id}/students`, { headers });
      if (resS.ok) setClassStudents(await resS.json());
      
      const resT = await fetch(`${API}/classes/${cls.id}/teachers`, { headers });
      if (resT.ok) setClassTeachers(await resT.json());
    } catch (e) { console.error(e); }
  };

  const assignHomeroomTeacher = async (teacherId: number) => {
    try {
      const res = await fetch(`${API}/classes/${selectedClass.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeroom_teacher_id: teacherId || null })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedClass(updated);
        setSchoolClasses(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
    } catch (e) { console.error(e); }
  };

  const addStudentToClass = async () => {
    if (!assignStudentId) return;
    try {
      const res = await fetch(`${API}/classes/${selectedClass.id}/students/${assignStudentId}`, { method: 'POST', headers });
      if (res.ok) {
        setAssignStudentId('');
        const resS = await fetch(`${API}/classes/${selectedClass.id}/students`, { headers });
        if (resS.ok) setClassStudents(await resS.json());
      } else alert("Lỗi khi thêm học sinh");
    } catch (e) { console.error(e); }
  };

  const removeStudentFromClass = async (studentId: number) => {
    try {
      const res = await fetch(`${API}/classes/${selectedClass.id}/students/${studentId}`, { method: 'DELETE', headers });
      if (res.ok || res.status === 204) {
        setClassStudents(prev => prev.filter(cs => cs.student_id !== studentId));
      }
    } catch (e) { console.error(e); }
  };

  const addTeacherToClass = async () => {
    if (!assignTeacherId || !assignSubjectId) return;
    try {
      const res = await fetch(`${API}/classes/${selectedClass.id}/teachers/${assignTeacherId}?subject_id=${assignSubjectId}`, { method: 'POST', headers });
      if (res.ok) {
        setAssignTeacherId('');
        setAssignSubjectId('');
        const resT = await fetch(`${API}/classes/${selectedClass.id}/teachers`, { headers });
        if (resT.ok) setClassTeachers(await resT.json());
      } else alert("Lỗi khi phân công giáo viên");
    } catch (e) { console.error(e); }
  };

  const removeTeacherFromClass = async (teacherId: number, subjectId: number) => {
    try {
      const res = await fetch(`${API}/classes/${selectedClass.id}/teachers/${teacherId}?subject_id=${subjectId}`, { method: 'DELETE', headers });
      if (res.ok || res.status === 204) {
        setClassTeachers(prev => prev.filter(ct => !(ct.teacher_id === teacherId && ct.subject_id === subjectId)));
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) {
      alert('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.email,
          full_name: createForm.full_name,
          password: createForm.password,
          role: [createForm.role]
        })
      });
      if (res.ok) {
        setShowCreateUser(false);
        setCreateForm({ email: '', full_name: '', password: '', role: 'student' });
        fetchUsers();
      } else {
        const err = await res.json();
        alert('Lỗi: ' + (err.detail || 'Unknown'));
      }
    } catch (e) { console.error(e); } finally { setIsCreating(false); }
  };

  const handleCreateClass = async () => {
    if (!createClassForm.name || !createClassForm.academic_year) {
      alert('Vui lòng nhập đầy đủ tên lớp và năm học.');
      return;
    }
    setIsCreatingClass(true);
    try {
      const res = await fetch(`${API}/classes/`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createClassForm.name,
          grade_level: Number(createClassForm.grade_level),
          academic_year: createClassForm.academic_year
        })
      });
      if (res.ok) {
        setShowCreateClassModal(false);
        setCreateClassForm({ name: '', grade_level: 10, academic_year: '2023-2024' });
        fetchClasses();
      } else {
        const err = await res.json();
        alert('Lỗi: ' + (err.detail || 'Unknown'));
      }
    } catch (e) { console.error(e); } finally { setIsCreatingClass(false); }
  };

  const stats = [
    { label: 'Tổng người dùng', value: users.length.toString(), change: `${users.filter(u => u.is_active).length} hoạt động`, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Yêu cầu AI/ngày', value: '–', change: 'Cập nhật sau', icon: Activity, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Dung lượng RAG', value: '–', change: 'Cập nhật sau', icon: Database, color: 'text-tertiary', bg: 'bg-tertiary/10' },
    { label: 'Trạng thái hệ thống', value: 'Ổn định', change: '99.9%', icon: Server, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const ragSources = [
    { id: '1', name: 'Sách giáo khoa Toán 12', type: 'PDF', size: '12MB', status: 'Indexed' },
    { id: '2', name: 'Đề thi THPT Quốc gia 2024', type: 'DOCX', size: '4MB', status: 'Processing' },
    { id: '3', name: 'Tài liệu ôn tập Ngữ Văn', type: 'PDF', size: '25MB', status: 'Indexed' },
  ];

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleLabel = (roles: string[]) => {
    if (!roles || roles.length === 0) return 'Học sinh';
    if (roles.includes('admin')) return 'Admin';
    if (roles.includes('subject_teacher') || roles.includes('homeroom_teacher')) return 'Giáo viên';
    if (roles.includes('parent')) return 'Phụ huynh';
    return 'Học sinh';
  };


  return (
    <div className="flex min-h-screen bg-surface font-sans">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low flex flex-col py-6 px-4 z-50 border-r border-outline-variant/10">
        <div className="mb-10 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary">Admin Panel</h1>
              <p className="text-[10px] text-on-surface-variant opacity-70 uppercase tracking-widest font-bold">Hệ thống RAG</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'overview' ? 'text-primary font-bold border-r-4 border-primary bg-white/50' : 'text-on-surface-variant hover:text-primary hover:bg-white/30'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Tổng quan</span>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'users' ? 'text-primary font-bold border-r-4 border-primary bg-white/50' : 'text-on-surface-variant hover:text-primary hover:bg-white/30'}`}
          >
            <Users className="w-5 h-5" />
            <span>Người dùng</span>
          </button>
          <button 
            onClick={() => setActiveTab('classes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'classes' ? 'text-primary font-bold border-r-4 border-primary bg-white/50' : 'text-on-surface-variant hover:text-primary hover:bg-white/30'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Lớp học</span>
          </button>
          <button 
            onClick={() => setActiveTab('rag-config')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'rag-config' ? 'text-primary font-bold border-r-4 border-primary bg-white/50' : 'text-on-surface-variant hover:text-primary hover:bg-white/30'}`}
          >
            <Database className="w-5 h-5" />
            <span>Dữ liệu RAG</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'settings' ? 'text-primary font-bold border-r-4 border-primary bg-white/50' : 'text-on-surface-variant hover:text-primary hover:bg-white/30'}`}
          >
            <Settings className="w-5 h-5" />
            <span>Cài đặt</span>
          </button>
        </nav>

        <div className="mt-auto px-2">
          <button 
            onClick={onLogout}
            className="w-full bg-gradient-to-r from-error to-error-container text-white py-4 rounded-md font-semibold flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Đăng xuất hệ thống</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 pt-24 px-10 pb-12 w-full">
        {/* Top Nav */}
        <header className="fixed top-0 right-0 w-[calc(100%-16rem)] z-40 bg-white/70 backdrop-blur-md flex justify-between items-center h-16 px-8 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
              <input 
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-sm focus:ring-2 focus:ring-primary text-sm transition-all" 
                placeholder="Tìm kiếm người dùng, tài liệu, logs..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pl-4 border-l border-outline-variant/20">
              <div className="text-right">
                <p className="font-bold text-on-surface text-sm leading-none">{currentUser?.full_name || 'Quản trị viên'}</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">Hệ thống RAG</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-5xl font-extrabold text-on-surface tracking-tight leading-tight">
                      Hệ thống<br/><span className="text-primary">Quản trị.</span>
                    </h2>
                    <p className="text-lg text-on-surface-variant mt-4 max-w-xl leading-relaxed">
                      Giám sát hiệu năng AI, quản lý kho tri thức và điều phối người dùng trong thời gian thực.
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {stats.map((stat, i) => (
                    <div key={i} className="glass-panel p-6 rounded-2xl border border-white/40 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                          <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-secondary/10 text-secondary' : 'bg-on-surface-variant/10 text-on-surface-variant'}`}>
                          {stat.change}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-on-surface-variant">{stat.label}</p>
                      <p className="text-3xl font-black text-on-surface mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Placeholder */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="glass-panel p-8 rounded-2xl border border-white/40 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-bold text-on-surface">Lưu lượng AI theo giờ</h3>
                      <Sparkles className="w-5 h-5 text-primary opacity-50" />
                    </div>
                    <div className="h-64 flex items-end justify-between gap-2 px-2">
                      {[40, 65, 45, 90, 55, 70, 85, 40, 60, 75, 50, 95].map((h, i) => (
                        <div key={i} className="flex-1 bg-primary/10 rounded-t-md relative group">
                          <div 
                            style={{ height: `${h}%` }} 
                            className="w-full bg-primary rounded-t-md transition-all group-hover:bg-primary-container"
                          ></div>
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-surface text-surface text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {h * 100} reqs
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-4 px-2">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">00:00</span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">12:00</span>
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">23:59</span>
                    </div>
                  </div>

                  <div className="glass-panel p-8 rounded-2xl border border-white/40 shadow-sm">
                    <h3 className="text-lg font-bold text-on-surface mb-8">Phân bổ người dùng</h3>
                    <div className="space-y-6">
                      {[
                        { label: 'Học sinh', value: 65, color: 'bg-primary' },
                        { label: 'Giáo viên', value: 15, color: 'bg-secondary' },
                        { label: 'Phụ huynh', value: 18, color: 'bg-tertiary' },
                        { label: 'Admin', value: 2, color: 'bg-on-surface-variant' },
                      ].map((item, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm font-bold">
                            <span className="text-on-surface-variant">{item.label}</span>
                            <span className="text-on-surface">{item.value}%</span>
                          </div>
                          <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
                            <div style={{ width: `${item.value}%` }} className={`h-full ${item.color} rounded-full`}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-black text-on-surface tracking-tight">Quản lý người dùng</h2>
                    <p className="text-on-surface-variant mt-2">Quản lý tài khoản học sinh, giáo viên và phụ huynh.</p>
                  </div>
                  <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-outline-variant/20 rounded-md text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all">
                      <Download className="w-4 h-4" />
                      <span>Xuất CSV</span>
                    </button>
                    <button 
                      onClick={() => setShowCreateUser(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all">
                      <UserPlus className="w-4 h-4" />
                      <span>Thêm người dùng</span>
                    </button>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl border border-white/40 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low">
                        <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Người dùng</th>
                        <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Vai trò</th>
                        <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Trạng thái</th>
                        <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Truy cập cuối</th>
                        <th className="px-6 py-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-white/30 transition-colors group">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                {(u.full_name || u.email)?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-on-surface">{u.full_name || '–'}</p>
                                <p className="text-xs text-on-surface-variant">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
                              getRoleLabel(u.role) === 'Admin' ? 'bg-on-surface text-surface' : 
                              getRoleLabel(u.role) === 'Giáo viên' ? 'bg-secondary/10 text-secondary' :
                              getRoleLabel(u.role) === 'Học sinh' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'
                            }`}>
                              {getRoleLabel(u.role)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}></div>
                              <span className="text-xs font-bold text-on-surface-variant">{u.is_active ? 'Active' : 'Inactive'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-xs font-medium text-on-surface-variant">–</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-all">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'classes' && (
              <motion.div 
                key="classes"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-black text-on-surface tracking-tight">Quản lý Lớp học</h2>
                    <p className="text-on-surface-variant mt-2">Phân bổ học sinh, GVCN và GV bộ môn.</p>
                  </div>
                  <button onClick={() => setShowCreateClassModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all">
                    <Plus className="w-4 h-4" />
                    <span>Tạo lớp học</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {schoolClasses.map(cls => (
                    <div key={cls.id} className="glass-panel p-6 rounded-2xl border border-white/40 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between cursor-pointer" onClick={() => openClassModal(cls)}>
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-bold text-on-surface group-hover:text-primary transition-colors">{cls.name}</h3>
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-surface-container-high">{cls.academic_year}</span>
                        </div>
                        <p className="text-sm text-on-surface-variant mt-1">Khối {cls.grade_level}</p>
                        <p className="text-xs text-on-surface-variant mt-3 font-medium">GVCN: <span className="text-on-surface font-bold">{cls.homeroom_teacher_id ? users.find(u => u.id === cls.homeroom_teacher_id)?.full_name || 'Chưa phân công' : 'Chưa phân công'}</span></p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-end">
                        <span className="text-xs font-bold text-primary group-hover:underline">Quản lý lớp &rarr;</span>
                      </div>
                    </div>
                  ))}
                  {schoolClasses.length === 0 && <p className="text-on-surface-variant italic py-8">Chưa có lớp học nào trong hệ thống.</p>}
                </div>
              </motion.div>
            )}

            {activeTab === 'rag-config' && (
              <motion.div 
                key="rag"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-black text-on-surface tracking-tight">Cấu hình Dữ liệu RAG</h2>
                    <p className="text-on-surface-variant mt-2">Quản lý kho tri thức cho Giáo viên ảo.</p>
                  </div>
                  <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-md text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all">
                    <Upload className="w-4 h-4" />
                    <span>Tải lên tài liệu</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel rounded-2xl border border-white/40 overflow-hidden shadow-sm">
                      <div className="p-4 bg-surface-container-low border-b border-outline-variant/10">
                        <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Nguồn dữ liệu hiện tại</span>
                      </div>
                      <div className="divide-y divide-outline-variant/10">
                        {ragSources.map((source) => (
                          <div key={source.id} className="p-6 flex items-center justify-between hover:bg-white/30 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-surface-container flex items-center justify-center rounded-xl">
                                <Globe className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                <p className="text-base font-bold text-on-surface">{source.name}</p>
                                <p className="text-xs text-on-surface-variant font-bold tracking-wider uppercase mt-1">{source.type} • {source.size}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${
                                source.status === 'Indexed' ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'
                              }`}>
                                {source.status}
                              </span>
                              <button className="p-2 text-on-surface-variant hover:text-error transition-colors">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="glass-panel p-8 rounded-2xl border border-white/40 shadow-sm">
                      <h3 className="text-lg font-bold text-on-surface mb-6">Thông số Embedding</h3>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Model</label>
                          <select className="w-full p-3 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary outline-none">
                            <option>text-embedding-004</option>
                            <option>text-embedding-3-large</option>
                          </select>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Chunk Size</label>
                          <input type="range" className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary" />
                          <div className="flex justify-between text-[10px] font-bold text-on-surface-variant">
                            <span>512 tokens</span>
                            <span>1024 tokens</span>
                          </div>
                        </div>
                        <button className="w-full py-3 bg-on-surface text-surface rounded-lg text-sm font-bold hover:opacity-90 transition-all">
                          Cập nhật cấu hình
                        </button>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary to-indigo-700 p-8 rounded-2xl text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                      <div className="relative z-10">
                        <h3 className="text-lg font-bold mb-2">Tình trạng Vector DB</h3>
                        <p className="text-4xl font-black mb-2">92.4%</p>
                        <p className="text-xs opacity-80 font-medium leading-relaxed">Độ chính xác truy xuất trung bình dựa trên 1,200 lần kiểm tra tự động.</p>
                      </div>
                      <Database className="absolute -bottom-6 -right-6 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-black text-on-surface tracking-tight">Cài đặt Hệ thống</h2>
                    <p className="text-on-surface-variant mt-2">Cấu hình các tham số vận hành ứng dụng.</p>
                  </div>
                </div>

                <div className="max-w-2xl space-y-6">
                  <div className="glass-panel p-8 rounded-2xl border border-white/40 shadow-sm space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-on-surface">Cấu hình Chung</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-on-surface">Chế độ Bảo trì</p>
                            <p className="text-xs text-on-surface-variant">Tạm dừng tất cả các yêu cầu AI từ người dùng.</p>
                          </div>
                          <div className="w-12 h-6 bg-surface-container rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-on-surface">Ghi nhật ký chi tiết</p>
                            <p className="text-xs text-on-surface-variant">Lưu trữ toàn bộ prompt và phản hồi của AI.</p>
                          </div>
                          <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-outline-variant/10 space-y-4">
                      <h3 className="text-lg font-bold text-on-surface">Bảo mật</h3>
                      <div className="space-y-4">
                        <button className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-all group">
                          <div className="flex items-center gap-3">
                            <Key className="w-5 h-5 text-primary" />
                            <span className="text-sm font-bold text-on-surface">Quản lý API Keys</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="w-full flex items-center justify-between p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-all group">
                          <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-secondary" />
                            <span className="text-sm font-bold text-on-surface">Phân quyền nâng cao</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Class Management Modal */}
      {showClassModal && selectedClass && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low shrink-0">
              <div>
                <h3 className="text-2xl font-bold text-on-surface">Lớp {selectedClass.name}</h3>
                <p className="text-sm text-on-surface-variant mt-1">Năm học {selectedClass.academic_year} • Khối {selectedClass.grade_level}</p>
              </div>
              <button onClick={() => setShowClassModal(false)} className="p-2 hover:bg-surface-container rounded-full hover:text-error transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-surface custom-scrollbar">
              {/* GVCN Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-on-surface border-b border-outline-variant/10 pb-2">Giáo viên chủ nhiệm</h4>
                <div className="flex gap-2 max-w-sm">
                  <select 
                    value={selectedClass.homeroom_teacher_id || ''}
                    onChange={(e) => assignHomeroomTeacher(Number(e.target.value))}
                    className="flex-1 bg-surface-container-low p-2 rounded-lg text-sm border border-outline-variant/20 focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Chọn GVCN --</option>
                    {users.filter(u => getRoleLabel(u.role) === 'Giáo viên').map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Teachers Section */}
              <div className="space-y-4">
                <h4 className="font-bold text-on-surface border-b border-outline-variant/10 pb-2">Giáo viên Bộ môn</h4>
                <div className="flex gap-2">
                  <select value={assignSubjectId} onChange={e => setAssignSubjectId(e.target.value)} className="bg-surface-container-low p-2 rounded-lg text-sm border border-outline-variant/20 flex-1">
                    <option value="">-- Môn học --</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={assignTeacherId} onChange={e => setAssignTeacherId(e.target.value)} className="bg-surface-container-low p-2 rounded-lg text-sm border border-outline-variant/20 flex-1">
                    <option value="">-- Giáo viên --</option>
                    {users.filter(u => getRoleLabel(u.role) === 'Giáo viên').map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </select>
                  <button onClick={addTeacherToClass} disabled={!assignTeacherId || !assignSubjectId} className="px-4 bg-secondary text-white rounded-lg text-sm font-bold disabled:opacity-50">Phân công</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {classTeachers.map(ct => (
                    <div key={`${ct.teacher_id}-${ct.subject_id}`} className="p-3 border border-outline-variant/20 rounded-lg flex justify-between items-center bg-white shadow-sm">
                      <div className="overflow-hidden">
                        <p className="text-[10px] font-black uppercase text-secondary truncate">{ct.subject?.name}</p>
                        <p className="text-sm font-bold truncate pr-2">{ct.teacher?.full_name}</p>
                      </div>
                      <button onClick={() => removeTeacherFromClass(ct.teacher_id, ct.subject_id)} className="text-error hover:bg-error/10 p-1.5 rounded transition shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {classTeachers.length === 0 && <p className="text-xs text-on-surface-variant italic">Chưa phân công môn nào.</p>}
                </div>
              </div>

              {/* Students Section */}
              <div className="space-y-4">
                <h4 className="font-bold text-on-surface border-b border-outline-variant/10 pb-2">Danh sách Học sinh ({classStudents.length})</h4>
                <div className="flex gap-2 max-w-md">
                  <select value={assignStudentId} onChange={e => setAssignStudentId(e.target.value)} className="bg-surface-container-low p-2 rounded-lg text-sm border border-outline-variant/20 flex-1">
                    <option value="">-- Chọn Học sinh --</option>
                    {users.filter(u => getRoleLabel(u.role) === 'Học sinh' || u.role.includes('student')).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                  <button onClick={addStudentToClass} disabled={!assignStudentId} className="px-4 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50">Thêm</button>
                </div>
                <div className="bg-white border border-outline-variant/10 rounded-xl overflow-hidden shadow-sm">
                  {classStudents.map((cs, i) => (
                    <div key={cs.student_id} className={`flex justify-between items-center p-3 ${i !== classStudents.length - 1 ? 'border-b border-outline-variant/5' : ''}`}>
                      <div>
                        <p className="text-sm font-bold">{cs.student?.full_name}</p>
                        <p className="text-[10px] text-on-surface-variant">{cs.student?.email}</p>
                      </div>
                      <button onClick={() => removeStudentFromClass(cs.student_id)} className="text-outline-variant hover:text-error hover:bg-error/10 p-1.5 rounded transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {classStudents.length === 0 && <div className="p-4 text-center text-sm text-on-surface-variant italic">Lớp chưa có học sinh.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-on-surface">Thêm người dùng mới</h3>
              <button onClick={() => setShowCreateUser(false)} className="p-2 hover:bg-surface-container rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm({...createForm, email: e.target.value})}
                  className="w-full bg-surface-container-low p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary border-none"
                  placeholder="example@school.edu.vn"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Họ và tên</label>
                <input
                  value={createForm.full_name}
                  onChange={e => setCreateForm({...createForm, full_name: e.target.value})}
                  className="w-full bg-surface-container-low p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary border-none"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Mật khẩu</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={e => setCreateForm({...createForm, password: e.target.value})}
                  className="w-full bg-surface-container-low p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary border-none"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Vai trò</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm({...createForm, role: e.target.value})}
                  className="w-full bg-surface-container-low p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary border-none"
                >
                  <option value="student">Học sinh</option>
                  <option value="subject_teacher">Giáo viên bộ môn</option>
                  <option value="homeroom_teacher">Giáo viên chủ nhiệm</option>
                  <option value="parent">Phụ huynh</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowCreateUser(false)} className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">Hủy</button>
              <button
                onClick={handleCreateUser}
                disabled={isCreating}
                className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${isCreating ? 'bg-slate-300 text-slate-500' : 'bg-primary text-white hover:bg-primary/90'}`}
              >
                {isCreating ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {showCreateClassModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-on-surface">Tạo lớp học mới</h3>
              <button onClick={() => setShowCreateClassModal(false)} className="p-2 hover:bg-surface-container rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Tên lớp</label>
                <input
                  type="text"
                  value={createClassForm.name}
                  onChange={e => setCreateClassForm({...createClassForm, name: e.target.value})}
                  className="w-full bg-surface-container-low p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary border-none"
                  placeholder="Ví dụ: 10A1"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Khối</label>
                <select
                  value={createClassForm.grade_level}
                  onChange={e => setCreateClassForm({...createClassForm, grade_level: Number(e.target.value)})}
                  className="w-full bg-surface-container-low p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary border-none"
                >
                  <option value={10}>Khối 10</option>
                  <option value={11}>Khối 11</option>
                  <option value={12}>Khối 12</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Năm học</label>
                <input
                  type="text"
                  value={createClassForm.academic_year}
                  onChange={e => setCreateClassForm({...createClassForm, academic_year: e.target.value})}
                  className="w-full bg-surface-container-low p-3 rounded-lg text-sm focus:ring-2 focus:ring-primary border-none"
                  placeholder="Ví dụ: 2023-2024"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowCreateClassModal(false)} className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">Hủy</button>
              <button
                onClick={handleCreateClass}
                disabled={isCreatingClass}
                className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${isCreatingClass ? 'bg-slate-300 text-slate-500' : 'bg-primary text-white hover:bg-primary/90'}`}
              >
                {isCreatingClass ? 'Đang tạo...' : 'Tạo lớp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
