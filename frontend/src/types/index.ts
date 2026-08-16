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
  icon: string | null;
  pao_months: number | null;
  opened_date: string | null;
  expiry_date: string | null;
  days_until_expiry: number | null;
  product_type: ProductType | null;
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
  product_type: string | null;
  category: string | null;
  category_method: string | null;
  pao_months: number | null;
  expiry_date: string | null;
  extraction_method: string | null;
  raw_ocr_text: string | null;
}

export interface ProcessPaoResult {
  pao_months: number | null;
  extraction_method: string | null;
}

export type NameBrandMethod = "barcode_lookup" | "llm_extraction" | "manual";

export type ScanStep = "front" | "back" | "pao" | "confirm";

export type SkinType = "dry" | "oily" | "combination" | "normal" | "sensitive";

export type StepType = "cleanse" | "tone" | "treat" | "moisturize" | "spf" | "other";

export type TimeOfDay = "AM" | "PM";

export interface StepDisplay {
  id: number;
  step_order: number;
  step_type: StepType;
  time_of_day: TimeOfDay;
  product_id: number | null;
  product_name: string | null;
  frequency: Frequency | null;
}

export type Frequency = "daily" | "every_other_day" | "weekly";

export type RoutineSource = "manual" | "template" | "llm_generated";

export type RoutineType = "skincare" | "haircare" | "makeup";

export type ProductType = "cleanser" | "toner" | "serum" | "moisturizer" | "exfoliant" | "mask" | "spot_treatment" | "spf" | "oil" | "other";

export interface SkinProfile {
  id: number;
  user_id: number;
  skin_type: SkinType | null;
  is_sensitive: boolean | null;
  concerns: string[];
  goals: string[];
  created_at: string;
  updated_at: string;
}

export interface RoutineStep {
  id: number;
  routine_id: number;
  step_order: number;
  product_id: number | null;
  step_type: StepType;
  time_of_day: TimeOfDay;
  frequency: Frequency;
  completed_today: boolean;
  created_at: string;
}

export interface Routine {
  id: number;
  user_id: number;
  name: string;
  source: RoutineSource;
  routine_type: RoutineType;
  is_main_routine: boolean;
  steps: RoutineStep[];
  created_at: string;
  updated_at: string;
}

export interface RoutineTemplateStep {
  id: number;
  template_id: number;
  step_order: number;
  step_type: StepType;
  time_of_day: TimeOfDay;
  frequency: Frequency;
  suggested_product_category: string | null;
  created_at: string;
}

export interface CalendarDay {
  date: string;
  completed: boolean;
}

export type Units = "imperial" | "metric";

export interface UserPreference {
  water_reminder_enabled: boolean;
  water_reminder_time: string;
  timezone: string | null;
  units: Units;
  water_goal_ml: number | null;
  water_weight_lb: number | null;
  water_activity_level: string | null;
  water_climate: string | null;
  routine_digest_am_time: string | null;
  routine_digest_pm_time: string | null;
}

export interface WaterIntake {
  date: string;
  ml: number;
}

export interface RoutineTemplate {
  id: number;
  name: string;
  description: string | null;
  routine_type: RoutineType;
  skin_type_tags: string[];
  concern_tags: string[];
  is_active: boolean;
  steps: RoutineTemplateStep[];
  created_at: string;
  updated_at: string;
}

export interface FlaggedIngredient {
  name: string;
  reason: string;
  known_risks: string[];
}

export interface MatchedIngredient {
  ingredient_name: string;
  raw_text: string;
  safety_score: number;
  known_risks: string[];
  benefits: string[];
  confidence: number;
  match_type: string;
}

export interface NotFoundIngredient {
  raw_text: string;
  confidence: number;
}

export interface AnalysisStats {
  total: number;
  matched: number;
  not_found: number;
  avg_safety_score: number;
  total_known_risks: number;
}

export interface IngredientAnalysisResponse {
  method: string;
  analysis: string | null;
  matched: MatchedIngredient[];
  not_found: NotFoundIngredient[];
  stats: AnalysisStats;
  overall_safety_score: number | null;
  flags: string[];
  source_attribution: string[];
}
