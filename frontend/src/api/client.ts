import axios from "axios";
import { getToken } from "../storage/token";
import Toast from "react-native-toast-message";
import Constants from "expo-constants";
import { Platform } from "react-native";

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
});

// attach token to every request
apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// catches api errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = "Something went wrong";

    if (error.response) {
      const errorData = error?.response?.data?.detail;
      if (typeof errorData === "string") {
        // handle HTTPException errors
        message = errorData;
      } else if (Array.isArray(errorData)) {
        // handle Pydantic validation errors
        message = errorData[0]?.msg || message;
      }
    } else if (error.request) {
      // network error
      message = "Cannot connect to server";
    }

    Toast.show({
      type: "error",
      text1: "Error",
      text2: message,
      position: "top",
      visibilityTime: 4000,
    });

    // reject so screens can catch error
    return Promise.reject(error);
  },
);

export default apiClient;
