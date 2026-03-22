/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import ParentDashboard from './components/ParentDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import AdminDashboard from './components/AdminDashboard';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { role, logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface">
      {!role && <Login onLogin={() => {}} />}
      {role === 'student' && <StudentDashboard onLogout={logout} />}
      {role === 'parent' && <ParentDashboard onLogout={logout} />}
      {role === 'teacher' && <TeacherDashboard onLogout={logout} />}
      {role === 'admin' && <AdminDashboard onLogout={logout} />}
    </div>
  );
}
