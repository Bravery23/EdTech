import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Mic, Bot, User,
  Plus, LogOut, Search, Settings,
  BookOpen, ChevronDown, ChevronRight,
  GraduationCap, Home, X, Sparkles
} from 'lucide-react';
import { ChatMessage } from '../types';
import { useAuth } from '../context/AuthContext';

interface StudentDashboardProps {
  onLogout: () => void;
}

interface SubjectInfo {
  subject_id: number;
  subject_name: string;
  subject_code: string | null;
  teacher_id: number;
  teacher_name: string;
  teacher_email: string;
}

interface HomeroomTeacher {
  teacher_id: number;
  teacher_name: string;
  teacher_email: string;
}

interface MySubjectsData {
  class_id: number | null;
  class_name: string | null;
  academic_year: string | null;
  subjects: SubjectInfo[];
  homeroom_teacher: HomeroomTeacher | null;
}

interface ChatSession {
  id: number;
  title: string | null;
  subject: string | null;
  created_at: string;
}

interface SessionContext {
  type: 'subject' | 'homeroom';
  subject_name?: string;
  subject_id?: number;
  teacher_name: string;
  teacher_id: number;
  color: string;
  icon: React.ReactNode;
}

const SUBJECT_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-teal-500 to-cyan-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-green-500 to-emerald-600',
];

const API = 'http://localhost:8000/api/v1';

