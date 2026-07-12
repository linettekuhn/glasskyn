import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface TemplateContextType {
  selectedTemplateId: number | null;
  selectTemplate: (id: number) => void;
  clearSelection: () => void;
  pendingProductChanges: Map<number, number>;
  pendingOrderChanges: Map<number, number>;
  setPendingProduct: (stepId: number, productId: number) => void;
  setPendingOrder: (stepId: number, newOrder: number) => void;
  clearPendingChanges: () => void;
}

const TemplateContext = createContext<TemplateContextType | null>(null);

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [pendingProductChanges, setPendingProductChanges] = useState<Map<number, number>>(new Map());
  const [pendingOrderChanges, setPendingOrderChanges] = useState<Map<number, number>>(new Map());

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
