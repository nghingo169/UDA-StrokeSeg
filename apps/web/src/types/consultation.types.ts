export type ConsultationStatus =
  | "DRAFT"
  | "PENDING_ASSIGNMENT"
  | "ASSIGNED"
  | "SCHEDULED"
  | "WAITING"
  | "LIVE"
  | "AWAITING_CONCLUSION"
  | "COMPLETED"
  | "FINALIZED"
  | "CANCELLED"
  | "ENDED_WITHOUT_CONSENSUS";

export type LifecyclePhase = "initialization" | "assignment" | "active" | "closure";
export type RoleInSession = "Chair" | "Member" | "Requester";
export type MemberPresence = "INVITED" | "IN_LOBBY" | "IN_ROOM" | "LEFT";
export type AgreementWithAI =
  | "Agree"
  | "Partial"
  | "Disagree"
  | "Agree with AI mask"
  | "Adjust mask"
  | "Recommend thrombectomy"
  | "Recommend thrombolysis"
  | "";
export type ClinicalRole = "radiologist" | "physician" | "hod" | "it";

export const DEMO_ACTORS: Record<
  ClinicalRole,
  { id: string; username: string; employeeId: string }
> = {
  radiologist: { id: "u-rad-011", username: "lena.morgan", employeeId: "RAD-011" },
  physician: { id: "u-phy-024", username: "maya.harris", employeeId: "PHY-024" },
  hod: { id: "u-hod-003", username: "thomas.nguyen", employeeId: "HOD-003" },
  it: { id: "u-it-008", username: "alex.nguyen", employeeId: "IT-008" },
};

export interface ConsultationViewport {
  slice: number;
  zoom: number;
  pan_x: number;
  pan_y: number;
}

export interface ConsultationMember {
  user_id: string;
  username: string;
  display_name: string;
  employee_id?: string;
  initials: string;
  role_in_session: RoleInSession;
  presence: MemberPresence;
  joined_at: string | null;
  agreement_with_ai: AgreementWithAI;
  agreement_note: string;
  comments: string;
  individual_mask_id: string | null;
}

export interface DiscussionMessage {
  id: string;
  author: string;
  username: string;
  role_in_session: string;
  employee_id?: string;
  text: string;
  sent_at: string;
}

export interface Consultationession {
  id: string;
  study_id: string;
  status: ConsultationStatus;
  lifecycle_phase?: LifecyclePhase;
  trigger_reason: string;
  requested_by_id?: string | null;
  lead_chair_id: string;
  conclusion?: string;
  digital_signature?: string | null;
  signed_by?: string | null;
  signed_at?: string | null;
  consensus_notes: string;
  consensus_mask_id: string | null;
  members: ConsultationMember[];
  agreements: Record<string, { agreement: string; note: string }>;
  attendance?: Array<{
    username: string;
    employee_id: string;
    display_name: string;
    zoom_role: string;
    joined_at: string;
  }>;
  discussion?: DiscussionMessage[];
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
  zoom_meeting_number: string | null;
  zoom_join_url: string | null;
  viewport: ConsultationViewport;
}

export interface ZoomJoinPayload {
  meeting_number: string;
  password: string;
  signature: string;
  sdk_key: string;
  sdk_lib_version?: string;
  user_name: string;
  user_email: string;
  staff_id: string;
  role: number;
  zak: string | null;
}

export interface DirectoryUser {
  id: string;
  username: string;
  display_name: string;
  employee_id: string;
  role: string;
  initials: string;
}

export const CLOSED_CONSULTATION_STATUSES: ConsultationStatus[] = [
  "FINALIZED",
  "COMPLETED",
  "CANCELLED",
  "ENDED_WITHOUT_CONSENSUS",
];

export const ON_DUTY_SHIFT = [
  { id: "u-rad-011", display_name: "Dr. Lena Morgan", employee_id: "RAD-011", initials: "LA", shift: "07:00–15:00" },
  { id: "u-rad-014", display_name: "Dr. Priya Shah", employee_id: "RAD-014", initials: "PS", shift: "07:00–15:00" },
  { id: "u-phy-024", display_name: "Dr. Maya Harris", employee_id: "PHY-024", initials: "MH", shift: "07:00–15:00" },
  { id: "u-hod-003", display_name: "Dr. Thomas Nguyen", employee_id: "HOD-003", initials: "TN", shift: "07:00–15:00" },
] as const;

export function formatMeetingNumber(value: string | null | undefined): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value || "-";
}

export function displayTriggerReason(reason: string): string {
  const known: Record<string, string> = {
    "Mismatch lâm sàng - hình ảnh không tương thích, nguy cơ xuất huyết cao":
      "Clinical–imaging mismatch, high hemorrhagic transformation risk",
  };
  if (known[reason]) return known[reason];
  if (!reason.trim() || reason.trim().toLowerCase() === "xxss") {
    return "Clinical–imaging mismatch requiring panel review";
  }
  return reason;
}

export function ConsultationStatusLabel(status: ConsultationStatus | string): string {
  switch (status) {
    case "PENDING_ASSIGNMENT":
      return "Awaiting chairman";
    case "ASSIGNED":
      return "Chairman assigned";
    case "SCHEDULED":
      return "Scheduled";
    case "WAITING":
      return "In lobby";
    case "LIVE":
      return "Live";
    case "AWAITING_CONCLUSION":
      return "Awaiting conclusion";
    case "COMPLETED":
    case "FINALIZED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}
