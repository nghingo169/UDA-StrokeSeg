import { useEffect, useMemo, useState } from "react";
import type { ClinicalRole, Consultationession, DirectoryUser } from "../../types/consultation.types";
import {
  CLOSED_CONSULTATION_STATUSES,
  DEMO_ACTORS,
  ON_DUTY_SHIFT,
  displayTriggerReason,
  sameClinician,
} from "../../types/consultation.types";
import {
  assignConsultation,
  createConsultation,
  enterConsultationLobby,
  listConsultation,
  listDirectoryUsers,
  listSignedStudies,
  listStudies,
} from "../../services/demoApi";
import { ClinicalComposer } from "../shared/ClinicalComposer";

type Props = {
  role: ClinicalRole;
  onOpenSession: (consultationId: string) => void;
  notify?: (message: string) => void;
  defaultStudyId?: string;
  /** Standing Chairman: may open an emergency room for a Critical study without HoD assignment. */
  canStartEmergency?: boolean;
};

type StudyOption = {
  id: string;
  patient?: string;
  volume?: number;
  territory?: string;
  side?: string;
  status?: string;
};

type SessionFilter = "all" | "needs" | "live" | "closed";

const QUICK_REASONS = [
  "Clinical–imaging mismatch",
  "Hemorrhagic transformation risk",
  "Borderline thrombectomy window",
];

function studyLabel(study: StudyOption) {
  const volume = typeof study.volume === "number" ? `${study.volume} mL` : "";
  const side = study.side?.startsWith("Left") ? "Left" : study.side?.startsWith("Right") ? "Right" : "";
  const territory =
    study.territory && study.territory !== "-"
      ? side
        ? `${side} ${study.territory}`
        : study.territory
      : study.volume === 0
        ? "No territory detected"
        : "";
  const detail = [volume, territory].filter(Boolean).join(", ");
  const identity = [study.patient?.trim(), detail ? `(${detail})` : ""].filter(Boolean).join(" ");
  return [study.id, identity].filter(Boolean).join(" — ");
}

function isClosed(status: Consultationession["status"]) {
  return CLOSED_CONSULTATION_STATUSES.includes(status);
}

function sessionBucket(status: Consultationession["status"]): SessionFilter {
  if (status === "PENDING_ASSIGNMENT") return "needs";
  if (isClosed(status)) return "closed";
  return "live";
}

