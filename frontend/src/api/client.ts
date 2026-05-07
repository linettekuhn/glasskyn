import axios from "axios";
import { getToken } from "../storage/token";
import Toast from "react-native-toast-message";

const apiClient = axios.create({
  baseURL: "http://localhost:8000/",
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
    const errorData = error?.response?.data?.detail;
    let message = "Something went wrong";

    if (typeof errorData === "string") {
      // handle HTTPException errors
      message = errorData;
    } else {
      // handle Pydantic validation errors
      message = errorData[0]?.msg || message;
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
