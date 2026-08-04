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

export async function updateUser(data: { name?: string; email?: string }) {
  const response = await apiClient.patch('/auth/me', data);
  return response.data as { id: number; name: string; email: string };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  await apiClient.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function deleteAccount() {
  await apiClient.delete('/auth/me');
}
