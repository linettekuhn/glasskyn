import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { ProcessMultiResult, ScanStep, IngredientAnalysisResponse } from "../types";

interface ScanContextType {
  step: ScanStep;
  frontImageUri: string | null;
  backImageUri: string | null;
  frontFileKey: string | null;
  backFileKey: string | null;
  barcode: string | null;
  scanResult: ProcessMultiResult | null;
  paoMonths: number | null;
  ingredientAnalysis: IngredientAnalysisResponse | null;
  analyzingIngredients: boolean;
  setStep: (v: ScanStep) => void;
  setFrontImageUri: (v: string | null) => void;
  setBackImageUri: (v: string | null) => void;
  setFrontFileKey: (v: string | null) => void;
  setBackFileKey: (v: string | null) => void;
  setBarcode: (v: string | null) => void;
  setScanResult: (v: ProcessMultiResult | null) => void;
  setPaoMonths: (v: number | null) => void;
  setIngredientAnalysis: (v: IngredientAnalysisResponse | null) => void;
  setAnalyzingIngredients: (v: boolean) => void;
  reset: () => void;
}

const ScanContext = createContext<ScanContextType | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<ScanStep>("front");
  const [frontImageUri, setFrontImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);
  const [frontFileKey, setFrontFileKey] = useState<string | null>(null);
  const [backFileKey, setBackFileKey] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ProcessMultiResult | null>(null);
  const [paoMonths, setPaoMonths] = useState<number | null>(null);
  const [ingredientAnalysis, setIngredientAnalysis] = useState<IngredientAnalysisResponse | null>(null);
  const [analyzingIngredients, setAnalyzingIngredients] = useState(false);

  const reset = useCallback(() => {
    setStep("front");
    setFrontImageUri(null);
    setBackImageUri(null);
    setFrontFileKey(null);
    setBackFileKey(null);
    setBarcode(null);
    setScanResult(null);
    setPaoMonths(null);
    setIngredientAnalysis(null);
    setAnalyzingIngredients(false);
  }, []);

  return (
    <ScanContext.Provider
      value={{
        step,
        frontImageUri,
        backImageUri,
        frontFileKey,
        backFileKey,
        barcode,
        scanResult,
        paoMonths,
        ingredientAnalysis,
        analyzingIngredients,
        setStep,
        setFrontImageUri,
        setBackImageUri,
        setFrontFileKey,
        setBackFileKey,
        setBarcode,
        setScanResult,
        setPaoMonths,
        setIngredientAnalysis,
        setAnalyzingIngredients,
        reset,
      }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScanContext(): ScanContextType {
  const ctx = useContext(ScanContext);
  if (!ctx) {
    throw new Error("useScanContext must be used within a ScanProvider");
  }
  return ctx;
}
