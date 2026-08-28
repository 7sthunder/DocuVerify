import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HistoryItem, Session } from "./types";

const KEYS = {
  serverUrl: "docuverify.serverUrl",
  session: "docuverify.session",
  history: "docuverify.history",
  pinned: "docuverify.pinnedServer",
};

let _serverUrl: string | null = null;
let _pinned = false;

export async function loadServerUrl(): Promise<string | null> {
  if (_serverUrl) return _serverUrl;
  try {
    const v = await AsyncStorage.getItem(KEYS.serverUrl);
    _serverUrl = v;
    return v;
  } catch {
    return _serverUrl;
  }
}

export function getServerUrlSync(): string {
  return _serverUrl ?? "";
}

export async function saveServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, "");
  _serverUrl = clean;
  try {
    await AsyncStorage.setItem(KEYS.serverUrl, clean);
  } catch {
    // in-memory value is still usable even if persistence fails
  }
}

export async function isPinnedServer(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEYS.pinned);
    _pinned = v === "1";
  } catch {
    return _pinned;
  }
  return _pinned;
}

export async function pinServer(): Promise<void> {
  _pinned = true;
  try {
    await AsyncStorage.setItem(KEYS.pinned, "1");
  } catch {
    // best effort
  }
}

export async function unpinServer(): Promise<void> {
  _pinned = false;
  try {
    await AsyncStorage.removeItem(KEYS.pinned);
  } catch {
    // best effort
  }
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.session);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session | null): Promise<void> {
  try {
    if (session) {
      await AsyncStorage.setItem(KEYS.session, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(KEYS.session);
    }
  } catch {
    // best effort
  }
}

export async function loadHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.history);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveHistory(items: HistoryItem[]): Promise<void> {
  try {
    const slim = items.map((item) => ({
      ...item,
      report: item.report && JSON.stringify(item.report).length <= 900_000 ? item.report : null,
    }));
    await AsyncStorage.setItem(KEYS.history, JSON.stringify(slim));
  } catch {
    // best effort
  }
}