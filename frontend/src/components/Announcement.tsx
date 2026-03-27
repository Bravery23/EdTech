import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, X, Bot } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Announcement {
  id: number;
  title: string;
  content: string;
  created_at: string;
  teacher?: {
    full_name: string;
    role: string[];
  };
}

const API_BASE = "http://localhost:8000/api/v1";

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Vừa xong";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
}

export default function NotificationBar({ onClose }: { onClose?: () => void }) {
  const [showNotifications, setShowNotifications] = useState(true);
  const [notifications, setNotifications] = useState<Announcement[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<Announcement | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch(`${API_BASE}/announcements/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (token) fetchAnnouncements();
  }, [token]);

  const handleClose = () => {
    setShowNotifications(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };

  return (
    <aside
      className={`fixed top-0 right-0 h-screen bg-white border-l border-slate-100 z-50 transition-all duration-300 shadow-2xl flex flex-col ${showNotifications ? "w-80" : "w-0"}`}
    >
      <AnimatePresence>
        {showNotifications && (
          <>
            {/* Overlay: Làm mờ nền khi mở sidebar để tập trung chú ý (Tùy chọn) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/10 z-40 backdrop-blur-[2px]"
            />

            {/* Sidebar chính */}
            <motion.aside
              initial={{ x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 h-screen w-80 bg-white border-l border-slate-100 z-50 shadow-2xl flex flex-col"
            >
              <div className="flex flex-col h-full w-full">
                {/* Header */}
                <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    <h3 className="font-black text-on-surface">Thông báo</h3>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* List - Thêm hiệu ứng xuất hiện cho từng item */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {notifications.map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }} // Hiệu ứng thác nước (stagger)
                      onClick={() => setSelectedNotification(n)}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/50 transition-all cursor-pointer group border border-transparent hover:border-blue-100"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary truncate">
                          {n.teacher ? `${n.teacher.full_name} • ${n.teacher.role.includes("admin") ? "Quản trị" : "Giáo viên"}` : "Thông báo"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                        {n.content}
                      </p>
                    </motion.div>
                  ))}

                  {notifications.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                      <Bot className="w-12 h-12 mb-2" />
                      <p className="text-xs italic">Không có thông báo mới</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-50">
                  <button className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-primary transition-colors text-center uppercase tracking-widest">
                    Đánh dấu đã đọc tất cả
                  </button>
                </div>
              </div>
            </motion.aside>

            {/* Modal hiển thị chi tiết thông báo */}
            {selectedNotification && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
                  onClick={() => setSelectedNotification(null)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
                >
                  <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-primary/5">
                    <div>
                      <h3 className="font-bold text-lg text-primary leading-tight pr-4">
                        {selectedNotification.title}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-2 font-medium">
                        Từ: {selectedNotification.teacher?.full_name}
                      </p>
                    </div>
                    <button 
                      onClick={() => setSelectedNotification(null)} 
                      className="p-1.5 hover:bg-black/5 rounded-full transition-colors shrink-0"
                    >
                      <X className="w-5 h-5 text-on-surface-variant"/>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedNotification.content}
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatTimeAgo(selectedNotification.created_at)}</span>
                    <button 
                      onClick={() => setSelectedNotification(null)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
                    >
                      Đóng
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </>
        )}
      </AnimatePresence>
    </aside>
  );
}
