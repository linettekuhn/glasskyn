import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

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

export interface VersionCheckResponse {
  current_version: string;
  minimum_version: string;
  store_url: string;
}

export async function checkAppVersion(): Promise<VersionCheckResponse> {
  const { data } = await axios.get<VersionCheckResponse>(
    `${getBaseUrl()}version-check`,
    { timeout: 5000 },
  );
  return data;
}
