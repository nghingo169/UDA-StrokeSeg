// TODO(UDA-StrokeSeg): scaffold - implement per notes/repo_structure.md

/** GENERATED OpenAPI DTOs placeholder */
export type PlaceholderDto = Record<string, unknown>;

export interface ConsultationMemberDto {
  user_id: string;
  username: string;
  display_name: string;
  initials: string;
  role_in_session: 'Chair' | 'Member';
  presence: 'INVITED' | 'IN_LOBBY' | 'IN_ROOM' | 'LEFT';
  agreement_with_ai: string;
  agreement_note: string;
}

export interface ConsultationessionDto {
  id: string;
  study_id: string;
  status: string;
  trigger_reason: string;
  lead_chair_id: string;
  consensus_notes: string;
  members: ConsultationMemberDto[];
  zoom_meeting_number: string | null;
  zoom_mock: boolean;
}

export interface ZoomJoinPayloadDto {
  meeting_number: string;
  password: string;
  signature: string;
  sdk_key: string;
  user_name: string;
  user_email: string;
  role: number;
  mock: boolean;
}

