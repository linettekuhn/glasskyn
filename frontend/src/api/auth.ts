import apiClient from './client';

export async function login(email: string, password: string) {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
}

export async function register(name: string, email: string, password: string) {
  const response = await apiClient.post('/auth/register', { name, email, password });
  return response.data;
}

export async function refresh() {
  const response = await apiClient.post('/auth/refresh');
  return response.data as { access_token: string; user: { id: number; name: string; email: string } };
}

export async function logout() {
  await apiClient.post('/auth/logout');
}
