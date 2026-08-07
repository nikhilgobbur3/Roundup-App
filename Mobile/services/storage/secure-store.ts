import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "../../types";

const TOKEN_KEY = "session_token";
const USER_KEY = "session_user";

const isWeb = Platform.OS === "web";

export async function saveToken(token: string) {
  if (isWeb) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  if (isWeb) {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function saveUser(user: User) {
  const json = JSON.stringify(user);
  if (isWeb) {
    await AsyncStorage.setItem(USER_KEY, json);
  } else {
    await SecureStore.setItemAsync(USER_KEY, json);
  }
}

export async function getUser(): Promise<User | null> {
  const json = isWeb
    ? await AsyncStorage.getItem(USER_KEY)
    : await SecureStore.getItemAsync(USER_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json) as User;
  } catch {
    return null;
  }
}

export async function clearUser() {
  if (isWeb) {
    await AsyncStorage.removeItem(USER_KEY);
  } else {
    await SecureStore.deleteItemAsync(USER_KEY);
  }
}
