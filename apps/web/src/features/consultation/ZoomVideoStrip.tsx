import { useEffect, useRef, useState } from "react";
import type { ConsultationMember, ZoomJoinPayload } from "../../types/consultation.types";
import { ON_DUTY_SHIFT, formatMeetingNumber } from "../../types/consultation.types";

type Props = {
  zoom: ZoomJoinPayload | null;
  active: boolean;
  members?: ConsultationMember[];
  meetingNumber?: string | null;
  canInvite?: boolean;
  onInvite?: (userId: string) => void;
};

type ZoomClient = {
  setZoomJSLib?: (path: string, dir: string) => void;
  preLoadWasm?: () => void;
  prepareJssdk?: () => void;
  prepareWebSDK?: () => void;
  init: (opts: Record<string, unknown>) => void;
  join: (opts: Record<string, unknown>) => void;
  leaveMeeting?: (opts: Record<string, unknown>) => void;
};

async function loadZoomClientView(): Promise<ZoomClient | null> {
  try {
    // Literal specifier so Vite bundles it. Requires: npm i @zoom/meetingsdk
    const mod = (await import("@zoom/meetingsdk")) as unknown as Record<string, unknown>;
    const candidate = (mod.ZoomMtg || mod.default) as ZoomClient | undefined;
    if (candidate && typeof candidate.init === "function" && typeof candidate.join === "function") {
      return candidate;
    }
  } catch (err) {
    console.warn("Zoom Meeting SDK failed to load", err);
  }
  return null;
}

function zoomCall(fn: (opts: Record<string, unknown>) => void, args: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    fn({
      ...args,
      success: (res: unknown) => resolve(res),
      error: (err: unknown) => {
        const e = err as { errorCode?: number; errorMessage?: string; reason?: string } | undefined;
        reject(
          err instanceof Error
            ? err
            : new Error(
                e?.errorMessage || e?.reason
                  ? `Zoom: ${e.errorMessage || e.reason}${e.errorCode ? ` (${e.errorCode})` : ""}`
                  : "Zoom SDK error",
              ),
        );
      },
    });
  });
}

/**
 * Zoom Meeting SDK Client View.
 * The Chairman join payload includes a ZAK so the SDK promotes them to host.
 */
export function ZoomVideoStrip({
  zoom,
  active,
  members = [],
  meetingNumber,
  canInvite = false,
  onInvite,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<ZoomClient | null>(null);
  const joinedRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [error, setError] = useState("");
  const [inviteId, setInviteId] = useState("");

  useEffect(() => {
    let cancelled = false;

    const leave = () => {
      if (joinedRef.current) {
        try {
          clientRef.current?.leaveMeeting?.({});
        } catch {
          /* already left */
        }
      }
      joinedRef.current = false;
      clientRef.current = null;
    };

    const run = async () => {
      if (!active || !zoom) {
        leave();
        if (!cancelled) setStatus("idle");
        return;
      }
      if (zoom.mock) {
        leave();
        if (!cancelled) {
          setStatus("error");
          setError("This room has no live Zoom meeting. Create a new consultation.");
        }
        return;
      }

      setStatus("connecting");
      setError("");
      const ZoomMtg = await loadZoomClientView();
      if (!ZoomMtg || !hostRef.current) {
        if (!cancelled) {
          setStatus("error");
          setError("Zoom Meeting SDK is not available.");
        }
        return;
      }

      try {
        // Do not pin the CDN lib path: it must equal the installed package version,
        // and the server always sends a default sdk_lib_version. The package's own default is correct.
        ZoomMtg.preLoadWasm?.();
        ZoomMtg.prepareWebSDK?.();
        ZoomMtg.prepareJssdk?.();
        clientRef.current = ZoomMtg;
        const leaveUrl = `${window.location.origin}${window.location.pathname}`;
        await zoomCall(ZoomMtg.init.bind(ZoomMtg), {
          leaveUrl,
          patchJsMedia: true,
          leaveOnPageUnload: true,
          isSupportAV: true,
        });
        const root = document.getElementById("zmmtg-root");
        if (root && hostRef.current && root.parentElement !== hostRef.current) {
          hostRef.current.appendChild(root);
        }
        await zoomCall(ZoomMtg.join.bind(ZoomMtg), {
          meetingNumber: zoom.meeting_number,
          userName: zoom.user_name,
          sdkKey: zoom.sdk_key,
          userEmail: zoom.user_email,
          passWord: zoom.password,
          signature: zoom.signature,
          zak: zoom.zak || "",
        });
        joinedRef.current = true;
        if (!cancelled) setStatus("live");
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Could not join the Zoom meeting.");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      leave();
    };
  }, [active, zoom]);

  useEffect(() => {
    const pin = () => {
      const host = hostRef.current;
      const root = document.getElementById("zmmtg-root");
      if (!host || !root) return;
      const shell = root.parentElement?.classList.contains("websdk-body") ? root.parentElement : null;
      const node = shell ?? root;
      if (node.parentElement !== host) host.appendChild(node);
    };
    pin();
    const observer = new MutationObserver(pin);
    observer.observe(document.documentElement, { childList: true });
    if (document.body) observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, [status]);

  if (!active && !zoom && members.length === 0) return null;

  const rawNumber = String(zoom?.meeting_number || meetingNumber || "").replace(/\D/g, "");
  const legacyRoom = !!zoom?.mock || rawNumber.startsWith("900");
  const number = formatMeetingNumber(zoom?.meeting_number || meetingNumber);
  const invitees = ON_DUTY_SHIFT.filter((doctor) => !members.some((member) => member.user_id === doctor.id));
  const statusLabel = status === "live" ? "In meeting" : status === "connecting" ? "Connecting" : "Zoom";

  return (
    <div className="zoom-video-strip" data-status={status} data-testid="zoom-video-strip">
      <div className="section-title">
        <span>Consultation video</span>
        <em>{legacyRoom ? "Unavailable" : statusLabel}</em>
      </div>
      {legacyRoom ? (
        <p className="zoom-fallback-note">This room has no live Zoom meeting. Create a new consultation.</p>
      ) : (
        number && <p className="zoom-fallback-note">Meeting {number}</p>
      )}
      {!legacyRoom && error && <p className="zoom-fallback-note">{error}</p>}
      <div ref={hostRef} id="zoom-consultation-root" className="zoom-sdk-root" hidden={legacyRoom || status === "error"} />
      {canInvite && onInvite && !legacyRoom && invitees.length > 0 && (
        <form
          className="zoom-invite-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!inviteId) return;
            onInvite(inviteId);
            setInviteId("");
          }}
        >
          <label>
            Invite on-duty doctor
            <select value={inviteId} onChange={(event) => setInviteId(event.target.value)}>
              <option value="">Select 07:00–15:00</option>
              {invitees.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.display_name}, {doctor.shift}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="secondary-button" disabled={!inviteId}>
            Invite
          </button>
        </form>
      )}
    </div>
  );
}
