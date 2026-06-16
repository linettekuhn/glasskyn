import apiClient from './client';

export async function login(email: string, password: string) {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data as { access_token: string; refresh_token: string; user: { id: number; name: string; email: string } };
}

export async function register(name: string, email: string, password: string) {
  const response = await apiClient.post('/auth/register', { name, email, password });
  return response.data;
}

export async function refresh(refresh_token: string) {
  const response = await apiClient.post('/auth/refresh', null, {
    headers: { 'x-refresh-token': refresh_token },
  });
  return response.data as { access_token: string; refresh_token: string; user: { id: number; name: string; email: string } };
}

export async function logout(refresh_token: string) {
  await apiClient.post('/auth/logout', null, {
    headers: { 'x-refresh-token': refresh_token },
  });
}
