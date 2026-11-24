import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ensureDemoSession,
  pingDemoApi,
  reassignFallback,
  saveClinicalNote,
  saveDisposition,
  savePhysicianFeedback,
  signOffStudy,
  suspendInference,
} from "./services/demoApi";
import { ConsultationLobby, RequestConsultationDialog } from "./features/consultation/ConsultationLobby";
import { VirtualReviewRoom } from "./features/consultation/VirtualReviewRoom";
import { RadiologistScheduleView } from "./features/radiologist/ShiftCalendar";
import { ClinicalComposer } from "./features/shared/ClinicalComposer";

type Role = "radiologist" | "physician" | "hod" | "it";
type AuthScreen = "login" | "expired" | "no-role";
type IconName =
  | "activity"
  | "alert"
  | "arrow"
  | "bell"
  | "brain"
  | "calendar"
  | "check"
  | "chevron"
  | "clock"
  | "database"
  | "download"
  | "edit"
  | "file"
  | "grid"
  | "layers"
  | "lock"
  | "logout"
  | "menu"
  | "mic"
  | "monitor"
  | "more"
  | "pause"
  | "people"
  | "play"
  | "plus"
  | "refresh"
  | "search"
  | "server"
  | "settings"
  | "shield"
  | "sliders"
  | "user"
  | "x";

type ClinicalGate = "pending" | "approved" | "rejected";
type CaseStatus = "Critical" | "Priority" | "Routine";
type CaseWorkflow = "Received" | "Processing" | "Awaiting review" | "Draft saved" | "Signed off";
type StrokeCase = {
  id: string;
  patient: string;
  age: number;
  sex: "Male" | "Female";
  onset: string;
  received: string;
  sla: number;
  status: CaseStatus;
  workflow: CaseWorkflow;
  volume: number;
  side: string;
  territory: string;
  nihss: number;
  clusters: number;
  mrs: number;
  strokeType: string;
  pacsNote: string;
  missingInputs: string[];
};

const IDLE_MS = 15 * 60 * 1000;
const LOCK_GRACE_MS = 5 * 60 * 1000;
/** Demo helpers only when VITE_DEMO_MODE=true (dev default). Production build hides them. */
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_PASSWORD = DEMO_MODE ? String(import.meta.env.VITE_DEMO_PASSWORD || "") : "";
/** Where "Continue with hospital SSO" sends the browser (OIDC/SAML start endpoint). */
const SSO_START_URL = String(import.meta.env.VITE_SSO_START_URL || "");
/** Prototype password check. Always false outside demo mode, so an empty password can never pass. */
const checkDemoPassword = (value: string) => DEMO_MODE && value === DEMO_PASSWORD;

function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const root = containerRef.current;
    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    const first = focusable()[0];
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const current = document.activeElement as HTMLElement | null;
      const index = items.indexOf(current ?? items[0]);
      if (event.shiftKey) {
        if (index <= 0) {
          event.preventDefault();
          items[items.length - 1]?.focus();
        }
      } else if (index === items.length - 1) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef]);
}

function useIdleSession({
  enabled,
  keepAlive,
  onIdle,
}: {
  enabled: boolean;
  keepAlive: boolean;
  onIdle: () => void;
}) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;
  useEffect(() => {
    if (!enabled) return;
    let timer = window.setTimeout(() => {
      if (!keepAlive) onIdleRef.current();
    }, IDLE_MS);
    const bump = () => {
      window.clearTimeout(timer);
      if (keepAlive) return;
      timer = window.setTimeout(() => onIdleRef.current(), IDLE_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;
    events.forEach((event) => window.addEventListener(event, bump, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, bump));
    };
  }, [enabled, keepAlive]);
}

function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className={`collapse-section ${open ? "open" : ""}`}>
      <button
        type="button"
        className="collapse-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        {badge && <em>{badge}</em>}
        <Icon name="chevron" size={15} />
      </button>
      {open && (
        <div className="collapse-panel" id={panelId}>
          {children}
        </div>
      )}
    </div>
  );
}

function CtaHint({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <p className="cta-hint" role="status">
      {children}
    </p>
  );
}

function TermTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <abbr className="term-tip" title={tip}>
      {children}
    </abbr>
  );
}

type NotifyFn = (message: string, undo?: () => void) => void;

function useBusyAction(notify: NotifyFn) {
  const [busyKey, setBusyKey] = useState("");
  const run = (key: string, successMessage: string, action?: () => void, undo?: () => void) => {
    if (busyKey) return;
    setBusyKey(key);
    window.setTimeout(() => {
      action?.();
      setBusyKey("");
      notify(successMessage, undo);
    }, 650);
  };
  return { busyKey, run, isBusy: (key: string) => busyKey === key };
}

