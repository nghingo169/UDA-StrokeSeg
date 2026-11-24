import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgreementWithAI,
  Consultationession,
  ConsultationViewport,
  DiscussionMessage,
  ZoomJoinPayload,
} from "../../types/consultation.types";
import {
  CLOSED_CONSULTATION_STATUSES,
  DEMO_ACTORS,
  ConsultationStatusLabel,
  displayTriggerReason,
  formatMeetingNumber,
} from "../../types/consultation.types";
import {
  endConsultation,
  getConsultation,
  inviteConsultationMember,
  joinConsultation,
  leaveConsultation,
  postConsultationNote,
  saveConsultationAgreement,
  startConsultation,
  submitConsultationConclusion,
} from "../../services/demoApi";
import { connectConsultationRoom } from "../../services/websocketService";
import { CollaborativeCanvas } from "./CollaborativeCanvas";
import { MemberPollPanel } from "./MemberPollPanel";
import { ConsensusFinalizeModal } from "./ConsensusFinalizeModal";
import { ZoomVideoStrip } from "./ZoomVideoStrip";
import { ClinicalComposer, clearClinicalDraft } from "../shared/ClinicalComposer";

type Role = "radiologist" | "physician" | "hod" | "it";

type Props = {
  sessionId: string;
  role: Role;
  onBack: () => void;
  notify: (message: string) => void;
};

type CursorPeer = {
  actor: string;
  display_name: string;
  initials: string;
  x: number;
  y: number;
};

