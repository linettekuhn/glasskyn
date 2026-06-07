import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getToken, setToken, removeToken } from "../storage/token";
import Toast from "react-native-toast-message";
import Constants from "expo-constants";
import { Platform } from "react-native";

interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

// TODO: change in prod to backend url
const getBaseUrl = () => {
  if (Platform.OS === "web") {
    return "http://localhost:8000/";
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:8000/`;
  }
  return "http://localhost:8000/";
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// attach token to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// refresh queue state
let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
};

// catches api errors and handles 401 refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register")
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${apiClient.defaults.baseURL}auth/refresh`,
          {},
          { withCredentials: true },
        );
        const { access_token } = response.data;
        await setToken(access_token);
        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await removeToken();
      } finally {
        isRefreshing = false;
      }
    }

    let message = "Something went wrong";

    if (error.response) {
      const data = error?.response?.data as { detail?: string | { msg: string }[] } | undefined;
      const errorDetail = data?.detail;
      if (typeof errorDetail === "string") {
        message = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        message = errorDetail[0]?.msg || message;
      }
    } else if (error.request) {
      message = "Cannot connect to server";
    }

    Toast.show({
      type: "error",
      text1: "Error",
      text2: message,
      position: "top",
      visibilityTime: 4000,
    });

    return Promise.reject(error);
  },
);

export default apiClient;
