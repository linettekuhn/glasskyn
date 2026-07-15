import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { StepType, Frequency } from "@/types";

export interface PendingAddStep {
  stepType: StepType;
  frequency: Frequency;
  timeOfDay: "AM" | "PM";
  productId: number | null;
}

interface TemplateContextType {
  selectedTemplateId: number | null;
  selectTemplate: (id: number) => void;
  clearSelection: () => void;
  pendingProductChanges: Map<number, number>;
  pendingOrderChanges: Map<number, number>;
  setPendingProduct: (stepId: number, productId: number) => void;
  setPendingOrder: (stepId: number, newOrder: number) => void;
  clearPendingChanges: () => void;
  pendingAddStep: PendingAddStep | null;
  setPendingAddStep: (data: PendingAddStep) => void;
  clearPendingAddStep: () => void;
}

const TemplateContext = createContext<TemplateContextType | null>(null);

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [pendingProductChanges, setPendingProductChanges] = useState<Map<number, number>>(new Map());
  const [pendingOrderChanges, setPendingOrderChanges] = useState<Map<number, number>>(new Map());
  const [pendingAddStep, setPendingAddStepState] = useState<PendingAddStep | null>(null);

  const selectTemplate = useCallback((id: number) => {
    setSelectedTemplateId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTemplateId(null);
  }, []);

  const setPendingProduct = useCallback((stepId: number, productId: number) => {
    setPendingProductChanges((prev) => {
      const next = new Map(prev);
      next.set(stepId, productId);
      return next;
    });
  }, []);

  const setPendingOrder = useCallback((stepId: number, newOrder: number) => {
    setPendingOrderChanges((prev) => {
      const next = new Map(prev);
      next.set(stepId, newOrder);
      return next;
    });
  }, []);

  const clearPendingChanges = useCallback(() => {
    setPendingProductChanges(new Map());
    setPendingOrderChanges(new Map());
  }, []);

  const setPendingAddStep = useCallback((data: PendingAddStep) => {
    setPendingAddStepState(data);
  }, []);

  const clearPendingAddStep = useCallback(() => {
    setPendingAddStepState(null);
  }, []);

  return (
    <TemplateContext.Provider
      value={{
        selectedTemplateId,
        selectTemplate,
        clearSelection,
        pendingProductChanges,
        pendingOrderChanges,
        setPendingProduct,
        setPendingOrder,
        clearPendingChanges,
        pendingAddStep,
        setPendingAddStep,
        clearPendingAddStep,
      }}
    >
      {children}
    </TemplateContext.Provider>
  );
}

export function useTemplateSelection() {
  const ctx = useContext(TemplateContext);
  if (!ctx) throw new Error("useTemplateSelection must be used within TemplateProvider");
  return ctx;
}
