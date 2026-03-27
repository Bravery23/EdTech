// const API_BASE = 'http://localhost:8000/api/v1';

// export async function loginApi(email: string, password: string):Promise<{access_token: string, role: string[]}> {
//   const formData = new URLSearchParams();
//   formData.append('username', email);
//   formData.append('password', password);
  
//   const res = await fetch(`${API_BASE}/auth/login`, {
//     method: 'POST',
//     body: formData,
//     headers: {
//       'Content-Type': 'application/x-www-form-urlencoded'
//     }
//   });
//   if (!res.ok) throw new Error('Login failed');
//   const data = await res.json();
  
//   // fetch user info to get role
//   const userRes = await fetch(`${API_BASE}/users/me`, {
//     headers: { 'Authorization': `Bearer ${data.access_token}` }
//   });
//   const userData = await userRes.json();
//   return { access_token: data.access_token, role: userData.role };
// }

// export async function generateSocraticResponse(history: { role: string, content: string }[], userMessage: string) {
//   const token = localStorage.getItem('access_token');
//   const res = await fetch(`${API_BASE}/rag/message`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${token}`
//     },
//     body: JSON.stringify({
//       query: userMessage,
//       role: 'student'
//     })
//   });
//   if (!res.ok) throw new Error('API Error');
//   const data = await res.json();
//   return data.response;
// }

// export async function generateParentAdvisorResponse(userMessage: string) {
//   const token = localStorage.getItem('access_token');
//   const res = await fetch(`${API_BASE}/rag/message`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${token}`
//     },
//     body: JSON.stringify({
//       query: userMessage,
//       role: 'parent'
//     })
//   });
//   if (!res.ok) throw new Error('API Error');
//   const data = await res.json();
//   return data.response;
// }
