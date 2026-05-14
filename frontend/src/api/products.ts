import apiClient from './client';

export interface ProcessImageResult {
  name: string | null;
  brand: string | null;
  category: string | null;
  barcode: string | null;
}

export async function getProducts() {
  const response = await apiClient.get('/products');
  return response.data;
}

export async function createProduct(data: {
  name: string;
  brand?: string;
  category?: string;
  image_s3_key?: string;
}) {
  const response = await apiClient.post('/products', data);
  return response.data;
}

export async function lookupProduct(barcode: string) {
  const response = await apiClient.get(`/products/lookup/${barcode}`);
  return response.data;
}

export async function updateProduct(id: number, data: {
  name?: string;
  brand?: string;
  category?: string;
  image_s3_key?: string;
}) {
  const response = await apiClient.patch(`/products/${id}`, data);
  return response.data;
}

export async function deleteProduct(id: number) {
  await apiClient.delete(`/products/${id}`);
}

export async function processImage(fileKey: string, barcode?: string | null): Promise<ProcessImageResult> {
  console.log("[API] processImage called, fileKey:", fileKey, "barcode:", barcode);
  const response = await apiClient.post('/uploads/process', {
    file_key: fileKey,
    barcode: barcode || null,
  });
  console.log("[API] processImage response:", response.data);
  return response.data;
}