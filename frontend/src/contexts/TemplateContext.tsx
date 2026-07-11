import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface TemplateContextType {
  selectedTemplateId: number | null;
  selectTemplate: (id: number) => void;
  clearSelection: () => void;
}

const TemplateContext = createContext<TemplateContextType | null>(null);

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const selectTemplate = useCallback((id: number) => {
    setSelectedTemplateId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTemplateId(null);
  }, []);

  return (
    <TemplateContext.Provider
      value={{ selectedTemplateId, selectTemplate, clearSelection }}
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
