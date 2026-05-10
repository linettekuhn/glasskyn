import apiClient from './client';

export async function getProducts() {
  const response = await apiClient.get('/products');
  return response.data;
}

export async function createProduct(data: { name: string; brand?: string; category?: string }) {
  const response = await apiClient.post('/products', data);
  return response.data;
}

export async function lookupProduct(barcode: string) {
  const response = await apiClient.get(`/products/lookup/${barcode}`);
  return response.data;
}
