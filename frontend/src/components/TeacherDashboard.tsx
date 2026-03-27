import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  Bell as BellIcon,
  Plus,
  Search,
  Settings,
  Bell,
  Upload,
  FileText,
  Trash2,
  Send,
  Filter,
  Download,
  MoreHorizontal,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface TeacherDashboardProps {
  onLogout: () => void;
}

interface ClassInfo {
  id: number;
  name: string;
  grade_level: number;
  academic_year: string;
  homeroom_teacher_id?: number;
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

const API = "http://localhost:8000/api/v1";

export default function TeacherDashboard({ onLogout }: TeacherDashboardProps) {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "overview" | "classes" | "docs" | "grades" | "announcements"
  >("overview");

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]); // Toàń bộ môn trường
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]); // Môn GV dạy ở lớp hiện tại
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Grades state
  const [semester, setSemester] = useState<number>(1);
  const [grades, setGrades] = useState<any[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});

  // Form states
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [uploadSubjectId, setUploadSubjectId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingAnn, setIsSendingAnn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, [token]);

  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API}/classes/teacher-classes`, { headers });
      if (res.ok) {
        const data: ClassInfo[] = await res.json();
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0]);
          fetchStudents(data[0].id);
          fetchAnnouncements(data[0].id);
          fetchDocuments(data[0].id);
          fetchClassSubjects(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudents = async (classId: number) => {
    try {
      const res = await fetch(`${API}/classes/${classId}/students`, {
        headers,
      });
      if (res.ok) setStudents(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDocuments = async (classId?: number) => {
    try {
      const url = classId
        ? `${API}/admin/documents?class_id=${classId}`
        : `${API}/admin/documents`;
      const res = await fetch(url, { headers });
      if (res.ok) setDocuments(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API}/subjects/`, { headers });
      if (res.ok) setSubjects(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnnouncements = async (classId: number) => {
    try {
      const res = await fetch(`${API}/announcements/class/${classId}`, {
        headers,
      });
      if (res.ok) setAnnouncements(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClassGrades = async (classId: number, subjectId: number, currentSem: number) => {
    try {
      const res = await fetch(`${API}/grades/class/${classId}?subject_id=${subjectId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setGrades(data);
        const inputs: Record<string, string> = {};
        data.forEach((g: any) => {
          if (g.semester === currentSem) {
            inputs[`${g.student_id}_${g.exam_type}`] = String(g.score);
          }
        });
        setGradeInputs(inputs);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (selectedClass && uploadSubjectId) {
      fetchClassGrades(selectedClass.id, uploadSubjectId, semester);
    } else {
      setGrades([]);
      setGradeInputs({});
    }
  }, [selectedClass, uploadSubjectId, semester]);

  const fetchClassSubjects = async (classId: number) => {
    try {
      const res = await fetch(`${API}/classes/${classId}/teachers`, {
        headers,
      });
      if (res.ok) {
        const assignments = await res.json();
        const myAssignments = assignments.filter(
          (a: any) => a.teacher_id === user?.id,
        );
        const mySubjects = myAssignments.map((a: any) => a.subject);
        setClassSubjects(mySubjects);

        // Find if user is homeroom for this selected class ID
        // Note: selectedClass might not be updated yet when this is called, so we find it from `classes`
        const targetClass = classes.find((c) => c.id === classId);
        const isHomeroom = targetClass?.homeroom_teacher_id === user?.id;

        if (isHomeroom) {
          // Default to general document if they are homeroom teacher
          setUploadSubjectId(null);
        } else if (mySubjects.length > 0) {
          // Otherwise default to their first subject
          setUploadSubjectId(mySubjects[0].id);
        } else {
          setUploadSubjectId(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectClass = (cls: ClassInfo) => {
    setSelectedClass(cls);
    fetchStudents(cls.id);
    fetchAnnouncements(cls.id);
    fetchDocuments(cls.id);
    fetchClassSubjects(cls.id);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClass) {
      alert("Vui lòng chọn file và đảm bảo đã chọn lớp.");
      return;
    }

    // Homeroom teachers can upload without subject. Subject teachers MUST pick a subject.
    const isHomeroom = selectedClass.homeroom_teacher_id === user?.id;
    if (!uploadSubjectId && !isHomeroom) {
      alert("Giáo viên bộ môn cần chọn môn học.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("class_id", String(selectedClass.id));
    if (uploadSubjectId) formData.append("subject_id", String(uploadSubjectId));

    try {
      const res = await fetch(`${API}/admin/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        fetchDocuments(selectedClass.id);
      } else {
        const err = await res.json();
        alert("Upload thất bại: " + (err.detail || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối server");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm("Xóa tài liệu này?")) return;
    try {
      const res = await fetch(`${API}/admin/documents/${docId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok || res.status === 204) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGradeBlur = async (studentId: number, examType: string, value: string) => {
    if (!selectedClass || !uploadSubjectId) return;
    const score = parseFloat(value);
    if (isNaN(score) || score < 0 || score > 10) {
      // Revert to old value if invalid
      const existing = grades.find(g => g.student_id === studentId && g.exam_type === examType && g.semester === semester);
      setGradeInputs(prev => ({
        ...prev,
        [`${studentId}_${examType}`]: existing ? String(existing.score) : ""
      }));
      return;
    }

    const existingGrade = grades.find(g => g.student_id === studentId && g.exam_type === examType && g.semester === semester);
    
    // Only update if changed
    if (existingGrade && existingGrade.score === score) return;

    try {
      let res;
      if (existingGrade) {
        res = await fetch(`${API}/grades/${existingGrade.id}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ score })
        });
      } else {
        res = await fetch(`${API}/grades/`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: studentId,
            subject_id: uploadSubjectId,
            semester,
            academic_year: selectedClass.academic_year,
            exam_type: examType,
            score
          })
        });
      }

      if (res.ok) {
        const updatedOrNew = await res.json();
        setGrades(prev => {
          if (existingGrade) {
            return prev.map(g => g.id === existingGrade.id ? updatedOrNew : g);
          }
          return [...prev, updatedOrNew];
        });
      }
    } catch (e) {
      console.error("Lỗi cập nhật điểm:", e);
    }
  };

  const examTypes = [
    { key: "15p", label: "15 Phút" },
    { key: "1_tiet", label: "1 Tiết" },
    { key: "giua_ky", label: "Giữa Kỳ" },
    { key: "cuoi_ky", label: "Cuối Kỳ" }
  ];

  const handleSendAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) {
      alert("Vui lòng nhập tiêu đề và nội dung thông báo.");
      return;
    }
    if (!selectedClass) {
      alert("Vui lòng chọn lớp.");
      return;
    }
    setIsSendingAnn(true);

    let prefix = "";
    const isHomeroom = selectedClass.homeroom_teacher_id === user?.id;
    if (isHomeroom) prefix += "GVCN";
    if (classSubjects.length > 0) {
      if (prefix) prefix += " & ";
      prefix += `GVBM ${classSubjects.map((s) => s.name).join(", ")}`;
    }
    const finalTitle = prefix ? `[${prefix}] ${annTitle}` : annTitle;

    try {
      const res = await fetch(`${API}/announcements/`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          content: annContent,
          class_id: selectedClass.id,
        }),
      });
      if (res.ok) {
        setAnnTitle("");
        setAnnContent("");
        fetchAnnouncements(selectedClass.id);
        alert("Đã gửi thông báo thành công!");
      } else {
        const err = await res.json();
        alert("Lỗi: " + (err.detail || "Unknown error"));
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
          <p className="text-xs text-on-surface-variant opacity-70">
            Hệ thống thông minh
          </p>
        </div>
        <nav className="flex-1 space-y-2">
          {[
            { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
            { id: "classes", label: "Lớp học", icon: Users },
            { id: "docs", label: "Học liệu", icon: BookOpen },
            { id: "grades", label: "Điểm số", icon: GraduationCap },
            { id: "announcements", label: "Thông báo", icon: BellIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === tab.id
                  ? "text-primary font-bold border-r-4 border-primary bg-white/50"
                  : "text-on-surface-variant hover:text-primary hover:bg-white/30"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 space-y-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 justify-center py-2 text-sm text-slate-500 hover:text-error font-semibold transition-colors"
          >
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
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-sm focus:ring-2 focus:ring-primary text-sm"
                placeholder="Tìm kiếm học sinh, tài liệu..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pl-4 border-l border-outline-variant/20">
              <div className="text-right">
                <p className="font-bold text-on-surface text-sm leading-none">
                  {user?.full_name || "Giáo viên"}
                </p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">
                  Giáo viên
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                <User className="w-5 h-5 text-on-surface-variant" />
              </div>
            </div>
          </div>
        </header>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <section>
            <div className="mb-12 flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <h2 className="text-5xl font-extrabold text-on-surface tracking-tight mb-4 leading-tight">
                  Chào buổi sáng,
                  <br />
                  <span className="text-primary">{user?.full_name}!</span>
                </h2>
                <p className="text-lg text-on-surface-variant max-w-xl leading-relaxed">
                  {classes.filter((c) => c.homeroom_teacher_id === user?.id)
                    .length > 0 ? (
                    <>
                      Bạn đang là{" "}
                      <strong>
                        Giáo viên chủ nhiệm của lớp{" "}
                        {classes
                          .filter((c) => c.homeroom_teacher_id === user?.id)
                          .map((c) => c.name)
                          .join(", ")}
                      </strong>
                      . Tham gia giảng dạy tại tổng cộng{" "}
                      <strong>{classes.length}</strong> lớp.
                    </>
                  ) : (
                    <>
                      Bạn đang quản lý <strong>{classes.length}</strong> lớp
                      học. Click vào tab "Lớp học" để xem danh sách học sinh.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-secondary to-secondary-dim text-on-secondary rounded-lg p-6 relative overflow-hidden max-w-md">
              <div className="relative z-10">
                <h4 className="text-xl font-bold leading-tight">
                  Gợi ý AI tuần này
                </h4>
                <p className="text-sm mt-2 opacity-90">
                  Tổ chức một buổi thảo luận nhóm để cải thiện kết quả học tập.
                </p>
                <button className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md text-xs font-bold transition-all backdrop-blur-sm">
                  Xem chi tiết
                </button>
              </div>
              <Sparkles className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10" />
            </div>
          </section>
        )}

        {/* CLASSES */}
        {activeTab === "classes" && (
          <section>
            <div className="flex gap-4 mb-6 flex-wrap">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => selectClass(cls)}
                  className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center gap-2 ${
                    selectedClass?.id === cls.id
                      ? "bg-primary text-white"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {cls.name}
                  {cls.homeroom_teacher_id === user?.id && (
                    <span className="text-yellow-400">★</span>
                  )}
                </button>
              ))}
            </div>

            <div className="bg-surface-container-lowest rounded-lg overflow-hidden shadow-sm">
              <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight">
                  Danh sách {selectedClass?.name || "..."}
                  <span className="ml-3 text-sm font-normal text-on-surface-variant">
                    ({students.length} học sinh)
                  </span>
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
                        <td
                          colSpan={3}
                          className="px-8 py-10 text-center text-on-surface-variant text-sm"
                        >
                          {selectedClass
                            ? "Lớp chưa có học sinh."
                            : "Vui lòng chọn lớp."}
                        </td>
                      </tr>
                    ) : (
                      students.map((s) => (
                        <tr
                          key={s.student_id}
                          className="hover:bg-surface-bright transition-colors"
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-[10px]">
                                {s.student.full_name?.charAt(0) || "?"}
                              </div>
                              <span className="font-bold text-sm">
                                {s.student.full_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-sm text-on-surface-variant">
                            {s.student.email}
                          </td>
                          <td className="px-8 py-5 text-sm text-on-surface-variant">
                            {new Date(s.joined_at).toLocaleDateString("vi-VN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* DOCUMENTS */}
        {activeTab === "docs" && (
          <section>
            <div className="bg-surface-container-lowest rounded-lg p-8 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">
                    Quản lý Học liệu RAG
                  </h3>
                  <p className="text-on-surface-variant text-sm mt-1">
                    Tải lên file để AI hỗ trợ giải đáp thắc mắc cho học sinh và
                    phụ huynh.
                  </p>
                </div>
                <Upload className="text-primary-container w-10 h-10" />
              </div>

              {/* Class Selector */}
              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">
                  Nhập tài liệu cho lớp
                </label>
                <div className="flex gap-3 flex-wrap">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => selectClass(cls)}
                      className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center gap-2 ${
                        selectedClass?.id === cls.id
                          ? "bg-primary text-white"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      {cls.name}
                      {cls.homeroom_teacher_id === user?.id && (
                        <span className="text-yellow-400">★</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Role Indicator */}
              {selectedClass && (
                <div className="mb-8 p-4 bg-primary/5 border border-primary/20 rounded-md flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full text-primary">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-on-surface">
                    Tại lớp{" "}
                    <strong className="text-primary">
                      {selectedClass.name}
                    </strong>
                    , bạn đang giữ vai trò:{" "}
                    {classSubjects.length > 0 ? (
                      <span className="font-bold underline">
                        Giáo viên bộ môn (
                        {classSubjects.map((s) => s.name).join(", ")})
                      </span>
                    ) : selectedClass.homeroom_teacher_id === user?.id ? (
                      <span className="font-bold underline text-secondary">
                        Giáo viên Chủ nhiệm
                      </span>
                    ) : (
                      <span className="font-bold underline text-error">
                        Chưa được phân công
                      </span>
                    )}
                    {selectedClass.homeroom_teacher_id === user?.id &&
                      classSubjects.length > 0 && (
                        <span>
                          {" "}
                          và{" "}
                          <span className="font-bold underline text-secondary">
                            Giáo viên Chủ nhiệm
                          </span>
                        </span>
                      )}
                  </p>
                </div>
              )}

              {/* Upload Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  {(classSubjects.length > 0 ||
                    selectedClass?.homeroom_teacher_id === user?.id) && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">
                        Phân loại tài liệu
                      </label>
                      <select
                        className="w-full bg-surface-container-low border-none rounded-sm p-3 text-sm focus:ring-2 focus:ring-primary"
                        value={uploadSubjectId ?? ""}
                        onChange={(e) =>
                          setUploadSubjectId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        {selectedClass?.homeroom_teacher_id === user?.id && (
                          <option value="">
                            Tài liệu chung (Dành cho Học sinh & Phụ huynh)
                          </option>
                        )}
                        {classSubjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            Tài liệu Giáo viên bộ môn ({s.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-outline-variant/30 rounded-md p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-primary/50 transition-all"
                  >
                    <Upload className="w-10 h-10 text-outline-variant mb-3 group-hover:scale-110 transition-transform" />
                    <p className="font-semibold text-on-surface">
                      {isUploading
                        ? "Đang xử lý..."
                        : "Click để tải lên tài liệu"}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      PDF, DOCX, TXT (Tối đa 20MB)
                    </p>
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
                    <p className="text-sm text-on-surface-variant text-center py-8">
                      Chưa có tài liệu nào được tải lên.
                    </p>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-surface-container-low p-4 rounded-md flex items-center gap-4"
                      >
                        <div className="w-10 h-10 bg-primary/10 text-primary rounded flex items-center justify-center">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-sm truncate">
                            {doc.metadata_json?.filename ||
                              `Tài liệu #${doc.id}`}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            {doc.metadata_json?.subject || "Không rõ môn"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="text-on-surface-variant hover:text-error transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* GRADES */}
        {activeTab === "grades" && (
          <section>
            <div className="bg-surface-container-lowest rounded-lg p-8 shadow-sm">
              <h3 className="text-2xl font-bold tracking-tight mb-6">
                Nhập điểm Bảng tính
              </h3>

              {/* Class Selector for Grades */}
              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">
                  CHỌN LỚP NHẬP ĐIỂM
                </label>
                <div className="flex gap-3 flex-wrap">
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => selectClass(cls)}
                      className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center gap-2 ${
                        selectedClass?.id === cls.id
                          ? "bg-primary text-white"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      {cls.name}
                      {cls.homeroom_teacher_id === user?.id && (
                        <span className="text-yellow-400">★</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 border border-outline-variant/10 rounded-t-lg bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-on-surface mt-1">
                    Học sinh: {students.length} — Tự động lưu khi nhập
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <select
                    className="bg-surface-container-low border-none rounded-md px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-primary"
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                  >
                    <option value={1}>Học kỳ 1</option>
                    <option value={2}>Học kỳ 2</option>
                  </select>

                  <select
                    className="bg-surface-container-low border-none rounded-md px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-primary"
                    value={uploadSubjectId ?? ""}
                    onChange={(e) => setUploadSubjectId(Number(e.target.value) || null)}
                  >
                    <option value="">-- Chọn môn dạy --</option>
                    {classSubjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-lowest text-on-surface-variant border-b border-outline-variant/10 text-xs uppercase tracking-wider">
                      <th className="px-8 py-4 font-semibold">Học sinh</th>
                      {examTypes.map(et => (
                        <th key={et.key} className="px-4 py-4 font-semibold text-center">{et.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {(!selectedClass || !uploadSubjectId) ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-10 text-center text-on-surface-variant text-sm">
                          Vui lòng chọn Lớp và Môn học để nhập điểm.
                        </td>
                      </tr>
                    ) : students.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-10 text-center text-on-surface-variant text-sm">
                          Lớp chưa có học sinh.
                        </td>
                      </tr>
                    ) : students.map((s) => (
                      <tr key={s.student_id} className="hover:bg-surface-bright transition-colors">
                        <td className="px-8 py-3">
                          <span className="font-bold text-sm">{s.student.full_name}</span>
                        </td>
                        {examTypes.map(et => {
                          const inputKey = `${s.student_id}_${et.key}`;
                          return (
                            <td key={et.key} className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0" max="10" step="0.1"
                                className="w-20 text-center bg-surface-container-low border-none rounded-md p-2 text-sm focus:ring-2 focus:ring-primary font-bold"
                                value={gradeInputs[inputKey] ?? ""}
                                onChange={e => setGradeInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                onBlur={e => handleGradeBlur(s.student_id, et.key, e.target.value)}
                                placeholder="--"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ANNOUNCEMENTS */}
        {activeTab === "announcements" && (
          <section>
            <div className="bg-surface-container-lowest rounded-lg p-8 shadow-sm">
              <h3 className="text-2xl font-bold tracking-tight mb-6">
                Gửi thông báo cho lớp
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">
                    Lớp nhận thông báo
                  </label>
                  <div className="flex gap-3 flex-wrap">
                    {classes.map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => selectClass(cls)}
                        className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center gap-2 ${
                          selectedClass?.id === cls.id
                            ? "bg-primary text-white"
                            : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                        }`}
                      >
                        {cls.name}
                        {cls.homeroom_teacher_id === user?.id && (
                          <span className="text-yellow-400">★</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">
                    Tiêu đề
                  </label>
                  <input
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-sm p-4 text-sm focus:ring-2 focus:ring-primary"
                    placeholder="Tiêu đề thông báo..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-2">
                    Nội dung
                  </label>
                  <textarea
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
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
                      isSendingAnn
                        ? "bg-slate-300 text-slate-500"
                        : "bg-primary text-white"
                    }`}
                  >
                    <span>
                      {isSendingAnn ? "Đang gửi..." : "Gửi thông báo"}
                    </span>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Announcement History */}
              <div className="mt-8 border-t border-outline-variant/10 pt-6">
                <h4 className="font-bold text-on-surface mb-4">
                  Thông báo đã gửi ({announcements.length})
                </h4>
                <div className="space-y-3">
                  {announcements.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">
                      Chưa có thông báo nào.
                    </p>
                  ) : (
                    announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className="bg-surface-container-low p-4 rounded-md"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-sm">{ann.title}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            {new Date(ann.created_at).toLocaleString("vi-VN")}
                          </p>
                        </div>
                        <p className="text-xs text-on-surface-variant whitespace-pre-wrap">
                          {ann.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