export default function StudentDashboard({ onLogout }: StudentDashboardProps) {
  const { user, token } = useAuth();

  // Data from backend
  const [mySubjectsData, setMySubjectsData] = useState<MySubjectsData | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Active session & context
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeContext, setActiveContext] = useState<SessionContext | null>(null);

  // Chat messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Subject Picker Modal
  const [showPicker, setShowPicker] = useState(false);

  // Sidebar collapse state for subject groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['homeroom']));

  const scrollRef = useRef<HTMLDivElement>(null);
  const headers = { 'Authorization': `Bearer ${token}` };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Load my subjects and sessions on mount
  useEffect(() => {
    if (!token) return;
    fetchMySubjects();
    fetchSessions();
  }, [token]);

  const fetchMySubjects = async () => {
    try {
      const res = await fetch(`${API}/classes/my-subjects`, { headers });
      if (res.ok) setMySubjectsData(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API}/chat/sessions`, { headers });
      if (res.ok) setSessions(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadSession = async (sessionId: number, ctx: SessionContext) => {
    setActiveSessionId(sessionId);
    setActiveContext(ctx);
    try {
      const res = await fetch(`${API}/chat/sessions/${sessionId}/messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: any) => ({
          id: m.id.toString(),
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          timestamp: new Date(m.created_at),
        })));
      }
    } catch (e) { console.error(e); }
  };

  // Build context from subject info
  const buildSubjectContext = (s: SubjectInfo, colorIdx: number): SessionContext => ({
    type: 'subject',
    subject_name: s.subject_name,
    subject_id: s.subject_id,
    teacher_name: s.teacher_name,
    teacher_id: s.teacher_id,
    color: SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length],
    icon: <BookOpen className="w-4 h-4" />,
  });

  const buildHomeroomContext = (): SessionContext | null => {
    const ht = mySubjectsData?.homeroom_teacher;
    if (!ht) return null;
    return {
      type: 'homeroom',
      teacher_name: ht.teacher_name,
      teacher_id: ht.teacher_id,
      color: 'from-slate-600 to-slate-800',
      icon: <Home className="w-4 h-4" />,
    };
  };

  const startNewSession = async (ctx: SessionContext) => {
    setShowPicker(false);
    const title = ctx.type === 'homeroom'
      ? `Hỏi GVCN ${ctx.teacher_name}`
      : `Học ${ctx.subject_name}`;
    try {
      const res = await fetch(`${API}/chat/sessions`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject: ctx.subject_name ?? 'Chủ nhiệm',
        }),
      });
      if (res.ok) {
        const session = await res.json();
        setSessions(prev => [session, ...prev]);
        setActiveSessionId(session.id);
        setActiveContext(ctx);
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: ctx.type === 'homeroom'
            ? `Chào ${user?.full_name || 'em'}! Thầy/Cô ${ctx.teacher_name} (GVCN) có thể giúp gì cho em?`
            : `Chào ${user?.full_name || 'em'}! Em đang học **${ctx.subject_name}** với Thầy/Cô **${ctx.teacher_name}**. Em muốn hỏi gì nào?`,
          timestamp: new Date(),
        }]);
        // Expand the group for this context
        setExpandedGroups(prev => new Set([...prev, ctx.subject_name || 'homeroom']));
      }
    } catch (e) { console.error(e); }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping || !activeSessionId || !activeContext) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      const response = await fetch(`${API}/rag/message`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMsg.content,
          subject: activeContext.subject_name ?? 'Chủ nhiệm',
          role: 'student',
          session_id: activeSessionId,
          stream: true,
        }),
      });

      if (!response.body) throw new Error('No stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let botContent = '';

      while (!done) {
        const { value, done: dr } = await reader.read();
        done = dr;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const d = line.slice(6);
            if (d.trim() === '[DONE]') { done = true; break; }
            botContent += d.replace(/\\n/g, '\n');
            setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: botContent } : m));
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.map(m =>
        m.id === botMsgId ? { ...m, content: 'Xin lỗi, có lỗi kết nối với máy chủ.' } : m
      ));
    } finally {
      setIsTyping(false);
    }
  };

  // Group sessions by subject for sidebar
  const sessionsBySubject = sessions.reduce((acc, s) => {
    const key = s.subject || 'Chủ nhiệm';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {} as Record<string, ChatSession[]>);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden font-sans">
      {/* ===== SIDEBAR ===== */}
      <aside className="h-screen w-72 hidden md:flex flex-col border-r border-surface-container-high bg-white z-40">
        {/* User Profile */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {user?.full_name?.charAt(0).toUpperCase() || 'HS'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-on-surface leading-none truncate">{user?.full_name || 'Học sinh'}</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                {mySubjectsData?.class_name ? `${mySubjectsData.class_name} • ${mySubjectsData.academic_year}` : user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* New Session Button */}
        <div className="px-4 py-3">
          <button
            onClick={() => setShowPicker(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-xl font-bold text-sm shadow hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Phiên học mới
          </button>
        </div>

        {/* Session Groups */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar">
          {/* Homeroom Group */}
          {mySubjectsData?.homeroom_teacher && (
            <div className="mb-1">
              <button
                onClick={() => toggleGroup('homeroom')}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center">
                  <Home className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant">GVCN</p>
                  <p className="text-xs font-medium text-on-surface truncate">{mySubjectsData.homeroom_teacher.teacher_name}</p>
                </div>
                {expandedGroups.has('homeroom') ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {expandedGroups.has('homeroom') && (
                <div className="ml-2 pl-4 border-l-2 border-slate-100 space-y-0.5 mt-1">
                  {(sessionsBySubject['Chủ nhiệm'] || []).map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        const ctx = buildHomeroomContext();
                        if (ctx) loadSession(s.id, ctx);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
                        activeSessionId === s.id
                          ? 'bg-slate-100 font-bold text-on-surface'
                          : 'text-on-surface-variant hover:bg-slate-50 hover:text-on-surface'
                      }`}
                    >
                      {s.title || 'Cuộc trò chuyện'}
                    </button>
                  ))}
                  {(sessionsBySubject['Chủ nhiệm'] || []).length === 0 && (
                    <p className="text-[10px] text-slate-300 px-3 py-1 italic">Chưa có phiên nào</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Subject Groups */}
          {(mySubjectsData?.subjects || []).map((subj, idx) => {
            const colorClass = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
            const isExpanded = expandedGroups.has(subj.subject_name);
            const subjectSessions = sessionsBySubject[subj.subject_name] || [];

            return (
              <div key={subj.subject_id} className="mb-1">
                <button
                  onClick={() => toggleGroup(subj.subject_name)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
                    <BookOpen className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-[11px] font-black uppercase tracking-wider text-on-surface-variant truncate">{subj.subject_name}</p>
                    <p className="text-xs font-medium text-slate-400 truncate">{subj.teacher_name}</p>
                  </div>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="ml-2 pl-4 border-l-2 border-slate-100 space-y-0.5 mt-1">
                    {subjectSessions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => loadSession(s.id, buildSubjectContext(subj, idx))}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
                          activeSessionId === s.id
                            ? 'bg-slate-100 font-bold text-on-surface'
                            : 'text-on-surface-variant hover:bg-slate-50 hover:text-on-surface'
                        }`}
                      >
                        {s.title || 'Cuộc trò chuyện'}
                      </button>
                    ))}
                    {subjectSessions.length === 0 && (
                      <p className="text-[10px] text-slate-300 px-3 py-1 italic">Chưa có phiên nào</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {!mySubjectsData && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-300 italic">Đang tải dữ liệu...</p>
            </div>
          )}
          {mySubjectsData && mySubjectsData.subjects.length === 0 && !mySubjectsData.homeroom_teacher && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-400 italic">Bạn chưa được xếp lớp. Liên hệ admin.</p>
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-error hover:bg-red-50 rounded-xl text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col h-screen relative overflow-hidden">
        {/* Top Header */}
        <header className="flex justify-between items-center px-6 py-3 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Giáo viên AI</span>

            {/* Context Badge */}
            {activeContext && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-xs font-bold bg-gradient-to-r ${activeContext.color} shadow-sm`}
              >
                {activeContext.icon}
                <span>
                  {activeContext.type === 'homeroom'
                    ? `GVCN: ${activeContext.teacher_name}`
                    : `${activeContext.subject_name}`}
                </span>
                {activeContext.type === 'subject' && (
                  <span className="opacity-75">• {activeContext.teacher_name}</span>
                )}
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              <input
                className="bg-slate-50 border-none rounded-full py-1.5 pl-9 pr-4 text-xs focus:ring-2 focus:ring-primary w-52"
                placeholder="Tìm trong hội thoại..."
                type="text"
              />
            </div>
            <button className="p-2 text-slate-400 hover:text-primary hover:bg-blue-50 rounded-full transition-all">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ===== CHAT AREA ===== */}
        {!activeSessionId ? (
          /* Welcome / Empty State */
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md px-6"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/20">
                <GraduationCap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black text-on-surface mb-2">
                Chào {user?.full_name?.split(' ').pop() || 'bạn'}! 👋
              </h2>
              <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                Chọn một môn học hoặc nhắn tin với Giáo viên chủ nhiệm để bắt đầu. Tôi sẽ hỗ trợ bạn theo phương pháp Socratic – gợi ý thay vì giải sẵn!
              </p>

              {/* Quick Subject Buttons */}
              {mySubjectsData && (
                <div className="flex flex-wrap justify-center gap-2">
                  {mySubjectsData.subjects.slice(0, 4).map((s, idx) => (
                    <button
                      key={s.subject_id}
                      onClick={() => startNewSession(buildSubjectContext(s, idx))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold bg-gradient-to-r ${SUBJECT_COLORS[idx % SUBJECT_COLORS.length]} hover:-translate-y-0.5 transition-all shadow`}
                    >
                      <BookOpen className="w-4 h-4" />
                      {s.subject_name}
                    </button>
                  ))}
                  {mySubjectsData.homeroom_teacher && (
                    <button
                      onClick={() => {
                        const ctx = buildHomeroomContext();
                        if (ctx) startNewSession(ctx);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold bg-gradient-to-r from-slate-600 to-slate-800 hover:-translate-y-0.5 transition-all shadow"
                    >
                      <Home className="w-4 h-4" />
                      GVCN
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar space-y-5 bg-slate-50/50">
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-3 max-w-4xl mx-auto w-full ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      msg.role === 'assistant'
                        ? `bg-gradient-to-br ${activeContext?.color || 'from-primary to-indigo-600'}`
                        : 'bg-slate-200'
                    }`}>
                      {msg.role === 'assistant'
                        ? <Bot className="text-white w-4 h-4" />
                        : <User className="text-slate-600 w-4 h-4" />
                      }
                    </div>

                    {/* Bubble */}
                    <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap max-w-xl ${
                      msg.role === 'assistant'
                        ? 'bg-white border border-slate-100 rounded-tl-none'
                        : 'bg-primary text-white rounded-tr-none ml-auto'
                    }`}>
                      {msg.content || (
                        <span className="flex gap-1 items-center h-5">
                          <motion.span animate={{ opacity: [0.3,1,0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block" />
                          <motion.span animate={{ opacity: [0.3,1,0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block" />
                          <motion.span animate={{ opacity: [0.3,1,0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full inline-block" />
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              <div className="max-w-4xl mx-auto">
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden p-2 flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32 custom-scrollbar placeholder:text-slate-300"
                    placeholder={`Hỏi về ${activeContext?.subject_name || 'bài học'}...`}
                    rows={1}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="p-2 text-slate-400 hover:text-primary hover:bg-blue-50 rounded-xl transition-colors">
                      <Mic className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={isTyping || !input.trim()}
                      className={`p-2.5 text-white rounded-xl shadow transition-all ${
                        isTyping || !input.trim()
                          ? 'bg-slate-200 text-slate-400'
                          : `bg-gradient-to-br ${activeContext?.color || 'from-primary to-indigo-600'} hover:scale-105 active:scale-95`
                      }`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 px-1">
                  <p className="text-[10px] text-slate-300 font-medium">Phương pháp Socratic • RAG thời gian thực</p>
                  {activeContext && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${activeContext.color}`}>
                      {activeContext.subject_name || 'Chủ nhiệm'} • {activeContext.teacher_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ===== SUBJECT PICKER MODAL ===== */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowPicker(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 relative">
                <button
                  onClick={() => setShowPicker(false)}
                  className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 mb-1">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                  <h3 className="text-xl font-black text-white">Bắt đầu phiên học mới</h3>
                </div>
                <p className="text-blue-200 text-sm">Chọn môn học hoặc giáo viên chủ nhiệm</p>
              </div>

              <div className="px-8 py-6 space-y-3">
                {/* GVCN option */}
                {mySubjectsData?.homeroom_teacher && (() => {
                  const ctx = buildHomeroomContext()!;
                  return (
                    <button
                      onClick={() => startNewSession(ctx)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-700 hover:bg-slate-700 group transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-md">
                        <Home className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-black text-on-surface group-hover:text-white text-base transition-colors">Giáo viên Chủ nhiệm</p>
                        <p className="text-sm text-slate-400 group-hover:text-white/70 transition-colors">{mySubjectsData.homeroom_teacher.teacher_name}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
                    </button>
                  );
                })()}

                {/* Subject options */}
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-300 px-1">Môn học</p>
                  {mySubjectsData?.subjects.map((s, idx) => {
                    const ctx = buildSubjectContext(s, idx);
                    return (
                      <button
                        key={s.subject_id}
                        onClick={() => startNewSession(ctx)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-transparent hover:shadow-lg group transition-all relative overflow-hidden"
                        style={{ '--hover-bg': '1' } as any}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, var(--subject-from, #3b82f6), var(--subject-to, #4f46e5))`;
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = '';
                        }}
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ctx.color} flex items-center justify-center shadow-md shrink-0`}>
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left flex-1 overflow-hidden">
                          <p className="font-black text-on-surface group-hover:text-white text-base transition-colors truncate">{s.subject_name}</p>
                          <p className="text-sm text-slate-400 group-hover:text-white/70 transition-colors truncate">{s.teacher_name}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-white shrink-0 transition-colors" />
                      </button>
                    );
                  })}
                </div>

                {/* No data state */}
                {mySubjectsData && mySubjectsData.subjects.length === 0 && !mySubjectsData.homeroom_teacher && (
                  <div className="text-center py-8">
                    <p className="text-slate-400 text-sm">Bạn chưa được xếp lớp hoặc phân công môn học.</p>
                    <p className="text-slate-300 text-xs mt-1">Liên hệ Admin để được hỗ trợ.</p>
                  </div>
                )}
                {!mySubjectsData && (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Đang tải danh sách môn học...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
