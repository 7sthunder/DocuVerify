import Constants from "expo-constants";
import type { JobStatus, PickedFile } from "./types";
import { getServerUrlSync } from "./storage";

export interface SignInResponse {
  redirect?: boolean;
  token?: string;
  url?: string | null;
  user?: { id?: string; name?: string | null; email?: string | null };
}

/**
 * Best-effort default for the DocuVerify backend URL.
 * When running under Expo Go, hostUri points at the machine serving the
 * Metro bundle (e.g. "192.168.1.20:8081"), so the backend on that same
 * machine typically lives at http://<that-ip>:8000.
 */
export function detectDefaultServer(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1" && /^[\d.]+$/.test(host)) {
    return `http://${host}:8000`;
  }
  return "http://localhost:8000";
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 20000,
  base?: string
): Promise<T> {
  const server = (base ?? getServerUrlSync()).replace(/\/+$/, "");
  if (!server) throw new Error("Server address is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, { ...init, signal: controller.signal });
  } catch (e) {
    const message =
      e instanceof Error && e.name === "AbortError"
        ? "The server took too long to respond."
        : `Cannot reach the server at ${server}.`;
    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = (await res.json()) as Record<string, unknown>;
      detail = typeof body?.detail === "string" ? (body.detail as string) : undefined;
    } catch {
      // ignore JSON parse failures; fall back to status line below
    }
    throw new Error(detail ?? `Request failed (HTTP ${res.status}).`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function probeServer(base: string): Promise<boolean> {
  try {
    const res = await apiFetch<{ ok?: boolean }>("/api/health", {}, 4000, base);
    return res?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Probes the plausible DocuVerify backends in order and returns the first one
 * that actually answers /api/health from this phone:
 *   1. localhost — hits the laptop over the USB adb-reverse bridge when
 *      connected (stablest link; harmless fast-fail when absent)
 *   2. the machine serving the Expo bundle (auto-detected hostUri)
 *   3. the Windows hotspot host (192.168.137.1 — laptop sharing its internet)
 */
export async function autoFindServer(): Promise<string | null> {
  const candidates = [
    "http://localhost:8000",
    detectDefaultServer(),
    "http://192.168.137.1:8000",
  ];
  const seen = new Set<string>();
  for (const cand of candidates) {
    const clean = cand.replace(/\/+$/, "");
    if (seen.has(clean)) continue;
    seen.add(clean);
    if (await probeServer(clean)) return clean;
  }
  return null;
}

export async function signIn(email: string, password: string): Promise<SignInResponse> {
  const res = await apiFetch<SignInResponse>("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, 20000);
  if (!res.token) {
    throw new Error("Sign-in did not return a session token.");
  }
  return res;
}

export async function signOut(): Promise<void> {
  try {
    await apiFetch<void>("/api/auth/sign-out", { method: "POST" }, 8000);
  } catch {
    // signing out locally is still valid when the server is unreachable
  }
}

export async function checkHealth(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/health", {}, 8000);
}

/**
 * React Native cannot append a Blob built from a picked file the way a
 * browser can; its fetch implementation expects the "file part" shape
 * { uri, name, type } (cf. react-native FormData docs). Building it
 * explicitly keeps the multipart upload identical to the web app's.
 */
function toUploadPart(file: PickedFile): { uri: string; name: string; type: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const guessed =
    ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
  return { uri: file.uri, name: file.name, type: file.mimeType || guessed };
}

// RN's FormData accepts {uri, name, type} at runtime, but the bundled DOM
// typings only allow string | Blob, hence the cast.
function appendFile(fd: FormData, field: string, file: PickedFile) {
  (fd.append as (name: string, value: unknown) => void)(field, toUploadPart(file));
}

export async function uploadDocument(file: PickedFile, base?: string): Promise<{ job_id: string }> {
  const fd = new FormData();
  appendFile(fd, "file", file);
  return apiFetch<{ job_id: string }>("/api/documents", { method: "POST", body: fd }, 60000, base);
}

export async function uploadCompare(
  document: PickedFile,
  template: PickedFile,
  base?: string
): Promise<{ job_id: string }> {
  const fd = new FormData();
  appendFile(fd, "document", document);
  appendFile(fd, "template", template);
  return apiFetch<{ job_id: string }>("/api/compare", { method: "POST", body: fd }, 60000, base);
}

export async function getJob(jobId: string): Promise<JobStatus> {
  return apiFetch<JobStatus>(`/api/jobs/${jobId}`, {}, 15000);
}

export function pageImageUrl(jobId: string, image: string): string {
  const name = image.split("/").pop();
  return `${getServerUrlSync()}/api/jobs/${jobId}/pages/${name}`;
}

export async function pollJob(
  jobId: string,
  onTick?: (job: JobStatus) => void,
  isCancelled?: () => boolean,
  maxConsecutiveErrors = 3
): Promise<JobStatus> {
  let consecutiveErrors = 0;
  for (;;) {
    if (isCancelled?.()) throw new Error("Cancelled");
    let job: JobStatus;
    try {
      job = await getJob(jobId);
      consecutiveErrors = 0;
    } catch (e) {
      // A 404 means the backend process was restarted while the job was
      // running (its in-memory job store is gone). Retrying will never
      // succeed, so fail immediately with an actionable message.
      const msg = e instanceof Error ? e.message : "";
      if (/not found/i.test(msg)) {
        throw new Error(
          "The DocuVerify server was restarted while analyzing this document. Please analyze it again."
        );
      }
      consecutiveErrors += 1;
      if (consecutiveErrors >= maxConsecutiveErrors) {
        throw e instanceof Error ? e : new Error("Lost connection to the DocuVerify server.");
      }
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    onTick?.(job);
    if (job.status === "complete" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 1200));
  }
}