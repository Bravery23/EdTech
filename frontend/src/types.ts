export type Role = 'student' | 'parent' | 'teacher' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  class?: string;
  avatar?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'sql_result' | 'socratic_hint';
  data?: any;
}

export interface StudentRisk {
  id: string;
  name: string;
  avatar: string;
  subject: string;
  trend: string;
  status: 'critical' | 'warning' | 'stable';
  detail: string;
}