export function ConsultationLobby({
  role,
  onOpenSession,
  notify,
  defaultStudyId = "AIS-240913-058",
  canStartEmergency = false,
}: Props) {
  const [sessions, setSessions] = useState<Consultationession[]>([]);
  const [doctors, setDoctors] = useState<DirectoryUser[]>([]);
  const [studies, setStudies] = useState<StudyOption[]>([]);
  const [studyId, setStudyId] = useState(defaultStudyId);
  const [urgency, setUrgency] = useState("Critical");
  const [reasons, setReasons] = useState<string[]>(["Clinical–imaging mismatch"]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [chairmanId, setChairmanId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [emergencyStudyId, setEmergencyStudyId] = useState("");
  const [emergencyConfirm, setEmergencyConfirm] = useState(false);

  const actor = DEMO_ACTORS[role];
  // Only radiologists request rooms (UC-13). Physicians join; the Head of Department assigns.
  const canCreate = role === "radiologist";
  const canAssign = role === "hod";

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listConsultation<Consultationession>();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
      notify?.("Could not load Consultation - is the demo API running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    void Promise.all([listStudies<StudyOption>(), listSignedStudies<StudyOption>()])
      .then(([active, signed]) => {
        const merged = new Map<string, StudyOption>();
        for (const study of [...(active || []), ...(signed || [])]) {
          if (study?.id) merged.set(study.id, study);
        }
        const rows = [...merged.values()];
        if (rows.length) setStudies(rows);
      })
      .catch(() => {
        setStudies([
          {
            id: "AIS-240913-084",
            patient: "BN-7A42",
            volume: 18.6,
            territory: "MCA",
            side: "Left hemisphere",
            status: "Critical",
          },
          {
            id: "AIS-240913-058",
            patient: "BN-5B22",
            volume: 6.8,
            territory: "PCA",
            side: "Right hemisphere",
          },
          {
            id: "AIS-240913-041",
            patient: "BN-9C04",
            volume: 2.1,
            territory: "ACA",
            side: "Left hemisphere",
          },
        ]);
      });
  }, []);

  useEffect(() => {
    if (!canAssign) return;
    void listDirectoryUsers<DirectoryUser>()
      .then((rows) => setDoctors((rows || []).filter((user) => user.role !== "it")))
      .catch(() => setDoctors([]));
  }, [canAssign]);

  const visible = useMemo(
    () => sessions.filter((session) => filter === "all" || sessionBucket(session.status) === filter),
    [sessions, filter],
  );

  const hasReason = reasons.length > 0 || note.trim().length > 0;
  const selectedStudy = studies.find((study) => study.id === studyId);
  const selectedStudyLabel = selectedStudy ? studyLabel(selectedStudy) : undefined;
  const triggerReason = [urgency, ...reasons, note.trim()].filter(Boolean).join(". ");
  const criticalStudies = studies.filter((study) => study.status === "Critical");
  const emergencyId = emergencyStudyId || criticalStudies[0]?.id || "";

  const openSession = async (session: Consultationession) => {
    if (!isClosed(session.status) && session.status !== "PENDING_ASSIGNMENT") {
      try {
        await enterConsultationLobby(session.id);
      } catch {
        /* viewer may be read-only */
      }
    }
    onOpenSession(session.id);
  };

  const startEmergencyRoom = async () => {
    if (!emergencyId) return;
    setBusy(true);
    let createdId = "";
    try {
      const created = (await createConsultation({
        study_id: emergencyId,
        trigger_reason: "Critical. Emergency room opened by the Chairman",
      })) as Consultationession | null;
      if (!created) throw new Error("API offline");
      createdId = created.id;
      const ready = (await assignConsultation(created.id, {
        chairman_user_id: actor.id,
        participant_user_ids: ON_DUTY_SHIFT.map((doctor) => doctor.id).filter((id) => id !== actor.id),
      })) as Consultationession | null;
      if (!ready) throw new Error("API offline");
      notify?.(`${ready.id} opened. On-duty doctors invited.`);
      setEmergencyConfirm(false);
      onOpenSession(ready.id);
    } catch (err) {
      notify?.(
        createdId
          ? `${createdId} was created but you could not be set as Chairman. The Head of Department must assign it.`
          : err instanceof Error
            ? err.message
            : "Could not open the emergency room",
      );
      setEmergencyConfirm(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const intro =
    role === "radiologist"
      ? "Request a multidisciplinary stroke panel. The Head of Department assigns a Chairman and invites on-duty specialists."
      : role === "hod"
        ? "Assign a Chairman and invite on-duty doctors for requested rooms."
        : "Join the Consultation you are invited to. Radiologists request rooms and the Head of Department assigns the Chairman.";

  return (
    <div className="consultation-lobby sketch-rooms">
      <div className="sketch-top">
        <div>
          <h1>Consultation rooms</h1>
          <span className="sketch-muted">{intro}</span>
        </div>
      </div>

      {canStartEmergency && (
        <section className="panel emergency-room-panel" aria-labelledby="emergency-room-title">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Chairman only</span>
              <h2 id="emergency-room-title">Emergency room</h2>
            </div>
            <span className="chip critical">Critical studies only</span>
          </div>
          <div className="panel-body">
            {criticalStudies.length === 0 ? (
              <p className="muted-line">No Critical study is open right now.</p>
            ) : (
              <>
                <p className="muted-line">
                  Opens a room right away with you as Chairman and invites every on-duty doctor. It does
                  not wait for Head of Department assignment.
                </p>
                <label>
                  Critical study
                  <select
                    value={emergencyId}
                    onChange={(event) => {
                      setEmergencyStudyId(event.target.value);
                      setEmergencyConfirm(false);
                    }}
                  >
                    {criticalStudies.map((study) => (
                      <option key={study.id} value={study.id}>
                        {studyLabel(study)}
                      </option>
                    ))}
                  </select>
                </label>
                {emergencyConfirm ? (
                  <div className="emergency-confirm" role="alertdialog" aria-label="Confirm emergency room">
                    <strong>Open the room for {emergencyId} now?</strong>
                    <span>{ON_DUTY_SHIFT.length} on-duty doctors will be invited immediately.</span>
                    <div className="modal-actions">
                      <button type="button" className="ghost-button" onClick={() => setEmergencyConfirm(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        disabled={busy}
                        onClick={() => void startEmergencyRoom()}
                      >
                        {busy ? "Opening…" : "Confirm and open room"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="danger-button"
                    disabled={!emergencyId || busy}
                    onClick={() => setEmergencyConfirm(true)}
                  >
                    Open emergency room now
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      )}

      <div className="consultation-lobby-grid">
        <section className="panel">
          {canCreate ? (
            <>
              <div className="panel-head compact">
                <h2>Request consultation</h2>
              </div>
              <form
                className="panel-body create-consultation-panel request-consultation-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!hasReason || !studyId) return;
                  setBusy(true);
                  try {
                    const created = (await createConsultation({
                      study_id: studyId,
                      trigger_reason: triggerReason.trim(),
                    })) as Consultationession | null;
                    if (!created) throw new Error("API offline");
                    notify?.(`${created.id} created. Waiting for the Head of Department to assign a Chairman.`);
                    setNote("");
                    await refresh();
                  } catch (err) {
                    notify?.(err instanceof Error ? err.message : "Create failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Study
                  <select
                    value={studyId}
                    onChange={(event) => setStudyId(event.target.value)}
                    required
                    title={selectedStudyLabel}
                  >
                    {studies.map((study) => {
                      const label = studyLabel(study);
                      return (
                        <option key={study.id} value={study.id} title={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  Urgency
                  <select value={urgency} onChange={(event) => setUrgency(event.target.value)}>
                    <option>Critical</option>
                    <option>Priority</option>
                    <option>Routine</option>
                  </select>
                </label>
                <fieldset>
                  <legend>Common reasons</legend>
                  <ul className="reason-chips">
                    {QUICK_REASONS.map((item) => (
                      <li key={item}>
                        <label>
                          <input
                            type="checkbox"
                            checked={reasons.includes(item)}
                            onChange={(event) => {
                              setReasons((current) =>
                                event.target.checked
                                  ? [...current, item]
                                  : current.filter((reason) => reason !== item),
                              );
                            }}
                          />
                          <span>{item}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
                <label>
                  Additional note
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional clinical context for the panel…"
                  />
                </label>
                <button type="submit" className="primary-button" disabled={busy || !hasReason}>
                  {busy ? "Sending…" : "Create consultation room"}
                </button>
                {!hasReason && (
                  <p className="muted-line">Pick a common reason or add a note to enable the request.</p>
                )}
              </form>
            </>
          ) : (
            <>
              <div className="panel-head compact">
                <div>
                  <span className="section-kicker">Shift 07:00–15:00</span>
                  <h2>On-duty doctors</h2>
                </div>
              </div>
              <ul className="duty-roster panel-body">
                {ON_DUTY_SHIFT.map((doctor) => (
                  <li key={doctor.id}>
                    <span className="avatar">{doctor.initials}</span>
                    <span>
                      <strong>{doctor.display_name}</strong>
                      <small>
                        {doctor.employee_id}, {doctor.shift}
                      </small>
                    </span>
                    <em className="duty-pill">On duty</em>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel">
          <div className="panel-head compact">
            <div className="session-heading">
              <h2>Consultation sessions</h2>
              <span className="count-badge" aria-label={loading ? "Loading sessions" : `${visible.length} sessions`}>
                {loading ? "…" : visible.length}
              </span>
            </div>
          </div>
          <div className="panel-body">
            <div className="session-filters" role="tablist" aria-label="Filter sessions">
              {(
                [
                  ["all", "All"],
                  ["needs", "Needs HoD assignment"],
                  ["live", "Live / waiting"],
                  ["closed", "Finalized"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="consultation-session-list">
              {visible.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  role={role}
                  actor={actor}
                  canAssign={canAssign}
                  assigning={assigningId === session.id}
                  doctors={doctors}
                  chairmanId={chairmanId}
                  participantIds={participantIds}
                  busy={busy}
                  onAssign={() => {
                    setAssigningId(session.id);
                    setChairmanId("");
                    setParticipantIds([]);
                  }}
                  onCancelAssign={() => setAssigningId(null)}
                  onChairman={setChairmanId}
                  onToggleParticipant={(id, checked) => {
                    setParticipantIds((current) =>
                      checked ? [...current, id] : current.filter((item) => item !== id),
                    );
                  }}
                  onConfirmAssign={async () => {
                    if (!chairmanId) return;
                    setBusy(true);
                    try {
                      const updated = (await assignConsultation(session.id, {
                        chairman_user_id: chairmanId,
                        participant_user_ids: participantIds.filter((id) => id !== chairmanId),
                      })) as Consultationession | null;
                      if (!updated) throw new Error("API offline");
                      notify?.(`Chairman assigned for ${updated.id}. Invitations sent.`);
                      setAssigningId(null);
                      await refresh();
                    } catch (err) {
                      notify?.(err instanceof Error ? err.message : "Assignment failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  onOpen={() => void openSession(session)}
                />
              ))}
              {!loading && visible.length === 0 && <li className="empty-row">No sessions in this filter.</li>}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  role,
  actor,
  canAssign,
  assigning,
  doctors,
  chairmanId,
  participantIds,
  busy,
  onAssign,
  onCancelAssign,
  onChairman,
  onToggleParticipant,
  onConfirmAssign,
  onOpen,
}: {
  session: Consultationession;
  role: ClinicalRole;
  actor: { id: string; username: string; employeeId: string };
  canAssign: boolean;
  assigning: boolean;
  doctors: DirectoryUser[];
  chairmanId: string;
  participantIds: string[];
  busy: boolean;
  onAssign: () => void;
  onCancelAssign: () => void;
  onChairman: (id: string) => void;
  onToggleParticipant: (id: string, checked: boolean) => void;
  onConfirmAssign: () => void;
  onOpen: () => void;
}) {
  const chair = session.members.find((member) => member.role_in_session === "Chair");
  const isChair =
    sameClinician(actor, chair) ||
    session.members.some(
      (member) => member.role_in_session === "Chair" && sameClinician(actor, member),
    );
  const isMember = session.members.some((member) => sameClinician(actor, member));
  const inRoom = session.members.filter((member) => member.presence === "IN_ROOM").length;
  const closed = isClosed(session.status);
  const needsChair = session.status === "PENDING_ASSIGNMENT";
  const live = session.status === "LIVE";

  let actionLabel = "Enter waiting room";
  let actionClass = "secondary-button";
  let action: (() => void) | null = onOpen;
  let pendingAssignment = false;
  if (closed) {
    actionLabel = "View consensus report";
  } else if (needsChair && canAssign) {
    actionLabel = "Assign Chair & Invite";
    actionClass = "primary-button";
    action = onAssign;
  } else if (needsChair) {
    pendingAssignment = true;
    action = null;
  } else if (live && isChair) {
    actionLabel = "Join Zoom room";
    actionClass = "primary-button";
  } else if (!live && isChair) {
    actionLabel = "Start as Chair (Zoom Host)";
    actionClass = "primary-button";
  } else if (isMember || role === "hod") {
    actionLabel = live ? "Join Zoom room" : "Enter waiting room";
    actionClass = live ? "primary-button" : "secondary-button";
  } else {
    actionLabel = "Not invited";
    action = null;
  }

  return (
    <li className="consultation-card">
      <div className="consultation-card-head">
        <strong>{session.id}</strong>
        <SessionBadge status={session.status} inRoom={inRoom} />
      </div>
      <p>
        {session.study_id} — {displayTriggerReason(session.trigger_reason).replace(/ · /g, " — ")}
      </p>
      <p className="chair-line">
        {chair ? `Chair: ${chair.display_name}` : "Chair: Unassigned"}
      </p>
      <div className="panel-avatars" aria-label="Invited doctors">
        {session.members.map((member) => {
          const onDuty = ON_DUTY_SHIFT.some(
            (doctor) => doctor.id === member.user_id || doctor.employee_id === member.employee_id,
          );
          return (
            <span key={member.user_id} className="duty-avatar" title={`${member.display_name}${onDuty ? " · On duty" : ""}`}>
              <span className="avatar">{member.initials}</span>
              {onDuty && <i className="duty-dot" />}
            </span>
          );
        })}
        <small>{session.members.length} invited</small>
      </div>
      <div className="consultation-card-actions">
        {pendingAssignment ? (
          <span className="assignment-status">Pending HoD assignment</span>
        ) : (
          <button type="button" className={actionClass} disabled={!action} onClick={() => action?.()}>
            {actionLabel}
          </button>
        )}
      </div>
      {assigning && (
        <form
          className="assign-chairman-form"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirmAssign();
          }}
        >
          <label>
            Chairman
            <select value={chairmanId} onChange={(event) => onChairman(event.target.value)} required>
              <option value="">Select the Chairman</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name} · {doctor.employee_id}
                  {ON_DUTY_SHIFT.some(
                    (item) => item.id === doctor.id || item.employee_id === doctor.employee_id,
                  )
                    ? " · On duty"
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Invite on-duty doctors</legend>
            <ul className="doctor-check-list">
              {doctors
                .filter((doctor) => doctor.id !== chairmanId)
                .map((doctor) => (
                  <li key={doctor.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={participantIds.includes(doctor.id)}
                        onChange={(event) => onToggleParticipant(doctor.id, event.target.checked)}
                      />
                      <span>
                        {doctor.display_name} ({doctor.employee_id})
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
          </fieldset>
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onCancelAssign}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy || !chairmanId}>
              {busy ? "Assigning…" : "Confirm assignment"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function SessionBadge({ status, inRoom }: { status: Consultationession["status"]; inRoom: number }) {
  if (status === "PENDING_ASSIGNMENT") return <span className="progress-pill waiting">Needs chairman</span>;
  if (status === "LIVE") {
    return (
      <span className="live-label">
        <i />
        Zoom live, {inRoom} in room
      </span>
    );
  }
  if (isClosed(status)) return <span className="session-badge finalized">Finalized</span>;
  if (status === "AWAITING_CONCLUSION") return <span className="progress-pill waiting">Awaiting sign-off</span>;
  return <span className="progress-pill in_progress">Waiting</span>;
}

type RequestDialogProps = {
  studyId: string;
  defaultUrgency?: "Critical" | "Priority" | "Routine";
  onClose: () => void;
  notify?: (message: string) => void;
};

/** Radiologist request from inside the Mask Studio. Same API call as the lobby form. */
export function RequestConsultationDialog({
  studyId,
  defaultUrgency = "Priority",
  onClose,
  notify,
}: RequestDialogProps) {
  const [urgency, setUrgency] = useState<string>(defaultUrgency);
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const hasReason = reasons.length > 0 || note.trim().length > 0;

  return (
    <div className="modal-wrap">
      <div
        className="modal consultation-request-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-consultation-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <span className="section-kicker">Consultation</span>
        <h2 id="request-consultation-title">Request a consultation for {studyId}</h2>
        <p>The Head of Department assigns the Chairman and invites the on-duty doctors.</p>
        <form
          className="create-consultation-panel"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!hasReason) return;
            setBusy(true);
            try {
              const created = (await createConsultation({
                study_id: studyId,
                trigger_reason: [urgency, ...reasons, note.trim()].filter(Boolean).join(". "),
              })) as Consultationession | null;
              if (!created) throw new Error("API offline");
              notify?.(`${created.id} requested. Waiting for the Head of Department to assign a Chairman.`);
              onClose();
            } catch (err) {
              notify?.(err instanceof Error ? err.message : "Request failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Urgency
            <select value={urgency} onChange={(event) => setUrgency(event.target.value)}>
              <option>Critical</option>
              <option>Priority</option>
              <option>Routine</option>
            </select>
          </label>
          <fieldset>
            <legend>Common reasons</legend>
            <ul className="reason-chips">
              {QUICK_REASONS.map((item) => (
                <li key={item}>
                  <label>
                    <input
                      type="checkbox"
                      checked={reasons.includes(item)}
                      onChange={(event) =>
                        setReasons((current) =>
                          event.target.checked ? [...current, item] : current.filter((reason) => reason !== item),
                        )
                      }
                    />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <ClinicalComposer
            label="Additional note"
            value={note}
            onChange={setNote}
            notify={notify ?? (() => undefined)}
            draftKey={`${studyId}:consultation-request`}
            syncStudyNote={false}
            placeholder="Optional clinical context for the panel…"
            voiceText="Requesting multidisciplinary review. Please correlate the imaging with the clinical examination before treatment."
          />
          <button type="submit" className="primary-button full" disabled={busy || !hasReason}>
            {busy ? "Sending…" : "Send request"}
          </button>
          {!hasReason && <p className="muted-line">Pick a common reason or add a note to enable the request.</p>}
        </form>
      </div>
    </div>
  );
}