export function VirtualReviewRoom({ sessionId, role, onBack, notify }: Props) {
  const [session, setSession] = useState<Consultationession | null>(null);
  const [zoom, setZoom] = useState<ZoomJoinPayload | null>(null);
  const [agreement, setAgreement] = useState<AgreementWithAI | "">("");
  const [agreementNote, setAgreementNote] = useState("");
  const [consensusNotes, setConsensusNotes] = useState("");
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [voteBusy, setVoteBusy] = useState(false);
  const [cursors, setCursors] = useState<Record<string, CursorPeer>>({});
  const [viewport, setViewport] = useState<ConsultationViewport>({
    slice: 16,
    zoom: 1,
    pan_x: 0,
    pan_y: 0,
  });
  const [followChair, setFollowChair] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const wsRef = useRef<ReturnType<typeof connectConsultationRoom> | null>(null);
  const followChairRef = useRef(true);
  followChairRef.current = followChair;
  const actor = DEMO_ACTORS[role];
  const amChairForSession = Boolean(
    session &&
      (session.lead_chair_id === actor.id ||
        session.members.some(
          (member) => member.user_id === actor.id && member.role_in_session === "Chair",
        )),
  );

  const readOnly = !session || CLOSED_CONSULTATION_STATUSES.includes(session.status);
  const awaitingConclusion = session?.status === "AWAITING_CONCLUSION";
  const pendingAssignment = session?.status === "PENDING_ASSIGNMENT";
  const inRoom = session?.status === "LIVE";

  const applySession = useCallback((next: Consultationession) => {
    setSession(next);
    if (next.viewport) setViewport(next.viewport);
    if (next.consensus_notes) setConsensusNotes(next.consensus_notes);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getConsultation<Consultationession>(sessionId);
        if (!cancelled && data) applySession(data);
      } catch {
        notify("Failed to load consultation");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, applySession, notify]);

  useEffect(() => {
    const room = connectConsultationRoom(sessionId, (event, payload) => {
      if (event === "session.snapshot" || event === "member.presence" || event === "poll.updated") {
        const consultation = payload.consultation as Consultationession | undefined;
        if (consultation) applySession(consultation);
      }
      if (event === "session.status") {
        const consultation = payload.consultation as Consultationession | undefined;
        if (consultation) applySession(consultation);
        else if (typeof payload.status === "string") {
          setSession((prev) => (prev ? { ...prev, status: payload.status as Consultationession["status"] } : prev));
        }
        if (payload.status === "COMPLETED" || payload.status === "FINALIZED" || payload.status === "AWAITING_CONCLUSION" || String(payload.status).startsWith("ENDED")) {
          setZoom(null);
          notify(
            payload.status === "AWAITING_CONCLUSION"
              ? "Meeting ended — the Chairman still needs to sign the conclusion"
              : `Session ${ConsultationStatusLabel(String(payload.status))}`,
          );
        }
      }
      if (event === "discussion.message") {
        const message = payload.message as DiscussionMessage | undefined;
        const consultation = payload.consultation as Consultationession | undefined;
        if (consultation) applySession(consultation);
        else if (message) {
          setSession((prev) => {
            if (!prev || prev.discussion?.some((item) => item.id === message.id)) return prev;
            return { ...prev, discussion: [...(prev.discussion || []), message] };
          });
        }
      }
      if (event === "canvas.viewport") {
        const next = payload.viewport as ConsultationViewport | undefined;
        if (next && (followChairRef.current || payload.actor === actor.username)) setViewport(next);
      }
      if (event === "canvas.cursor") {
        const actor = String(payload.actor || "");
        if (!actor) return;
        setCursors((prev) => ({
          ...prev,
          [actor]: {
            actor,
            display_name: String(payload.display_name || actor),
            initials: String(payload.initials || "??"),
            x: Number(payload.x || 0),
            y: Number(payload.y || 0),
          },
        }));
      }
    });
    wsRef.current = room;
    return () => {
      room.close();
      wsRef.current = null;
    };
  }, [sessionId, applySession, notify, actor.username]);

  const handleStart = async () => {
    try {
      const result = await startConsultation(sessionId);
      if (!result) throw new Error("API offline");
      applySession(result.session as Consultationession);
      setZoom(result.zoom as ZoomJoinPayload);
      notify("Consultation is live");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Start failed");
    }
  };

  const handleJoin = async () => {
    try {
      const result = await joinConsultation(sessionId);
      if (!result) throw new Error("API offline");
      applySession(result.session as Consultationession);
      if (result.waiting) {
        notify("Waiting in the lobby until the Chairman starts");
        setZoom(null);
        return;
      }
      setZoom(result.zoom as ZoomJoinPayload);
      notify("Joined consultation room");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Join failed");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveConsultation(sessionId);
      setZoom(null);
      notify("Left consultation");
      onBack();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Leave failed");
    }
  };

  const handleEnd = async () => {
    try {
      const ended = (await endConsultation(sessionId)) as Consultationession | null;
      if (ended) applySession(ended);
      setZoom(null);
      notify("Meeting ended. Record the conclusion and sign the chart.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "End failed");
    }
  };

  const joinedCount =
    session?.members.filter((member) => member.presence === "IN_ROOM" || member.presence === "IN_LOBBY")
      .length ?? 0;

  useEffect(() => {
    document.documentElement.classList.add("sketch-immersive");
    return () => document.documentElement.classList.remove("sketch-immersive");
  }, []);

  const chairName =
    session?.members.find((member) => member.role_in_session === "Chair")?.display_name || "Unassigned";

  return (
    <div className="consultation-workspace virtual-review-room sketch-live">
      <header className="sketch-live-bar">
        <b>Room {sessionId}</b>
        <span className="sketch-chip crit">{session ? ConsultationStatusLabel(session.status) : "…"}</span>
        <span>
          Case {session?.study_id || "unassigned"}. Chairman: {chairName}
        </span>
        <div className="sketch-live-actions">
          {session && !readOnly && !inRoom && !awaitingConclusion && !pendingAssignment && amChairForSession && (
            <button type="button" className="primary-button" onClick={handleStart}>
              Start as Chair (Zoom Host)
            </button>
          )}
          {session && !readOnly && inRoom && !zoom && (
            <button type="button" className="primary-button" onClick={handleJoin}>
              Join Zoom room
            </button>
          )}
          {session && !readOnly && !inRoom && !awaitingConclusion && !pendingAssignment && !amChairForSession && (
            <button type="button" className="secondary-button" onClick={handleJoin}>
              Join Zoom room
            </button>
          )}
          {amChairForSession && (inRoom || awaitingConclusion) && (
            <button type="button" className="primary-button" onClick={() => setFinalizeOpen(true)}>
              Finalize consensus & close Zoom room
            </button>
          )}
          {amChairForSession && inRoom && (
            <button type="button" className="sketch-btn danger" onClick={handleEnd}>
              End meeting (chairman)
            </button>
          )}
          <button type="button" className="sketch-btn outline" onClick={handleLeave}>
            Leave
          </button>
        </div>
      </header>

      <div className="room-status-bar">
        <span>Zoom meeting {formatMeetingNumber(session?.zoom_meeting_number)}</span>
        <span>Encrypted, hospital compliant</span>
        <span>
          Chairman:{" "}
          {session?.members.find((member) => member.role_in_session === "Chair")?.display_name || "Unassigned"}
        </span>
        <button
          type="button"
          className="secondary-button small"
          aria-pressed={followChair}
          disabled={amChairForSession}
          onClick={() => setFollowChair((value) => !value)}
        >
          {amChairForSession
            ? "Broadcasting viewport"
            : followChair
              ? "Viewport synced with Chair"
              : "Sync viewport with Chair"}
        </button>
      </div>

      {pendingAssignment && (
        <p className="lifecycle-banner">
          This room is waiting for the Head of Department to assign a Chairman and the panel.
        </p>
      )}
      {awaitingConclusion && (
        <p className="lifecycle-banner">
          The Zoom meeting has ended. The Chairman records the conclusion and signs it into the chart.
        </p>
      )}

      <div className="consultation-layout">
        <div className="consultation-main-column">
          <CollaborativeCanvas
            viewport={viewport}
            readOnly={readOnly || !inRoom}
            isChair={amChairForSession}
            cursors={Object.values(cursors)}
            onViewportChange={(next) => {
              setViewport(next);
              wsRef.current?.send("canvas.viewport", {
                slice: next.slice,
                zoom: next.zoom,
                pan_x: next.pan_x,
                pan_y: next.pan_y,
              });
            }}
            onCursorMove={(x, y) => {
              wsRef.current?.send("canvas.cursor", { x, y });
            }}
          />
        </div>

        <aside className="clinical-panel">
          <ZoomVideoStrip
            zoom={zoom}
            active={!!session && !readOnly}
            members={session?.members || []}
            meetingNumber={session?.zoom_meeting_number}
            canInvite={(amChairForSession || role === "hod") && inRoom}
            onInvite={async (userId) => {
              try {
                const updated = (await inviteConsultationMember(sessionId, userId)) as Consultationession | null;
                if (updated) applySession(updated);
                notify("On-duty doctor invited");
              } catch (err) {
                notify(err instanceof Error ? err.message : "Invite failed");
              }
            }}
          />
          <div className="clinical-section">
            <div className="section-title">
              <span>Panel members</span>
              <em>{joinedCount} present</em>
            </div>
            <ul className="member-list">
              {(session?.members || []).map((member) => (
                <li key={member.user_id}>
                  <span className="avatar">{member.initials}</span>
                  {member.display_name}
                  {member.employee_id ? ` (${member.employee_id})` : ""}, {member.role_in_session}
                  <em className="member-presence">{member.presence}</em>
                </li>
              ))}
            </ul>
          </div>

          <div className="clinical-section discussion-thread">
            <div className="section-title">
              <span>Shared discussion</span>
            </div>
            <ul className="discussion-list">
              {(session?.discussion || []).map((message) => (
                <li key={message.id}>
                  <strong>
                    {message.author}, {message.role_in_session}
                  </strong>
                  <time>{message.sent_at.slice(11, 16)}</time>
                  <p>{message.text}</p>
                </li>
              ))}
              {(session?.discussion || []).length === 0 && <li className="empty-row">No shared notes yet.</li>}
            </ul>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const text = noteDraft.trim();
                if (!text) return;
                setNoteBusy(true);
                try {
                  const saved = (await postConsultationNote(sessionId, text)) as DiscussionMessage | null;
                  if (saved) {
                    setSession((prev) => {
                      if (!prev || prev.discussion?.some((item) => item.id === saved.id)) return prev;
                      return { ...prev, discussion: [...(prev.discussion || []), saved] };
                    });
                  }
                  setNoteDraft("");
                } catch (err) {
                  notify(err instanceof Error ? err.message : "Note failed");
                } finally {
                  setNoteBusy(false);
                }
              }}
            >
              <textarea
                value={noteDraft}
                rows={3}
                disabled={readOnly || !session}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Add a shared clinical note…"
              />
              <button type="submit" className="secondary-button" disabled={noteBusy || readOnly || !noteDraft.trim()}>
                {noteBusy ? "Sending…" : "Post note"}
              </button>
            </form>
          </div>

          <MemberPollPanel
            members={session?.members || []}
            myAgreement={agreement}
            myNote={agreementNote}
            disabled={readOnly || session?.status !== "LIVE"}
            submitting={voteBusy}
            onAgreementChange={setAgreement}
            onNoteChange={setAgreementNote}
            notify={notify}
            draftKey={`${sessionId}:agreement`}
            onSubmit={async () => {
              if (!agreement) return;
              setVoteBusy(true);
              try {
                const updated = (await saveConsultationAgreement(
                  sessionId,
                  agreement,
                  agreementNote,
                )) as Consultationession | null;
                if (updated) applySession(updated);
                notify("Vote saved");
              } catch (err) {
                notify(err instanceof Error ? err.message : "Vote failed");
              } finally {
                setVoteBusy(false);
              }
            }}
          />

          <div className="clinical-section">
            <div className="section-title">
              <span>Consensus notes</span>
            </div>
            <textarea
              className="consensus-notes-preview"
              value={consensusNotes || session?.consensus_notes || ""}
              readOnly={!amChairForSession || (readOnly && !awaitingConclusion)}
              onChange={(event) => setConsensusNotes(event.target.value)}
              placeholder="Chairman records the consultation conclusion here…"
              rows={5}
            />
            <p className="muted-line">
              Stored as a separate record. It does not change the signed report or grant signing rights.
            </p>
          </div>
        </aside>
      </div>

      <ConsensusFinalizeModal
        open={finalizeOpen}
        notes={consensusNotes}
        onNotesChange={setConsensusNotes}
        notify={notify}
        draftKey={`${sessionId}:consensus`}
        onClose={() => setFinalizeOpen(false)}
        onConfirm={async (stepUpPassword) => {
          const updated = (await submitConsultationConclusion(sessionId, {
            conclusion: consensusNotes,
            agreement: agreement || "Agree",
            agreement_note: agreementNote,
            step_up_password: stepUpPassword,
          })) as Consultationession | null;
          if (!updated) throw new Error("Could not sign the conclusion");
          applySession(updated);
          setZoom(null);
          setFinalizeOpen(false);
          notify("Conclusion signed into the chart");
        }}
      />
    </div>
  );
}
