import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, User, Users, ShieldCheck, BadgeCheck, Lock, Eye, EyeOff } from 'lucide-react';
import { Role } from '../types';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onLogin: (role: Role) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!res.ok) throw new Error('Login failed');
      const data = await res.json();
      
      const userRes = await fetch('http://localhost:8000/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const userData = await userRes.json();
      
      login(data.access_token, userData);
    } catch (err) {
      alert('Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.');
    }
  };

  const roles = [
    { id: 'student', label: 'Học sinh', icon: User },
    { id: 'parent', label: 'Phụ huynh', icon: Users },
    { id: 'teacher', label: 'Giáo viên', icon: GraduationCap },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-surface">
      {/* Decorative Elements */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-container/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary-container/20 rounded-full blur-3xl"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] flex flex-col items-center z-10"
      >
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary to-primary-container rounded-xl shadow-lg mb-4">
            <GraduationCap className="text-white w-8 h-8" />
          </div>
          <h1 className="text-xl font-black bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent tracking-tight">
            RAG Giáo viên ảo
          </h1>
          <p className="text-on-surface-variant text-sm font-medium mt-1">Học viện Công nghệ Sáng tạo</p>
        </div>

        {/* Login Card */}
        <div className="w-full glass-panel border border-white/40 shadow-[0_20px_40px_rgba(36,44,81,0.06)] rounded-lg p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-on-surface text-center">Chào mừng trở lại</h2>
            <p className="text-on-surface-variant text-sm mt-1 text-center">Vui lòng đăng nhập để tiếp tục</p>
          </div>

          <form className="space-y-6" onSubmit={handleLoginSubmit}>
            {/* Role Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Bạn là ai?</label>
              <div className="grid grid-cols-4 gap-2 p-1.5 bg-surface-container-low rounded-md">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id as Role)}
                    className={`flex flex-col items-center justify-center py-3 px-1 rounded-sm transition-all ${
                      selectedRole === role.id 
                        ? 'bg-surface-container-lowest shadow-sm text-primary' 
                        : 'text-on-surface-variant hover:bg-surface-container-highest/30'
                    }`}
                  >
                    <role.icon className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">{role.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Fields */}
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <BadgeCheck className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-sm focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest text-sm font-medium transition-all placeholder:text-outline-variant"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                </div>
                <input
                  className="w-full pl-12 pr-12 py-4 bg-surface-container-low border-none rounded-sm focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest text-sm font-medium transition-all placeholder:text-outline-variant"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-on-surface-variant hover:text-primary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <input className="w-4 h-4 rounded-sm border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                <span className="text-xs font-medium text-on-surface-variant group-hover:text-on-surface">Ghi nhớ tôi</span>
              </label>
              <a className="text-xs font-bold text-primary hover:underline underline-offset-4" href="#">Quên mật khẩu?</a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-primary-container text-white py-4 rounded-md font-bold text-sm shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.98]"
            >
              Đăng nhập vào hệ thống
            </button>
          </form>
        </div>
      </motion.div>

      {/* Background Decoration */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_rgba(110,159,255,0.1),_transparent_40%),_radial-gradient(circle_at_80%_70%,_rgba(105,246,184,0.1),_transparent_40%)]"></div>
        <img
          className="w-full h-full object-cover mix-blend-overlay"
          src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1920"
          alt="Background"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
