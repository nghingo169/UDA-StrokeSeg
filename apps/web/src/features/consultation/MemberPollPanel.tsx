import type { AgreementWithAI, ConsultationMember } from "../../types/consultation.types";
import { ClinicalComposer } from "../shared/ClinicalComposer";

type Props = {
  members: ConsultationMember[];
  myAgreement: AgreementWithAI | "";
  myNote: string;
  disabled?: boolean;
  onAgreementChange: (value: AgreementWithAI) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  notify: (message: string) => void;
  draftKey: string;
};

const OPTIONS: { value: AgreementWithAI; label: string }[] = [
  { value: "Agree with AI mask", label: "Agree with draft mask" },
  { value: "Adjust mask", label: "Adjust mask" },
  { value: "Recommend thrombectomy", label: "Recommend thrombectomy" },
  { value: "Recommend thrombolysis", label: "Recommend thrombolysis" },
];

export function MemberPollPanel({
  members,
  myAgreement,
  myNote,
  disabled = false,
  onAgreementChange,
  onNoteChange,
  onSubmit,
  submitting = false,
  notify,
  draftKey,
}: Props) {
  const noteRequired = myAgreement === "Partial" || myAgreement === "Disagree" || myAgreement === "Adjust mask";
  const canSubmit =
    !disabled &&
    !!myAgreement &&
    (!noteRequired || myNote.trim().length > 0) &&
    !submitting;

  return (
    <div className="clinical-section member-poll-panel">
      <div className="section-title">
        <span>Panel poll</span>
        <em>Required</em>
      </div>
      <div className="disposition-options">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={myAgreement === option.value ? "active" : ""}
            disabled={disabled}
            onClick={() => onAgreementChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {myAgreement && (
        <div className="rejection-reason disposition-note">
          <ClinicalComposer
            label="Note on panel agreement"
            value={myNote}
            onChange={onNoteChange}
            disabled={disabled}
            notify={notify}
            draftKey={draftKey}
            syncStudyNote={false}
            placeholder="Brief clinical rationale for the selected position…"
            voiceText="Imaging and the clinical examination are concordant. I support the selected panel position."
          />
        </div>
      )}
      <button type="button" className="secondary-button" disabled={!canSubmit} onClick={onSubmit}>
        {submitting ? "Saving vote…" : "Submit vote"}
      </button>
      <ul className="poll-tally">
        {members.map((member) => (
          <li key={member.user_id}>
            <strong>{member.display_name}</strong>
            <span>{member.agreement_with_ai || "—"}</span>-
          </li>
        ))}
      </ul>
    </div>
  );
}
