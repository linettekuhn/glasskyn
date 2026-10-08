import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  deleteSkinSession,
  getSkinSessions,
} from "@/api/skin";
import {
  clearSkinPhotoCache,
  evictSkinPhotoUrl,
} from "@/api/skin-photo-urls";
import type { SkinConcernOut, SkinSessionOut } from "@/types";

interface SkinSessionsContextType {
  /** All skin sessions, newest first. Single source of truth. */
  sessions: SkinSessionOut[];
  /** True until the first load completes (avoids empty flash). */
  loading: boolean;
  /** True when the last refresh failed (previous sessions preserved). */
  error: boolean;
  /** Reload from the backend. Concurrent calls share one request. */
  refresh: () => Promise<void>;
  /**
   * Delete a session on the backend, drop it from state, and evict its
   * cached photo so no component can render it afterwards.
   */
  removeSession: (id: number) => Promise<void>;
  /**
   * Merge an updated concern (from patchConcernPosition) into the session
   * that created it, so every subscribed screen shows the new position
   * without a remount.
   */
  applyConcernPatch: (updated: SkinConcernOut) => void;
  /**
   * Call after a check-in is saved (the response carries no full session,
   * so this refreshes from the backend).
   */
  noteCheckInSaved: () => Promise<void>;
  /** Clear local state + photo cache (after a full backend wipe). */
  clearAll: () => void;
}

const SkinSessionsContext =
  createContext<SkinSessionsContextType | null>(null);

export function SkinSessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SkinSessionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const inflightRef = useRef<Promise<void> | null>(null);
  const loadedRef = useRef(false);
  // Mirror for mutation helpers that need current data outside setState.
  const sessionsRef = useRef<SkinSessionOut[]>([]);
  sessionsRef.current = sessions;

  const refresh = useCallback(() => {
    if (inflightRef.current) return inflightRef.current;
    if (!loadedRef.current) setLoading(true);
    const request = getSkinSessions()
      .then((data) => {
        setSessions(data);
        setError(false);
      })
      .catch(() => {
        // Preserve previous sessions; screens keep rendering stale data
        // rather than flashing empty on a transient failure.
        setError(true);
      })
      .finally(() => {
        loadedRef.current = true;
        setLoading(false);
        if (inflightRef.current === request) inflightRef.current = null;
      });
    inflightRef.current = request;
    return request;
  }, []);

  const removeSession = useCallback(async (id: number) => {
    const target = sessionsRef.current.find((s) => s.id === id);
    await deleteSkinSession(id);
    if (target?.image_url) evictSkinPhotoUrl(target.image_url);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const applyConcernPatch = useCallback((updated: SkinConcernOut) => {
    const createdId = updated.created_session_id;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== createdId) return s;
        return {
          ...s,
          concerns: (s.concerns ?? []).map((c) =>
            c.id === updated.id ? updated : c,
          ),
        };
      }),
    );
  }, []);

  const noteCheckInSaved = useCallback(() => refresh(), [refresh]);

  const clearAll = useCallback(() => {
    setSessions([]);
    setError(false);
    clearSkinPhotoCache();
  }, []);

  const value = useMemo(
    () => ({
      sessions,
      loading,
      error,
      refresh,
      removeSession,
      applyConcernPatch,
      noteCheckInSaved,
      clearAll,
    }),
    [
      sessions,
      loading,
      error,
      refresh,
      removeSession,
      applyConcernPatch,
      noteCheckInSaved,
      clearAll,
    ],
  );

  return (
    <SkinSessionsContext.Provider value={value}>
      {children}
    </SkinSessionsContext.Provider>
  );
}

export function useSkinSessions(): SkinSessionsContextType {
  const ctx = useContext(SkinSessionsContext);
  if (!ctx) {
    throw new Error(
      "useSkinSessions must be used within a SkinSessionsProvider",
    );
  }
  return ctx;
}
