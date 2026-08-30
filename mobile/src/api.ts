import Constants from "expo-constants";
import * as Network from "expo-network";
import type { JobStatus, JobSummary, PickedFile } from "./types";
import { getServerUrlSync } from "./storage";

const DEV = __DEV__;

export interface SignInResponse {
  redirect?: boolean;
  token?: string;
  url?: string | null;
  user?: { id?: string; name?: string | null; email?: string | null };
}

/**
 * Best-effort default for the DocuVerify backend URL.
 *
 * When running under Expo Go the JS bundle is served from the dev machine, so
 * `Constants.expoConfig.hostUri` carries that machine's address (e.g.
 * "192.168.1.20:8081"). The backend on that same machine therefore lives at
 * http://<that-ip>:8000 — and that address IS reachable from the phone because
 * the phone is on the same Wi-Fi as the laptop.
 *
 * The only addresses we must refuse are:
 *   - loopback (localhost / 127.0.0.1) — on a physical device that is the
 *     *phone* itself, not the laptop, so it can never serve the backend;
 *   - the Docker/container private range (172.16.0.0–172.31.255.255) — that is
 *     a virtual adapter on the laptop that the phone cannot route to.
 *
 * When hostUri is one of those (e.g. Expo resolved the Docker vEthernet
 * adapter, or we are on the simulator with no LAN), we return "" and let
 * autoFindServer() scan the phone's own subnet instead of pinning an
 * unreachable address.
 */
export function detectDefaultServer(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (host && /^[\d.]+$/.test(host) && isLanReachableHost(host)) {
    return `http://${host}:8000`;
  }
  return "";
}

