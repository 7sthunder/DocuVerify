import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { HistoryItem, Session } from "./types";
import {
  isPinnedServer,
  loadHistory,
  loadServerUrl,
  loadSession,
  pinServer,
  saveHistory,
  saveServerUrl,
  saveSession,
  unpinServer,
} from "./storage";
import { signIn as apiSignIn, signOut as apiSignOut, autoFindServer, probeServer, detectDefaultServer, isDockerNetworkURL } from "./api";

interface AppContextValue {
  booted: boolean;
  serverUrl: string;
  setServerUrl: (url: string, opts?: { pin?: boolean }) => Promise<void>;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  history: HistoryItem[];
  addHistory: (item: HistoryItem) => Promise<void>;
  upsertHistory: (item: HistoryItem) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [serverUrl, setServerUrlState] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyRef = useRef<HistoryItem[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [rawUrl, sess, hist] = await Promise.all([
        loadServerUrl(),
        loadSession(),
        loadHistory(),
      ]);
      let url: string | null = rawUrl;

      // Self-heal: a previously saved server address may be stale.
      //  - A Docker/container private IP (172.16.0.0/12) is unreachable from a
      //    physical device, so we always discard it and re-discover.
      //  - Any other non-pinned address that no longer answers /api/health is
      //    replaced by the first candidate that does.
      //  - With no saved address at all we attempt discovery once at boot.
      let effectiveUrl = url;
      if (url && isDockerNetworkURL(url)) {
        await unpinServer();
        await saveServerUrl("");
        effectiveUrl = "";
        url = "";
      }
      if (effectiveUrl) {
        const pinned = await isPinnedServer();
        if (!pinned) {
          const ok = await probeServer(url as string);
          if (!ok) {
            const found = await autoFindServer();
            if (found) {
              await saveServerUrl(found);
              effectiveUrl = found;
            }
          }
        }
      } else {
        const found = await autoFindServer();
        if (found) {
          await saveServerUrl(found);
          effectiveUrl = found;
        }
      }

      if (!active) return;
      if (effectiveUrl) setServerUrlState(effectiveUrl);
      if (sess) setSession(sess);
      setHistory(hist);
      historyRef.current = hist;
      setBooted(true);
    })();
    return () => {
      active = false;
    };
  }, []);

const setServerUrl = useCallback(async (url: string, opts?: { pin?: boolean }) => {
  await saveServerUrl(url);
  if (opts?.pin) await pinServer();
  setServerUrlState(url);
}, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiSignIn(email, password);
    const next: Session = {
      token: res.token ?? "",
      user: {
        id: res.user?.id,
        name: res.user?.name,
        email: res.user?.email,
      },
    };
    await saveSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    await apiSignOut();
    await saveSession(null);
    setSession(null);
  }, []);

  const addHistory = useCallback(async (item: HistoryItem) => {
    const next = [item, ...historyRef.current].slice(0, 50);
    historyRef.current = next;
    setHistory(next);
    await saveHistory(next);
  }, []);

  const upsertHistory = useCallback(async (item: HistoryItem) => {
    const rest = historyRef.current.filter((h) => h.jobId !== item.jobId);
    const next = [item, ...rest].slice(0, 50);
    historyRef.current = next;
    setHistory(next);
    await saveHistory(next);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      booted,
      serverUrl,
      setServerUrl,
      session,
      login,
      logout,
      history,
      addHistory,
      upsertHistory,
    }),
    [booted, serverUrl, setServerUrl, session, login, logout, history, addHistory, upsertHistory]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}