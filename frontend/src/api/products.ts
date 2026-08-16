import apiClient from './client';
import type { ProcessMultiResult, ProcessPaoResult, IngredientAnalysisResponse } from '../types';

export async function getProducts() {
  const response = await apiClient.get('/products');
  return response.data;
}

export async function createProduct(data: {
  name: string;
  brand?: string;
  category?: string;
  product_type?: string;
  image_s3_key?: string;
  icon?: string;
  pao_months?: number | null;
  opened_date?: string;
  expiry_date?: string;
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
  product_type?: string;
  image_s3_key?: string;
  icon?: string;
  pao_months?: number | null;
  opened_date?: string;
  expiry_date?: string;
}) {
  const response = await apiClient.patch(`/products/${id}`, data);
  return response.data;
}

export async function deleteProduct(id: number) {
  await apiClient.delete(`/products/${id}`);
}

export async function markProductReplaced(id: number, expiryDate?: string) {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return updateProduct(
    id,
    expiryDate
      ? { opened_date: iso, expiry_date: expiryDate }
      : { opened_date: iso },
  );
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

export async function analyzeIngredients(
  ingredientText: string,
): Promise<IngredientAnalysisResponse> {
  const response = await apiClient.post('/ingredients/analyze', {
    ingredient_text: ingredientText,
  }, { timeout: 60000 });
  return response.data;
}

export async function getProductScanText(
  productId: number,
): Promise<{ raw_ocr_text: string | null; scan_date?: string | null }> {
  const response = await apiClient.get(`/products/${productId}/scan-text`);
  return response.data;
}

export async function getProductAnalysis(
  productId: number,
  refresh = false,
): Promise<IngredientAnalysisResponse> {
  const response = await apiClient.get(`/products/${productId}/analysis`, {
    params: refresh ? { refresh: "1" } : {},
    timeout: 60000,
  });
  return response.data;
}