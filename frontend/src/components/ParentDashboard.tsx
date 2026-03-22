import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Bell, User, Search, 
  History, Settings, Send, Info, Download, 
  TrendingDown, Activity, GraduationCap, Bot, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ParentDashboardProps {
  onLogout: () => void;
}

interface GradeRow {
  id: number;
  subject_id: number;
  exam_type: string;
  score: number;
  semester: number;
  academic_year: string;
  comments?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export default function ParentDashboard({ onLogout }: ParentDashboardProps) {
  const { user, token } = useAuth();
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    { role: 'assistant', content: `Xin chào! Tôi là trợ lý ảo tích hợp dữ liệu từ CSDL nhà trường. Tôi có thể giúp Anh/Chị tra cứu **điểm số**, **nhận xét** từ giáo viên hoặc giải đáp thắc mắc về **quy chế học tập** của nhà trường.` }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  // Fetch associated student IDs for this parent
  useEffect(() => {
    if (!token || !user?.id) return;
    fetch(`http://localhost:8000/api/v1/users/${user.id}/students`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.ok ? r.json() : [])
    .then((students: { id: number }[]) => {
      const ids = students.map(s => s.id);
      setStudentIds(ids);
      if (ids.length > 0) fetchGrades(ids[0]);
    })
    .catch(console.error);
  }, [token, user?.id]);

  const fetchGrades = async (studentId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/grades/student/${studentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGrades(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isTyping) return;
    const userMessage = chatInput;
    const userMsg: ChatMsg = { role: 'user', content: userMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    const botId = Date.now();
    setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('http://localhost:8000/api/v1/rag/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: userMessage,
          role: 'parent',
          stream: true,
        })
      });

      if (!response.body) throw new Error('No stream body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let botContent = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr.trim() === '[DONE]') { done = true; break; }
            botContent += dataStr.replace(/\\n/g, '\n');
            setChatHistory(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: botContent };
              return updated;
            });
          }
        }
      }
    } catch (error) {
      console.error(error);
      setChatHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Xin lỗi, có lỗi khi kết nối với máy chủ.' };
        return updated;
      });
    } finally {
      setIsTyping(false);
    }
  };

  // Group grades by exam_type for easy display
  const gradesByExamType = grades.reduce((acc, g) => {
    if (!acc[g.exam_type]) acc[g.exam_type] = [];
    acc[g.exam_type].push(g);
    return acc;
  }, {} as Record<string, GradeRow[]>);

  const avgScore = grades.length > 0 ? (grades.reduce((sum, g) => sum + g.score, 0) / grades.length).toFixed(1) : null;

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-3 bg-white/70 backdrop-blur-md shadow-sm border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          <span className="text-lg font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">RAG Giáo viên ảo</span>
          <div className="h-6 w-[1px] bg-outline-variant/30 hidden md:block"></div>
          <p className="text-xs font-medium text-on-surface-variant hidden md:block uppercase tracking-widest">Portal Phụ huynh</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Bell className="w-5 h-5 text-on-surface-variant cursor-pointer" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/20">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold leading-tight">{user?.full_name || 'Phụ huynh'}</p>
              <p className="text-[10px] text-on-surface-variant">{user?.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center cursor-pointer">
              <User className="w-5 h-5 text-on-surface-variant" />
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 text-sm text-slate-500 hover:text-error font-semibold transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        <main className="flex-1 overflow-hidden grid grid-cols-12 gap-6 p-6">
          {/* Left Column: Reports */}
          <section className="col-span-12 lg:col-span-5 flex flex-col space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-on-surface">Báo cáo học tập & Phân tích AI</h1>
              <p className="text-on-surface-variant text-sm italic">Dữ liệu thời gian thực từ CSDL nhà trường</p>
            </div>

            {/* AI Alerts */}
            <div className="flex flex-col gap-4">
              {avgScore && parseFloat(avgScore) < 7 ? (
                <motion.div whileHover={{ scale: 1.01 }} className="bg-error-container/5 border border-error/20 p-5 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="text-error w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-wider text-error">Cảnh báo rủi ro (AI)</span>
                    </div>
                    <span className="text-[10px] bg-error text-white px-2 py-0.5 rounded-full">Ưu tiên cao</span>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-bold text-on-surface">Điểm trung bình đang thấp</p>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">Điểm TB hiện tại: <strong>{avgScore}</strong>. Cần chú ý hơn các môn học để cải thiện kết quả.</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.01 }} className="bg-secondary-container/5 border border-secondary/20 p-5 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Activity className="text-secondary w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-wider text-secondary">Phân tích chuyên cần</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-bold text-on-surface">
                      {avgScore ? `Điểm TB: ${avgScore} — Học tập ổn định` : 'Đang tải dữ liệu điểm số...'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      {grades.length > 0 ? `Đã cập nhật ${grades.length} bài kiểm tra từ CSDL.` : 'Liên hệ nhà trường để cập nhật điểm số.'}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Grades Table */}
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-white/50">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  <GraduationCap className="text-primary w-4 h-4" />
                  Kết quả học tập {grades.length > 0 && `(${grades.length} bài)`}
                </h3>
                <button className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">
                  <Download className="w-3 h-3" /> Tải PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-on-surface-variant border-b border-outline-variant/5">
                      <th className="px-4 py-3 font-semibold">Loại bài</th>
                      <th className="px-4 py-3 font-semibold text-center">Kỳ</th>
                      <th className="px-4 py-3 font-semibold text-right">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {grades.length > 0 ? grades.map((g) => (
                      <tr key={g.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 font-semibold capitalize">{g.exam_type.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-center">Kỳ {g.semester} — {g.academic_year}</td>
                        <td className={`px-4 py-3 text-right font-bold ${g.score >= 8 ? 'text-secondary' : g.score >= 5 ? 'text-primary' : 'text-error'}`}>
                          {g.score}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-on-surface-variant text-xs">
                          {studentIds.length === 0 ? 'Chưa có dữ liệu học sinh được liên kết.' : 'Chưa có bài kiểm tra nào được nhập.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-slate-50 border-t border-outline-variant/10">
                <div className="flex items-start gap-2">
                  <Info className="text-on-surface-variant w-3 h-3 mt-0.5" />
                  <p className="text-[9px] text-on-surface-variant italic leading-relaxed">Dữ liệu được truy xuất trực tiếp từ CSDL nhà trường qua API bảo mật.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Chat */}
          <section className="col-span-12 lg:col-span-7 bg-white rounded-lg border border-outline-variant/10 shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-outline-variant/10 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-md">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Chủ nhiệm ảo (RAG AI Assistant)</h2>
                  <p className="text-xs text-secondary font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span> Đang trực tuyến • Sẵn sàng hỗ trợ
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-on-surface-variant cursor-pointer" />
                <Settings className="w-5 h-5 text-on-surface-variant cursor-pointer" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40 custom-scrollbar">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-10 h-10 rounded-full bg-primary/10 shrink-0 flex items-center justify-center text-primary border border-primary/20">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl shadow-sm max-w-[80%] ${
                    msg.role === 'assistant' 
                      ? 'bg-white border border-outline-variant/10 rounded-tl-none' 
                      : 'bg-primary text-on-primary rounded-tr-none'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 flex items-center justify-center text-on-surface-variant border border-outline-variant/10">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && chatHistory[chatHistory.length - 1]?.content === '' && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 shrink-0 flex items-center justify-center text-primary border border-primary/20">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="bg-white border border-outline-variant/10 p-4 rounded-2xl rounded-tl-none flex gap-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-75"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-6 border-t border-outline-variant/10 bg-white">
              <div className="relative flex items-center max-w-4xl mx-auto">
                <input 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend(); }}
                  className="w-full bg-slate-50 border border-outline-variant/20 rounded-2xl py-4 pl-6 pr-16 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary placeholder:text-on-surface-variant/50 shadow-inner transition-all" 
                  placeholder="Hỏi về quy chế, tra cứu điểm hoặc nhận xét của giáo viên..." 
                  type="text"
                />
                <button 
                  onClick={handleChatSend}
                  disabled={isTyping}
                  className={`absolute right-2 p-2.5 text-on-primary rounded-xl transition-all active:scale-95 ${isTyping ? 'bg-slate-300' : 'bg-primary hover:shadow-lg'}`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="flex justify-center gap-8 mt-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">RAG Policy Engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Secure SQL Gateway</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