/** True for an IPv4 literal that a physical device can actually reach. */
function isLanReachableHost(host: string): boolean {
  if (isLoopback(host)) return false;
  if (isDockerNetworkURL(host)) return false;
  return true;
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Returns true when the given URL points into the Docker/container
 * private network range (172.16.0.0/12) that is unreachable from a
 * physical Android device on the same Wi-Fi.
 */
export function isDockerNetworkURL(url: string): boolean {
  // Accept a bare host ("172.19.24.139") as well as a full URL; normalize
  // before parsing so the missing-scheme path does not throw and silently
  // fall through to "not a docker URL".
  let candidate = url;
  if (!/^https?:\/\//i.test(candidate)) candidate = `http://${candidate}`;
  try {
    const u = new URL(candidate);
    const host = u.hostname;
    const octets = host.split(".");
    if (octets.length === 4) {
      const first = parseInt(octets[0], 10);
      const second = parseInt(octets[1], 10);
      if (first === 172 && second >= 16 && second <= 31) {
        return true;
      }
    }
  } catch {
    // not a valid host/URL
  }
  return false;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 20000,
  base?: string
): Promise<T> {
  const server = (base ?? getServerUrlSync()).replace(/\/+$/, "");
  if (!server) throw new Error("Server address is not configured.");
  const url = `${server}${path}`;
  if (DEV) console.log(`[DocuVerify] → ${init?.method ?? "GET"} ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    const message = timedOut
      ? "The server took too long to respond."
      : `Cannot reach the server at ${server}.`;
    if (DEV) {
      console.warn(
        `[DocuVerify] ✗ connection failed: ${url} — ${
          timedOut ? "timeout" : "unreachable (network/DNS/cleartext blocked)"
        }`
      );
    }
    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
  if (DEV) console.log(`[DocuVerify] ← ${res.status} ${url}`);
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = (await res.json()) as Record<string, unknown>;
      detail = typeof body?.detail === "string" ? (body.detail as string) : undefined;
    } catch {
      // ignore JSON parse failures; fall back to status line below
    }
    if (DEV && !detail) console.warn(`[DocuVerify] non-JSON error body for HTTP ${res.status} ${url}`);
    throw new Error(detail ?? `Request failed (HTTP ${res.status}).`);
  }
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch (e) {
    if (DEV) {
      console.warn(
        `[DocuVerify] ✗ response parse error: ${url} — ${
          e instanceof Error ? e.message : "invalid JSON"
        }`
      );
    }
    throw new Error("The server returned a response we could not read.");
  }
}

/**
 * Liveness probe. Returns true only when the backend answers /api/health with
 * ok:true, so a captive portal / stub response does not masquerade as the API.
 */
export async function probeServer(base: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await apiFetch<{ ok?: boolean }>("/api/health", {}, timeoutMs, base);
    return res?.ok === true;
  } catch {
    return false;
  }
}

/** Returns the device's own IPv4 (best-effort), cached for the session. */
let _deviceIp: Promise<string | null> | null = null;
function deviceIp(): Promise<string | null> {
  if (!_deviceIp) {
    _deviceIp = Network.getIpAddressAsync()
      .then((ip) => (typeof ip === "string" ? ip : null))
      .catch(() => null);
  }
  return _deviceIp;
}

/**
 * If the device has a private IPv4 (10.x, 192.168.x, 172.16–31.x, link-local),
 * returns "a.b.c" — the first three octets of its subnet — so we can probe
 * every host on that subnet for the backend. Returns null for public/unknown
 * addresses where a scan would be meaningless or abusive.
 */
function subnetBaseFromDeviceIp(ip: string | null): string | null {
  if (!ip) return null;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(ip);
  if (!m) return null;
  const a = +m[1];
  const b = +m[2];
  const c = +m[3];
  const privateRange =
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254);
  if (!privateRange) return null;
  return `${a}.${b}.${c}`;
}

/**
 * Preference score for a responding candidate. Higher is better.
 *   +50  it is the phone's own network gateway (most reliable hop)
 *   +30  it lives on the phone's own private subnet
 *  -50  loopback (localhost / 127.0.0.1) — the phone itself, never the laptop
 * -100  Docker/container private range (172.16–31) — reachable for small GETs
 *        but uploads from the phone routinely fail, so avoid it.
 * This lets us pick 192.168.137.1 over 172.19.24.139 even when both answer
 * /api/health, which is exactly the hotspot + Wi-Fi-adapter failure in the log.
 */
function rankCandidate(url: string, subnet: string | null, gateway: string | null): number {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return -1;
  }
  let score = 0;
  if (isDockerNetworkURL(host)) score -= 100;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") score -= 50;
  if (gateway && host === gateway) score += 50;
  if (subnet && host.startsWith(`${subnet}.`)) score += 30;
  return score;
}

export async function autoFindServers(): Promise<string[]> {
  const candidates = new Set<string>();
  const add = (u?: string | null) => {
    if (!u) return;
    const clean = u.replace(/\/+$/, "");
    if (clean) candidates.add(clean);
  };

  const ip = await deviceIp();
  const subnet = subnetBaseFromDeviceIp(ip);
  const gateway = ip ? `${ip.split(".").slice(0, 3).join(".")}.1` : null;

  // Highest priority: the phone's own network gateway — when the laptop shares
  // a hotspot this IS the laptop (192.168.137.1). Most reliable for uploads.
  if (gateway && !isDockerNetworkURL(gateway)) add(`http://${gateway}:8000`);
  // Explicit Windows "Mobile hotspot" gateway fallback.
  add("http://192.168.137.1:8000");
  // Expo bundle host — correct when phone + laptop share the same adapter.
  add(detectDefaultServer());
  // Emulator / localhost bridges.
  add("http://10.0.2.2:8000");
  add("http://localhost:8000");
  // Full subnet scan of the phone's own private network.
  const self = ip ? ip.replace(/\.\d+$/, "") : null;
  if (subnet) {
    // Skip the phone itself; 1500ms probe timeout keeps the full scan snappy.
    for (let o = 1; o <= 254; o++) {
      const host = `${subnet}.${o}`;
      if (self && host === self) continue;
      add(`http://${host}:8000`);
    }
  }

  const probes = [...candidates];
  if (DEV) {
    console.log(
      `[DocuVerify] autoFindServer: device=${ip ?? "unknown"} subnet=${subnet ?? "n/a"} gateway=${gateway ?? "n/a"} candidates=${probes.length}`
    );
  }
  const results = await Promise.all(
    probes.map(async (c) => {
      const ok = await probeServer(c, subnet ? 1500 : 4000);
      if (DEV && ok) console.log(`[DocuVerify] found server at ${c}`);
      return ok ? c : null;
    })
  );

  const responders = results.filter((r): r is string => !!r);

  responders.sort((a, b) => {
    const sa = rankCandidate(a, subnet, gateway);
    const sb = rankCandidate(b, subnet, gateway);
    if (sb !== sa) return sb - sa;
    return probes.indexOf(a) - probes.indexOf(b);
  });

  if (DEV) {
    console.log(
      `[DocuVerify] autoFindServers: responders ${responders.length ? responders.join(", ") : "(none)"}`
    );
  }
  return responders;
}

/**
 * Returns every backend that answered /api/health, best-first. Callers that
 * actually upload should iterate this list and try each one — a GET health
 * probe is NOT proof that a large multipart POST will succeed (e.g. the
 * 172.19.x Wi-Fi adapter answers GET but rejects phone uploads), so we must
 * be ready to fall through to the next candidate.
 */

/** Convenience wrapper: the single best candidate, or null. */
export async function autoFindServer(): Promise<string | null> {
  const list = await autoFindServers();
  return list[0] ?? null;
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

/**
 * Tries an upload against a list of candidate servers (best-first) and returns
 * the first one that succeeds. This is the key resilience fix: a GET /api/health
 * probe is NOT proof a multipart POST will succeed from the phone (the 172.19.x
 * Wi-Fi adapter answered GET but rejected uploads), so we must be willing to
 * fall through to the next reachable address. 4xx/5xx (validation/auth) errors
 * are real and surfaced immediately; only transport failures trigger a retry.
 */
export async function uploadToAny(
  file: PickedFile,
  template: PickedFile | null,
  bases: string[]
): Promise<{ job_id: string; base: string }> {
  if (bases.length === 0) {
    throw new Error("No DocuVerify server address is available.");
  }
  let lastErr: unknown;
  for (const base of bases) {
    try {
      const r = template
        ? await uploadCompare(file, template, base)
        : await uploadDocument(file, base);
      return { job_id: r.job_id, base };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      lastErr = e;
      // Transport failure → try the next candidate. A real API error (4xx/5xx)
      // is not recoverable by switching servers, so stop immediately.
      if (!/Cannot reach the server|took too long/i.test(msg)) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Upload failed on every candidate server.");
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

export async function listJobs(): Promise<JobSummary[]> {
  return apiFetch<JobSummary[]>("/api/jobs", {}, 15000);
}