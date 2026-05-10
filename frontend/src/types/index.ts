export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
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
