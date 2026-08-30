export interface Region {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Finding {
  id: string;
  category: string;
  module: string;
  severity: "low" | "medium" | "high";
  score: number;
  confidence: number;
  region: Region | null;
  evidence: string[];
  explanation: string;
  fields: Record<string, unknown>;
}

export interface CategoryStatus {
  category: string;
  label: string;
  available: boolean;
  max_severity: "low" | "medium" | "high" | null;
  score: number;
  findings_count: number;
}

export interface Assessment {
  suspicion_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  categories: CategoryStatus[];
  disclaimer: string;
}

export interface PageInfo {
  index: number;
  width: number;
  height: number;
  image: string;
}

export interface Reliability {
  text_layer_available: boolean;
  ocr_mean_conf: number | null;
  ocr_computed: boolean;
}

export interface LlmInfo {
  enabled: boolean;
  summary: string | null;
  error: string | null;
  finding_count: number;
}

export interface ReferenceInfo {
  enabled: boolean;
  template: string | null;
  finding_count: number;
}

export interface Report {
  assessment: Assessment;
  findings: Finding[];
  pages: PageInfo[];
  reliability: Reliability;
  llm: LlmInfo;
  reference?: ReferenceInfo;
}

export interface JobStatus {
  id: string;
  status: "queued" | "processing" | "complete" | "failed";
  filename: string;
  error: string | null;
  report: Report | null;
}

export interface AuthUser {
  id?: string;
  name?: string | null;
  email?: string | null;
}

export interface Session {
  token: string;
  user: AuthUser;
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

export interface HistoryItem {
  jobId: string;
  filename: string;
  createdAt: number;
  score: number | null;
  risk: string | null;
  template: string | null;
  status: "complete" | "failed";
  error: string | null;
  report: Report | null;
}

export interface JobSummary {
  id: string;
  filename: string;
  created: number;
  status: "completed";
  score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
}

export type TabKey = "home" | "verify" | "history" | "reports" | "templates";