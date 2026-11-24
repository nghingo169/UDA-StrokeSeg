// TODO(UDA-StrokeSeg): scaffold - implement per notes/repo_structure.md

/** GENERATED from FastAPI OpenAPI / Pydantic - do not dual-edit.
 *  Run: make gen-types  (or pnpm gen:types)
 */
export enum CaseStatus {
  Received = 'Received',
  Processing = 'Processing',
  Failed = 'Failed',
  AwaitingReview = 'AwaitingReview',
  SignedOff = 'SignedOff',
}

export enum RoleName {
  Radiologist = 'Radiologist',
  Stroke_Physician = 'Stroke_Physician',
  Head_Of_Department = 'Head_Of_Department',
  IT_Administrator = 'IT_Administrator',
}

export enum TreatmentDecision {
  Thrombolysis = 'Thrombolysis',
  Thrombectomy = 'Thrombectomy',
  Conservative = 'Conservative',
}

export enum MaskType {
  AI_Prediction = 'AI_Prediction',
  Expert_GroundTruth = 'Expert_GroundTruth',
  Consensus_Mask = 'Consensus_Mask',
}

export enum Modality {
  DWI = 'DWI',
  ADC = 'ADC',
  FLAIR = 'FLAIR',
}

export enum ConsultationStatus {
  Draft = 'DRAFT',
  PendingAssignment = 'PENDING_ASSIGNMENT',
  Assigned = 'ASSIGNED',
  Scheduled = 'SCHEDULED',
  Waiting = 'WAITING',
  Live = 'LIVE',
  AwaitingConclusion = 'AWAITING_CONCLUSION',
  Completed = 'COMPLETED',
  Finalized = 'FINALIZED',
  Cancelled = 'CANCELLED',
  EndedWithoutConsensus = 'ENDED_WITHOUT_CONSENSUS',
}

export enum RoleInSession {
  Chair = 'Chair',
  Member = 'Member',
  Requester = 'Requester',
}
