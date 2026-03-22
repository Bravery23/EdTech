import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, Users, BookOpen, GraduationCap, 
  Bell as BellIcon, Plus, Search, Settings, Bell, 
  Upload, FileText, Trash2, Send, Filter, Download,
  MoreHorizontal, MessageSquare, AlertTriangle, Sparkles, User, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TeacherDashboardProps {
  onLogout: () => void;
}

interface ClassInfo {
  id: number;
  name: string;
  grade_level: number;
  academic_year: string;
}

interface Student {
  student_id: number;
  student: { id: number; email: string; full_name: string; role: any };
  joined_at: string;
}

interface Document {
  id: number;
  content: string;
  metadata_json?: { filename?: string; subject?: string } | null;
}

interface Subject {
  id: number;
  name: string;
  code?: string;
}

const API = 'http://localhost:8000/api/v1';

export default function TeacherDashboard({ onLogout }: TeacherDashboardProps) {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'docs' | 'grades' | 'announcements'>('overview');

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Form states
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [uploadSubjectId, setUploadSubjectId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingAnn, setIsSendingAnn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    fetchClasses();
    fetchDocuments();
    fetchSubjects();
  }, [token]);

  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API}/classes/`, { headers });
      if (res.ok) {
        const data: ClassInfo[] = await res.json();
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0]);
          fetchStudents(data[0].id);
          fetchAnnouncements(data[0].id);
        }
      }
    } catch (e) { console.error(e); }
  };

  const fetchStudents = async (classId: number) => {
    try {
      const res = await fetch(`${API}/classes/${classId}/students`, { headers });
      if (res.ok) setStudents(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API}/admin/documents`, { headers });
      if (res.ok) setDocuments(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API}/subjects/`, { headers });
      if (res.ok) setSubjects(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAnnouncements = async (classId: number) => {
    try {
      const res = await fetch(`${API}/announcements/class/${classId}`, { headers });
      if (res.ok) setAnnouncements(await res.json());
    } catch (e) { console.error(e); }
  };

  const selectClass = (cls: ClassInfo) => {
    setSelectedClass(cls);
    fetchStudents(cls.id);
    fetchAnnouncements(cls.id);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadSubjectId) {
      alert('Vui lòng chọn file và môn học.');
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject_id', String(uploadSubjectId));
    try {
      const res = await fetch(`${API}/admin/documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        fetchDocuments();
      } else {
        const err = await res.json();
        alert('Upload thất bại: ' + (err.detail || 'Unknown error'));
      }
    } catch (e) { 
      console.error(e);
      alert('Lỗi kết nối server');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('Xóa tài liệu này?')) return;
    try {
      const res = await fetch(`${API}/admin/documents/${docId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok || res.status === 204) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      }
    } catch (e) { console.error(e); }
  };

  const handleSendAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) {
      alert('Vui lòng nhập tiêu đề và nội dung thông báo.');
      return;
    }
    if (!selectedClass) {
      alert('Vui lòng chọn lớp.');
      return;
    }
    setIsSendingAnn(true);
    try {
      const res = await fetch(`${API}/announcements/`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: annTitle, content: annContent, class_id: selectedClass.id })
      });
      if (res.ok) {
        setAnnTitle('');
        setAnnContent('');
        fetchAnnouncements(selectedClass.id);
        alert('Đã gửi thông báo thành công!');
      } else {
        const err = await res.json();
        alert('Lỗi: ' + (err.detail || 'Unknown error'));
      }
    } catch (e) { 
      console.error(e);
    } finally {
      setIsSendingAnn(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low flex flex-col py-6 px-4 z-50">
        <div className="mb-10 px-4">
          <h1 className="text-xl font-bold text-primary">Giáo viên ảo</h1>
          <p className="text-xs text-on-surface-variant opacity-70">Hệ thống thông minh</p>
        </div>
        <nav className="flex-1 space-y-2">
          {[
            { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
            { id: 'classes',  label: 'Lớp học',   icon: Users },
            { id: 'docs',     label: 'Học liệu',  icon: BookOpen },
            { id: 'grades',   label: 'Điểm số',   icon: GraduationCap },
            { id: 'announcements', label: 'Thông báo', icon: BellIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'text-primary font-bold border-r-4 border-primary bg-white/50'
                  : 'text-on-surface-variant hover:text-primary hover:bg-white/30'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 space-y-2">
          <button className="w-full bg-gradient-to-r from-primary to-primary-container text-white py-4 rounded-md font-semibold flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all">
            <Plus className="w-5 h-5" />
            <span>Tạo bài giảng mới</span>
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-2 justify-center py-2 text-sm text-slate-500 hover:text-error font-semibold transition-colors">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 pt-24 px-10 pb-12 w-full">
        {/* Top Nav */}
        <header className="fixed top-0 right-0 w-[calc(100%-16rem)] z-40 bg-white/70 backdrop-blur-md flex justify-between items-center h-16 px-8 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
              <input className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-sm focus:ring-2 focus:ring-primary text-sm" placeholder="Tìm kiếm học sinh, tài liệu..." type="text" />
            </div>
            <div className="hidden lg:flex items-center gap-4 text-primary font-semibold text-sm">
              <span>{selectedClass ? `${selectedClass.name} — ${selectedClass.academic_year}` : 'Chưa chọn lớp'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-outline-variant/20">
              <div className="text-right">
                <p className="font-bold text-on-surface text-sm leading-none">{user?.full_name || 'Giáo viên'}</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">Giáo viên</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                <User className="w-5 h-5 text-on-surface-variant" />
              </div>
            </div>
          </div>
        </header>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <section>
            <div className="mb-12 flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <h2 className="text-5xl font-extrabold text-on-surface tracking-tight mb-4 leading-tight">
                  Chào buổi sáng,<br/><span className="text-primary">{user?.full_name}!</span>
                </h2>
                <p className="text-lg text-on-surface-variant max-w-xl leading-relaxed">
                  Bạn đang quản lý <strong>{classes.length}</strong> lớp. Click vào tab "Lớp học" để xem danh sách học sinh.
                </p>
              </div>
              <div className="w-full md:w-80 bg-surface-container-low rounded-lg p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-on-surface-variant">Sĩ số lớp</span>
                  <span className="text-2xl font-black text-primary">{students.length} HS</span>
                </div>
                <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: students.length > 0 ? '100%' : '0%' }}></div>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-secondary-container/30 text-secondary text-[10px] font-bold rounded">
                    {selectedClass?.name || 'Chưa chọn lớp'}
                  </span>
                  <span className="px-2 py-1 bg-primary-container/20 text-primary text-[10px] font-bold rounded">
                    {documents.length} TÀI LIỆU
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-secondary to-secondary-dim text-on-secondary rounded-lg p-6 relative overflow-hidden max-w-md">
              <div className="relative z-10">
                <h4 className="text-xl font-bold leading-tight">Gợi ý AI tuần này</h4>
                <p className="text-sm mt-2 opacity-90">Tổ chức một buổi thảo luận nhóm để cải thiện kết quả học tập.</p>
                <button className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md text-xs font-bold transition-all backdrop-blur-sm">Xem chi tiết</button>
              </div>
              <Sparkles className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10" />
            </div>
          </section>
        )}

        {/* CLASSES */}
        {activeTab === 'classes' && (
          <section>
            <div className="flex gap-4 mb-6 flex-wrap">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => selectClass(cls)}
                  className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${
                    selectedClass?.id === cls.id 
                      ? 'bg-primary text-white' 
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>

            <div className="bg-surface-container-lowest rounded-lg overflow-hidden shadow-sm">
              <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight">
                  Danh sách {selectedClass?.name || '...'}
                  <span className="ml-3 text-sm font-normal text-on-surface-variant">({students.length} học sinh)</span>
                </h3>
                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-md bg-surface-container-low text-xs font-bold text-on-surface-variant flex items-center gap-2 hover:bg-surface-container-high transition-colors">
                    <Download className="w-4 h-4" /> Xuất Excel
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-on-surface-variant uppercase text-[10px] font-black tracking-widest border-b border-outline-variant/10 bg-surface-container-low/30">
                      <th className="px-8 py-4">Họ và tên</th>
                      <th className="px-8 py-4">Email</th>
                      <th className="px-8 py-4">Ngày nhập học</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-8 py-10 text-center text-on-surface-variant text-sm">
                          {selectedClass ? 'Lớp chưa có học sinh.' : 'Vui lòng chọn lớp.'}
                        </td>
                      </tr>
                    ) : students.map(s => (
                      <tr key={s.student_id} className="hover:bg-surface-bright transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-[10px]">
                              {s.student.full_name?.charAt(0) || '?'}
                            </div>
                            <span className="font-bold text-sm">{s.student.full_name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-sm text-on-surface-variant">{s.student.email}</td>
                        <td className="px-8 py-5 text-sm text-on-surface-variant">
                          {new Date(s.joined_at).toLocaleDateString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* DOCUMENTS */}
        {activeTab === 'docs' && (
          <section>
            <div className="bg-surface-container-lowest rounded-lg p-8 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">Quản lý Học liệu RAG</h3>
                  <p className="text-on-surface-variant text-sm mt-1">Tải lên file để AI hỗ trợ giải đáp thắc mắc cho học sinh và phụ huynh.</p>
                </div>
                <Upload className="text-primary-container w-10 h-10" />
              </div>

              {/* Upload Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">Môn học</label>
                    <select
                      className="w-full bg-surface-container-low border-none rounded-sm p-3 text-sm focus:ring-2 focus:ring-primary"
                      value={uploadSubjectId ?? ''}
                      onChange={e => setUploadSubjectId(Number(e.target.value) || null)}
                    >
                      <option value="">-- Chọn môn học --</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-outline-variant/30 rounded-md p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-primary/50 transition-all"
                  >
                    <Upload className="w-10 h-10 text-outline-variant mb-3 group-hover:scale-110 transition-transform" />
                    <p className="font-semibold text-on-surface">
                      {isUploading ? 'Đang xử lý...' : 'Click để tải lên tài liệu'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">PDF, DOCX, TXT (Tối đa 20MB)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={handleUpload}
                      disabled={isUploading}
                    />
                  </div>
                </div>

                {/* Documents List */}
                <div className="flex flex-col gap-3 overflow-y-auto max-h-64">
                  {documents.length === 0 ? (
                    <p className="text-sm text-on-surface-variant text-center py-8">Chưa có tài liệu nào được tải lên.</p>
                  ) : documents.map(doc => (
                    <div key={doc.id} className="bg-surface-container-low p-4 rounded-md flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm truncate">{doc.metadata_json?.filename || `Tài liệu #${doc.id}`}</p>
                        <p className="text-[10px] text-on-surface-variant">{doc.metadata_json?.subject || 'Không rõ môn'}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-on-surface-variant hover:text-error transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <section>
            <div className="bg-surface-container-lowest rounded-lg p-8 shadow-sm">
              <h3 className="text-2xl font-bold tracking-tight mb-6">Gửi thông báo cho lớp</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">Lớp nhận thông báo</label>
                  <div className="flex gap-3 flex-wrap">
                    {classes.map(cls => (
                      <button
                        key={cls.id}
                        onClick={() => selectClass(cls)}
                        className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${
                          selectedClass?.id === cls.id 
                            ? 'bg-primary text-white' 
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {cls.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">Tiêu đề</label>
                  <input
                    value={annTitle}
                    onChange={e => setAnnTitle(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-sm p-4 text-sm focus:ring-2 focus:ring-primary"
                    placeholder="Tiêu đề thông báo..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">Nội dung</label>
                  <textarea
                    value={annContent}
                    onChange={e => setAnnContent(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-sm p-4 text-sm focus:ring-2 focus:ring-primary transition-all"
                    placeholder="Nhập nội dung thông báo..."
                    rows={4}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSendAnnouncement}
                    disabled={isSendingAnn}
                    className={`px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 hover:translate-y-[-2px] transition-all ${
                      isSendingAnn ? 'bg-slate-300 text-slate-500' : 'bg-primary text-white'
                    }`}
                  >
                    <span>{isSendingAnn ? 'Đang gửi...' : 'Gửi thông báo'}</span>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Announcement History */}
              <div className="mt-8 border-t border-outline-variant/10 pt-6">
                <h4 className="font-bold text-on-surface mb-4">Thông báo đã gửi ({announcements.length})</h4>
                <div className="space-y-3">
                  {announcements.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Chưa có thông báo nào.</p>
                  ) : announcements.map(ann => (
                    <div key={ann.id} className="bg-surface-container-low p-4 rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-sm">{ann.title}</p>
                        <p className="text-[10px] text-on-surface-variant">{new Date(ann.created_at).toLocaleString('vi-VN')}</p>
                      </div>
                      <p className="text-xs text-on-surface-variant whitespace-pre-wrap">{ann.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
