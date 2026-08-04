import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { User } from "../types";
import {
  getRefreshToken,
  setRefreshToken,
  getToken as getStoredToken,
  setToken as saveToken,
  removeToken,
  removeRefreshToken,
} from "../storage/token";
import * as auth from "../api/auth";
import {
  registerPushNotificationsWithBackend,
  unregisterPushNotificationsFromBackend,
} from "../services/notifications";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedRefresh = await getRefreshToken();
      if (storedRefresh) {
        try {
          const data = await auth.refresh(storedRefresh);
          await saveToken(data.access_token);
          await setRefreshToken(data.refresh_token);
          setToken(data.access_token);
          setUser(data.user);
        } catch {
          await removeToken();
          await removeRefreshToken();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    if (token) {
      registerPushNotificationsWithBackend();
    }
  }, [token]);

  const performLogin = async (email: string, password: string) => {
    const data = await auth.login(email, password);
    await saveToken(data.access_token);
    await setRefreshToken(data.refresh_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await performLogin(email, password);
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      await auth.register(name, email, password);
      await performLogin(email, password);
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const storedRefresh = await getRefreshToken();
      if (storedRefresh) {
        await auth.logout(storedRefresh);
      }
    } catch {
      // still clear local state even if server call fails
    }
    await unregisterPushNotificationsFromBackend();
    await removeToken();
    await removeRefreshToken();
    setUser(null);
    setToken(null);
  };

  const updateUser = (updated: User) => {
    setUser(updated);
  };

  const deleteAccount = async () => {
    await auth.deleteAccount();
    await unregisterPushNotificationsFromBackend();
    await removeToken();
    await removeRefreshToken();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
