import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "./AuthContext";

interface ChatSessionContextType {
  sessionId: string;
  resetSession: () => Promise<void>;
}

const SESSION_KEY_PREFIX = "chatSession_";

const ChatSessionContext = createContext<ChatSessionContextType | undefined>(
  undefined,
);

function sessionKey(userId: number): string {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

async function loadOrCreateSession(userId: number): Promise<string> {
  const key = sessionKey(userId);
  const stored = await SecureStore.getItemAsync(key);
  if (stored) return stored;
  const fresh = Crypto.randomUUID();
  await SecureStore.setItemAsync(key, fresh);
  return fresh;
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    if (!user) {
      setSessionId("");
      return;
    }
    let cancelled = false;
    loadOrCreateSession(user.id).then((id) => {
      if (!cancelled) setSessionId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const resetSession = useCallback(async () => {
    if (!user) return;
    const fresh = Crypto.randomUUID();
    await SecureStore.setItemAsync(sessionKey(user.id), fresh);
    setSessionId(fresh);
  }, [user]);

  return (
    <ChatSessionContext.Provider value={{ sessionId, resetSession }}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  const context = useContext(ChatSessionContext);
  if (!context) {
    throw new Error("useChatSession must be used within a ChatSessionProvider");
  }
  return context;
}
