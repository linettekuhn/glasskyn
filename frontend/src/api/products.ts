import apiClient from './client';
import type { ProcessMultiResult, ProcessPaoResult } from '../types';

export interface ProcessImageResult {
  name: string | null;
  brand: string | null;
  category: string | null;
  barcode: string | null;
  scan_id: number | null;
  pao_months: number | null;
  expiry_date: string | null;
  category_method: string | null;
  extraction_method: string | null;
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
  icon?: string;
  pao_months?: number;
  scan_id?: number | null;
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
  icon?: string;
  pao_months?: number;
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

export async function processMultiImages(
  frontFileKey: string,
  backFileKey: string,
  barcode?: string | null,
): Promise<ProcessMultiResult> {
  console.log("[API] processMultiImages called", { frontFileKey, backFileKey, barcode });
  const response = await apiClient.post('/uploads/process-multi', {
    front_file_key: frontFileKey,
    back_file_key: backFileKey,
    barcode: barcode || null,
  });
  console.log("[API] processMultiImages response:", response.data);
  return response.data;
}

export async function processPaoImage(
  fileKey: string,
  scanId: number,
): Promise<ProcessPaoResult> {
  console.log("[API] processPaoImage called", { fileKey, scanId });
  const response = await apiClient.post('/uploads/process-pao', {
    file_key: fileKey,
    scan_id: scanId,
  });
  console.log("[API] processPaoImage response:", response.data);
  return response.data;
}

export async function updateScanResult(
  scanId: number,
  data: {
    product_name?: string;
    brand?: string;
    name_brand_method?: string;
    pao_months?: number | null;
  },
) {
  console.log("[API] updateScanResult called", { scanId, data });
  const response = await apiClient.patch(`/uploads/scan/${scanId}`, data);
  return response.data;
}