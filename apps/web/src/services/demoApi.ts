/** Thin client for the in-memory lecturer demo API (apps/server). */

export type DemoRole = "radiologist" | "physician" | "hod" | "it";

const ROLE_USER: Record<DemoRole, string> = {
  radiologist: "lena.morgan",
  physician: "maya.harris",
  hod: "thomas.nguyen",
  it: "alex.nguyen",
};

let accessToken: string | null = null;
let apiReachable = false;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function getDemoToken() {
  return accessToken;
}

export function isDemoApiReachable() {
  return apiReachable;
}

export async function loginApi(username: string, password: string, role?: DemoRole) {
  const data = await request<{ access_token: string; role: DemoRole }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password, role }),
    },
    false,
  );
  accessToken = data.access_token;
  apiReachable = true;
  return data;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (auth && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}/api/v1${normalizedPath}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text();
    let message = detail || `API ${response.status}`;
    try {
      const parsed = JSON.parse(detail) as { detail?: unknown };
      if (typeof parsed.detail === "string") message = parsed.detail;
    } catch {
      /* keep raw body */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function pingDemoApi(): Promise<boolean> {
  try {
    const health = await request<{ status: string }>(
      "/operations/health",
      { method: "GET" },
      false,
    );
    apiReachable = health?.status === "ok";
  } catch {
    apiReachable = false;
  }
  return apiReachable;
}

export async function loginDemoApi(role: DemoRole, password = "Pass@123") {
  return loginApi(ROLE_USER[role], password, role);
}

export async function ensureDemoSession(role: DemoRole) {
  const up = await pingDemoApi();
  if (!up) return false;
  if (accessToken) return true;
  try {
    await loginDemoApi(role);
    return true;
  } catch {
    return false;
  }
}

export async function saveClinicalNote(studyId: string, note: string, source: string) {
  if (!accessToken) return null;
  return request(`/studies/${studyId}/notes`, {
    method: "PUT",
    body: JSON.stringify({ note, source }),
  });
}

export async function saveDisposition(studyId: string, disposition: string, note: string) {
  if (!accessToken) return null;
  return request(`/studies/${studyId}/disposition`, {
    method: "PUT",
    body: JSON.stringify({ disposition, note }),
  });
}

export async function signOffStudy(payload: {
  studyId: string;
  clinicalNote: string;
  disposition: string;
  dispositionNote: string;
  perceivedQuality: string;
  clinicalUtility: number;
  password?: string;
}) {
  if (!accessToken) return null;
  return request(`/sign-offs/${payload.studyId}`, {
    method: "POST",
    body: JSON.stringify({
      password: payload.password || "Pass@123",
      clinical_note: payload.clinicalNote,
      disposition: payload.disposition,
      disposition_note: payload.dispositionNote,
      perceived_quality: payload.perceivedQuality,
      clinical_utility: payload.clinicalUtility,
      attest: true,
    }),
  });
}

export async function savePhysicianFeedback(studyId: string, note: string, treatment?: string) {
  if (!accessToken) return null;
  return request(`/feedback/${studyId}/clinical`, {
    method: "POST",
    body: JSON.stringify({ note, treatment }),
  });
}

export async function suspendInference(reason: string, resume = false) {
  if (!accessToken) return null;
  return request("/operations/suspension", {
    method: "POST",
    body: JSON.stringify({ reason, resume }),
  });
}

export async function reassignFallback(studyId: string, assignee: string) {
  if (!accessToken) return null;
  return request("/governance/reassign", {
    method: "POST",
    body: JSON.stringify({ study_id: studyId, assignee }),
  });
}

export async function fetchOversight(params?: {
  time_range?: string;
  progress?: string;
  doctor?: string;
}) {
  if (!accessToken) return null;
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return request(`/governance/overview${query ? `?${query}` : ""}`);
}

export async function resetDemoStore() {
  return request("/demo/reset", { method: "POST" }, false);
}

export async function listStudies<T = unknown>() {
  return request<T[]>("/studies", { method: "GET" }, false);
}

export async function listSignedStudies<T = unknown>() {
  return request<T[]>("/studies/signed", { method: "GET" }, false);
}

export async function listConsultation<T = unknown>() {
  if (!accessToken) return [] as T[];
  return request<T[]>("consultation");
}

export async function getConsultation<T = unknown>(consultationId: string) {
  if (!accessToken) return null;
  return request<T>(`consultation/${consultationId}`);
}

export async function createConsultation(payload: {
  study_id: string;
  trigger_reason: string;
}) {
  if (!accessToken) return null;
  return request("consultation", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listDirectoryUsers<T = unknown>() {
  if (!accessToken) return [] as T[];
  return request<T[]>("/users");
}

export async function assignConsultation(
  consultationId: string,
  payload: { chairman_user_id: string; participant_user_ids: string[] },
) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function inviteConsultationMember(consultationId: string, userId: string) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/invite`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function postConsultationNote(consultationId: string, text: string) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/discussion`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function enterConsultationLobby(consultationId: string) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/lobby`, { method: "POST" });
}

export async function startConsultation(consultationId: string) {
  if (!accessToken) return null;
  return request<{ session: unknown; zoom: unknown }>(
    `consultation/${consultationId}/start`,
    { method: "POST" },
  );
}

export async function joinConsultation(consultationId: string) {
  if (!accessToken) return null;
  return request<{ session: unknown; zoom: unknown; waiting?: boolean }>(
    `consultation/${consultationId}/join`,
    { method: "POST" },
  );
}

export async function leaveConsultation(consultationId: string) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/leave`, { method: "POST" });
}

export async function endConsultation(consultationId: string) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/end`, { method: "POST" });
}

export async function saveConsultationAgreement(
  consultationId: string,
  agreement: string,
  note = "",
) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/agreement`, {
    method: "POST",
    body: JSON.stringify({ agreement, note }),
  });
}

export async function submitConsultationConclusion(
  consultationId: string,
  payload: {
    conclusion: string;
    agreement?: string;
    agreement_note?: string;
    step_up_password?: string;
  },
) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/conclusion`, {
    method: "POST",
    body: JSON.stringify({
      conclusion: payload.conclusion,
      agreement: payload.agreement || "Agree",
      agreement_note: payload.agreement_note || "",
      step_up_password: payload.step_up_password || "Pass@123",
    }),
  });
}

export async function finalizeConsultationConsensus(
  consultationId: string,
  payload: {
    notes: string;
    agreement: string;
    agreement_note?: string;
    step_up_password?: string;
  },
) {
  if (!accessToken) return null;
  return request(`consultation/${consultationId}/consensus`, {
    method: "POST",
    body: JSON.stringify({
      notes: payload.notes,
      agreement: payload.agreement,
      agreement_note: payload.agreement_note || "",
      step_up_password: payload.step_up_password || "Pass@123",
    }),
  });
}
