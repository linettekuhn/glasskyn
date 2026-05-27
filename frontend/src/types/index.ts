export interface User {
  id: number;
  name: string;
  email: string;
}

export type ProductCategory = "skincare" | "makeup" | "haircare";

export interface Product {
  id: number;
  name: string;
  brand: string | null;
  category: ProductCategory | null;
  image_s3_key: string | null;
  image_url: string | null;
  created_at: string;
  user_id: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface BarcodeLookupResult {
  product_name: string | null;
  brands: string | null;
  categories: string | null;
  barcode: string;
}

export interface ProcessMultiResult {
  scan_id: number | null;
  product_name: string | null;
  brand: string | null;
  name_brand_method: "barcode_lookup" | "llm_extraction" | null;
  category: string | null;
  category_method: string | null;
  pao_months: number | null;
  expiry_date: string | null;
  extraction_method: string | null;
}

export interface ProcessPaoResult {
  pao_months: number | null;
  extraction_method: string | null;
}

export type NameBrandMethod = "barcode_lookup" | "llm_extraction" | "manual";

export type ScanStep = "front" | "back" | "pao" | "confirm";