function AppToast({
  toast,
  onDismiss,
}: {
  toast: { message: string; undo?: () => void } | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>
        <Icon name="check" size={15} />
      </span>
      <span className="toast-message">{toast.message}</span>
      {toast.undo && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            toast.undo?.();
            onDismiss();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}

type SubPage = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  actionIcon?: IconName;
  columns: string[];
  rows: string[][];
};

const roles: Record<Role, { label: string; short: string; title: string; initials: string }> = {
  radiologist: {
    label: "Radiologist",
    short: "Radiology",
    title: "Reading workspace",
    initials: "LA",
  },
  physician: {
    label: "Stroke Physician",
    short: "Stroke Physician",
    title: "Clinical results",
    initials: "MH",
  },
  hod: { label: "Head of Department", short: "HoD", title: "Clinical oversight", initials: "TN" },
  it: { label: "IT Administrator", short: "IT Admin", title: "System operations", initials: "QT" },
};

const cases: StrokeCase[] = [
  {
    id: "AIS-240913-084",
    patient: "BN-7A42",
    age: 67,
    sex: "Male",
    onset: "01:38",
    received: "08:42",
    sla: 11,
    status: "Critical",
    workflow: "Awaiting review",
    volume: 18.6,
    side: "Left hemisphere",
    territory: "MCA",
    nihss: 14,
    clusters: 2,
    mrs: 1,
    strokeType: "Large-vessel occlusion",
    pacsNote: "Technician: no motion. DWI, ADC, and FLAIR are complete.",
    missingInputs: [],
  },
  {
    id: "AIS-240913-079",
    patient: "BN-3C91",
    age: 58,
    sex: "Female",
    onset: "02:15",
    received: "08:31",
    sla: 18,
    status: "Critical",
    workflow: "Draft saved",
    volume: 7.2,
    side: "Right hemisphere",
    territory: "PCA",
    nihss: 9,
    clusters: 1,
    mrs: 2,
    strokeType: "Cardioembolic",
    pacsNote: "Onset time was not verified at the scanner.",
    missingInputs: ["Clinical onset time unverified"],
  },
  {
    id: "AIS-240913-077",
    patient: "BN-8D16",
    age: 72,
    sex: "Female",
    onset: "Unknown",
    received: "08:17",
    sla: 24,
    status: "Priority",
    workflow: "Awaiting review",
    volume: 3.8,
    side: "Left hemisphere",
    territory: "ACA",
    nihss: 6,
    clusters: 3,
    mrs: 3,
    strokeType: "Lacunar",
    pacsNote: "Symptom onset unknown. Prior imaging has not been read.",
    missingInputs: ["Symptom onset unknown", "Prior imaging unread"],
  },
  {
    id: "AIS-240913-071",
    patient: "BN-2F08",
    age: 49,
    sex: "Male",
    onset: "03:02",
    received: "07:54",
    sla: 35,
    status: "Routine",
    workflow: "Received",
    volume: 0,
    side: "Undetermined",
    territory: "-",
    nihss: 4,
    clusters: 0,
    mrs: 1,
    strokeType: "Undetermined",
    pacsNote: "Empty automated mask. Full manual read required before sign-off.",
    missingInputs: ["Empty mask - full manual read required"],
  },
];

function sexInitial(sex: string) {
  return sex.startsWith("M") ? "M" : "F";
}

function patientLine(patient: string, age: number, sex: string) {
  return `${patient}, ${age}${sexInitial(sex)}`;
}

function territoryPhrase(study: { volume?: number; territory?: string; side?: string }) {
  const territory = study.territory?.trim();
  if (study.volume === 0 || !territory || territory === "-") return "No territory detected";
  const side = study.side?.startsWith("Left") ? "Left" : study.side?.startsWith("Right") ? "Right" : "";
  return side ? `${side} ${territory}` : territory;
}

function qualityFlag(study: StrokeCase) {
  if (study.volume === 0) return { label: "Empty mask, manual read", tone: "bad" };
  if (study.missingInputs.length > 0) return { label: study.missingInputs[0], tone: "warn" };
  if (study.confidence < 0.6) return { label: "Low confidence", tone: "bad" };
  if (study.confidence < 0.8) return { label: "Review suggested", tone: "warn" };
  return { label: "High confidence", tone: "good" };
}

const signedCases = [
  {
    ...cases[0],
    id: "AIS-240913-063",
    patient: "BN-1E74",
    signed: "08:18",
    signer: "Dr. Lena Morgan",
    treatment: "Decision pending",
    volume: 12.4,
  },
  {
    ...cases[1],
    id: "AIS-240913-058",
    patient: "BN-5B22",
    signed: "07:56",
    signer: "Dr. Priya Shah",
    treatment: "Consulted",
    volume: 6.8,
  },
  {
    ...cases[2],
    id: "AIS-240913-041",
    patient: "BN-9C04",
    signed: "06:42",
    signer: "Dr. Lena Morgan",
    treatment: "Monitoring",
    volume: 2.1,
  },
];

// ASSUMPTION: the standing Chairman who may open an emergency room for a Critical study
// without HoD assignment is a Stroke physician. Confirm with the spec and change here.
const STANDING_CHAIR_ROLE: Role = "physician";

const navByRole: Record<Role, { icon: IconName; label: string }[]> = {
  radiologist: [
    { icon: "grid", label: "Worklist" },
    { icon: "file", label: "Report" },
    { icon: "people", label: "Consultation" },
  ],
  physician: [
    { icon: "activity", label: "Dashboard" },
    { icon: "file", label: "Cases" },
    { icon: "people", label: "Consultation" },
  ],
  // HoD manages people and owns the clinical gate for new models only.
  // Import, technical gate, activation, rollback and AI pause stay with IT.
  hod: [
    { icon: "activity", label: "Clinical overview" },
    { icon: "sliders", label: "Assignment & escalation" },
    { icon: "people", label: "Reviewer roster" },
    { icon: "monitor", label: "Consultation rooms" },
    { icon: "shield", label: "Model approval" },
  ],
  it: [
    { icon: "activity", label: "Ops dashboard" },
    { icon: "alert", label: "Quarantine" },
    { icon: "file", label: "Audit log" },
    { icon: "monitor", label: "PACS & sites" },
    { icon: "shield", label: "Identity (SSO)" },
    { icon: "layers", label: "Model registry" },
    { icon: "database", label: "Backups" },
  ],
};

const subPages: Record<Role, SubPage[]> = {
  radiologist: [
    {
      eyebrow: "Radiologist",
      title: "Report",
      description: "Draft and signed Report. A signed report is locked and cannot be edited.",
      action: "Export PDF",
      actionIcon: "download",
      columns: ["Report", "Study", "Status", "System disposition", "Updated"],
      rows: [
        ["RPT-0913-084", "AIS-240913-084", "Draft", "Not decided", "Today · 08:50"],
        ["RPT-0913-063", "AIS-240913-063", "Signed", "Accepted unchanged", "Today · 08:18"],
        ["RPT-0913-052", "AIS-240913-052", "Signed", "Accepted with adjustment", "Today · 07:42"],
        ["RPT-0912-171", "AIS-240912-171", "Signed", "Not used", "Yesterday · 20:31"],
      ],
    },
    {
      eyebrow: "Consultation",
      title: "Consultation",
      description: "Rooms you requested or were invited to.",
      action: "Request a room",
      columns: ["Session", "Study", "Participants", "Status", "Last activity"],
      rows: [
        ["CON-0913-012", "AIS-240913-058", "4 clinicians", "Live", "2 min ago"],
        ["CON-0913-009", "AIS-240913-041", "3 clinicians", "Concluded", "07:12"],
        ["CON-0912-044", "AIS-240912-166", "5 clinicians", "Concluded", "Yesterday"],
      ],
    },
  ],
  physician: [
    {
      eyebrow: "Stroke physician",
      title: "Cases",
      description: "Signed-off studies and the treatment decisions you logged against them.",
      action: "Export summary",
      actionIcon: "download",
      columns: ["Study", "Treatment", "System usefulness", "Feedback", "Updated"],
      rows: [
        ["AIS-240913-063", "Thrombolysis", "Useful", "Complete", "08:31"],
        ["AIS-240913-058", "Thrombectomy", "Useful", "Complete", "08:12"],
        ["AIS-240913-041", "Conservative care", "Neutral", "Needs note", "07:05"],
      ],
    },
    {
      eyebrow: "Consultation",
      title: "Consultation",
      description: "Rooms you are invited to. Only radiologists can request a room.",
      action: "Join live room",
      columns: ["Session", "Study", "Chairman", "Status", "Last activity"],
      rows: [
        ["CON-0913-012", "AIS-240913-058", "Dr. Maya Harris", "Live", "2 min ago"],
        ["CON-0913-009", "AIS-240913-041", "Dr. Thomas Nguyen", "Concluded", "07:12"],
        ["CON-0912-044", "AIS-240912-166", "Dr. Priya Shah", "Concluded", "Yesterday"],
      ],
    },
  ],
  hod: [
    {
      eyebrow: "Governance",
      title: "Assignment & escalation",
      description:
        "Who reads which study, and who is alerted when a read runs late. Analysis SLA is fixed at 180 s.",
      action: "Save policy",
      actionIcon: "check",
      columns: ["Rule", "Current setting", "Applies to", "Escalate after", "Notify"],
      rows: [
        ["Critical study routing", "Workload-based", "NIHSS ≥ 10", "8 min", "Head of Department"],
        ["Standard assignment", "Round-robin", "All other studies", "15 min", "Shift lead"],
        ["Night coverage", "On-call reader", "23:00–07:00", "10 min", "On-call radiologist"],
      ],
    },
    {
      eyebrow: "Governance",
      title: "Reviewer roster",
      description: "",
      action: "Add from HRM directory",
      columns: [],
      rows: [],
    },
    {
      eyebrow: "Consultation",
      title: "Consultation rooms",
      description: "",
      action: "Assign room",
      columns: [],
      rows: [],
    },
    {
      eyebrow: "Governance",
      title: "Model approval",
      description:
        "Clinical gate for candidate models. Import, technical gate, activation and rollback stay with IT.",
      action: "Review evidence",
      actionIcon: "file",
      columns: ["Version", "Technical gate (IT)", "Clinical gate (HoD)", "Deployment"],
      rows: [
        ["v2.5.0", "Passed", "{clinical}", "Candidate"],
        ["v2.4.1", "Passed", "Approved", "Active"],
        ["v2.3.0", "Passed", "Approved", "Archived"],
      ],
    },
  ],
  it: [
    {
      eyebrow: "Operations",
      title: "Quarantine",
      description: "Validation and processing failures held out of the worklist.",
      action: "Export incidents",
      actionIcon: "download",
      columns: ["Incident", "Technical reason", "Task", "Received", "Fallback"],
      rows: [
        ["INC-0913-028", "SLA timeout · 184s", "TASK-028", "08:41", "Manual reading"],
        ["INC-0913-027", "Missing FLAIR · C000", "TASK-027", "08:29", "PACS notified"],
        ["INC-0913-024", "Affine mismatch · Q102", "TASK-024", "07:58", "PACS notified"],
      ],
    },
    {
      eyebrow: "Operations",
      title: "Audit log",
      description: "Read-only and immutable. Every sign-off, mask revision, join and roster change is recorded.",
      action: "Export log",
      actionIcon: "download",
      columns: ["Time", "Event", "Actor", "Object", "Result"],
      rows: [
        ["08:46:12", "CONSULT_JOINED", "usr_phy_024", "CON-0913-012", "200 OK"],
        ["08:43:08", "MASK_REVISED", "usr_rad_011", "MSK-084-02", "201"],
        ["08:41:54", "ACCESS_DENIED", "usr_hod_003", "/admin/pacs", "403"],
        ["08:39:22", "SSO_SYNC", "worker_sso_01", "HRM directory", "200 OK"],
      ],
    },
    {
      eyebrow: "Operations",
      title: "PACS & sites",
      description: "Submit-only DICOM nodes and scanner sites. PACS has no permission to view results.",
      action: "Test connection",
      actionIcon: "refresh",
      columns: ["Node", "AE title", "Endpoint", "Last C-ECHO", "Status"],
      rows: [
        ["Main MRI", "HOSP_MRI_01", "10.20.4.18:104", "24 sec ago", "Connected"],
        ["Emergency MRI", "ER_MRI_02", "10.20.4.22:104", "31 sec ago", "Connected"],
        ["PACS archive", "PACS_CORE", "10.20.2.10:11112", "18 sec ago", "Connected"],
      ],
    },
    {
      eyebrow: "Identity",
      title: "Identity (SSO)",
      description:
        "Accounts sync from the hospital HRM. Roles come from HRM group mapping. Nobody is created or edited here.",
      action: "Sync now",
      actionIcon: "refresh",
      columns: ["HRM group", "Maps to role", "Accounts", "Last sync", "Status"],
      rows: [
        ["Radiology attending", "Radiologist", "6", "Today · 08:00", "Mapped"],
        ["Stroke neurology", "Stroke Physician", "8", "Today · 08:00", "Mapped"],
        ["Radiology department head", "Head of Department", "1", "Today · 08:00", "Mapped"],
        ["IT operations", "IT Administrator", "3", "Today · 08:00", "Mapped"],
        ["Contract staff (no group)", "No role assigned", "2", "Today · 08:00", "Needs mapping"],
      ],
    },
    {
      eyebrow: "Models",
      title: "Model registry",
      description: "Package import, technical gate, activation and rollback.",
      action: "Import package",
      columns: ["Version", "Architecture", "SHA-256", "Technical gate", "Clinical gate", "Deployment"],
      rows: [
        ["v2.5.0", "3D nnU-Net", "Verified", "Passed", "{clinical}", "Candidate"],
        ["v2.4.1", "3D nnU-Net", "Verified", "Passed", "Approved", "Active"],
        ["v2.3.0", "3D nnU-Net", "Verified", "Passed", "Approved", "Archived"],
      ],
    },
    {
      eyebrow: "Operations",
      title: "Backups",
      description: "Backup status and retention. Restore runs only through CLI or bastion, never from this app.",
      action: "Back up now",
      columns: ["Resource", "Usage", "Last backup", "Integrity", "Retention"],
      rows: [
        ["PostgreSQL", "68 GB", "Today · 02:00", "Verified", "30 days"],
        ["Object Storage", "1.8 TB", "Today · 02:00", "Verified", "30 days"],
        ["Audit Store", "42 GB", "Today · 02:04", "Verified", "7 years"],
      ],
    },
  ],
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    alert: (
      <>
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    brain: (
      <>
        <path d="M9.5 4.5A3 3 0 0 0 4 6.2a3 3 0 0 0 .4 5.7A3.5 3.5 0 0 0 8 17.5c.4 1.5 1.8 2.5 3.5 2.5V4a3 3 0 0 0-2-.7ZM14.5 4.5A3 3 0 0 1 20 6.2a3 3 0 0 1-.4 5.7 3.5 3.5 0 0 1-3.6 5.6c-.4 1.5-1.8 2.5-3.5 2.5V4a3 3 0 0 1 2-.7Z" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    download: <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />,
    edit: (
      <>
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    file: (
      <>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M14 3v4h4M9 12h6M9 16h6" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3-9 5 9 5 9-5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    logout: <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    mic: (
      <>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
    monitor: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    pause: <path d="M9 5v14M15 5v14" />,
    people: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: (
      <path d="M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5" />
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    server: (
      <>
        <rect x="3" y="4" width="18" height="6" rx="2" />
        <rect x="3" y="14" width="18" height="6" rx="2" />
        <path d="M7 7h.01M7 17h.01" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1A8 8 0 0 0 15 6l-.3-2.6h-4L10.4 6A8 8 0 0 0 8 7L5.6 6 3.7 9.5l2 1.5a7 7 0 0 0 0 2l-2 1.5L5.6 18 8 17a8 8 0 0 0 2.4 1l.3 2.6h4L15 18a8 8 0 0 0 1.5-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.6 7.5 9.5 4.4-1.9 7.5-4.9 7.5-9.5V6L12 3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    sliders: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    x: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function schedulePathOpen() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/schedule" || path.endsWith("/schedule");
}

function setSchedulePath(open: boolean, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  const openNow = schedulePathOpen();
  if (open === openNow) return;
  url.pathname = open ? "/schedule" : "/";
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
}

function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("nf_authed") === "1");
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [role, setRole] = useState<Role>(() => {
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    return ["radiologist", "physician", "hod", "it"].includes(requestedRole ?? "")
      ? (requestedRole as Role)
      : "radiologist";
  });
  const [activeNav, setActiveNav] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(() => schedulePathOpen());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [aiActive, setAiActive] = useState(true);
  const [clinicalGate, setClinicalGate] = useState<ClinicalGate>("pending");
  const [assignmentPolicy, setAssignmentPolicy] = useState<AssignmentPolicy>(defaultAssignmentPolicy);
  const [sessionLocked, setSessionLocked] = useState(false);
  const [lockDeadline, setLockDeadline] = useState<number | null>(null);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [demoActorsOpen, setDemoActorsOpen] = useState(false);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [emergencyKeepAlive, setEmergencyKeepAlive] = useState(false);
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const [apiStatus, setApiStatus] = useState<"offline" | "connecting" | "online">("connecting");

  const pushToast: NotifyFn = (message, undo) => setToast({ message, undo });

  useEffect(() => {
    const syncSchedule = () => {
      const open = schedulePathOpen();
      setScheduleOpen(open);
      if (open) {
        setActiveNav(0);
        setShowAccount(false);
        setConsultationId(null);
      }
    };
    window.addEventListener("popstate", syncSchedule);
    return () => window.removeEventListener("popstate", syncSchedule);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncApi = async () => {
      if (!authed) {
        const up = await pingDemoApi();
        if (!cancelled) setApiStatus(up ? "online" : "offline");
        return;
      }
      setApiStatus("connecting");
      const ok = await ensureDemoSession(role);
      if (!cancelled) setApiStatus(ok ? "online" : "offline");
    };
    void syncApi();
    return () => {
      cancelled = true;
    };
  }, [authed, role]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.undo ? 10000 : 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedWork) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedWork]);

  useIdleSession({
    enabled: authed && !sessionLocked,
    keepAlive: emergencyKeepAlive,
    onIdle: () => {
      setSessionLocked(true);
      setLockDeadline(Date.now() + LOCK_GRACE_MS);
      pushToast("Session locked after 15 minutes of inactivity");
    },
  });

  useEffect(() => {
    if (!sessionLocked || !lockDeadline) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= lockDeadline) {
        sessionStorage.removeItem("nf_authed");
        setAuthed(false);
        setSessionLocked(false);
        setLockDeadline(null);
        setAuthScreen("expired");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionLocked, lockDeadline]);

  const completeLogin = (nextRole: Role) => {
    sessionStorage.setItem("nf_authed", "1");
    setAuthed(true);
    setRole(nextRole);
    setActiveNav(0);
    setShowAccount(false);
    setConsultationId(null);
    if (nextRole === "radiologist" && schedulePathOpen()) {
      setScheduleOpen(true);
    } else {
      setScheduleOpen(false);
      setSchedulePath(false, "replace");
    }
    setSessionLocked(false);
    setLockDeadline(null);
    const url = new URL(window.location.href);
    url.searchParams.set("role", nextRole);
    url.searchParams.delete("study");
    window.history.replaceState({}, "", url);
    pushToast(`Signed in as ${roles[nextRole].label}`);
  };

  const requestRoleChange = (next: Role) => {
    if (next === role) return;
    setPendingRole(next);
  };

  const confirmRoleChange = (password: string) => {
    if (!pendingRole) return false;
    if (!checkDemoPassword(password)) return false;
    setRole(pendingRole);
    setActiveNav(0);
    setSidebarOpen(false);
    setShowAccount(false);
    setConsultationId(null);
    setHasUnsavedWork(false);
    if (pendingRole === "radiologist" && schedulePathOpen()) {
      setScheduleOpen(true);
    } else {
      setScheduleOpen(false);
      setSchedulePath(false, "replace");
    }
    const url = new URL(window.location.href);
    url.searchParams.set("role", pendingRole);
    url.searchParams.delete("study");
    window.history.replaceState({}, "", url);
    setPendingRole(null);
    pushToast(`Re-authenticated · switched to ${roles[pendingRole].label}`);
    return true;
  };

  const openSchedule = () => {
    setShowAccount(false);
    setConsultationId(null);
    setSidebarOpen(false);
    setActiveNav(0);
    setScheduleOpen(true);
    setSchedulePath(true, "push");
  };

  const closeSchedule = () => {
    setScheduleOpen(false);
    setActiveNav(0);
    setSchedulePath(false, "push");
  };

  const logout = () => {
    sessionStorage.removeItem("nf_authed");
    setAuthed(false);
    setSessionLocked(false);
    setShowAccount(false);
    setAuthScreen("login");
    setHasUnsavedWork(false);
  };

  if (!authed) {
    return (
      <div className="app-shell">
        <a className="skip-link" href="#auth-main">
          Skip to main content
        </a>
        <AuthViews screen={authScreen} onScreenChange={setAuthScreen} onLogin={completeLogin} />
        <AppToast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    );
  }

  return (
    <div className="app-shell sketch-app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar
        role={role}
        activeNav={role === "radiologist" && scheduleOpen ? -1 : activeNav}
        open={sidebarOpen}
        worklistCount={cases.length}
        onNavigate={(index) => {
          setShowAccount(false);
          setConsultationId(null);
          setScheduleOpen(false);
          setActiveNav(index);
          setSchedulePath(false, "push");
        }}
        onClose={() => setSidebarOpen(false)}
        onOpenAccount={() => {
          setShowAccount(true);
          setConsultationId(null);
          setSidebarOpen(false);
        }}
        onLockNow={() => {
          setSessionLocked(true);
          setLockDeadline(Date.now() + LOCK_GRACE_MS);
        }}
        onLogout={logout}
      />
      <div className="app-main">
        <Header
          role={role}
          pageTitle={
            showAccount
              ? "Account settings"
              : consultationId
                ? "Consultation room"
                : role === "radiologist" && scheduleOpen
                  ? "My schedule"
                : navByRole[role][activeNav].label
          }
          aiActive={aiActive}
          apiStatus={apiStatus}
          demoActorsOpen={demoActorsOpen}
          onToggleDemoActors={() => setDemoActorsOpen((value) => !value)}
          onRoleChange={requestRoleChange}
          onMenu={() => setSidebarOpen(true)}
          onLockNow={() => {
            setSessionLocked(true);
            setLockDeadline(Date.now() + LOCK_GRACE_MS);
          }}
          notify={pushToast}
        />
        {hasUnsavedWork && (
          <div className="unsaved-banner" role="status">
            <Icon name="alert" size={16} />
            <span>
              Unsaved changes on this study. Save or discard before leaving.
            </span>
          </div>
        )}
        <main className="page" id="main-content" tabIndex={-1}>
          {showAccount ? (
            <AccountSettingsView role={role} onLogout={logout} notify={pushToast} />
          ) : consultationId ? (
            <VirtualReviewRoom
              sessionId={consultationId}
              role={role}
              onBack={() => setConsultationId(null)}
              notify={pushToast}
            />
          ) : role === "radiologist" && activeNav === 0 ? (
            <RadiologistView
              notify={pushToast}
              onEmergencyKeepAlive={setEmergencyKeepAlive}
              onUnsavedChange={setHasUnsavedWork}
              scheduleOpen={scheduleOpen}
              onCloseSchedule={closeSchedule}
              onOpenSchedule={openSchedule}
            />
          ) : activeNav > 0 ? (
            <SubWorkspaceView
              role={role}
              page={subPages[role][activeNav - 1]}
              notify={pushToast}
              onOpenConsultation={setConsultationId}
              clinicalGate={clinicalGate}
              onClinicalGateChange={setClinicalGate}
              assignmentPolicy={assignmentPolicy}
              onAssignmentPolicyChange={setAssignmentPolicy}
            />
          ) : (
            <>
              {role === "physician" && (
                <PhysicianView notify={pushToast} onOpenConsultation={setConsultationId} />
              )}
              {role === "hod" && (
                <HodView
                  aiActive={aiActive}
                  notify={pushToast}
                  policy={assignmentPolicy}
                  onOpenAssignment={() => setActiveNav(1)}
                />
              )}
              {role === "it" && (
                <ItView aiActive={aiActive} onAiChange={setAiActive} notify={pushToast} />
              )}
            </>
          )}
        </main>
      </div>
      {pendingRole && (
        <RoleReauthModal
          target={pendingRole}
          onCancel={() => setPendingRole(null)}
          onConfirm={confirmRoleChange}
        />
      )}
      {sessionLocked && (
        <SessionLockOverlay
          role={role}
          deadline={lockDeadline}
          onUnlock={() => {
            if (DEMO_MODE) {
              setSessionLocked(false);
              setLockDeadline(null);
              pushToast("Session unlocked");
              return true;
            }
            if (SSO_START_URL) {
              window.location.assign(SSO_START_URL);
              return true;
            }
            return false;
          }}
          onExpire={logout}
        />
      )}
      <AppToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function displayName(role: Role) {
  return role === "radiologist"
    ? "Dr. Lena Morgan"
    : role === "physician"
      ? "Dr. Maya Harris"
      : role === "hod"
        ? "Dr. Thomas Nguyen"
        : "Alex Nguyen";
}

function staffId(role: Role) {
  return role === "radiologist" ? "RAD-011" : role === "physician" ? "PHY-024" : role === "hod" ? "HOD-003" : "IT-008";
}

function Sidebar({
  role,
  activeNav,
  open,
  worklistCount,
  onNavigate,
  onClose,
  onOpenAccount,
  onLockNow,
  onLogout,
}: {
  role: Role;
  activeNav: number;
  open: boolean;
  worklistCount: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onOpenAccount: () => void;
  onLockNow: () => void;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      {open && <button className="sidebar-scrim" aria-label="Close menu" onClick={onClose} />}
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Primary workspace navigation">
        <div className="brand">
          <div className="brand-mark">
            <Icon name="brain" size={23} />
          </div>
          <div>
            <strong>
              UDA-<span>StrokeSeg</span>
            </strong>
            <small>AIS lesion segmentation</small>
          </div>
        </div>
        <div className="workspace-label">
          <span>Signed in as</span>
          <strong>{roles[role].label}</strong>
        </div>
        <nav className="side-nav" aria-label={`${roles[role].label} navigation`}>
          {navByRole[role].map((item, index) => (
            <button
              key={item.label}
              className={activeNav === index ? "active" : ""}
              onClick={() => {
                onNavigate(index);
                onClose();
              }}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {index === 0 && role === "radiologist" && <b className="nav-count">{worklistCount}</b>}
              {index === 0 && role === "it" && <i />}
            </button>
          ))}
        </nav>
        <div className="sketch-identity">
          <strong>{displayName(role)}</strong>
          <span>{roles[role].label}</span>
          <span>{staffId(role)}</span>
        </div>
        <button type="button" className="sketch-signout" onClick={onLogout}>
          Sign out
        </button>
        <div className="sidebar-user-wrap">
          <button
            type="button"
            className="sidebar-user"
            aria-label={`Account menu for ${roles[role].label}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="avatar">{roles[role].initials}</span>
            <span>
              <strong>{displayName(role)}</strong>
              <small>{roles[role].label}</small>
            </span>
            <Icon name="more" size={18} />
          </button>
          {menuOpen && (
            <div className="account-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAccount();
                }}
              >
                <Icon name="settings" size={15} /> Account settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLockNow();
                }}
              >
                <Icon name="lock" size={15} /> Lock session now
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
              >
                <Icon name="logout" size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Header({
  role,
  pageTitle,
  aiActive,
  apiStatus,
  demoActorsOpen,
  onToggleDemoActors,
  onRoleChange,
  onMenu,
  onLockNow,
  notify,
}: {
  role: Role;
  pageTitle: string;
  aiActive: boolean;
  apiStatus: "offline" | "connecting" | "online";
  demoActorsOpen: boolean;
  onToggleDemoActors: () => void;
  onRoleChange: (role: Role) => void;
  onMenu: () => void;
  onLockNow: () => void;
  notify: NotifyFn;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const systemState = !aiActive
    ? "paused"
    : apiStatus === "online"
      ? "ok"
      : apiStatus === "connecting"
        ? "connecting"
        : "offline";
  const systemLabel = {
    ok: "All systems normal",
    paused: "Analysis paused",
    connecting: "Connecting…",
    offline: "API offline",
  }[systemState];
  const systemDetail = `Inference: ${aiActive ? "online" : "paused, manual reading fallback"}. API: ${apiStatus}.`;
  return (
    <header className="topbar">
      <button className="menu-button" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <div className="topbar-title">
        <span>UDA-StrokeSeg / {roles[role].short}</span>
        <strong>{pageTitle}</strong>
      </div>
      <div
        className={`service-pill ${systemState === "ok" ? "" : systemState === "connecting" ? "connecting" : "stopped"}`}
        tabIndex={0}
        title={systemDetail}
      >
        <i />
        <span role="status">{systemLabel}</span>
        <span className="sr-only">{systemDetail}</span>
      </div>
      {DEMO_MODE && (
        <div className={`role-control ${demoActorsOpen ? "open" : "collapsed"}`}>
          <button
            type="button"
            className="demo-actors-toggle"
            aria-expanded={demoActorsOpen}
            onClick={onToggleDemoActors}
          >
            Demo actors
          </button>
          {demoActorsOpen && (
            <>
              <div className="role-switcher" aria-label="Request actor workspace switch">
                {(Object.keys(roles) as Role[]).map((item) => (
                  <button
                    key={item}
                    className={role === item ? "active" : ""}
                    onClick={() => onRoleChange(item)}
                    aria-pressed={role === item}
                  >
                    <b>{roles[item].label}</b>
                    <em>{roles[item].short}</em>
                  </button>
                ))}
              </div>
              <select
                className="role-select"
                aria-label="Request actor workspace switch"
                value={role}
                onChange={(event) => onRoleChange(event.target.value as Role)}
              >
                {(Object.keys(roles) as Role[]).map((item) => (
                  <option value={item} key={item}>
                    {roles[item].label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
      <button className="icon-button" aria-label="Lock session now" onClick={onLockNow}>
        <Icon name="lock" size={18} />
      </button>
      <div className="notification-wrap">
        <button
          className="icon-button notification-button"
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
          title="Notifications"
          onClick={() => setNotificationsOpen((value) => !value)}
        >
          <Icon name="bell" size={19} />
          <span />
        </button>
        {notificationsOpen && (
          <div className="notification-panel" role="dialog" aria-label="Notifications">
            <strong>Notifications</strong>
            <p>No unread notifications for this shift.</p>
            <ul className="notification-empty-hints">
              <li>Critical SLA breaches</li>
              <li>Consultation invitations</li>
              <li>Model gate decisions</li>
              <li>Fallback reassignments</li>
            </ul>
            <button
              type="button"
              className="secondary-button small"
              onClick={() => setNotificationsOpen(false)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function SubWorkspaceView({
  role,
  page,
  notify,
  onOpenConsultation,
  clinicalGate,
  onClinicalGateChange,
  assignmentPolicy,
  onAssignmentPolicyChange,
}: {
  role: Role;
  page: SubPage;
  notify: NotifyFn;
  onOpenConsultation: (sessionId: string) => void;
  clinicalGate: ClinicalGate;
  onClinicalGateChange: (value: ClinicalGate) => void;
  assignmentPolicy: AssignmentPolicy;
  onAssignmentPolicyChange: (value: AssignmentPolicy) => void;
}) {
  const [query, setQuery] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const gateLabel = clinicalGate === "approved" ? "Approved" : clinicalGate === "rejected" ? "Rejected" : "Pending";
  const rows = page.rows
    .map((row) => row.map((cell) => (cell === "{clinical}" ? gateLabel : cell)))
    .filter((row) => row.join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const isConsultation = page.title.toLowerCase().includes("consultation");

  if (page.title === "Reviewer roster") {
    return <ReviewerRosterView notify={notify} />;
  }

  if (role === "hod" && page.title === "Assignment & escalation") {
    return (
      <AssignmentEscalationView
        page={page}
        policy={assignmentPolicy}
        onPolicyChange={onAssignmentPolicyChange}
        notify={notify}
      />
    );
  }

  if (isConsultation) {
    return (
      <ConsultationLobby
        role={role}
        onOpenSession={onOpenConsultation}
        notify={notify}
        defaultStudyId="AIS-240913-058"
        canStartEmergency={role === STANDING_CHAIR_ROLE}
      />
    );
  }

  return (
    <>
      <PageIntro eyebrow={page.eyebrow} title={page.title} description={page.description}>
        <button
          className="primary-button"
          onClick={() => {
            notify(`${page.action} opened`);
          }}
        >
          <Icon name={page.actionIcon ?? "plus"} size={16} />
          {page.action}
        </button>
      </PageIntro>
      <div className="workspace-boundary">
        <span className="workspace-role-icon">
          <Icon
            name={
              role === "radiologist"
                ? "brain"
                : role === "physician"
                  ? "activity"
                  : role === "hod"
                    ? "shield"
                    : "server"
            }
            size={17}
          />
        </span>
        <p>
          <strong>{roles[role].label}</strong>
          <span>Access limited to this role.</span>
        </p>
        <span className="access-badge">
          <Icon name="lock" size={13} /> Role enforced
        </span>
      </div>
      {page.title === "Model registry" && (
        <div className="workflow-callout">
          <div>
            <span className="section-kicker">Candidate v2.5.0</span>
            <strong>
              {clinicalGate === "approved"
                ? "Both gates passed · ready to activate"
                : clinicalGate === "rejected"
                  ? "Activation blocked - clinical gate rejected"
                  : "Activation blocked - clinical gate pending"}
            </strong>
            <small>Studies already processing keep the current model (v2.4.1).</small>
          </div>
          <span className="gate-status done">
            <Icon name="check" size={14} /> Technical gate passed
          </span>
          <span className={`gate-status ${clinicalGate === "approved" ? "done" : "pending"}`}>
            <Icon name={clinicalGate === "approved" ? "check" : "clock"} size={14} /> Clinical gate {gateLabel.toLowerCase()}
          </span>
          <button
            className="primary-button"
            disabled={clinicalGate !== "approved"}
            title={clinicalGate !== "approved" ? "Waiting for clinical gate approval" : undefined}
            onClick={() => notify("v2.5.0 will apply to new studies only · running jobs keep v2.4.1")}
          >
            Activate v2.5.0
          </button>
          <CtaHint show={clinicalGate !== "approved"}>
            The Head of Department approves the clinical gate. IT cannot activate without it.
          </CtaHint>
          <div className="ai-caution compact" role="status">
            <Icon name="alert" size={15} />
            <span>
              <TermTip tip="Dual-gate: both the technical gate (IT) and the clinical gate (Head of Department) are required before a model enters clinical service.">
                Dual-gate
              </TermTip>{" "}
              required. Candidate metrics are for evaluation only, not a production accuracy claim.
            </span>
          </div>
        </div>
      )}
      {page.title === "Model approval" && (
        <div className="workflow-callout">
          <div>
            <span className="section-kicker">Candidate v2.5.0</span>
            <strong>
              {clinicalGate === "pending"
                ? "Clinical gate waiting for your decision"
                : `Clinical gate ${gateLabel.toLowerCase()}`}
            </strong>
            <small>
              Technical gate passed by IT. Your decision is audited. Candidate metrics are for evaluation
              only.
            </small>
          </div>
          {clinicalGate === "pending" ? (
            <>
              <label className="form-label">
                Reason (required to reject)
                <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
              </label>
              <button
                className="primary-button"
                onClick={() => {
                  onClinicalGateChange("approved");
                  notify("Clinical gate approved · IT can now activate v2.5.0", () => onClinicalGateChange("pending"));
                }}
              >
                Approve clinical gate
              </button>
              <button
                className="danger-button"
                disabled={!rejectReason.trim()}
                onClick={() => {
                  onClinicalGateChange("rejected");
                  notify("Clinical gate rejected · IT notified", () => onClinicalGateChange("pending"));
                }}
              >
                Reject
              </button>
            </>
          ) : (
            <button className="secondary-button" onClick={() => onClinicalGateChange("pending")}>
              Reopen decision
            </button>
          )}
        </div>
      )}
      {page.title === "Identity (SSO)" && (
        <div className="workflow-callout">
          <div>
            <span className="section-kicker">SSO connection</span>
            <strong>Connected · last sync today 08:00</strong>
            <small>
              Protocol: OIDC (authorization code with PKCE) · sync every 15 min. Accounts are created,
              edited and disabled in the HRM. This app has no Create account.
            </small>
            <small>
              If HRM disables someone who holds an open study, access ends at the next sync or token
              refresh, the study returns to the fallback queue and the Head of Department is notified.
            </small>
          </div>
          <span className="gate-status done">
            <Icon name="check" size={14} /> Connected
          </span>
          <span className="gate-status pending">
            <Icon name="alert" size={14} /> 2 accounts need mapping
          </span>
        </div>
      )}
      {page.title === "Quarantine" && (
        <div className="workflow-callout quarantine-detail">
          <div>
            <span className="section-kicker">Latest failure · INC-0913-027</span>
            <strong>Missing mandatory sequence: FLAIR</strong>
            <small>
              AE Title ER_MRI_02 · Received 08:29 · DICOM response{" "}
              <TermTip tip="DICOM failure status 0xC000 - processing could not complete; typically a missing or rejected series.">
                0xC000
              </TermTip>
            </small>
          </div>
          <button
            className="secondary-button"
            onClick={() => notify("Rescan request sent to PACS workstation · 0xC000")}
          >
            Request rescan
          </button>
        </div>
      )}
      {page.title === "Audit log" && (
        <div className="workflow-callout">
          <div>
            <span className="section-kicker">Audit</span>
            <strong>Events cannot be edited or deleted</strong>
          </div>
          <span className="gate-status done">
            <Icon name="lock" size={14} /> Integrity verified
          </span>
          <button
            className="secondary-button"
            onClick={() => notify("Signed JSON payload opened in read-only mode")}
          >
            View JSON payload
          </button>
        </div>
      )}
      <section className="panel subpage-panel">
        <div className="subpage-tools">
          <label className="search-field">
            <Icon name="search" size={17} />
            <input
              aria-label={`Search ${page.title}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${page.title.toLowerCase()}...`}
            />
          </label>
          <span>{rows.length} records</span>
          <button className="secondary-button" onClick={() => notify(`${page.title} refreshed`)}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
        </div>
        <div className="subpage-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {page.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${row[0]}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${cell}-${cellIndex}`}
                      className={
                        cellIndex === 0
                          ? "primary-cell"
                          : [
                                "Active",
                                "Connected",
                                "Verified",
                                "Approved",
                                "200 OK",
                                "201",
                                "Current",
                              ].includes(cell)
                            ? "positive-cell"
                            : ["FAILED", "Pending", "Awaiting review", "Needs note"].includes(cell)
                              ? "attention-cell"
                              : ""
                      }
                    >
                      {cellIndex === 0 ? (
                        <button
                          type="button"
                          className="table-link"
                          onClick={() => {
                            if (isConsultation) onOpenConsultation(cell);
                            else notify(`${cell} selected`);
                          }}
                        >
                          {cell}
                        </button>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="subpage-empty">
              <Icon name="search" size={22} />
              <strong>No matching records</strong>
              <span>Try a different search term.</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

type RosterStatus = "On shift" | "Off shift" | "On leave";
type RosterPerson = {
  name: string;
  staffId: string;
  specialty: string;
  status: RosterStatus;
  today: string;
  openCases: number;
  tat7d: string;
  eligible: boolean;
  autoAssign: boolean;
  week: string[];
  hrmTitle: string;
  hrmSite: string;
  history: string[];
};

const initialRoster: RosterPerson[] = [
  {
    name: "Dr. Lena Morgan",
    staffId: "RAD-011",
    specialty: "Neuroradiology",
    status: "On shift",
    today: "AM",
    openCases: 4,
    tat7d: "14 min",
    eligible: true,
    autoAssign: true,
    week: ["AM", "AM", "-", "AM", "AM", "-", "-"],
    hrmTitle: "Attending radiologist",
    hrmSite: "Main campus",
    history: ["Eligible switched on · 02 Sep", "Added to roster · 12 Jan"],
  },
  {
    name: "Dr. Priya Shah",
    staffId: "RAD-014",
    specialty: "Neuroradiology",
    status: "On shift",
    today: "AM",
    openCases: 3,
    tat7d: "16 min",
    eligible: true,
    autoAssign: true,
    week: ["AM", "-", "AM", "AM", "-", "PM", "-"],
    hrmTitle: "Attending radiologist",
    hrmSite: "Main campus",
    history: ["Added to roster · 03 Mar"],
  },
  {
    name: "Dr. Noah Williams",
    staffId: "RAD-019",
    specialty: "General radiology",
    status: "Off shift",
    today: "PM",
    openCases: 0,
    tat7d: "19 min",
    eligible: true,
    autoAssign: false,
    week: ["PM", "PM", "PM", "-", "-", "AM", "-"],
    hrmTitle: "Radiologist",
    hrmSite: "Emergency wing",
    history: ["Auto-assignment switched off · 20 Aug", "Added to roster · 14 May"],
  },
  {
    name: "Dr. Sofia Chen",
    staffId: "RAD-023",
    specialty: "Neuroradiology",
    status: "Off shift",
    today: "Night",
    openCases: 0,
    tat7d: "17 min",
    eligible: true,
    autoAssign: true,
    week: ["Night", "Night", "-", "-", "Night", "Night", "-"],
    hrmTitle: "Attending radiologist",
    hrmSite: "Main campus",
    history: ["Added to roster · 21 Jun"],
  },
  {
    name: "Dr. Minh Tran",
    staffId: "RAD-027",
    specialty: "Interventional neuroradiology",
    status: "On leave",
    today: "-",
    openCases: 0,
    tat7d: "-",
    eligible: true,
    autoAssign: false,
    week: ["-", "-", "-", "-", "-", "-", "-"],
    hrmTitle: "Consultant radiologist",
    hrmSite: "Main campus",
    history: ["Auto-assignment switched off · 09 Nov"],
  },
];

const hrmDirectory = [
  { name: "Dr. Arjun Rao", staffId: "RAD-031", specialty: "General radiology" },
  { name: "Dr. Hana Kim", staffId: "RAD-034", specialty: "Neuroradiology" },
];

function ReviewerRosterView({ notify }: { notify: NotifyFn }) {
  const [people, setPeople] = useState<RosterPerson[]>(initialRoster);
  const [filter, setFilter] = useState<"All" | RosterStatus>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialRoster[0].staffId);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const counts = {
    All: people.length,
    "On shift": people.filter((item) => item.status === "On shift").length,
    "Off shift": people.filter((item) => item.status === "Off shift").length,
    "On leave": people.filter((item) => item.status === "On leave").length,
  };
  const visible = people.filter(
    (item) =>
      (filter === "All" || item.status === filter) &&
      `${item.name} ${item.staffId} ${item.specialty}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const selected = people.find((item) => item.staffId === selectedId) ?? people[0];
  const update = (staffId: string, patch: Partial<RosterPerson>) =>
    setPeople((list) => list.map((item) => (item.staffId === staffId ? { ...item, ...patch } : item)));
  const initials = (name: string) =>
    name
      .replace("Dr. ", "")
      .split(" ")
      .map((word) => word[0])
      .join("");
  const statusTone = (status: RosterStatus) => (status === "On shift" ? "info" : "neutral");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const available = hrmDirectory.filter((item) => !people.some((p) => p.staffId === item.staffId));

  return (
    <>
      <PageIntro
        eyebrow="Governance"
        title="Reviewer roster"
        description="Who can read stroke MRI and who is included in auto-assignment. People come from the HRM; nobody is created here."
      >
        <button className="primary-button" onClick={() => setDirectoryOpen((value) => !value)} aria-expanded={directoryOpen}>
          <Icon name="plus" size={16} /> Add from HRM directory
        </button>
      </PageIntro>
      {directoryOpen && (
        <section className="panel roster-directory" aria-label="HRM directory">
          <h2>HRM directory</h2>
          {available.length === 0 ? (
            <p className="muted-line">Everyone synced from the HRM is already on the roster.</p>
          ) : (
            <ul>
              {available.map((item) => (
                <li key={item.staffId}>
                  <span className="avatar">{initials(item.name)}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.staffId} · {item.specialty}
                    </small>
                  </span>
                  <button
                    className="secondary-button small"
                    onClick={() => {
                      setPeople((list) => [
                        ...list,
                        {
                          ...item,
                          status: "Off shift",
                          today: "-",
                          openCases: 0,
                          tat7d: "-",
                          eligible: false,
                          autoAssign: false,
                          week: ["-", "-", "-", "-", "-", "-", "-"],
                          hrmTitle: "Radiologist",
                          hrmSite: "Main campus",
                          history: ["Added to roster · today"],
                        },
                      ]);
                      notify(`${item.name} added to roster · not yet eligible to read`);
                    }}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="roster-layout">
        <section className="panel roster-main" aria-label="Reviewers">
          <div className="roster-tools">
            <label className="search-field">
              <Icon name="search" size={17} />
              <input
                aria-label="Search reviewers"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, staff ID or specialty"
              />
            </label>
            <div className="chip-group" role="group" aria-label="Filter by status">
              {(["All", "On shift", "Off shift", "On leave"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={filter === item ? "active" : ""}
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                >
                  {item} <b>{counts[item]}</b>
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <div className="empty-state">
              <strong>No reviewers match</strong>
              <button
                className="secondary-button"
                onClick={() => {
                  setQuery("");
                  setFilter("All");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="subpage-table-wrap">
              <table className="data-table roster-table">
                <thead>
                  <tr>
                    <th scope="col">Reviewer</th>
                    <th scope="col">Specialty</th>
                    <th scope="col">Eligible</th>
                    <th scope="col">Status</th>
                    <th scope="col">Today</th>
                    <th scope="col">Open</th>
                    <th scope="col">TAT 7 d</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.staffId} className={item.staffId === selected.staffId ? "selected" : ""}>
                      <td>
                        <button
                          type="button"
                          className="roster-name"
                          aria-current={item.staffId === selected.staffId}
                          onClick={() => {
                            setSelectedId(item.staffId);
                            setConfirmRemove(false);
                          }}
                        >
                          <span className="avatar">{initials(item.name)}</span>
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.staffId}</small>
                          </span>
                        </button>
                      </td>
                      <td>{item.specialty}</td>
                      <td>{item.eligible ? "Yes" : "No"}</td>
                      <td>
                        <span className={`chip ${statusTone(item.status)}`}>{item.status}</span>
                      </td>
                      <td>{item.today}</td>
                      <td className="num">{item.openCases}</td>
                      <td className="num">{item.tat7d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h2 className="roster-week-title">Week schedule</h2>
          <p className="muted-line">Synced from HRM · read-only. Change shifts in HRM, not here.</p>
          <div className="subpage-table-wrap">
            <table className="data-table roster-week">
              <thead>
                <tr>
                  <th scope="col">Reviewer</th>
                  {days.map((day) => (
                    <th key={day} scope="col">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((item) => (
                  <tr key={item.staffId}>
                    <th scope="row">{item.name}</th>
                    {item.week.map((slot, index) => (
                      <td key={days[index]}>{slot === "-" ? <span className="muted-line">Off</span> : slot}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {selected && (
        <aside className="panel roster-detail" aria-label={`Details for ${selected.name}`}>
          <div className="roster-detail-head">
            <span className="avatar">{initials(selected.name)}</span>
            <div>
              <h2>{selected.name}</h2>
              <p>
                {selected.staffId} · {selected.specialty}
              </p>
            </div>
          </div>
          <h3>From HRM (read-only)</h3>
          <dl className="account-grid dense">
            <div>
              <dt>Title</dt>
              <dd>{selected.hrmTitle}</dd>
            </div>
            <div>
              <dt>Site</dt>
              <dd>{selected.hrmSite}</dd>
            </div>
          </dl>
          <h3>Reading rights</h3>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={selected.eligible}
              onChange={(event) => {
                update(selected.staffId, {
                  eligible: event.target.checked,
                  autoAssign: event.target.checked ? selected.autoAssign : false,
                });
                notify(`Eligible to read stroke MRI ${event.target.checked ? "on" : "off"} · ${selected.name}`);
              }}
            />
            Eligible to read stroke MRI
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={selected.autoAssign}
              disabled={!selected.eligible}
              onChange={(event) => {
                update(selected.staffId, { autoAssign: event.target.checked });
                notify(`Included in auto-assignment ${event.target.checked ? "on" : "off"} · ${selected.name}`);
              }}
            />
            Included in auto-assignment
          </label>
          {!selected.eligible && (
            <p className="muted-line">Turn on eligibility first to include this reviewer in auto-assignment.</p>
          )}
          <h3>Roster history</h3>
          <ul className="roster-history">
            {selected.history.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
          {confirmRemove ? (
            <div className="roster-remove-confirm" role="alert">
              <p>
                Remove {selected.name} from the roster? Open studies ({selected.openCases}) will be reassigned.
              </p>
              <button
                className="danger-button"
                onClick={() => {
                  const removed = selected;
                  const index = people.findIndex((item) => item.staffId === removed.staffId);
                  const next = people.filter((item) => item.staffId !== removed.staffId);
                  setPeople(next);
                  setSelectedId(next[0]?.staffId ?? "");
                  setConfirmRemove(false);
                  notify(`${removed.name} removed from roster`, () =>
                    setPeople((list) => {
                      const copy = [...list];
                      copy.splice(index, 0, removed);
                      return copy;
                    }),
                  );
                }}
              >
                Confirm remove
              </button>
              <button className="secondary-button" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="text-button danger" onClick={() => setConfirmRemove(true)}>
              Remove from roster
            </button>
          )}
        </aside>
        )}
      </div>
    </>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-intro">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="intro-actions">{children}</div>}
    </section>
  );
}

const radiologistShift = {
  dateLabel: "13 Sep 2026",
};

function RadiologistView({
  notify,
  onEmergencyKeepAlive,
  onUnsavedChange,
  scheduleOpen = false,
  onCloseSchedule,
  onOpenSchedule,
}: {
  notify: NotifyFn;
  onEmergencyKeepAlive: (active: boolean) => void;
  onUnsavedChange: (dirty: boolean) => void;
  scheduleOpen?: boolean;
  onCloseSchedule?: () => void;
  onOpenSchedule?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | CaseStatus>("All");
  const [sortBy, setSortBy] = useState<"urgency" | "arrival" | "volume">("urgency");
  const [previewId, setPreviewId] = useState(cases[0]?.id ?? "");
  const nextCase = [...cases].sort((a, b) => a.sla - b.sla)[0] ?? null;
  const [remainingSec, setRemainingSec] = useState(() => (nextCase?.sla ?? 0) * 60);
  useEffect(() => {
    const timer = window.setInterval(
      () => setRemainingSec((value) => (value > 0 ? value - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const [selected, setSelected] = useState<StrokeCase | null>(() => {
    const studyId = new URLSearchParams(window.location.search).get("study");
    return cases.find((study) => study.id === studyId) ?? null;
  });
  useEffect(() => {
    onEmergencyKeepAlive(Boolean(selected && selected.status === "Critical"));
    return () => onEmergencyKeepAlive(false);
  }, [selected, onEmergencyKeepAlive]);
  const filtered = useMemo(() => {
    const urgencyRank: Record<CaseStatus, number> = { Critical: 0, Priority: 1, Routine: 2 };
    const list = cases.filter(
        (item) =>
          (filter === "All" || item.status === filter) &&
          `${item.id} ${item.patient}`.toLowerCase().includes(query.toLowerCase()),
    );
    return [...list].sort((a, b) => {
      if (sortBy === "volume") return b.volume - a.volume;
      if (sortBy === "arrival") return a.received.localeCompare(b.received);
      return urgencyRank[a.status] - urgencyRank[b.status] || a.sla - b.sla;
    });
  }, [filter, query, sortBy]);

  const preview = filtered.find((study) => study.id === previewId) ?? filtered[0] ?? null;
  const slaDueLabel = `${Math.max(0, Math.ceil(remainingSec / 60))} min`;

  const openStudy = (study: StrokeCase) => {
    setSelected(study);
    const url = new URL(window.location.href);
    url.searchParams.set("study", study.id);
    window.history.replaceState({}, "", url);
  };

  const closeStudy = () => {
    onUnsavedChange(false);
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("study");
    window.history.replaceState({}, "", url);
  };

  if (selected) {
    return (
      <CaseWorkspace
        study={selected}
        onBack={closeStudy}
        notify={notify}
        onUnsavedChange={onUnsavedChange}
      />
    );
  }

  if (scheduleOpen) {
    return <RadiologistScheduleView onBack={() => onCloseSchedule?.()} />;
  }

  return (
    <>
      <div className="sketch-top">
        <div>
          <h1>Worklist</h1>
          <span className="sketch-muted">
            Morning Shift ({radiologistShift.dateLabel.replace(" 2026", "")}) - {cases.length} pending studies
          </span>
        </div>
        <div className="sketch-top-actions">
          <span className="cds-badge">Clinical Decision Support (CDS)</span>
          <button type="button" className="secondary-button my-schedule-button" onClick={() => onOpenSchedule?.()}>
            <Icon name="calendar" size={16} />
            My schedule
        </button>
          <span className="engine-pill" role="status"><i /> Analysis Service: Online</span>
          </div>
        </div>
      <div className="sketch-worklist">
      <section className="panel worklist-panel" aria-label="Studies">
        <div className="sketch-tools">
            <input
            className="sketch-search"
            aria-label="Search study or patient ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search study or patient ID"
            />
          <div className="sketch-filters" role="group" aria-label="Filter by priority">
            {(["All", "Critical", "Priority", "Routine"] as const).map((item) => {
              const count =
                item === "All" ? cases.length : cases.filter((study) => study.status === item).length;
              const tone =
                item === "Critical" ? "crit" : item === "Priority" ? "pri" : item === "Routine" ? "routine" : "all";
              return (
              <button
                key={item}
                  type="button"
                  className={`sketch-chip ${tone} ${filter === item ? "on" : ""}`}
                onClick={() => setFilter(item)}
              >
                  {item} {count}
              </button>
              );
            })}
          </div>
          <label className="sketch-sort">
            Sort by
            <select aria-label="Sort worklist" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
              <option value="urgency">Urgency</option>
              <option value="arrival">Arrival time</option>
              <option value="volume">Volume</option>
            </select>
          </label>
        </div>
        <div className="case-table worklist-scroll">
          <table className="worklist-table">
            <thead>
              <tr>
                <th className="thumb" scope="col">
                  <span className="sr-only">Preview</span>
                </th>
                <th scope="col">Study</th>
                <th scope="col">Status</th>
                <th className="num" scope="col">Read within</th>
              </tr>
            </thead>
            <tbody>
              {(!query.trim() || "ais-240913-091".includes(query.trim().toLowerCase())) && (
                <tr className="processing-row">
                  <td colSpan={4}>
                    <div className="processing-line">
                      <span className="processing-spin" aria-hidden="true" />
                      <span>Processing AIS-240913-091: Running lesion segmentation...</span>
                      <span
                        className="sketch-bar thin"
                        role="progressbar"
                        aria-valuenow={60}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Processing AIS-240913-091, running lesion segmentation"
                      >
                        <i />
                      </span>
                    </div>
                      </td>
                    </tr>
              )}
              {filtered.map((study) => {
                    const tone = study.status === "Critical" ? "critical" : "";
                    return (
                    <tr
                      key={study.id}
                      className={`${tone ? `tone-${tone}` : ""} ${preview?.id === study.id ? "is-preview" : ""}`.trim()}
                      onClick={() => setPreviewId(study.id)}
                    >
                      <td className="thumb">
                        <span className={`sketch-thumb ${study.volume === 0 ? "empty" : ""}`} aria-hidden="true">
                          {study.volume > 0 && <i />}
                        </span>
                      </td>
                      <td className="study">
                        <strong>{study.id}</strong>
                        <br />
                        <span className="study-meta">
                          <PriorityBadge status={study.status} />
                          <small>{patientLine(study.patient, study.age, study.sex)}</small>
                        </span>
                      </td>
                      <td>
                        <span className={`workflow-chip ${study.workflow === "Draft saved" ? "draft" : study.workflow === "Received" ? "received" : "review"}`}>
                          {study.workflow}
                        </span>
                      </td>
                      <td className="num">
                        <strong className={tone === "critical" ? "sla-hot" : ""}>
                          {study.id === nextCase?.id ? slaDueLabel : `${study.sla} min`}
                        </strong>
                      </td>
                    </tr>
                    );
                  })}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty-state">
              <strong>No matching studies</strong>
              <p>Try another study ID, or clear filters to see the full assigned queue.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setQuery("");
                  setFilter("All");
                }}
              >
                Clear search and filters
              </button>
            </div>
          )}
        </div>
      </section>
      <aside className="panel sketch-preview" aria-label="Preview">
        {preview ? (
          <>
            <div className="sketch-preview-scan">
              <span>DWI Sequence (Draft Overlay)</span>
            </div>
            <h2>{preview.id}</h2>
            <div className="sketch-metrics">
        <div>
                <span>Lesion volume</span>
                <strong>{preview.volume ? `${preview.volume.toFixed(1)} mL` : "Empty mask"}</strong>
        </div>
              <div>
                <span>NIHSS</span>
                <strong>{preview.nihss}</strong>
              </div>
              <div>
                <span>Territory</span>
                <strong>{territoryPhrase(preview)}</strong>
              </div>
              <div>
                <span>Onset</span>
                <strong>
                  {preview.onset === "Unknown" ? "Unknown" : `${formatOnset(preview.onset)} ago`}
                </strong>
              </div>
            </div>
            <div className="preview-action">
              <button className="sketch-btn block" onClick={() => openStudy(preview)}>
                Start review
              </button>
            </div>
          </>
        ) : (
          <p className="sketch-muted">No study matches this filter.</p>
        )}
      </aside>
      </div>
    </>
  );
}

function PriorityBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`priority ${status === "Critical" ? "critical" : status === "Priority" ? "warning" : "normal"}`}>
      <i />
      {status}
    </span>
  );
}

function MetricCard({
  icon,
  tone,
  value,
  label,
  note,
}: {
  icon: IconName;
  tone: string;
  value: string;
  label: string;
  note: string;
}) {
  return (
    <article className="metric-card">
      <span className={`metric-icon ${tone}`}>
        <Icon name={icon} size={19} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{note}</small>
      </div>
    </article>
  );
}

function CaseWorkspace({
  study,
  onBack,
  notify,
  onUnsavedChange,
}: {
  study: StrokeCase;
  onBack: () => void;
  notify: NotifyFn;
  onUnsavedChange: (dirty: boolean) => void;
}) {
  const [slice, setSlice] = useState(17);
  const [activeSequence, setActiveSequence] = useState(0);
  const [layoutMode, setLayoutMode] = useState<"triple" | "single">("triple");
  const [overlay, setOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(80);
  const [heatmap, setHeatmap] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedbackTouched, setFeedbackTouched] = useState(false);
  const [pastMask, setPastMask] = useState<{ revised: boolean; dirty: boolean }[]>([]);
  const [futureMask, setFutureMask] = useState<{ revised: boolean; dirty: boolean }[]>([]);
  const [editTool, setEditTool] = useState<"Brush" | "Eraser" | "Threshold">("Brush");
  const [railTool, setRailTool] = useState("Brush");
  const [editing, setEditing] = useState(false);
  const [maskRevised, setMaskRevised] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [signed, setSigned] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [disposition, setDisposition] = useState<
    "accepted_unchanged" | "accepted_with_adjustment" | "not_used"
  >("accepted_unchanged");
  const [dispositionNote, setDispositionNote] = useState("");
  const [qualityRating, setQualityRating] = useState(0);
  const [perceivedQuality, setPerceivedQuality] = useState<"Good" | "Fair" | "Poor" | "">("");
  const [note, setNote] = useState("");
  const [attestChecked, setAttestChecked] = useState(false);
  const [stepUp, setStepUp] = useState("");
  const [confirmAiDraft, setConfirmAiDraft] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [dirtyMask, setDirtyMask] = useState(false);
  const leaveModalRef = useRef<HTMLDivElement>(null);
  const scanGridRef = useRef<HTMLDivElement>(null);
  const { busyKey, run: runBusy } = useBusyAction(notify);
  const aiDraft = `Acute ischemic infarct in the ${study.side.toLowerCase()}, ${study.territory} territory. Correlate with clinical presentation before release.`;
  useFocusTrap(leaveOpen, leaveModalRef);
  useEffect(() => {
    onUnsavedChange(dirtyMask || Boolean(note.trim()) || editing);
  }, [dirtyMask, note, editing, onUnsavedChange]);

  useEffect(() => {
    document.documentElement.classList.add("sketch-immersive");
    return () => document.documentElement.classList.remove("sketch-immersive");
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select, button")) return;
      if (event.code === "Space") {
        event.preventDefault();
        setOverlay((value) => !value);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const el = scanGridRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setSlice((value) => Math.min(33, Math.max(0, value + (event.deltaY > 0 ? 1 : -1))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const rememberMask = () => {
    setPastMask((items) => [...items, { revised: maskRevised, dirty: dirtyMask }]);
    setFutureMask([]);
  };
  const undoMask = () => {
    const previous = pastMask[pastMask.length - 1];
    if (!previous) return;
    setFutureMask((items) => [...items, { revised: maskRevised, dirty: dirtyMask }]);
    setPastMask((items) => items.slice(0, -1));
    setMaskRevised(previous.revised);
    setDirtyMask(previous.dirty);
  };
  const redoMask = () => {
    const next = futureMask[futureMask.length - 1];
    if (!next) return;
    setPastMask((items) => [...items, { revised: maskRevised, dirty: dirtyMask }]);
    setFutureMask((items) => items.slice(0, -1));
    setMaskRevised(next.revised);
    setDirtyMask(next.dirty);
  };
  const resetMask = () => {
    rememberMask();
    setMaskRevised(false);
    setDirtyMask(false);
    setEditing(false);
    setRailTool("Select");
    notify("Mask reset to the initial draft");
  };
  const saveDraft = () => {
    try {
      if (note.trim()) {
        window.localStorage.setItem(`clinical-note:${study.id}:radiologist-note`, note);
      }
    } catch {
      /* local draft persistence is best-effort */
    }
    void saveClinicalNote(study.id, note, "manual").catch(() => undefined);
    notify("Clinical note saved");
  };

  const leaveStudy = () => {
    setLeaveOpen(false);
    onUnsavedChange(false);
    onBack();
  };

  const requestBack = () => {
    if (dirtyMask || note.trim() || editing) {
      setLeaveOpen(true);
      return;
    }
    leaveStudy();
  };

  if (signed) {
    return (
      <div className="success-screen">
        <span className="success-icon">
          <Icon name="check" size={30} />
        </span>
        <span className="section-kicker">Signed off</span>
        <h1>Report released</h1>
        <p>{study.id} is locked and visible to the stroke team.</p>
        <div className="success-meta">
          <div>
            <span>Signed by</span>
            <strong>Dr. Lena Morgan</strong>
          </div>
          <div>
            <span>Mask version</span>
            <strong>{maskRevised ? "Revision 02" : "System draft 01"}</strong>
          </div>
          <div>
            <span>Report version</span>
            <strong>RPT-01</strong>
          </div>
        </div>
        <button className="primary-button" onClick={onBack}>
          Return to worklist
        </button>
      </div>
    );
  }

  return (
    <div className="workspace sketch-studio">
      <header className="sketch-studio-bar">
        <b>{study.id}</b>
            <PriorityBadge status={study.status} />
        <div className="studio-meta">
          <span>{patientLine(study.patient, study.age, study.sex)}</span>
          <span>Model v2.4.1</span>
          <span>SLA: {study.sla} min remaining</span>
          </div>
        <div className="studio-bar-actions">
          <button type="button" className="sketch-btn outline" onClick={requestBack}>
            ← Back to worklist
          </button>
          <button type="button" className="sketch-btn outline" onClick={() => setRequestOpen(true)}>
            Request consultation
            </button>
          </div>
      </header>
        <div className="viewer-layout">
        <div className="sketch-tools-rail" aria-label="Mask tools">
            {(["Select", "Brush", "Eraser", "Thresh", "Compare", "Measure"] as const).map((tool) => (
                <button
                key={tool}
                    type="button"
                className={railTool === tool ? "on" : ""}
              onClick={() => {
                  setRailTool(tool);
                  if (tool === "Brush" || tool === "Eraser" || tool === "Thresh") rememberMask();
                  if (tool === "Brush" || tool === "Eraser") {
                    setEditTool(tool);
                    setEditing(true);
                    setDirtyMask(true);
                  } else if (tool === "Thresh") {
                    setEditTool("Threshold");
                    setEditing(true);
                    setDirtyMask(true);
                  } else {
                    setEditing(false);
                  }
                }}
              >
                {tool}
            </button>
            ))}
            <div className="rail-history">
              <button type="button" onClick={undoMask} disabled={!pastMask.length}>Undo</button>
              <button type="button" onClick={redoMask} disabled={!futureMask.length}>Redo</button>
              <button type="button" onClick={resetMask}>Reset mask</button>
      </div>
          </div>
        <section className="viewer">
          <div className="viewer-toolbar">
            <span className="viewer-sync-label">
              <Icon name="layers" size={14} /> Synchronized series
            </span>
            <span>Axial slice {slice + 1} of 34</span>
            <div className="viewport-layout-toggle" role="group" aria-label="Viewport layout">
              <button
                type="button"
                className={layoutMode === "triple" ? "active" : ""}
                aria-pressed={layoutMode === "triple"}
                onClick={() => setLayoutMode("triple")}
                title="Show DWI / ADC / FLAIR side by side"
              >
                1×3
              </button>
              <button
                type="button"
                className={layoutMode === "single" ? "active" : ""}
                aria-pressed={layoutMode === "single"}
                onClick={() => setLayoutMode("single")}
                title="Enlarge one sequence for mask editing"
              >
                1×1
              </button>
            </div>
            <div className="viewer-toggles">
              <label>
                <input type="checkbox" checked={overlay} onChange={() => setOverlay(!overlay)} />{" "}
                Mask
              </label>
              <label>
                <input type="checkbox" checked={heatmap} onChange={() => setHeatmap(!heatmap)} />{" "}
                Heatmap
              </label>
              <label className="overlay-opacity">
                Overlay opacity
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={overlayOpacity}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={overlayOpacity}
                  aria-valuetext={`${overlayOpacity}%`}
                  onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                />
                <span>{overlayOpacity}%</span>
              </label>
            </div>
            {heatmap && (
              <div className="heatmap-legend" aria-label="Probability scale from 0.0 to 1.0">
                <span>0.0</span>
                <i />
                <span>1.0</span>
              </div>
            )}
          </div>
          <div
            className={`sequence-tabs${layoutMode === "single" ? " force-visible" : ""}`}
            role="tablist"
            aria-label="MRI sequence"
          >
            {["DWI", "ADC", "FLAIR"].map((sequence, index) => (
              <button
                key={sequence}
                type="button"
                role="tab"
                aria-selected={activeSequence === index}
                className={activeSequence === index ? "active" : ""}
                onClick={() => setActiveSequence(index)}
              >
                {sequence}
              </button>
            ))}
          </div>
          <div
            ref={scanGridRef}
            className={`scan-grid sequence-${activeSequence}${layoutMode === "single" ? " layout-single" : ""}`}
          >
            {["DWI", "ADC", "FLAIR"].map((sequence, index) => (
              <div className={`scan scan-${index + 1}`} key={sequence}>
                <span className="sequence-label">{sequence}</span>
                <div className="brain-scan">
                  <i className="hemisphere left" />
                  <i className="hemisphere right" />
                  {overlay && <i className="lesion" style={{ opacity: overlayOpacity / 100 }} />}
                  {heatmap && <i className="heatmap" style={{ opacity: overlayOpacity / 100 }} />}
                  {editing && <i className="edit-ring" />}
                  <i className="crosshair-x" />
                  <i className="crosshair-y" />
                </div>
                <div className="scan-hud" aria-hidden="true">
                  <span>
                    W {index === 1 ? 1350 : 980}, L {index === 1 ? 680 : 460}
                  </span>
                  <span>
                    x 42.0, y 68.0, z {(slice * 4).toFixed(1)} mm
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="slice-control">
            <button aria-label="Previous slice" onClick={() => setSlice(Math.max(0, slice - 1))}>
              −
            </button>
            <input
              aria-label="MRI slice"
              type="range"
              min="0"
              max="33"
              value={slice}
              onChange={(event) => setSlice(Number(event.target.value))}
            />
            <button aria-label="Next slice" onClick={() => setSlice(Math.min(33, slice + 1))}>
              +
            </button>
            <span>Slice {slice + 1}</span>
          </div>
          {editing && (
            <div className="edit-tools">
              <span>
                <Icon name="edit" size={15} /> Tools:
              </span>
              {(["Brush", "Eraser", "Threshold"] as const).map((tool) => (
                <button
                  key={tool}
                  className={editTool === tool ? "active" : ""}
                  aria-pressed={editTool === tool}
                  onClick={() => setEditTool(tool)}
                >
                  {tool}
                </button>
              ))}
              <input
                aria-label="Reason for mask revision"
                value={revisionReason}
                onChange={(event) => setRevisionReason(event.target.value)}
                placeholder="Reason for revision (required)"
              />
              <button
                disabled={!revisionReason.trim() || busyKey === "revision"}
                onClick={() =>
                  runBusy(
                    "revision",
                    "Mask Revision 02 saved and measurements recalculated",
                    () => {
                      setEditing(false);
                      setDirtyMask(false);
                      setMaskRevised(true);
                      setDisposition("accepted_with_adjustment");
                    },
                  )
                }
              >
                {busyKey === "revision" ? "Saving…" : "Save revision"}
              </button>
              <CtaHint show={!revisionReason.trim()}>
                Enter a revision reason to enable Save.
              </CtaHint>
            </div>
          )}
        </section>
          <aside className="clinical-panel">
            <div className="clinical-section patient-summary">
              <div className="section-title">
                <span>Case & lesion summary</span>
                <b>
                  <TermTip tip="National Institutes of Health Stroke Scale - clinical severity score (0–42).">
                    NIHSS
                  </TermTip>{" "}
                  {study.nihss}
                </b>
              </div>
              <dl>
                <div>
                  <dt>Onset</dt>
                  <dd>{study.onset === "Unknown" ? "Unknown" : `${formatOnset(study.onset)} ago`}</dd>
                </div>
                <div>
                  <dt>Pre-stroke mRS</dt>
                  <dd>{study.mrs}</dd>
                </div>
                <div>
                  <dt>Scanner</dt>
                  <dd>Siemens 3.0T</dd>
                </div>
              </dl>
              <hr className="summary-split" />
              {study.missingInputs.length > 0 && (
                <div className="missing-inputs" role="status">
                  <Icon name="alert" size={15} />
                  <div>
                    <strong>Unread or incomplete inputs</strong>
                    <ul>
                      {study.missingInputs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {study.volume === 0 ? (
                <div className="ai-caution" role="status">
                  <Icon name="alert" size={17} />
                  <div>
                    <strong>Empty mask - not a negative study</strong>
                    <span>
                      A zero-volume automated result is not evidence of exclusion. Review the full
                      examination before documenting your NOTE.
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="volume-result">
                    <span>Total volume</span>
                    <strong>
                      {editing || maskRevised
                        ? (study.volume + (maskRevised ? 0.7 : 0)).toFixed(1)
                        : study.volume.toFixed(1)}
                      <small>mL</small>
                    </strong>
                  </div>
                  <div className="measurement-grid">
                    <div>
                      <span>Clusters</span>
                      <strong>{study.clusters}</strong>
                    </div>
                    <div>
                      <span>Laterality</span>
                      <strong>{study.side.replace(" hemisphere", "")}</strong>
                    </div>
                    <div>
                      <span>Territory</span>
                      <strong>{territoryPhrase(study)}</strong>
                    </div>
                    <div>
                      <span>QC</span>
                      <strong className="good">Passed</strong>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="clinical-section">
              <div className="section-title">
                <span>System suggestion</span>
              </div>
              <div className="ai-suggestion">
                <CollapsibleSection title="1. Related imaging findings">
                  <ul>
                    <li>DWI hyperintensity with spatially corresponding ADC hypointensity.</li>
                    <li>Subtle FLAIR hyperintensity; no visible hemorrhagic component.</li>
                    <li>Distribution is predominantly within the {territoryPhrase(study)} territory.</li>
                  </ul>
                </CollapsibleSection>
                <CollapsibleSection title="2. Draft conclusion" defaultOpen>
                  <ul>
                    <li>
                      Findings may be compatible with acute ischemic injury in the{" "}
                      {study.side.toLowerCase()}.
                    </li>
                    <li>Correlate with onset time and the full MRI study.</li>
                  </ul>
                </CollapsibleSection>
                <CollapsibleSection title="3. References">
                  <ul>
                    <li>Powers WJ et al. AHA/ASA AIS Guideline, 2019.</li>
                    <li>ISLES 2022 challenge definition.</li>
                    <li>Model v2.4.1 validation card.</li>
                  </ul>
                </CollapsibleSection>
              </div>
            </div>
            <div className="clinical-section studio-decision">
              <div className="section-title">
                <span>System feedback</span>
                <em>Required</em>
              </div>
              <div className="disposition-options">
                {[
                  ["accepted_unchanged", "Accept suggestion"],
                  ["accepted_with_adjustment", "Accept with adjustment"],
                  ["not_used", "Do not use suggestion"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={disposition === value ? "active" : ""}
                    onClick={() =>
                      setDisposition(
                        value as "accepted_unchanged" | "accepted_with_adjustment" | "not_used",
                      )
                    }
                  >
                    <span>{disposition === value && <Icon name="check" size={12} />}</span>
                    {label}
              </button>
                ))}
              </div>
              <div className="rejection-reason disposition-note">
                <ClinicalComposer
                  label="Clinical feedback"
                  value={dispositionNote}
                  onChange={setDispositionNote}
                  onBlur={() => setFeedbackTouched(true)}
                  placeholder="Explain your clinical assessment…"
                  voiceText="Mask reviewed against the diffusion images. Clinical assessment supports the selected response to the system suggestion."
                  notify={notify}
                  draftKey={`${study.id}:disposition-feedback`}
                  syncStudyNote={false}
                  chrome="minimal"
                  error={
                    feedbackTouched && !dispositionNote.trim()
                      ? "Clinical feedback is required."
                      : undefined
                  }
                />
              </div>
              <div className="quality-flat">
                <div className="section-title">
                  <span>Suggestion quality</span>
                </div>
                <div className="quality-row">
                  <span>Perceived mask quality</span>
                  {(["Good", "Fair", "Poor"] as const).map((quality) => (
                    <button
                      type="button"
                      key={quality}
                      className={perceivedQuality === quality ? "active" : ""}
                      aria-pressed={perceivedQuality === quality}
                      onClick={() => setPerceivedQuality(quality)}
                    >
                      {quality}
              </button>
                  ))}
            </div>
                <div className="quality-row utility-scale">
                  <span>Clinical utility</span>
                  <div className="utility-scale-options" role="radiogroup" aria-label="Clinical utility">
                    {(
                      [
                        [1, "Poor"],
                        [2, "Fair"],
                        [3, "Good"],
                        [4, "Very good"],
                        [5, "Essential"],
                      ] as const
                    ).map(([rating, label]) => (
                      <button
                        type="button"
                        key={rating}
                        role="radio"
                        aria-checked={qualityRating === rating}
                        className={qualityRating === rating ? "active" : ""}
                        onClick={() => setQualityRating(rating)}
                      >
                        {rating} {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="clinical-section studio-note">
              <div className="section-title note-title">
                <span>Clinical note</span>
                <div className="note-header-actions">
                  <button type="button" className="note-text-button" onClick={() => setConfirmAiDraft(true)}>
                    Insert draft
                  </button>
                  <button
                    type="button"
                    className="note-text-button"
                    onClick={() => {
                      const metricText = `Verified lesion measurements: ${study.volume.toFixed(1)} mL, ${study.clusters} cluster${study.clusters === 1 ? "" : "s"}, ${study.side.toLowerCase()}, ${study.territory} territory.`;
                      setNote((value) => `${value}${value.trim() ? "\n" : ""}${metricText}`);
                      notify("Verified lesion measurements inserted");
                    }}
                  >
                    Insert measurements
                  </button>
                </div>
              </div>
              <ClinicalComposer
                label="Clinical note"
                hideLabel
                chrome="minimal"
                value={note}
                onChange={setNote}
                placeholder="Enter your clinical note…"
                voiceText="Restricted diffusion in the left MCA territory with corresponding low ADC signal. No hemorrhagic component is identified."
                notify={notify}
                draftKey={`${study.id}:radiologist-note`}
              />
            </div>
            <div className="clinical-section studio-sign">
              <div className="section-title">
                <span>Sign-off</span>
              </div>
              <div className="report-draft-actions">
                <button type="button" onClick={() => notify("Draft PDF generated with draft watermark")}>
                  Export draft PDF
                </button>
              </div>
              <label className="form-label">
                Current password
                <span className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={stepUp}
                    onChange={(event) => setStepUp(event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      {showPassword ? (
                        <path fill="none" stroke="currentColor" strokeWidth="2" d="M3 3l18 18M10.5 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.2-5M9.9 5.1A11 11 0 0 1 12 5c5 0 9.3 3.1 11 7a11.7 11.7 0 0 1-4.1 4.7M6.1 6.1C4 7.5 2.4 9.5 1 12c1.7 3.9 6 7 11 7 1.5 0 2.9-.3 4.2-.8" />
                      ) : (
                        <>
                          <path fill="none" stroke="currentColor" strokeWidth="2" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                        </>
                      )}
                    </svg>
                  </button>
                </span>
              </label>
              <label className="confirm-check">
                <input
                  type="checkbox"
                  checked={attestChecked}
                  onChange={(event) => setAttestChecked(event.target.checked)}
                />{" "}
                I reviewed the complete examination and confirm the note above.
              </label>
              <div className="sign-actions">
              <button type="button" className="secondary-button" onClick={saveDraft}>
                Save draft
              </button>
              <button
                className="primary-button"
                disabled={
                  !note.trim() ||
                  !dispositionNote.trim() ||
                  !stepUp ||
                  !attestChecked ||
                  !perceivedQuality ||
                  qualityRating === 0
                }
                onClick={() => {
                  onUnsavedChange(false);
                  if (note.trim()) {
                    try {
                      window.localStorage.removeItem(`clinical-note:${study.id}:radiologist-note`);
                    } catch {
                      /* ignore */
                    }
                  }
                  void saveDisposition(study.id, disposition, dispositionNote).catch(() => undefined);
                  void signOffStudy({
                    studyId: study.id,
                    clinicalNote: note,
                    disposition,
                    dispositionNote,
                    perceivedQuality,
                    clinicalUtility: qualityRating,
                  }).catch(() => undefined);
                  setSigned(true);
                }}
              >
                <Icon name="lock" size={15} /> Sign and release report
              </button>
        </div>
              {(!note.trim() ||
                !dispositionNote.trim() ||
                !stepUp ||
                !attestChecked ||
                !perceivedQuality ||
                qualityRating === 0) && (
                <p className="sign-requirements" role="status">
                  {(() => {
                    const gaps = [
                      !note.trim() ? "diagnostic note" : "",
                      !dispositionNote.trim() ? "clinical feedback" : "",
                      !attestChecked ? "confirmation checkbox" : "",
                      !stepUp ? "password" : "",
                      !perceivedQuality || qualityRating === 0 ? "suggestion quality" : "",
                    ].filter(Boolean);
                    if (gaps.length === 1) return `Complete ${gaps[0]} to sign.`;
                    const last = gaps[gaps.length - 1];
                    return `Complete ${gaps.slice(0, -1).join(", ")}, and ${last} to sign.`;
                  })()}
                </p>
              )}
            </div>
          </aside>
        </div>
      {requestOpen && (
        <RequestConsultationDialog
          studyId={study.id}
          defaultUrgency={study.status}
          onClose={() => setRequestOpen(false)}
          notify={notify}
        />
      )}
      {confirmAiDraft && (
        <div className="modal-wrap">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-draft-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") setConfirmAiDraft(false);
            }}
          >
            <button className="modal-close" onClick={() => setConfirmAiDraft(false)}>
              <Icon name="x" />
            </button>
            <span className="modal-icon">
              <Icon name="brain" />
            </span>
            <span className="section-kicker">Confirm</span>
            <h2 id="ai-draft-title">Insert draft conclusion?</h2>
            <p>Text is editable after insert. You remain responsible for the signed wording.</p>
            <div className="ai-caution compact" role="status">
              <Icon name="alert" size={15} />
              <span>
                Automated wording is for diagnostic support only. Review every line before sign-off.
              </span>
            </div>
            <blockquote className="ai-draft-preview">{aiDraft}</blockquote>
            <button
              className="primary-button full"
              onClick={() => {
                setNote((value) => `${value}${value.trim() ? "\n" : ""}${aiDraft}`);
                setConfirmAiDraft(false);
                notify("Draft conclusion inserted. Review before signing");
              }}
            >
              Insert draft conclusion
            </button>
            <button className="secondary-button full" onClick={() => setConfirmAiDraft(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {leaveOpen && (
        <div className="modal-wrap">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-dialog-title"
            ref={leaveModalRef}
            onKeyDown={(event) => {
              if (event.key === "Escape") setLeaveOpen(false);
            }}
          >
            <button className="modal-close" onClick={() => setLeaveOpen(false)}>
              <Icon name="x" />
            </button>
            <span className="modal-icon danger">
              <Icon name="alert" />
            </span>
            <span className="section-kicker">Unsaved work</span>
            <h2 id="leave-dialog-title">Leave without saving?</h2>
            <p>
              Mask edits may be lost. Clinical note text is auto-saved as a local draft, but
              unsigned work is not released to the care team.
            </p>
            <button className="danger-button full" onClick={leaveStudy}>
              Discard and leave
            </button>
            <button className="secondary-button full" onClick={() => setLeaveOpen(false)}>
              Stay on study
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type PhysicianCaseStatus = "Pending" | "Consulted" | "Decided";

const initialPhysicianStatus = (treatment: string): PhysicianCaseStatus =>
  treatment === "Decision pending" ? "Pending" : treatment === "Consulted" ? "Consulted" : "Decided";

const physicianStatusTone: Record<PhysicianCaseStatus, string> = {
  Pending: "warning",
  Consulted: "info",
  Decided: "neutral",
};

function formatOnset(onset: string) {
  const match = /^(\d+):(\d{2})$/.exec(onset);
  return match ? `${Number(match[1])}h ${match[2]}m` : onset;
}

function PhysicianView({
  notify,
  onOpenConsultation,
}: {
  notify: NotifyFn;
  onOpenConsultation: (sessionId: string) => void;
}) {
  const [selected, setSelected] = useState(signedCases[0]);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Record<string, PhysicianCaseStatus>>(() =>
    Object.fromEntries(signedCases.map((item) => [item.id, initialPhysicianStatus(item.treatment)])),
  );
  const [treatment, setTreatment] = useState("Not recorded");
  const [checks, setChecks] = useState({ onset: false, hemorrhage: false, contraindication: false });
  const [aiUsefulness, setAiUsefulness] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [slice, setSlice] = useState(18);
  const [activeSequence, setActiveSequence] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const { busyKey, run: runBusy } = useBusyAction(notify);

  // Decision, checklist, rating and note belong to one case. Reset them on switch so
  // a choice made for one patient can never be saved against another.
  const selectCase = (item: (typeof signedCases)[number]) => {
    if (item.id === selected.id) return;
    setSelected(item);
    setTreatment("Not recorded");
    setChecks({ onset: false, hemorrhage: false, contraindication: false });
    setAiUsefulness(0);
    setFeedbackNote("");
  };

  const visibleCases = signedCases.filter((item) =>
    `${item.id} ${item.patient} ${item.signer}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const status = statuses[selected.id];

  return (
    <>
      <div className="sketch-top">
        <div>
          <h1>Signed-off cases</h1>
          <span className="sketch-muted">Read-only. No mask editing or sign-off.</span>
        </div>
        <button className="sketch-btn outline" onClick={() => onOpenConsultation("CON-0913-012")}>
          Start consultation
        </button>
      </div>
      <div className="physician-layout sketch-physician">
        <section className="panel result-list">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Signed off</span>
              <h2>Released today</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Refresh released studies"
              onClick={() => notify("Released studies refreshed")}
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
          <label className="search-field full-width">
            <Icon name="search" size={16} />
            <input
              aria-label="Search released studies"
              placeholder="Search by study ID or signer…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="signed-list">
            {visibleCases.map((item) => (
              <button
                key={item.id}
                className={selected.id === item.id ? "active" : ""}
                aria-current={selected.id === item.id ? "true" : undefined}
                onClick={() => selectCase(item)}
              >
                <span className="signed-check">
                  <Icon name="check" size={14} />
                </span>
                <span>
                  <strong>{item.id}</strong>
                  <small>
                    Signed {item.signed} by {item.signer}
                  </small>
                </span>
                <span>
                  <strong>{item.volume} mL</strong>
                  <small className={`chip ${physicianStatusTone[statuses[item.id]]}`}>
                    {statuses[item.id]}
                  </small>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
            {!visibleCases.length && <p className="muted-line">No released studies match “{query}”.</p>}
          </div>
        </section>
        <section className="panel result-detail">
          <div className="result-header">
            <div>
              <span className="verified-badge">
                <Icon name="shield" size={14} /> Verified
              </span>
              <h2>{selected.id} signed report</h2>
              <p>{patientLine(selected.patient, selected.age, selected.sex)}</p>
            </div>
            <div className="result-exports">
              <button
                className="secondary-button"
                onClick={() => notify("Secure PDF link created - valid for 15 minutes")}
              >
                <Icon name="download" size={16} /> Export PDF
              </button>
              <button
                className="secondary-button"
                onClick={() => notify("DICOM SR export prepared - valid for 15 minutes")}
              >
                <Icon name="download" size={16} /> Export DICOM SR
              </button>
            </div>
          </div>
          <div className="big-measurements physician-kpis" aria-label="Verified measurements">
            <div className="featured">
              <span>Lesion volume</span>
              <strong>
                {selected.volume}
                <small>mL</small>
              </strong>
            </div>
            <div>
              <span>NIHSS</span>
              <strong>{selected.nihss}</strong>
            </div>
            <div>
              <span>Onset</span>
              <strong>{selected.onset === "Unknown" ? "Unknown" : formatOnset(selected.onset)}</strong>
            </div>
            <div>
              <span>Clusters</span>
              <strong>{selected.clusters}</strong>
            </div>
          </div>
          <div className="clinical-banner">
            <span>
              <Icon name="activity" size={18} />
            </span>
            <div>
              <small>Radiology impression</small>
              <strong>
                Acute ischemic infarct in the {territoryPhrase(selected)} territory.
              </strong>
              <p>
                Restricted diffusion on DWI with corresponding low ADC signal. No hemorrhage
                identified.
              </p>
            </div>
          </div>
          <div className="physician-viewer">
            <div className="panel-head compact">
              <div>
                <span className="section-kicker">Read-only viewer</span>
                <h3>DWI, ADC, and FLAIR final mask</h3>
              </div>
              <label className="viewer-toggles">
                <input
                  type="checkbox"
                  checked={overlay}
                  onChange={() => setOverlay((value) => !value)}
                />{" "}
                Final mask
              </label>
            </div>
            <div className="sequence-tabs" role="tablist" aria-label="MRI sequence">
              {["DWI", "ADC", "FLAIR"].map((sequence, index) => (
                <button
                  key={sequence}
                  type="button"
                  role="tab"
                  aria-selected={activeSequence === index}
                  className={activeSequence === index ? "active" : ""}
                  onClick={() => setActiveSequence(index)}
                >
                  {sequence}
                </button>
              ))}
            </div>
            <div className={`scan-grid physician-scan-grid sequence-${activeSequence}`}>
              {["DWI", "ADC", "FLAIR"].map((sequence, index) => (
                <div className={`scan scan-${index + 1}`} key={sequence}>
                  <span className="sequence-label">{sequence}</span>
                  <div className="brain-scan">
                    <i className="hemisphere left" />
                    <i className="hemisphere right" />
                    {overlay && <i className="lesion" />}
                    <i className="crosshair-x" />
                    <i className="crosshair-y" />
                  </div>
                  <small>Slice {slice + 1}/34</small>
                </div>
              ))}
            </div>
            <div className="slice-control">
              <button aria-label="Previous slice" onClick={() => setSlice(Math.max(0, slice - 1))}>
                −
              </button>
              <input
                aria-label="MRI slice"
                type="range"
                min="0"
                max="33"
                value={slice}
                onChange={(event) => setSlice(Number(event.target.value))}
              />
              <button aria-label="Next slice" onClick={() => setSlice(Math.min(33, slice + 1))}>
                +
              </button>
              <span>Mask editing disabled</span>
            </div>
          </div>
          <div className="signer-row">
            <span className="avatar">
              {selected.signer
                .split(" ")
                .slice(-2)
                .map((word) => word[0])
                .join("")}
            </span>
            <div>
              <small>Signed by</small>
              <strong>{selected.signer}</strong>
            </div>
            <div>
              <small>Released</small>
              <strong>13/09/2026, {selected.signed}</strong>
            </div>
            <div>
              <small>Report</small>
              <strong>v1, mask revision 01</strong>
            </div>
            <span className="immutable">
              <Icon name="lock" size={14} /> Locked
            </span>
          </div>
          <div className="treatment-section">
            <div>
              <span className="section-kicker">Clinical feedback</span>
              <h3>Treatment decision</h3>
            </div>
            <div className="treatment-checks" role="group" aria-label="Eligibility you confirmed">
              <label>
                <input
                  type="checkbox"
                  checked={checks.onset}
                  onChange={(event) => setChecks({ ...checks, onset: event.target.checked })}
                />{" "}
                Onset within 4.5 hours
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checks.hemorrhage}
                  onChange={(event) => setChecks({ ...checks, hemorrhage: event.target.checked })}
                />{" "}
                No hemorrhage identified
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checks.contraindication}
                  onChange={(event) =>
                    setChecks({ ...checks, contraindication: event.target.checked })
                  }
                />{" "}
                Contraindication identified
              </label>
            </div>
            <div className="treatment-options" role="radiogroup" aria-label="Treatment decision">
              {["Thrombolysis", "Thrombectomy", "Conservative care"].map((item) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={treatment === item}
                  className={treatment === item ? "active" : ""}
                  onClick={() => setTreatment(item)}
                  key={item}
                >
                  <span>{treatment === item && <Icon name="check" size={13} />}</span>
                  {item}
                </button>
              ))}
            </div>
            <div className="ai-usefulness">
              <span id="ai-usefulness-label">How useful was the system suggestion? (optional)</span>
              <div role="radiogroup" aria-labelledby="ai-usefulness-label">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    type="button"
                    key={rating}
                    role="radio"
                    aria-checked={aiUsefulness === rating}
                    className={aiUsefulness === rating ? "active" : ""}
                    onClick={() => setAiUsefulness(aiUsefulness === rating ? 0 : rating)}
                  >
                    {rating}
                  </button>
                ))}
              </div>
              <small>1 = not useful, 5 = essential</small>
            </div>
            <ClinicalComposer
              label="Clinical feedback note"
              value={feedbackNote}
              onChange={setFeedbackNote}
              placeholder="Type a care note or use the microphone…"
              voiceText="Imaging findings reviewed with the stroke team. Clinical presentation is concordant. Proceed with treatment pathway after contraindication screening."
              notify={notify}
              draftKey={`${selected.id}:physician-feedback`}
              syncStudyNote={false}
            />
            <button
              className="primary-button"
              disabled={!feedbackNote.trim() || busyKey === "feedback"}
              onClick={() => {
                void savePhysicianFeedback(
                  selected.id,
                  feedbackNote,
                  treatment !== "Not recorded" ? treatment : undefined,
                ).catch(() => undefined);
                runBusy("feedback", "Clinical feedback saved to the study record");
              }}
            >
              {busyKey === "feedback" ? "Saving…" : "Save clinical feedback"}
            </button>
            <CtaHint show={!feedbackNote.trim()}>
              Enter feedback text to enable save. Auto-save also keeps a local draft.
            </CtaHint>
          </div>
        </section>
      </div>
    </>
  );
}

type HodCaseProgress = "waiting" | "in_progress" | "overdue";
type HodTimeRange = "shift" | "24h" | "7d";

const hodOversightCases: {
  id: string;
  patient: string;
  progress: HodCaseProgress;
  assignee: string;
  slaMin: number;
  received: string;
  priority: CaseStatus;
  window: HodTimeRange;
}[] = [
  {
    id: "AIS-240913-084",
    patient: "BN-7A42",
    progress: "waiting",
    assignee: "Dr. Lena Morgan",
    slaMin: 11,
    received: "08:42",
    priority: "Critical",
    window: "shift",
  },
  {
    id: "AIS-240913-079",
    patient: "BN-3C91",
    progress: "in_progress",
    assignee: "Dr. Priya Shah",
    slaMin: 18,
    received: "08:31",
    priority: "Critical",
    window: "shift",
  },
  {
    id: "AIS-240913-077",
    patient: "BN-8D16",
    progress: "overdue",
    assignee: "Dr. Lena Morgan",
    slaMin: -4,
    received: "08:17",
    priority: "Priority",
    window: "shift",
  },
  {
    id: "AIS-240913-071",
    patient: "BN-2F08",
    progress: "waiting",
    assignee: "Dr. Noah Williams",
    slaMin: 35,
    received: "07:54",
    priority: "Routine",
    window: "24h",
  },
  {
    id: "AIS-240912-184",
    patient: "BN-4D77",
    progress: "in_progress",
    assignee: "Dr. Priya Shah",
    slaMin: 9,
    received: "Yesterday",
    priority: "Priority",
    window: "7d",
  },
  {
    id: "AIS-240913-091",
    patient: "BN-6E11",
    progress: "overdue",
    assignee: "Unassigned",
    slaMin: -2,
    received: "08:48",
    priority: "Critical",
    window: "shift",
  },
];

type AssignmentMode = "workload" | "round_robin";
type AssignmentPolicy = {
  mode: AssignmentMode;
  escalateAfter: 5 | 10 | 15 | 20;
  notify: "next_reader" | "shift_lead" | "hod";
};

const defaultAssignmentPolicy: AssignmentPolicy = {
  mode: "workload",
  escalateAfter: 15,
  notify: "next_reader",
};

const assignmentModeLabel: Record<AssignmentMode, string> = {
  workload: "Workload-based",
  round_robin: "Round-robin",
};

const notifyLabel: Record<AssignmentPolicy["notify"], string> = {
  next_reader: "Next eligible reader",
  shift_lead: "Shift lead",
  hod: "Head of Department",
};

type FallbackItem = { id: string; reason: string; tone: "critical" | "warning" };

const initialFallbackQueue: FallbackItem[] = [
  { id: "AIS-240913-091", reason: "Analysis timeout > 180 s", tone: "critical" },
  { id: "AIS-240913-066", reason: "Processing failed", tone: "warning" },
  { id: "AIS-240913-060", reason: "SLA breach", tone: "critical" },
];

const hodWindowRank: Record<HodTimeRange, number> = { shift: 0, "24h": 1, "7d": 2 };

function HodView({
  aiActive,
  notify,
  policy,
  onOpenAssignment,
}: {
  aiActive: boolean;
  notify: NotifyFn;
  policy: AssignmentPolicy;
  onOpenAssignment: () => void;
}) {
  const [timeRange, setTimeRange] = useState<HodTimeRange>("shift");
  const [progressFilter, setProgressFilter] = useState<"All" | HodCaseProgress>("All");
  const [doctorFilter, setDoctorFilter] = useState("All");
  const [queue, setQueue] = useState<FallbackItem[]>(initialFallbackQueue);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const { busyKey, run: runBusy } = useBusyAction(notify);

  // Shared with the Reviewer roster page, so both always agree.
  const roster = initialRoster;
  const onShift = roster.filter((person) => person.status === "On shift");
  const maxLoad = Math.max(5, ...roster.map((person) => person.openCases));

  const doctorOptions = useMemo(
    () => ["All", ...roster.map((person) => person.name), "Unassigned"],
    [roster],
  );

  const inRange = useMemo(
    () => hodOversightCases.filter((item) => hodWindowRank[item.window] <= hodWindowRank[timeRange]),
    [timeRange],
  );
  const overdueCount = inRange.filter((item) => item.progress === "overdue").length;
  const byDoctor = useMemo(
    () => inRange.filter((item) => doctorFilter === "All" || item.assignee === doctorFilter),
    [inRange, doctorFilter],
  );
  const filteredOversight = useMemo(
    () => byDoctor.filter((item) => progressFilter === "All" || item.progress === progressFilter),
    [byDoctor, progressFilter],
  );
  const progressCounts = useMemo(() => {
    const base = { waiting: 0, in_progress: 0, overdue: 0 };
    for (const item of byDoctor) base[item.progress] += 1;
    return base;
  }, [byDoctor]);

  const progressLabel = (progress: HodCaseProgress) =>
    progress === "waiting" ? "Waiting" : progress === "in_progress" ? "In progress" : "Overdue";

  const reassign = (item: FallbackItem) => {
    const assignee = picked[item.id];
    if (!assignee) return;
    void reassignFallback(item.id, assignee).catch(() => undefined);
    runBusy(
      `reassign:${item.id}`,
      `${item.id} reassigned to ${assignee}`,
      () => setQueue((list) => list.filter((entry) => entry.id !== item.id)),
      () => {
        setQueue((list) =>
          list.some((entry) => entry.id === item.id) ? list : [...list, item],
        );
        setPicked((current) => ({ ...current, [item.id]: "" }));
        notify("Reassignment undone");
      },
    );
  };

  return (
    <>
      <div className="sketch-top">
        <div>
          <h1>Overview and assignment</h1>
          <span className="sketch-muted">People and workload only. Aggregate data, cohorts below 5 hidden, no patient images.</span>
        </div>
        <div className="hod-time-select" role="group" aria-label="Time range">
          {(
            [
              ["shift", "This shift"],
              ["24h", "Past 24 hours"],
              ["7d", "Past 7 days"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={timeRange === value}
              className={timeRange === value ? "active" : ""}
              onClick={() => setTimeRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!aiActive && (
        <div className="suspended-banner">
          <Icon name="alert" size={19} />
          <div>
            <strong>Automated analysis is paused by IT</strong>
            <span>New studies are routed to the manual PACS reading workflow.</span>
          </div>
          <span>Manual fallback active</span>
        </div>
      )}
      <section className="metric-grid four hod-kpis" aria-label="Key figures">
        <MetricCard
          icon="clock"
          tone="green"
          value="14 min"
          label="Review turnaround (median)"
          note="Goal: ≤ 20 minutes"
        />
        <MetricCard
          icon="check"
          tone="blue"
          value="78%"
          label="Suggestion acceptance rate"
          note="Accepted masks this shift"
        />
        <MetricCard
          icon="alert"
          tone="amber"
          value={String(overdueCount)}
          label="Overdue cases"
          note={overdueCount ? "Needs coordination" : "None right now"}
        />
        <MetricCard
          icon="people"
          tone="violet"
          value={`${onShift.length} / ${roster.length}`}
          label="Readers on shift"
          note="From the Reviewer roster"
        />
      </section>
      <div className="hod-split">
        <div className="hod-split-main">
          <section className="panel fallback-panel" aria-labelledby="fallback-title">
            <div className="panel-head compact">
              <div>
                <span className="section-kicker">Needs a reader now</span>
                <h2 id="fallback-title">Emergency fallback queue</h2>
              </div>
              <span className={`chip ${queue.length ? "critical" : "neutral"}`}>
                {queue.length} waiting
              </span>
            </div>
            {queue.length ? (
              <div className="case-table worklist-scroll">
                <table className="worklist-table">
                  <thead>
                    <tr>
                      <th scope="col">Study</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Assign to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.id}</strong>
                        </td>
                        <td>
                          <span className={`chip ${item.tone}`}>{item.reason}</span>
                        </td>
                        <td>
                          <div className="fallback-assign">
                            <select
                              aria-label={`Assign ${item.id} to an on-duty reader`}
                              value={picked[item.id] ?? ""}
                              onChange={(event) =>
                                setPicked((current) => ({ ...current, [item.id]: event.target.value }))
                              }
                            >
                              <option value="">Select reader</option>
                              {onShift.map((person) => (
                                <option key={person.staffId} value={person.name}>
                                  {person.name} · {person.openCases} open
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={!picked[item.id] || busyKey === `reassign:${item.id}`}
                              onClick={() => reassign(item)}
                            >
                              {busyKey === `reassign:${item.id}` ? "Assigning…" : "Reassign"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <strong>Fallback queue is clear</strong>
                <p>Studies that fail processing or breach SLA will appear here.</p>
              </div>
            )}
          </section>
          <section className="panel oversight-panel">
            <div className="panel-head compact">
              <div>
                <span className="section-kicker">Case supervision</span>
                <h2>Active case progress</h2>
              </div>
              <span className="live-label">
                <i /> Live
              </span>
            </div>
            <div className="table-tools hod-filters">
              <div className="filter-tabs" role="group" aria-label="Case status">
                {(
                  [
                    ["All", "All", byDoctor.length],
                    ["waiting", "Waiting", progressCounts.waiting],
                    ["in_progress", "In progress", progressCounts.in_progress],
                    ["overdue", "Overdue", progressCounts.overdue],
                  ] as const
                ).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={progressFilter === value}
                    className={progressFilter === value ? "active" : ""}
                    onClick={() => setProgressFilter(value)}
                  >
                    {label}
                    <span>{count}</span>
                  </button>
                ))}
              </div>
              <label className="hod-doctor-filter">
                Responsible doctor
                <select
                  aria-label="Filter by responsible doctor"
                  value={doctorFilter}
                  onChange={(event) => setDoctorFilter(event.target.value)}
                >
                  {doctorOptions.map((name) => (
                    <option key={name} value={name}>
                      {name === "All" ? "All doctors" : name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="case-table worklist-scroll">
              <table className="worklist-table">
                <thead>
                  <tr>
                    <th scope="col">Priority</th>
                    <th scope="col">Study</th>
                    <th scope="col">Status</th>
                    <th scope="col">Responsible doctor</th>
                    <th scope="col">Received</th>
                    <th scope="col">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOversight.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <PriorityBadge status={item.priority} />
                      </td>
                      <td>
                        <strong>{item.id}</strong>
                      </td>
                      <td>
                        <span className={`progress-pill ${item.progress}`}>
                          {progressLabel(item.progress)}
                        </span>
                      </td>
                      <td>{item.assignee}</td>
                      <td>{item.received}</td>
                      <td>
                        <span className={`sla ${item.slaMin <= 20 ? "urgent" : ""}`}>
                          <Icon name="clock" size={14} />{" "}
                          {item.slaMin < 0 ? `${Math.abs(item.slaMin)} min over` : `${item.slaMin} min`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredOversight.length && (
                <div className="empty-state">
                  <strong>No cases match these filters</strong>
                  <p>Widen the time range or clear status / doctor filters.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setProgressFilter("All");
                      setDoctorFilter("All");
                      setTimeRange("7d");
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
        <div className="hod-split-side">
          <section className="panel policy-summary" aria-labelledby="policy-title">
            <div className="panel-head compact">
              <div>
                <span className="section-kicker">Current rules</span>
                <h2 id="policy-title">Assignment policy</h2>
              </div>
            </div>
            <dl>
              <div>
                <dt>Assignment</dt>
                <dd>{assignmentModeLabel[policy.mode]}</dd>
              </div>
              <div>
                <dt>Escalate after</dt>
                <dd>{policy.escalateAfter} min unread</dd>
              </div>
              <div>
                <dt>Notify</dt>
                <dd>{notifyLabel[policy.notify]}</dd>
              </div>
              <div>
                <dt>Analysis SLA</dt>
                <dd>180 s · fixed</dd>
              </div>
            </dl>
            <button type="button" className="secondary-button full" onClick={onOpenAssignment}>
              <Icon name="sliders" size={15} /> Edit assignment &amp; escalation
            </button>
          </section>
          <section className="panel roster-panel">
            <div className="panel-head compact">
              <div>
                <span className="section-kicker">Staff</span>
                <h2>Workload per reader</h2>
              </div>
            </div>
            <ul className="workload-list">
              {roster.map((person) => (
                <li key={person.staffId}>
                  <div className="workload-row">
                    <strong>{person.name}</strong>
                    <span>
                      {person.openCases} open,{" "}
                      <em className={person.status === "On shift" ? "on" : ""}>{person.status}</em>
                    </span>
                  </div>
                  <div
                    className="bar"
                    role="img"
                    aria-label={`${person.openCases} open of ${maxLoad} on the scale`}
                  >
                    <i style={{ width: `${Math.round((person.openCases / maxLoad) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
        </section>
        <section className="panel acceptance-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Suggestion quality</span>
              <h2>30-day disposition</h2>
            </div>
          </div>
          <div className="donut-wrap">
            <div className="donut">
              <div>
                <strong>87%</strong>
                <span>Accepted</span>
              </div>
            </div>
            <div className="donut-legend">
              <div>
                <i className="unchanged" />
                <span>Unchanged</span>
                <strong>74%</strong>
              </div>
              <div>
                <i className="adjusted" />
                <span>Adjusted</span>
                <strong>13%</strong>
              </div>
              <div>
                <i className="rejected" />
                <span>Not used</span>
                <strong>13%</strong>
              </div>
            </div>
          </div>
          <p className="privacy-note">
            <Icon name="shield" size={14} /> Groups with fewer than five studies are hidden.
          </p>
        </section>
      </div>
      </div>
    </>
  );
}

function AssignmentEscalationView({
  page,
  policy,
  onPolicyChange,
  notify,
}: {
  page: SubPage;
  policy: AssignmentPolicy;
  onPolicyChange: (value: AssignmentPolicy) => void;
  notify: NotifyFn;
}) {
  const [draft, setDraft] = useState<AssignmentPolicy>(policy);
  const { busyKey, run: runBusy } = useBusyAction(notify);
  const dirty =
    draft.mode !== policy.mode ||
    draft.escalateAfter !== policy.escalateAfter ||
    draft.notify !== policy.notify;

  return (
    <>
      <PageIntro eyebrow={page.eyebrow} title={page.title} description={page.description} />
      <div className="policy-layout">
        <section className="panel policy-form" aria-labelledby="policy-form-title">
          <h2 id="policy-form-title">Default policy</h2>
          <fieldset>
            <legend>Assignment</legend>
            {(["workload", "round_robin"] as const).map((mode) => (
              <label key={mode} className="radio-row">
                <input
                  type="radio"
                  name="assignment-mode"
                  checked={draft.mode === mode}
                  onChange={() => setDraft({ ...draft, mode })}
                />
                <span>
                  <strong>{assignmentModeLabel[mode]}</strong>
                  <small>
                    {mode === "workload"
                      ? "Next study goes to the on-shift reader with the fewest open cases."
                      : "Studies rotate across on-shift readers in a fixed order."}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Escalation</legend>
            <label className="form-label">
              Escalate after
              <select
                value={draft.escalateAfter}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    escalateAfter: Number(event.target.value) as AssignmentPolicy["escalateAfter"],
                  })
                }
              >
                {[5, 10, 15, 20].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min unread
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Notify
              <select
                value={draft.notify}
                onChange={(event) =>
                  setDraft({ ...draft, notify: event.target.value as AssignmentPolicy["notify"] })
                }
              >
                {(Object.keys(notifyLabel) as AssignmentPolicy["notify"][]).map((key) => (
                  <option key={key} value={key}>
                    {notifyLabel[key]}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <p className="muted-line">Analysis SLA is fixed at 180 s and cannot be changed here.</p>
          <div className="policy-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!dirty}
              onClick={() => setDraft(policy)}
            >
              Discard changes
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!dirty || busyKey === "policy"}
              onClick={() => {
                const previous = policy;
                const next = draft;
                runBusy(
                  "policy",
                  "Assignment policy saved · applies to new studies",
                  () => onPolicyChange(next),
                  () => {
                    onPolicyChange(previous);
                    setDraft(previous);
                    notify("Policy change undone");
                  },
                );
              }}
            >
              {busyKey === "policy" ? "Saving…" : "Save policy"}
            </button>
          </div>
          <CtaHint show={!dirty}>Change a setting to enable Save.</CtaHint>
        </section>
        <section className="panel policy-rules" aria-labelledby="policy-rules-title">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Read-only</span>
              <h2 id="policy-rules-title">Rules by study type</h2>
            </div>
          </div>
          <div className="case-table worklist-scroll">
            <table className="worklist-table">
              <thead>
                <tr>
                  {page.columns.map((column) => (
                    <th scope="col" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.join("|")}>
                    {row.map((cell, index) => (
                      <td key={index}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function SuspendModal({
  aiActive,
  onClose,
  onConfirm,
  notify,
}: {
  aiActive: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  notify: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  useFocusTrap(true, ref);
  return (
    <div className="modal-wrap">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suspend-dialog-title"
        ref={ref}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <button className="modal-close" onClick={onClose}>
          <Icon name="x" />
        </button>
        <span className={`modal-icon ${aiActive ? "danger" : "safe"}`}>
          <Icon name={aiActive ? "pause" : "play"} />
        </span>
        <span className="section-kicker">Service control</span>
        <h2 id="suspend-dialog-title">
          {aiActive ? "Pause automated analysis?" : "Confirm clinical safety"}
        </h2>
        <p>
          {aiActive
            ? "New studies will move to manual reading. In-progress work remains safe."
            : "Recovery requires both clinical and technical approval."}
        </p>
        <ClinicalComposer
          label="Reason (required)"
            value={reason}
          onChange={setReason}
          notify={notify}
          draftKey="ops:analysis-pause-reason"
          syncStudyNote={false}
            placeholder="Describe the reason and affected scope..."
          voiceText="Automated analysis is paused for a technical check. New studies stay on manual reading until the service is confirmed safe."
          />
        <button
          className={aiActive ? "danger-button full" : "primary-button full"}
          disabled={!reason.trim()}
          onClick={() => onConfirm(reason.trim())}
        >
          <Icon name={aiActive ? "pause" : "check"} size={15} />{" "}
          {aiActive ? "Confirm pause" : "Confirm safety"}
        </button>
        <CtaHint show={!reason.trim()}>
          Enter a reason to enable {aiActive ? "pause" : "safety confirmation"}.
        </CtaHint>
      </div>
    </div>
  );
}

function ItView({
  aiActive,
  onAiChange,
  notify,
}: {
  aiActive: boolean;
  onAiChange: (value: boolean) => void;
  notify: NotifyFn;
}) {
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  return (
    <>
      <PageIntro
        eyebrow="Operations"
        title="Ops dashboard"
        description="Queue, workers, and quarantine. No patient images on this screen."
      >
        <span className="last-update">
          <i /> Updated 8 seconds ago
        </span>
        <button className="secondary-button" onClick={() => notify("Telemetry refreshed")}>
          <Icon name="refresh" size={16} /> Refresh
        </button>
        <button className="danger-button" onClick={() => setConfirmSuspend(true)}>
          <Icon name={aiActive ? "pause" : "play"} size={16} />{" "}
          {aiActive ? "Pause analysis (technical)" : "Resume analysis"}
        </button>
      </PageIntro>
      <section className="health-strip">
        {[
          ["API Gateway", "99.99%", "healthy"],
          ["Event Bus", "12 msg/s", "healthy"],
          ["Analysis workers", "3 / 3", "healthy"],
          ["Object Storage", "68%", "healthy"],
          ["PACS C-STORE", "24 ms", "healthy"],
        ].map(([name, value, status]) => (
          <div key={name}>
            <span className={status}>
              <i />
            </span>
            <p>
              <strong>{name}</strong>
              <small>{value}</small>
            </p>
          </div>
        ))}
      </section>
      <section className="metric-grid four">
        <MetricCard
          icon="layers"
          tone="blue"
          value="06"
          label="Queue depth"
          note="2 tasks processing"
        />
        <MetricCard
          icon="clock"
          tone="green"
          value="86s"
          label="p95 inference"
          note="SLA goal < 180s"
        />
        <MetricCard
          icon="server"
          tone="violet"
          value="72%"
          label="GPU utilization"
          note="VRAM 18.2 / 24 GB"
        />
        <MetricCard
          icon="alert"
          tone="amber"
          value="03"
          label="Quarantine"
          note="2 validation · 1 timeout"
        />
      </section>
      <div className="ai-caution" role="status">
        <Icon name="alert" size={16} />
        <div>
          <strong>Ops view - no clinical authority</strong>
          <span>
            Telemetry and model controls do not replace radiologist sign-off. Inference metrics are
            operational, not diagnostic proof.
          </span>
        </div>
      </div>
      <div className="ops-grid">
        <section className="panel pipeline-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Pipeline</span>
              <h2>Processing flow</h2>
            </div>
            <span className="live-label">
              <i /> Live
            </span>
          </div>
          <div className="pipeline">
            {[
              ["Intake & QC", "database", "24 studies/h", "12ms"],
              ["Event Bus", "activity", "6 queued", "8ms"],
              ["Lesion analysis", "brain", "2 processing", "86s"],
              ["Measurement", "sliders", "0 pending", "1.2s"],
              ["Awaiting Review", "file", "12 cases", "-"],
            ].map(([label, icon, detail, latency], index) => (
              <div className="pipeline-wrap" key={label}>
                <div className="pipeline-node">
                  <span>
                    <Icon name={icon as IconName} size={19} />
                  </span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                  <em>{latency}</em>
                </div>
                {index < 4 && (
                  <div className="pipeline-arrow">
                    <i />
                    <Icon name="chevron" size={13} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="panel resource-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Compute</span>
              <h2>Worker resources</h2>
            </div>
          </div>
          {[
            ["GPU 0 · A10", 72, "#2f6fed"],
            ["CPU cluster", 38, "#18a07a"],
            ["RAM", 61, "#7259d9"],
            ["Object storage", 68, "#d88a17"],
          ].map(([label, value, color]) => (
            <div className="resource-row" key={label as string}>
              <div>
                <span>{label}</span>
                <strong>{value}%</strong>
              </div>
              <div className="progress">
                <i style={{ width: `${value}%`, background: color as string }} />
              </div>
            </div>
          ))}
        </section>
        <section className="panel incidents-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Quarantine</span>
              <h2>Issues requiring attention</h2>
            </div>
            <span className="count-badge">3</span>
          </div>
          <div className="incident-list">
            <div>
              <span className="incident-icon red">
                <Icon name="alert" size={15} />
              </span>
              <p>
                <strong>INC-0913-028 · SLA timeout</strong>
                <small>Analysis worker · 08:41 · 184s</small>
              </p>
              <button onClick={() => notify("Study moved to manual reading")}>Fallback</button>
            </div>
            <div>
              <span className="incident-icon amber">
                <Icon name="alert" size={15} />
              </span>
              <p>
                <strong>INC-0913-027 · Missing FLAIR</strong>
                <small>Intake QC · 08:29 · C000</small>
              </p>
              <button onClick={() => notify("QC issue details opened")}>Details</button>
            </div>
            <div>
              <span className="incident-icon amber">
                <Icon name="alert" size={15} />
              </span>
              <p>
                <strong>INC-0913-024 · Affine mismatch</strong>
                <small>Intake QC · 07:58 · Q102</small>
              </p>
              <button onClick={() => notify("QC issue details opened")}>Details</button>
            </div>
          </div>
        </section>
        <section className="panel backup-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Backup</span>
              <h2>Latest backup</h2>
            </div>
            <span className="verified-badge">
              <Icon name="check" size={13} /> Verified
            </span>
          </div>
          <div className="backup-time">
            <Icon name="database" size={24} />
            <div>
              <strong>13/09/2026 · 02:00</strong>
              <span>PostgreSQL + Object Storage · 1.8 TB</span>
            </div>
          </div>
          <div className="backup-meta">
            <span>
              Checksum <strong>Matched</strong>
            </span>
            <span>
              RPO <strong>6 hours</strong>
            </span>
            <span>
              Retention <strong>30 days</strong>
            </span>
          </div>
          <button
            className="secondary-button full"
            onClick={() => notify("New backup job created")}
          >
            Back up now
          </button>
        </section>
        <section className="panel audit-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">Audit</span>
              <h2>Recent events</h2>
            </div>
            <button className="secondary-button small">
              <Icon name="download" size={14} /> Export log
            </button>
          </div>
          <div className="audit-table">
            <div>
              <span>08:46:12</span>
              <strong>REPORT_ACCESSED</strong>
              <span>usr_phy_024</span>
              <em>200 OK</em>
            </div>
            <div>
              <span>08:43:08</span>
              <strong>MASK_REVISED</strong>
              <span>usr_rad_011</span>
              <em>201</em>
            </div>
            <div>
              <span>08:41:54</span>
              <strong>SLA_TIMEOUT</strong>
              <span>worker_ai_02</span>
              <em className="error">FAILED</em>
            </div>
            <div>
              <span>08:39:22</span>
              <strong>INFERENCE_COMPLETED</strong>
              <span>worker_ai_01</span>
              <em>200 OK</em>
            </div>
          </div>
        </section>
      </div>
      <div className="info-strip neutral">
        <Icon name="shield" size={16} />
        <span>
          <strong>Separation of duties:</strong> IT sees telemetry and audit IDs only - not images,
          masks, or Report.
        </span>
      </div>
      {confirmSuspend && (
        <SuspendModal
          aiActive={aiActive}
          notify={notify}
          onClose={() => setConfirmSuspend(false)}
          onConfirm={(reason) => {
            const wasActive = aiActive;
            void suspendInference(reason, !wasActive).catch(() => undefined);
            onAiChange(!wasActive);
            setConfirmSuspend(false);
            notify(
              wasActive ? "Analysis paused. New studies go to manual reading" : "Analysis resume requested",
              () => {
                onAiChange(wasActive);
                notify(wasActive ? "Analysis resumed" : "Resume request undone");
              },
            );
          }}
        />
      )}
    </>
  );
}

function AuthViews({
  screen,
  onScreenChange,
  onLogin,
}: {
  screen: AuthScreen;
  onScreenChange: (screen: AuthScreen) => void;
  onLogin: (role: Role) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickRole, setPickRole] = useState(false);

  const startSso = () => {
    setError("");
    if (SSO_START_URL) {
      setBusy(true);
      window.location.assign(SSO_START_URL);
      return;
    }
    if (DEMO_MODE) {
      setPickRole(true);
      return;
    }
    // Generic message on purpose: never reveal whether an account exists.
    setError("Sign-in is unavailable right now. Contact your administrator.");
  };

  return (
    <main className="auth-page" id="auth-main">
      <header className="auth-topbar">
        <div className="brand auth-brand">
          <div className="brand-mark">
            <Icon name="brain" size={23} />
          </div>
          <div>
            <strong>
              UDA-<span>StrokeSeg</span>
            </strong>
          </div>
        </div>
        <nav className="auth-nav" aria-label="Primary">
          <a href="#workflow">About</a><a href="#workflow">Workflow</a><a href="#roles">Roles</a><a href="#roles">Clinical safety</a>
        </nav>
        <small>HCMUT · Faculty of Computer Science &amp; Engineering</small>
      </header>

      <section className="auth-hero">
        <div className="auth-hero-copy">
          <span className="auth-kicker">Diagnostic decision support · Multi-center brain MRI</span>
          <h1>Segment acute ischemic stroke lesions quickly, with a clinician in control</h1>
          <p>AI segments lesions across DWI, ADC, and FLAIR sequences and measures lesion volume automatically. A radiologist always reviews, edits, and signs off before any report reaches the stroke physician.</p>
          <div className="scan-preview" aria-label="DWI, ADC and FLAIR scan preview">
            {(["DWI", "ADC", "FLAIR"] as const).map((label, index) => <div className={`scan-tile scan-${index}`} key={label}><i /><b>{label}</b></div>)}
          </div>
          <div className="hero-metrics"><div><strong>&lt; 180 s</strong><span>Target AI inference time</span></div><div><strong>Volume in mL</strong><span>Lesion count, laterality, vascular territory</span></div></div>
        </div>
        <section className="auth-form-panel" aria-labelledby="signin-title">
          <div className="auth-form">
            <div className="signin-heading"><div className="signin-icon"><Icon name="brain" size={24} /></div><div><h2 id="signin-title">Sign in</h2><p>Use the account issued by your hospital IT Admin</p></div></div>
            <label className="form-label">Username<input type="text" placeholder="your.username" autoComplete="username" /></label>
            <label className="form-label">Password<input type="password" placeholder="••••••••" autoComplete="current-password" /></label>
          {screen === "expired" && (
            <div className="auth-notice warning" role="alert">
              <span className="chip warning">
                <Icon name="clock" size={13} /> Session expired
              </span>
              <p>Your session timed out. Unsaved edits were discarded. Sign in again.</p>
            </div>
          )}
          {screen === "no-role" && (
            <div className="auth-notice critical" role="alert">
              <span className="chip critical">
                <Icon name="alert" size={13} /> No role assigned
              </span>
              <p>Your account has no mapped role. Contact your administrator.</p>
            </div>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button full large auth-submit" onClick={startSso} disabled={busy}>
            {busy ? "Connecting to HRM…" : "Continue with hospital SSO"}
          </button>
          <p className="auth-identity-note"><Icon name="shield" size={13} /> Identity and roles are synchronized from the hospital HRM. No local account is created.</p>
          <p className="muted-line">
            Sessions end after 15 minutes of inactivity. Forgot your password or locked out? Contact your IT Admin at [SUPPORT EMAIL].
          </p>
          {DEMO_MODE && pickRole && (
            <div className="demo-creds">
              <span className="section-kicker">Prototype: role returned by HRM</span>
              <div>
                {(Object.keys(roles) as Role[]).map((item) => (
                  <button key={item} type="button" onClick={() => onLogin(item)}>
                    {roles[item].label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPickRole(false);
                    onScreenChange("no-role");
                  }}
                >
                  No role mapped
                </button>
              </div>
            </div>
          )}
          </div>
        </section>
      </section>
      <section className="auth-section" id="workflow"><h2>From scanner to signed report</h2><div className="auth-steps">{[["PACS intake", "Receives DWI, ADC and FLAIR via C-STORE, runs quality checks and converts quickly to NIfTI."], ["3D AI segmentation", "nnU-Net produces a draft mask, a probability heatmap and volume measurements."], ["Radiologist review", "Accept, edit slice by slice or reject, then re-authenticate and sign off."], ["Stroke physician reads", "Sees signed-off cases only and downloads the official PDF report."]].map(([title, text], index) => <article key={title}><span>{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="auth-section auth-roles" id="roles"><h2>A workspace for every role</h2><div className="role-grid">{[["Radiologist", "Worklist of cases awaiting review, synchronized DWI/ADC/FLAIR viewer, mask editing and sign-off."], ["Stroke physician", "Reads the radiologist's impression and quantitative summary, then exports the final report."], ["Head of Department", "Case assignment, SLA and acceptance-rate monitoring, and clinical approval for new models."], ["IT Administrator", "Accounts, PACS connectivity, queue health, backups and technical approval for models."]].map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <nav className="auth-legal" aria-label="Legal"><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a></nav>
    </main>
  );
}

function SessionLockOverlay({
  role,
  deadline,
  onUnlock,
  onExpire,
}: {
  role: Role;
  deadline: number | null;
  onUnlock: () => boolean;
  onExpire: () => void;
}) {
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(LOCK_GRACE_MS);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(true, ref);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!deadline) return;
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left <= 0) onExpire();
    }, 250);
    return () => window.clearInterval(timer);
  }, [deadline, onExpire]);

  return (
    <div className="session-lock" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div className="session-lock-card" ref={ref}>
        <span className="modal-icon">
          <Icon name="lock" />
        </span>
        <h2 id="lock-title">Session locked</h2>
        <p>
          Locked after 15 minutes without activity. Sign in again with hospital SSO to continue as{" "}
          {displayName(role)}. If the session ends first, unsaved mask edits are discarded.
        </p>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button full"
          onClick={() => {
            if (!onUnlock()) setError("Sign-in is unavailable right now. Contact your administrator.");
          }}
        >
          Continue with hospital SSO
        </button>
        <small>
          Session ends in {String(Math.floor(remaining / 60000)).padStart(2, "0")}:
          {String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}
        </small>
      </div>
    </div>
  );
}

function RoleReauthModal({
  target,
  onCancel,
  onConfirm,
}: {
  target: Role;
  onCancel: () => void;
  onConfirm: (password: string) => boolean;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(true, ref);
  return (
    <div className="modal-wrap">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reauth-title"
        ref={ref}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <button className="modal-close" onClick={onCancel}>
          <Icon name="x" />
        </button>
        <span className="modal-icon">
          <Icon name="shield" />
        </span>
        <span className="section-kicker">Re-auth</span>
        <h2 id="reauth-title">Switch to {roles[target].label}?</h2>
        <p>Confirm your password before changing workspace role.</p>
        <label className="form-label">
          Password
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button full"
          onClick={() => {
            if (!onConfirm(password)) setError("Invalid credentials");
          }}
        >
          Confirm switch
        </button>
      </div>
    </div>
  );
}

function AccountSettingsView({
  role,
  onLogout,
  notify,
}: {
  role: Role;
  onLogout: () => void;
  notify: (message: string) => void;
}) {
  const [criticalPause, setCriticalPause] = useState(true);
  const [shiftAlerts, setShiftAlerts] = useState(true);
  const employeeId =
    role === "radiologist"
      ? "RAD-011"
      : role === "physician"
        ? "PHY-024"
        : role === "hod"
          ? "HOD-003"
          : "IT-008";
  return (
    <>
      <PageIntro
        eyebrow="Account"
        title="Account settings"
        description="Identity, role, and session options."
      >
        <button className="secondary-button" onClick={onLogout}>
          <Icon name="logout" size={15} /> Sign out
        </button>
      </PageIntro>
      <section className="panel account-panel compact">
        <div className="account-identity">
          <span className="avatar">{roles[role].initials}</span>
          <div>
            <strong>{displayName(role)}</strong>
            <p>
              {roles[role].label} · {employeeId}
            </p>
          </div>
          <span className="chip neutral">Managed in HRM · signed in with SSO</span>
        </div>
        <dl className="account-grid dense">
          <div>
            <dt>Email</dt>
            <dd>{displayName(role).toLowerCase().replace(/\s|\./g, ".")}@hospital.local</dd>
          </div>
          <div>
            <dt>Last login</dt>
            <dd>Today · 08:12</dd>
          </div>
          <div>
            <dt>Idle lock</dt>
            <dd>15 min</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>Neuroscience</dd>
          </div>
        </dl>
        <div className="account-prefs">
          <label>
            <input
              type="checkbox"
              checked={criticalPause}
              onChange={(event) => setCriticalPause(event.target.checked)}
            />
            Pause idle lock during Critical reads
          </label>
          <label>
            <input
              type="checkbox"
              checked={shiftAlerts}
              onChange={(event) => setShiftAlerts(event.target.checked)}
            />
            Shift SLA and gate alerts
          </label>
        </div>
        <div className="account-actions">
          <button
            className="primary-button"
            onClick={() => notify("Notification preferences saved")}
          >
            Save preferences
          </button>
        </div>
      </section>
    </>
  );
}

export default App;
