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

export interface Report {
  assessment: Assessment;
  findings: Finding[];
  pages: PageInfo[];
  reliability: Reliability;
}

export interface JobStatus {
  id: string;
  status: "queued" | "processing" | "complete" | "failed";
  filename: string;
  error: string | null;
  report: Report | null;
}