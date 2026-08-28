import type { JobStatus } from "./types";

export async function uploadDocument(file: File): Promise<{ job_id: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/documents", { method: "POST", body: fd });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e?.detail ?? "Upload failed");
  }
  return r.json();
}

export async function uploadCompare(
  document: File,
  template: File
): Promise<{ job_id: string }> {
  const fd = new FormData();
  fd.append("document", document);
  fd.append("template", template);
  const r = await fetch("/api/compare", { method: "POST", body: fd });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e?.detail ?? "Compare failed");
  }
  return r.json();
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const r = await fetch(`/api/jobs/${jobId}`);
  if (!r.ok) throw new Error("Failed to load job");
  return r.json();
}

export function pageUrl(jobId: string, image: string): string {
  const name = image.split("/").pop();
  return `/api/jobs/${jobId}/pages/${name}`;
}

export async function pollJob(
  jobId: string,
  onTick?: (job: JobStatus) => void
): Promise<JobStatus> {
  for (;;) {
    const job = await getJob(jobId);
    onTick?.(job);
    if (job.status === "complete" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 1000));
  }
}