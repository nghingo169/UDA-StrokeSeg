import { useEffect, useMemo, useState, type ReactNode } from "react";

type Role = "radiologist" | "physician" | "hod" | "it";
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

type CaseStatus = "Critical" | "Priority" | "Routine";
type StrokeCase = {
  id: string;
  patient: string;
  age: number;
  sex: "Male" | "Female";
  onset: string;
  received: string;
  sla: number;
  status: CaseStatus;
  volume: number;
  side: string;
  territory: string;
  nihss: number;
  clusters: number;
};

type SubPage = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
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
    short: "Care team",
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
    volume: 18.6,
    side: "Left hemisphere",
    territory: "MCA",
    nihss: 14,
    clusters: 2,
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
    volume: 7.2,
    side: "Right hemisphere",
    territory: "PCA",
    nihss: 9,
    clusters: 1,
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
    volume: 3.8,
    side: "Left hemisphere",
    territory: "ACA",
    nihss: 6,
    clusters: 3,
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
    volume: 0,
    side: "Undetermined",
    territory: "-",
    nihss: 4,
    clusters: 0,
  },
];

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

const navByRole: Record<Role, { icon: IconName; label: string }[]> = {
  radiologist: [
    { icon: "grid", label: "Worklist" },
    { icon: "clock", label: "Reading history" },
    { icon: "people", label: "Consultation" },
  ],
  physician: [
    { icon: "grid", label: "Released cases" },
    { icon: "people", label: "Consultation" },
    { icon: "file", label: "Clinical feedback" },
  ],
  hod: [
    { icon: "activity", label: "Overview" },
    { icon: "people", label: "Reviewer roster" },
    { icon: "sliders", label: "Assignment policy" },
    { icon: "layers", label: "Model approval" },
    { icon: "people", label: "Consultation" },
  ],
  it: [
    { icon: "activity", label: "Ops dashboard" },
    { icon: "people", label: "Accounts & access" },
    { icon: "monitor", label: "PACS connection" },
    { icon: "layers", label: "Model registry" },
    { icon: "database", label: "Storage & backup" },
    { icon: "file", label: "Audit log" },
    { icon: "alert", label: "Quarantine log" },
  ],
};

const subPages: Record<Role, SubPage[]> = {
  radiologist: [
    {
      eyebrow: "PERSONAL ACTIVITY",
      title: "Reading history",
      description: "Find studies you have reviewed and Report you have released.",
      action: "Export activity",
      columns: ["Study", "Patient", "Released", "Disposition", "Turnaround"],
      rows: [
        ["AIS-240913-063", "BN-1E74", "Today · 08:18", "AI accepted", "13 min"],
        ["AIS-240913-052", "BN-6A31", "Today · 07:42", "AI adjusted", "18 min"],
        ["AIS-240912-184", "BN-4D77", "Yesterday · 22:08", "AI accepted", "11 min"],
        ["AIS-240912-171", "BN-8F02", "Yesterday · 20:31", "Not used", "21 min"],
      ],
    },
    {
      eyebrow: "MULTIDISCIPLINARY CARE",
      title: "Consultation",
      description: "Join active discussions or review consensus notes from completed sessions.",
      action: "Start consultation",
      columns: ["Session", "Study", "Participants", "Status", "Last activity"],
      rows: [
        ["CON-0913-012", "AIS-240913-058", "4 clinicians", "In progress", "2 min ago"],
        ["CON-0913-009", "AIS-240913-041", "3 clinicians", "Consensus reached", "07:12"],
        ["CON-0912-044", "AIS-240912-166", "5 clinicians", "Indeterminate", "Yesterday"],
      ],
    },
  ],
  physician: [
    {
      eyebrow: "MULTIDISCIPLINARY CARE",
      title: "Consultation",
      description: "Discuss complex released studies with Radiology and the stroke team.",
      action: "Start consultation",
      columns: ["Session", "Study", "Lead", "Status", "Last activity"],
      rows: [
        ["CON-0913-012", "AIS-240913-058", "Dr. Maya Harris", "In progress", "2 min ago"],
        ["CON-0913-009", "AIS-240913-041", "Dr. Thomas Nguyen", "Consensus reached", "07:12"],
        ["CON-0912-044", "AIS-240912-166", "Dr. Priya Shah", "Indeterminate", "Yesterday"],
      ],
    },
    {
      eyebrow: "CARE OUTCOMES",
      title: "Clinical feedback",
      description: "Review treatment decisions and complete feedback for released studies.",
      action: "Export summary",
      columns: ["Study", "Treatment", "AI utility", "Feedback", "Updated"],
      rows: [
        ["AIS-240913-063", "Thrombolysis", "Useful", "Complete", "08:31"],
        ["AIS-240913-058", "Thrombectomy", "Useful", "Complete", "08:12"],
        ["AIS-240913-041", "Conservative care", "Neutral", "Needs note", "07:05"],
      ],
    },
  ],
  hod: [
    {
      eyebrow: "CLINICAL STAFFING",
      title: "Reviewer roster",
      description: "Manage qualified readers, availability, and the current on-call schedule.",
      action: "Add reviewer",
      columns: ["Reviewer", "Shift", "Availability", "Waiting", "Credential"],
      rows: [
        ["Dr. Lena Morgan", "07:00–15:00", "On duty", "4 studies", "Current"],
        ["Dr. Priya Shah", "07:00–15:00", "On duty", "3 studies", "Current"],
        ["Dr. Noah Williams", "15:00–23:00", "Next shift", "-", "Current"],
        ["Dr. Sofia Chen", "23:00–07:00", "Off duty", "-", "Renews Dec 2026"],
      ],
    },
    {
      eyebrow: "WORKLOAD GOVERNANCE",
      title: "Assignment policy",
      description: "Define how urgent studies are routed and when delayed reviews are escalated.",
      action: "Save policy",
      columns: ["Rule", "Current setting", "Applies to", "Escalation", "Status"],
      rows: [
        ["Critical study routing", "Least-loaded reader", "NIHSS ≥ 10", "After 8 min", "Active"],
        ["Standard assignment", "Round robin", "All other studies", "After 15 min", "Active"],
        ["Night coverage", "On-call reader", "23:00–07:00", "After 10 min", "Active"],
      ],
    },
    {
      eyebrow: "DUAL AUTHORIZATION",
      title: "Model approval",
      description: "Review clinical evidence before approving a model for clinical release.",
      action: "Review v2.5.0",
      columns: ["Version", "Target site", "Clinical gate", "Technical gate", "Status"],
      rows: [
        ["v2.5.0", "Siemens 1.5T", "Pending", "Approved", "Awaiting review"],
        ["v2.4.1", "Multi-center", "Approved", "Approved", "Active"],
        ["v2.3.0", "Philips 3.0T", "Approved", "Approved", "Archived"],
      ],
    },
    {
      eyebrow: "MULTIDISCIPLINARY GOVERNANCE",
      title: "Consultation and consensus",
      description:
        "Chair complex case discussions and review permanently recorded consensus notes.",
      action: "Open active session",
      columns: ["Session", "Study", "Members", "AI agreement", "Consensus"],
      rows: [
        ["CON-0913-012", "AIS-240913-058", "4 clinicians", "3 of 4", "In progress"],
        ["CON-0913-009", "AIS-240913-041", "3 clinicians", "3 of 3", "Consensus reached"],
        ["CON-0912-044", "AIS-240912-166", "5 clinicians", "2 of 5", "Indeterminate"],
      ],
    },
  ],
  it: [
    {
      eyebrow: "IDENTITY & ACCESS",
      title: "Accounts and access",
      description:
        "Provision staff accounts and review role assignments under separation of duties.",
      action: "Create account",
      columns: ["User", "Employee ID", "Role", "Last active", "Status"],
      rows: [
        ["Dr. Lena Morgan", "RAD-011", "Radiologist", "Now", "Active"],
        ["Dr. Maya Harris", "PHY-024", "Stroke Physician", "4 min ago", "Active"],
        ["Dr. Thomas Nguyen", "HOD-003", "Head of Department", "12 min ago", "Active"],
        ["Alex Nguyen", "IT-008", "IT Administrator", "Now", "Active"],
      ],
    },
    {
      eyebrow: "DICOM CONNECTIVITY",
      title: "PACS connection",
      description: "Monitor submit-only DICOM nodes and validate C-STORE connectivity.",
      action: "Add PACS node",
      columns: ["Node", "AE title", "Endpoint", "Last heartbeat", "Status"],
      rows: [
        ["Main MRI", "HOSP_MRI_01", "10.20.4.18:104", "24 sec ago", "Connected"],
        ["Emergency MRI", "ER_MRI_02", "10.20.4.22:104", "31 sec ago", "Connected"],
        ["PACS archive", "PACS_CORE", "10.20.2.10:11112", "18 sec ago", "Connected"],
      ],
    },
    {
      eyebrow: "MODEL LIFECYCLE",
      title: "Model registry",
      description: "Validate packages, technical readiness, activation, and safe rollback.",
      action: "Import package",
      columns: ["Version", "Architecture", "Checksum", "Technical gate", "Deployment"],
      rows: [
        ["v2.5.0", "3D nnU-Net", "Verified", "Approved", "Staging"],
        ["v2.4.1", "3D nnU-Net", "Verified", "Approved", "Active"],
        ["v2.3.0", "3D nnU-Net", "Verified", "Approved", "Archived"],
      ],
    },
    {
      eyebrow: "DATA PROTECTION",
      title: "Storage and backup",
      description: "Track protected storage, backup integrity, retention, and restore points.",
      action: "Back up now",
      columns: ["Resource", "Usage", "Last backup", "Integrity", "Retention"],
      rows: [
        ["PostgreSQL", "68 GB", "Today · 02:00", "Verified", "30 days"],
        ["Object Storage", "1.8 TB", "Today · 02:00", "Verified", "30 days"],
        ["Audit Store", "42 GB", "Today · 02:04", "Verified", "7 years"],
      ],
    },
    {
      eyebrow: "IMMUTABLE EVENTS",
      title: "Audit log",
      description: "Search security and lifecycle events without changing the underlying record.",
      action: "Export log",
      columns: ["Time", "Event", "Actor", "Resource", "Result"],
      rows: [
        ["08:46:12", "REPORT_ACCESSED", "usr_phy_024", "RPT-0913-063", "200 OK"],
        ["08:43:08", "MASK_REVISED", "usr_rad_011", "MSK-084-02", "201"],
        ["08:41:54", "SLA_TIMEOUT", "worker_ai_02", "TASK-028", "FAILED"],
        ["08:39:22", "INFERENCE_COMPLETED", "worker_ai_01", "TASK-026", "200 OK"],
      ],
    },
    {
      eyebrow: "FAILED STUDY ISOLATION",
      title: "Quarantine log",
      description:
        "Review validation and processing failures before routing studies to manual reading.",
      action: "Export incidents",
      columns: ["Incident", "Technical reason", "Task", "Received", "Fallback"],
      rows: [
        ["INC-0913-028", "SLA timeout · 184s", "TASK-028", "08:41", "Manual reading"],
        ["INC-0913-027", "Missing FLAIR · C000", "TASK-027", "08:29", "PACS notified"],
        ["INC-0913-024", "Affine mismatch · Q102", "TASK-024", "07:58", "PACS notified"],
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

function App() {
  const [role, setRole] = useState<Role>(() => {
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    return ["radiologist", "physician", "hod", "it"].includes(requestedRole ?? "")
      ? (requestedRole as Role)
      : "radiologist";
  });
  const [activeNav, setActiveNav] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [aiActive, setAiActive] = useState(true);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const switchRole = (next: Role) => {
    setRole(next);
    setActiveNav(0);
    setSidebarOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("role", next);
    url.searchParams.delete("study");
    window.history.replaceState({}, "", url);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar
        role={role}
        activeNav={activeNav}
        open={sidebarOpen}
        onNavigate={setActiveNav}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="app-main">
        <Header
          role={role}
          aiActive={aiActive}
          onRoleChange={switchRole}
          onMenu={() => setSidebarOpen(true)}
        />
        <main className="page" id="main-content" tabIndex={-1}>
          {activeNav > 0 ? (
            <SubWorkspaceView role={role} page={subPages[role][activeNav - 1]} notify={setToast} />
          ) : (
            <>
              {role === "radiologist" && <RadiologistView notify={setToast} />}
              {role === "physician" && <PhysicianView notify={setToast} />}
              {role === "hod" && (
                <HodView aiActive={aiActive} onAiChange={setAiActive} notify={setToast} />
              )}
              {role === "it" && (
                <ItView aiActive={aiActive} onAiChange={setAiActive} notify={setToast} />
              )}
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>
            <Icon name="check" size={15} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function Sidebar({
  role,
  activeNav,
  open,
  onNavigate,
  onClose,
}: {
  role: Role;
  activeNav: number;
  open: boolean;
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
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
              Neuro<span>Flow</span>
            </strong>
            <small>Stroke intelligence</small>
          </div>
        </div>
        <div className="workspace-label">
          <span>Actor workspace</span>
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
              {index === 0 && role === "radiologist" && <b>4</b>}
              {index === 0 && role === "it" && <i />}
            </button>
          ))}
        </nav>
        <div className="safety-note">
          <Icon name="shield" size={17} />
          <p>
            <strong>Clinical decision support</strong>
            <span>AI supports, but never replaces, clinical judgment.</span>
          </p>
        </div>
        <div className="sidebar-user" aria-label={`Signed in as ${roles[role].label}`}>
          <span className="avatar">{roles[role].initials}</span>
          <span>
            <strong>
              {role === "radiologist"
                ? "Dr. Lena Morgan"
                : role === "physician"
                  ? "Dr. Maya Harris"
                  : role === "hod"
                    ? "Dr. Thomas Nguyen"
                    : "Alex Nguyen"}
            </strong>
            <small>{roles[role].label}</small>
          </span>
          <Icon name="more" size={18} />
        </div>
      </aside>
    </>
  );
}

function Header({
  role,
  aiActive,
  onRoleChange,
  onMenu,
}: {
  role: Role;
  aiActive: boolean;
  onRoleChange: (role: Role) => void;
  onMenu: () => void;
}) {
  return (
    <header className="topbar">
      <button className="menu-button" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <div className="topbar-title">
        <span>NEUROFLOW / {roles[role].short.toUpperCase()}</span>
        <strong>{roles[role].title}</strong>
      </div>
      <div className={`service-pill ${aiActive ? "" : "stopped"}`}>
        <i />
        <span role="status" aria-live="polite">
          {aiActive ? "AI services healthy" : "AI services paused"}
        </span>
      </div>
      <div className="role-control">
        <span>Switch actor view</span>
        <div className="role-switcher" aria-label="Actor workspace">
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
          aria-label="Switch actor workspace"
          value={role}
          onChange={(event) => onRoleChange(event.target.value as Role)}
        >
          {(Object.keys(roles) as Role[]).map((item) => (
            <option value={item} key={item}>
              {roles[item].label}
            </option>
          ))}
        </select>
      </div>
      <button className="icon-button notification-button" aria-label="Notifications">
        <Icon name="bell" size={19} />
        <span />
      </button>
    </header>
  );
}

function SubWorkspaceView({
  role,
  page,
  notify,
}: {
  role: Role;
  page: SubPage;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const rows = page.rows.filter((row) =>
    row.join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <PageIntro eyebrow={page.eyebrow} title={page.title} description={page.description}>
        <button className="primary-button" onClick={() => notify(`${page.action} opened`)}>
          <Icon name={page.action.includes("Export") ? "download" : "plus"} size={16} />
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
          <strong>{roles[role].label} workspace</strong>
          <span>Actions and data on this page are scoped to this actor’s permissions.</span>
        </p>
        <span className="access-badge">
          <Icon name="lock" size={13} /> RBAC enforced
        </span>
      </div>
      {page.title === "Model registry" && (
        <div className="workflow-callout">
          <div>
            <span className="section-kicker">DUAL-GATE ACTIVATION · v2.5.0</span>
            <strong>Activation is blocked until both approvals are complete</strong>
          </div>
          <span className="gate-status done">
            <Icon name="check" size={14} /> Technical approved
          </span>
          <span className="gate-status pending">
            <Icon name="clock" size={14} /> Clinical pending
          </span>
          <button className="primary-button" disabled>
            Activate model
          </button>
        </div>
      )}
      {page.title === "Quarantine log" && (
        <div className="workflow-callout quarantine-detail">
          <div>
            <span className="section-kicker">LATEST FAILURE · INC-0913-027</span>
            <strong>Missing mandatory sequence: FLAIR</strong>
            <small>AE Title ER_MRI_02 · Received 08:29 · DICOM response 0xC000</small>
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
            <span className="section-kicker">APPEND-ONLY RECORD</span>
            <strong>Audit events cannot be edited or deleted</strong>
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
          <div
            className="subpage-row subpage-head"
            style={{ gridTemplateColumns: `repeat(${page.columns.length}, minmax(130px, 1fr))` }}
          >
            {page.columns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          {rows.map((row, rowIndex) => (
            <button
              className="subpage-row"
              style={{ gridTemplateColumns: `repeat(${page.columns.length}, minmax(130px, 1fr))` }}
              key={`${row[0]}-${rowIndex}`}
              onClick={() => notify(`${row[0]} selected`)}
            >
              {row.map((cell, cellIndex) => (
                <span
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
                  {cell}
                </span>
              ))}
            </button>
          ))}
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

function RadiologistView({ notify }: { notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | CaseStatus>("All");
  const [selected, setSelected] = useState<StrokeCase | null>(() => {
    const studyId = new URLSearchParams(window.location.search).get("study");
    return cases.find((study) => study.id === studyId) ?? null;
  });
  const [processingSeconds, setProcessingSeconds] = useState(108);
  useEffect(() => {
    const timer = window.setInterval(
      () => setProcessingSeconds((value) => (value > 0 ? value - 1 : 180)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const filtered = useMemo(
    () =>
      cases.filter(
        (item) =>
          (filter === "All" || item.status === filter) &&
          `${item.id} ${item.patient}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [filter, query],
  );

  const openStudy = (study: StrokeCase) => {
    setSelected(study);
    const url = new URL(window.location.href);
    url.searchParams.set("study", study.id);
    window.history.replaceState({}, "", url);
  };

  const closeStudy = () => {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("study");
    window.history.replaceState({}, "", url);
  };

  if (selected) {
    return <CaseWorkspace study={selected} onBack={closeStudy} notify={notify} />;
  }

  return (
    <>
      <PageIntro
        eyebrow="FRIDAY, SEPTEMBER 13 · MORNING SHIFT"
        title="Good morning, Dr. Morgan"
        description="Four studies need review. We have placed the most time-sensitive case first."
      >
        <button className="secondary-button" onClick={() => notify("Today’s schedule opened")}>
          <Icon name="calendar" size={17} /> Today’s schedule
        </button>
      </PageIntro>
      <section className="focus-card">
        <div className="focus-icon">
          <Icon name="clock" size={22} />
        </div>
        <div className="focus-copy">
          <span>YOUR NEXT PRIORITY</span>
          <h2>Review the critical study received at 08:42</h2>
          <p>AIS-240913-084 · 11 minutes remaining · All three MRI sequences are ready.</p>
        </div>
        <div className="focus-stats">
          <span>
            <strong>4</strong> waiting
          </span>
          <span>
            <strong>14m</strong> median TAT
          </span>
        </div>
        <button className="primary-button" onClick={() => openStudy(cases[0])}>
          Start review <Icon name="arrow" size={15} />
        </button>
      </section>
      <section className="panel worklist-panel">
        <div className="panel-head">
          <div>
            <span className="section-kicker">LIVE WORKLIST</span>
            <h2>Your review queue</h2>
          </div>
          <span className="live-label">
            <i /> Live updates
          </span>
        </div>
        <div className="table-tools">
          <label className="search-field">
            <Icon name="search" size={17} />
            <input
              aria-label="Search assigned studies"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search study or patient ID"
            />
          </label>
          <div className="filter-tabs">
            {(["All", "Critical", "Priority", "Routine"] as const).map((item) => (
              <button
                key={item}
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
              >
                {item}
                {item === "All" && <span>{cases.length}</span>}
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            aria-label="Refresh"
            onClick={() => notify("Your worklist is up to date")}
          >
            <Icon name="refresh" size={17} />
          </button>
        </div>
        <div
          className={`processing-study ${processingSeconds < 30 ? "critical" : processingSeconds < 60 ? "warning" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="processing-pulse">
            <Icon name="brain" size={17} />
          </span>
          <div>
            <strong>AIS-240913-091 · AI inference in progress</strong>
            <small>DWI, ADC and FLAIR validated · Siemens 3.0T</small>
          </div>
          <span className="processing-stage">Segmenting lesion</span>
          <div className="processing-timer">
            <span>SLA remaining</span>
            <strong>
              {String(Math.floor(processingSeconds / 60)).padStart(2, "0")}:
              {String(processingSeconds % 60).padStart(2, "0")}
            </strong>
          </div>
        </div>
        <div className="case-table">
          <div className="case-row case-head">
            <span>Priority</span>
            <span>Study</span>
            <span>Onset</span>
            <span>Received</span>
            <span>Time remaining</span>
            <span />
          </div>
          {filtered.map((study) => (
            <button className="case-row" key={study.id} onClick={() => openStudy(study)}>
              <span>
                <PriorityBadge status={study.status} />
              </span>
              <span className="case-identity">
                <strong>{study.id}</strong>
                <small>
                  {study.patient} · {study.age} years · {study.sex}
                </small>
              </span>
              <span>{study.onset === "Unknown" ? study.onset : `${study.onset} ago`}</span>
              <span>{study.received}</span>
              <span className={`sla ${study.sla <= 20 ? "urgent" : ""}`}>
                <Icon name="clock" size={14} /> {study.sla} min
              </span>
              <span className="open-case">
                Review <Icon name="arrow" size={15} />
              </span>
            </button>
          ))}
          {!filtered.length && <div className="empty-state">No matching studies found.</div>}
        </div>
      </section>
      <div className="info-strip">
        <Icon name="shield" size={17} />
        <span>
          <strong>Human review required:</strong> Every AI result must be reviewed and signed by a
          radiologist before release.
        </span>
      </div>
    </>
  );
}

function PriorityBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`priority ${status === "Critical" ? "critical" : status === "Priority" ? "warning" : "normal"}`}
    >
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

function ClinicalComposer({
  label,
  value,
  onChange,
  voiceText,
  placeholder,
  notify,
  metricText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  voiceText: string;
  placeholder: string;
  notify: (message: string) => void;
  metricText?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [voiceAdded, setVoiceAdded] = useState(false);

  const toggleRecording = () => {
    if (recording) {
      onChange(`${value}${value.trim() ? "\n" : ""}${voiceText}`);
      setVoiceAdded(true);
      setRecording(false);
      notify("Voice transcript added - review the text before saving");
      return;
    }
    setRecording(true);
    setVoiceAdded(false);
  };

  return (
    <div className={`clinical-composer ${recording ? "recording" : ""}`}>
      <div className="composer-heading">
        <label>{label}</label>
        <span>{voiceAdded ? "VOICE TRANSCRIPT · DRAFT" : "TYPE OR DICTATE"}</span>
      </div>
      <textarea
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {recording && (
        <div className="composer-listening">
          <span>
            <i /> Listening
          </span>
          <div aria-hidden="true">
            {[7, 14, 10, 20, 12, 17, 8, 15, 6, 11, 18, 9].map((height, index) => (
              <i key={index} style={{ height: `${height}px` }} />
            ))}
          </div>
          <small>Tap stop when finished</small>
        </div>
      )}
      <div className="composer-toolbar">
        <span>
          <Icon name="shield" size={13} /> Draft until reviewed
        </span>
        {metricText && (
          <button
            className="autofill-button"
            onClick={() => {
              onChange(`${value}${value.trim() ? "\n" : ""}${metricText}`);
              notify("Verified lesion measurements inserted");
            }}
          >
            <Icon name="plus" size={14} /> Insert measurements
          </button>
        )}
        <select aria-label="Dictation language" defaultValue="en-US">
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
        </select>
        <button
          className={recording ? "recording" : ""}
          onClick={toggleRecording}
          aria-label={recording ? "Stop dictation" : "Start dictation"}
          title={recording ? "Stop dictation" : "Start dictation"}
        >
          <Icon name={recording ? "pause" : "mic"} size={18} />
        </button>
      </div>
    </div>
  );
}

function CaseWorkspace({
  study,
  onBack,
  notify,
}: {
  study: StrokeCase;
  onBack: () => void;
  notify: (message: string) => void;
}) {
  const [slice, setSlice] = useState(17);
  const [overlay, setOverlay] = useState(true);
  const [heatmap, setHeatmap] = useState(false);
  const [editTool, setEditTool] = useState<"Brush" | "Eraser" | "Threshold">("Brush");
  const [signing, setSigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [maskRevised, setMaskRevised] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [signed, setSigned] = useState(false);
  const [disposition, setDisposition] = useState<
    "accepted_unchanged" | "accepted_with_adjustment" | "not_used"
  >("accepted_unchanged");
  const [rejectionReason, setRejectionReason] = useState("");
  const [qualityRating, setQualityRating] = useState(0);
  const [perceivedQuality, setPerceivedQuality] = useState<"Good" | "Fair" | "Poor" | "">("");
  const [impression, setImpression] = useState(
    `Acute ischemic infarct in the ${study.side.toLowerCase()}, ${study.territory} territory.`,
  );

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

  if (signed) {
    return (
      <div className="success-screen">
        <span className="success-icon">
          <Icon name="check" size={30} />
        </span>
        <span className="section-kicker">SIGNED OFF · IMMUTABLE</span>
        <h1>Report released successfully</h1>
        <p>{study.id} is locked and safely available to the stroke care team.</p>
        <div className="success-meta">
          <div>
            <span>Signed by</span>
            <strong>Dr. Lena Morgan</strong>
          </div>
          <div>
            <span>Mask version</span>
            <strong>{maskRevised ? "Revision 02" : "AI Original 01"}</strong>
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
    <div className="workspace">
      <div className="workspace-top">
        <button className="back-button" onClick={onBack}>
          <Icon name="arrow" size={16} /> Worklist
        </button>
        <div>
          <PriorityBadge status={study.status} />
          <strong>{study.id}</strong>
          <span>
            {study.patient} · {study.age} years · {study.sex}
          </span>
        </div>
        <div className="workspace-actions">
          <span className="sla-clock">
            <Icon name="clock" size={15} /> SLA {study.sla} min
          </span>
          <button
            className="secondary-button"
            onClick={() => {
              setEditing(!editing);
              setDisposition("accepted_with_adjustment");
            }}
          >
            <Icon name="edit" size={16} /> {editing ? "Editing mask" : "Edit mask"}
          </button>
          <button className="primary-button" onClick={() => setSigning(true)}>
            <Icon name="lock" size={15} /> Review & sign
          </button>
        </div>
      </div>
      <div className="review-steps" aria-label="Review progress">
        <span className="active">
          <b>1</b> Review images
        </span>
        <i />
        <span>
          <b>2</b> Confirm impression
        </span>
        <i />
        <span>
          <b>3</b> Sign and release
        </span>
      </div>
      <div className="viewer-layout">
        <section className="viewer">
          <div className="viewer-toolbar">
            <span className="viewer-sync-label">
              <Icon name="layers" size={14} /> Synchronized series
            </span>
            <span>Axial · {slice + 1} / 34</span>
            <div className="viewer-toggles">
              <label>
                <input type="checkbox" checked={overlay} onChange={() => setOverlay(!overlay)} />{" "}
                Mask
              </label>
              <label>
                <input type="checkbox" checked={heatmap} onChange={() => setHeatmap(!heatmap)} />{" "}
                Heatmap
              </label>
            </div>
          </div>
          <div
            className="scan-grid"
            onWheel={(event) => {
              event.preventDefault();
              setSlice((value) => Math.min(33, Math.max(0, value + (event.deltaY > 0 ? 1 : -1))));
            }}
          >
            {["DWI", "ADC", "FLAIR"].map((sequence, index) => (
              <div className={`scan scan-${index + 1}`} key={sequence}>
                <span className="sequence-label">{sequence}</span>
                <div className="brain-scan">
                  <i className="hemisphere left" />
                  <i className="hemisphere right" />
                  {overlay && <i className="lesion" />}
                  {heatmap && <i className="heatmap" />}
                  {editing && <i className="edit-ring" />}
                  <i className="crosshair-x" />
                  <i className="crosshair-y" />
                </div>
                <span className="scan-coordinates">
                  x 42.0 · y 68.0 · z {(slice * 4).toFixed(1)} mm
                </span>
                <small>
                  W: {index === 1 ? 1350 : 980} · L: {index === 1 ? 680 : 460}
                </small>
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
                disabled={!revisionReason.trim()}
                onClick={() => {
                  setEditing(false);
                  setMaskRevised(true);
                  setDisposition("accepted_with_adjustment");
                  notify("Mask Revision 02 saved and measurements recalculated");
                }}
              >
                Save revision
              </button>
            </div>
          )}
        </section>
        <aside className="clinical-panel">
          <div className="clinical-section patient-summary">
            <div className="section-title">
              <span>Clinical context</span>
              <b>NIHSS {study.nihss}</b>
            </div>
            <dl>
              <div>
                <dt>Onset</dt>
                <dd>{study.onset === "Unknown" ? study.onset : `${study.onset} ago`}</dd>
              </div>
              <div>
                <dt>Pre-stroke mRS</dt>
                <dd>1</dd>
              </div>
              <div>
                <dt>Scanner</dt>
                <dd>Siemens 3.0T</dd>
              </div>
            </dl>
          </div>
          <div className="clinical-section">
            <div className="section-title">
              <span>Lesion measurements</span>
              <em>AI · v2.4.1</em>
            </div>
            {study.volume === 0 ? (
              <div className="empty-mask-warning">
                <Icon name="alert" size={17} />
                <p>
                  <strong>Empty mask</strong>
                  <span>
                    This is not evidence of a negative study. Review the full examination.
                  </span>
                </p>
              </div>
            ) : (
              <>
                <div className="volume-result">
                  <span>Total volume</span>
                  <strong>
                    {editing ? (study.volume + 0.7).toFixed(1) : study.volume.toFixed(1)}{" "}
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
                    <strong>{study.territory}</strong>
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
              <span>Structured AI suggestion</span>
              <em>Unverified</em>
            </div>
            <div className="ai-suggestion">
              <section>
                <span className="suggestion-index">01</span>
                <div>
                  <strong>Lesion parameters</strong>
                  <ul>
                    <li>
                      Volume: <b>{study.volume.toFixed(1)} mL</b> · Clusters:{" "}
                      <b>{study.clusters}</b>
                    </li>
                    <li>
                      Laterality: <b>{study.side}</b> · Territory: <b>{study.territory}</b>
                    </li>
                    <li>
                      Native voxel spacing: <b>2.0 × 2.0 × 4.0 mm</b>
                    </li>
                    <li>
                      Model / mask: <b>v2.4.1 · AI Original 01</b>
                    </li>
                  </ul>
                </div>
              </section>
              <section>
                <span className="suggestion-index">02</span>
                <div>
                  <strong>Related imaging findings</strong>
                  <ul>
                    <li>DWI hyperintensity with spatially corresponding ADC hypointensity.</li>
                    <li>Subtle FLAIR hyperintensity; no visible hemorrhagic component.</li>
                    <li>Distribution is predominantly within the {study.territory} territory.</li>
                  </ul>
                </div>
              </section>
              <section>
                <span className="suggestion-index">03</span>
                <div>
                  <strong>Conclusion and suggestion</strong>
                  <p>
                    Pattern may be compatible with acute ischemic injury in the{" "}
                    {study.side.toLowerCase()}. Correlate with symptom onset, neurologic
                    examination, and the complete MRI study. Radiologist confirmation is required.
                  </p>
                </div>
              </section>
              <section className="suggestion-references">
                <span className="suggestion-index">04</span>
                <div>
                  <strong>Reference basis</strong>
                  <ol>
                    <li>Powers WJ et al. AHA/ASA Acute Ischemic Stroke Guideline, 2019.</li>
                    <li>ISLES 2022: Ischemic Stroke Lesion Segmentation challenge definition.</li>
                    <li>Model v2.4.1 validation card · Site-specific release evidence.</li>
                  </ol>
                </div>
              </section>
            </div>
            <div className="ai-disclaimer">
              <Icon name="brain" size={16} />
              AI-generated draft. References provide context, not patient-specific evidence.
            </div>
          </div>
          <div className="clinical-section">
            <div className="section-title">
              <span>AI disposition</span>
              <em>Required</em>
            </div>
            <div className="disposition-options">
              {[
                ["accepted_unchanged", "Accept unchanged"],
                ["accepted_with_adjustment", "Accept with adjustment"],
                ["not_used", "Do not use AI"],
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
            {disposition === "not_used" && (
              <label className="rejection-reason">
                Reason for rejecting AI output
                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Required before sign-off..."
                />
              </label>
            )}
          </div>
          <div className="clinical-section">
            <ClinicalComposer
              label="Radiology impression"
              value={impression}
              onChange={setImpression}
              placeholder="Type your impression or use the microphone…"
              voiceText="Restricted diffusion in the left MCA territory with corresponding low ADC signal. No hemorrhagic component is identified."
              metricText={`Verified lesion measurements: ${study.volume.toFixed(1)} mL, ${study.clusters} cluster${study.clusters === 1 ? "" : "s"}, ${study.side.toLowerCase()}, ${study.territory} territory.`}
              notify={notify}
            />
            <div className="report-draft-actions">
              <span>
                <Icon name="file" size={13} /> Unsigned exports include a DRAFT watermark
              </span>
              <button onClick={() => notify("Draft PDF generated with DRAFT watermark")}>
                Export draft PDF
              </button>
            </div>
          </div>
        </aside>
      </div>
      {signing && (
        <div className="modal-wrap">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-dialog-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") setSigning(false);
            }}
          >
            <button className="modal-close" onClick={() => setSigning(false)}>
              <Icon name="x" />
            </button>
            <span className="modal-icon">
              <Icon name="lock" />
            </span>
            <span className="section-kicker">STEP-UP AUTHENTICATION</span>
            <h2 id="sign-dialog-title">Confirm and release</h2>
            <p>
              After signing, the mask and report are permanently locked. Please verify your
              identity.
            </p>
            <div className="sign-summary">
              <div>
                <span>Study</span>
                <strong>{study.id}</strong>
              </div>
              <div>
                <span>Disposition</span>
                <strong>
                  {disposition === "accepted_unchanged"
                    ? "AI accepted unchanged"
                    : disposition === "accepted_with_adjustment"
                      ? "AI accepted with adjustment"
                      : "AI not used"}
                </strong>
              </div>
            </div>
            <fieldset className="quality-feedback">
              <legend>AI quality feedback</legend>
              <div>
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
              <div>
                <span>Clinical utility</span>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    type="button"
                    key={rating}
                    className={qualityRating >= rating ? "active star" : "star"}
                    aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
                    onClick={() => setQualityRating(rating)}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="form-label">
              Current password
              <input type="password" defaultValue="password" autoFocus />
            </label>
            <label className="confirm-check">
              <input type="checkbox" defaultChecked /> I reviewed the complete examination and
              confirm the impression above.
            </label>
            <button
              className="primary-button full"
              disabled={
                !impression.trim() ||
                !perceivedQuality ||
                qualityRating === 0 ||
                (disposition === "not_used" && !rejectionReason.trim())
              }
              onClick={() => setSigned(true)}
            >
              <Icon name="lock" size={15} /> Sign and release report
            </button>
            {(!perceivedQuality || qualityRating === 0) && (
              <p className="sign-requirements" role="status">
                Select mask quality and clinical utility before signing.
              </p>
            )}
            <small className="modal-foot">
              Verification is valid for 5 minutes · This action is recorded in the audit log
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

function PhysicianView({ notify }: { notify: (message: string) => void }) {
  const [selected, setSelected] = useState(signedCases[0]);
  const [treatment, setTreatment] = useState("Not recorded");
  const [feedbackNote, setFeedbackNote] = useState("");
  return (
    <>
      <PageIntro
        eyebrow="STROKE TEAM · RELEASED RESULTS"
        title="Released cases"
        description="Only finalized radiology Report are available in this workspace."
      >
        <button className="secondary-button" onClick={() => notify("Date filter opened")}>
          <Icon name="calendar" size={16} /> Today, Sep 13
        </button>
        <button
          className="primary-button"
          onClick={() => notify("Consultation room opened for this study")}
        >
          <Icon name="people" size={16} /> Start consultation
        </button>
      </PageIntro>
      <div className="care-path">
        <span className="done">
          <Icon name="check" size={14} /> Radiology released
        </span>
        <Icon name="chevron" size={14} />
        <span className="active">Review clinical context</span>
        <Icon name="chevron" size={14} />
        <span>Record treatment decision</span>
      </div>
      <div className="physician-layout">
        <section className="panel result-list">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">SIGNED OFF</span>
              <h2>{signedCases.length} new results</h2>
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
            <input aria-label="Search released studies" placeholder="Search studies..." />
          </label>
          <div className="signed-list">
            {signedCases.map((item) => (
              <button
                key={item.id}
                className={selected.id === item.id ? "active" : ""}
                onClick={() => setSelected(item)}
              >
                <span className="signed-check">
                  <Icon name="check" size={14} />
                </span>
                <span>
                  <strong>{item.id}</strong>
                  <small>
                    {item.patient} · {item.age} years · {item.sex}
                  </small>
                </span>
                <span>
                  <strong>{item.volume} mL</strong>
                  <small>Released {item.signed}</small>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel result-detail">
          <div className="result-header">
            <div>
              <span className="verified-badge">
                <Icon name="shield" size={14} /> Verified
              </span>
              <h2>{selected.id}</h2>
              <p>
                {selected.patient} · {selected.age} years · {selected.sex} · NIHSS {selected.nihss}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => notify("Secure PDF link created - valid for 15 minutes")}
            >
              <Icon name="download" size={16} /> Download PDF
            </button>
          </div>
          <div className="clinical-banner">
            <span>
              <Icon name="activity" size={18} />
            </span>
            <div>
              <small>FINAL RADIOLOGY IMPRESSION</small>
              <strong>
                Acute ischemic infarct in the {selected.side.toLowerCase()}, {selected.territory}{" "}
                territory.
              </strong>
              <p>
                Restricted diffusion on DWI with corresponding low ADC signal. No hemorrhage
                identified.
              </p>
            </div>
          </div>
          <div className="result-body">
            <div>
              <h3>Verified measurements</h3>
              <div className="big-measurements">
                <div className="featured">
                  <span>Lesion volume</span>
                  <strong>
                    {selected.volume}
                    <small>mL</small>
                  </strong>
                </div>
                <div>
                  <span>Clusters</span>
                  <strong>{selected.clusters}</strong>
                </div>
                <div>
                  <span>Laterality</span>
                  <strong>{selected.side.replace(" hemisphere", "")}</strong>
                </div>
                <div>
                  <span>Territory</span>
                  <strong>{selected.territory}</strong>
                </div>
              </div>
            </div>
            <div className="approved-scan">
              <span>APPROVED MASK · DWI</span>
              <div className="brain-scan">
                <i className="hemisphere left" />
                <i className="hemisphere right" />
                <i className="lesion" />
              </div>
              <small>Mask Revision 01 · Model v2.4.1</small>
            </div>
          </div>
          <div className="signer-row">
            <span className="avatar">LA</span>
            <div>
              <small>Signed by</small>
              <strong>{selected.signer}</strong>
            </div>
            <div>
              <small>Released</small>
              <strong>13/09/2026 · {selected.signed}</strong>
            </div>
            <span className="immutable">
              <Icon name="lock" size={14} /> Locked
            </span>
          </div>
          <div className="treatment-section">
            <div>
              <span className="section-kicker">CLINICAL FEEDBACK</span>
              <h3>Treatment decision</h3>
            </div>
            <div className="treatment-checks" aria-label="Treatment eligibility review">
              <label>
                <input type="checkbox" defaultChecked /> Onset within 4.5 hours
              </label>
              <label>
                <input type="checkbox" defaultChecked /> No hemorrhage identified
              </label>
              <label>
                <input type="checkbox" /> Contraindication identified
              </label>
            </div>
            <div className="treatment-options">
              {["Thrombolysis", "Thrombectomy", "Conservative care"].map((item) => (
                <button
                  className={treatment === item ? "active" : ""}
                  onClick={() => {
                    setTreatment(item);
                  }}
                  key={item}
                >
                  <span>{treatment === item && <Icon name="check" size={13} />}</span>
                  {item}
                </button>
              ))}
            </div>
            <button
              className="primary-button"
              disabled={treatment === "Not recorded"}
              onClick={() => notify(`Treatment plan saved: ${treatment}`)}
            >
              Save treatment plan
            </button>
          </div>
          <div className="physician-feedback-note">
            <ClinicalComposer
              label="Clinical feedback note"
              value={feedbackNote}
              onChange={setFeedbackNote}
              placeholder="Type a care note or use the microphone…"
              voiceText="Imaging findings reviewed with the stroke team. Clinical presentation is concordant. Proceed with treatment pathway after contraindication screening."
              notify={notify}
            />
            <button
              className="primary-button"
              disabled={!feedbackNote.trim()}
              onClick={() => notify("Clinical feedback saved to the study record")}
            >
              Save clinical feedback
            </button>
          </div>
        </section>
      </div>
      <div className="info-strip neutral">
        <Icon name="lock" size={16} />
        <span>
          This is a <strong>read-only</strong> workspace. Draft and unsigned studies are never
          available to the care team.
        </span>
      </div>
    </>
  );
}

function HodView({
  aiActive,
  onAiChange,
  notify,
}: {
  aiActive: boolean;
  onAiChange: (value: boolean) => void;
  notify: (message: string) => void;
}) {
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [fallbackAssignee, setFallbackAssignee] = useState("");
  const [roster, setRoster] = useState([
    { name: "Dr. Lena Morgan", status: true, load: 4, shift: "07:00–15:00" },
    { name: "Dr. Priya Shah", status: true, load: 3, shift: "07:00–15:00" },
    { name: "Dr. Noah Williams", status: false, load: 0, shift: "15:00–23:00" },
  ]);
  return (
    <>
      <PageIntro
        eyebrow="CLINICAL GOVERNANCE · HOTL"
        title="Clinical overview"
        description="A calm, department-level view of workload, turnaround, and AI safety."
      >
        <button className="secondary-button">
          <Icon name="calendar" size={16} /> Past 24 hours
        </button>
        <button
          className={`danger-button ${!aiActive ? "resume" : ""}`}
          onClick={() => setConfirmSuspend(true)}
        >
          <Icon name={aiActive ? "pause" : "play"} size={16} />{" "}
          {aiActive ? "Pause AI" : "Resume AI"}
        </button>
      </PageIntro>
      {!aiActive && (
        <div className="suspended-banner">
          <Icon name="alert" size={19} />
          <div>
            <strong>AI service is paused</strong>
            <span>New studies are routed to the manual PACS reading workflow.</span>
          </div>
          <span>Manual fallback active</span>
        </div>
      )}
      <section className="metric-grid four">
        <MetricCard
          icon="grid"
          tone="amber"
          value="12"
          label="Awaiting review"
          note="+3 in the last 30 minutes"
        />
        <MetricCard
          icon="clock"
          tone="green"
          value="14m"
          label="Median TAT"
          note="Goal: ≤ 20 minutes"
        />
        <MetricCard
          icon="check"
          tone="blue"
          value="87%"
          label="AI accepted"
          note="74% without changes"
        />
        <MetricCard
          icon="alert"
          tone="red"
          value="02"
          label="SLA alerts"
          note="Needs coordination"
        />
      </section>
      <section className="panel fallback-queue">
        <div>
          <span className="incident-icon red">
            <Icon name="alert" size={16} />
          </span>
          <p>
            <strong>Emergency manual fallback · AIS-240913-091</strong>
            <small>AI inference exceeded 180s · PACS study is available for manual reading</small>
          </p>
        </div>
        <label>
          Reassign to
          <select
            value={fallbackAssignee}
            onChange={(event) => setFallbackAssignee(event.target.value)}
          >
            <option value="">Select on-duty radiologist</option>
            <option value="Dr. Lena Morgan">Dr. Lena Morgan · 4 waiting</option>
            <option value="Dr. Priya Shah">Dr. Priya Shah · 3 waiting</option>
          </select>
        </label>
        <button
          className="danger-button"
          disabled={!fallbackAssignee}
          onClick={() => notify(`Emergency study reassigned to ${fallbackAssignee}`)}
        >
          Reassign now
        </button>
      </section>
      <div className="governance-grid">
        <section className="panel queue-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">REVIEW QUEUE</span>
              <h2>Hourly workload</h2>
            </div>
            <span className="goal-line">TAT goal ≤ 20m</span>
          </div>
          <div className="queue-chart">
            {[5, 7, 4, 9, 12, 8, 11, 6, 10, 13, 9, 12].map((height, index) => (
              <div key={index}>
                <span
                  style={{ height: `${height * 9}px` }}
                  className={height >= 12 ? "high" : ""}
                />
                <small>{index % 2 === 0 ? `${index + 1}h` : ""}</small>
              </div>
            ))}
            <i className="target-line">
              <span>20m</span>
            </i>
          </div>
          <div className="chart-legend">
            <span>
              <i className="blue" /> Studies received
            </span>
            <span>
              <i className="red" /> Above threshold
            </span>
          </div>
        </section>
        <section className="panel acceptance-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">AI QUALITY</span>
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
        <section className="panel roster-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">REVIEWER ROSTER</span>
              <h2>Today’s reading team</h2>
            </div>
            <button className="secondary-button small">
              <Icon name="plus" size={14} /> Add reviewer
            </button>
          </div>
          <div className="roster-list">
            {roster.map((person, index) => (
              <div key={person.name}>
                <span className="avatar">
                  {person.name
                    .split(" ")
                    .slice(-2)
                    .map((word) => word[0])
                    .join("")}
                </span>
                <span>
                  <strong>{person.name}</strong>
                  <small>
                    {person.shift} · {person.load} studies waiting
                  </small>
                </span>
                <span className={`availability ${person.status ? "" : "off"}`}>
                  <i />
                  {person.status ? "On duty" : "Next shift"}
                </span>
                <button
                  className={`toggle ${person.status ? "on" : ""}`}
                  onClick={() =>
                    setRoster(
                      roster.map((item, i) =>
                        i === index ? { ...item, status: !item.status } : item,
                      ),
                    )
                  }
                  aria-label={`Change status ${person.name}`}
                >
                  <i />
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel model-gate">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">DUAL AUTHORIZATION</span>
              <h2>Model v2.5.0</h2>
            </div>
            <span className="review-badge">Pending review</span>
          </div>
          <p>
            UDA update for Siemens 1.5T · Target Dice improved <strong>+6.8%</strong>
          </p>
          <div className="gate-row done">
            <span>
              <Icon name="check" size={14} />
            </span>
            <div>
              <strong>Technical gate</strong>
              <small>Approved by IT Admin · Sep 11</small>
            </div>
          </div>
          <div className="gate-row">
            <span>2</span>
            <div>
              <strong>Clinical gate</strong>
              <small>Awaiting clinical evidence review</small>
            </div>
          </div>
          <div className="model-actions">
            <button className="secondary-button">View evidence</button>
            <button
              className="primary-button"
              onClick={() => notify("Clinical approval recorded for model v2.5.0")}
            >
              Approve clinical gate
            </button>
          </div>
        </section>
      </div>
      {confirmSuspend && (
        <div className="modal-wrap">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suspend-dialog-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") setConfirmSuspend(false);
            }}
          >
            <button className="modal-close" onClick={() => setConfirmSuspend(false)}>
              <Icon name="x" />
            </button>
            <span className={`modal-icon ${aiActive ? "danger" : "safe"}`}>
              <Icon name={aiActive ? "pause" : "play"} />
            </span>
            <span className="section-kicker">CLINICAL CIRCUIT BREAKER</span>
            <h2 id="suspend-dialog-title">
              {aiActive ? "Pause AI services?" : "Confirm clinical safety"}
            </h2>
            <p>
              {aiActive
                ? "New studies will move to manual reading. In-progress work remains safe."
                : "Recovery requires both clinical and technical approval."}
            </p>
            <label className="form-label">
              Reason (required)
              <textarea placeholder="Describe the reason and affected scope..." />
            </label>
            <button
              className={aiActive ? "danger-button full" : "primary-button full"}
              onClick={() => {
                onAiChange(!aiActive);
                setConfirmSuspend(false);
                notify(
                  aiActive ? "Manual fallback activated" : "Clinical safety confirmation sent",
                );
              }}
            >
              <Icon name={aiActive ? "pause" : "check"} size={15} />{" "}
              {aiActive ? "Confirm pause" : "Confirm safety"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ItView({
  aiActive,
  onAiChange,
  notify,
}: {
  aiActive: boolean;
  onAiChange: (value: boolean) => void;
  notify: (message: string) => void;
}) {
  return (
    <>
      <PageIntro
        eyebrow="SYSTEM OPERATIONS · LIVE"
        title="System operations"
        description="Technical telemetry only - no images or clinical content are visible here."
      >
        <span className="last-update">
          <i /> Updated 8 seconds ago
        </span>
        <button className="secondary-button" onClick={() => notify("Telemetry refreshed")}>
          <Icon name="refresh" size={16} /> Refresh
        </button>
        <button
          className="danger-button"
          onClick={() => {
            onAiChange(!aiActive);
            notify(
              aiActive ? "AI paused for technical safety" : "Dual-approval recovery request sent",
            );
          }}
        >
          <Icon name={aiActive ? "pause" : "play"} size={16} />{" "}
          {aiActive ? "Technical pause" : "Request recovery"}
        </button>
      </PageIntro>
      <section className="health-strip">
        {[
          ["API Gateway", "99.99%", "healthy"],
          ["Event Bus", "12 msg/s", "healthy"],
          ["AI Workers", "3 / 3", "healthy"],
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
      <div className="ops-grid">
        <section className="panel pipeline-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">EVENT PIPELINE</span>
              <h2>Live processing flow</h2>
            </div>
            <span className="live-label">
              <i /> Live
            </span>
          </div>
          <div className="pipeline">
            {[
              ["Intake & QC", "database", "24 studies/h", "12ms"],
              ["Event Bus", "activity", "6 queued", "8ms"],
              ["AI Inference", "brain", "2 processing", "86s"],
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
              <span className="section-kicker">COMPUTE</span>
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
              <span className="section-kicker">QUARANTINE</span>
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
                <small>AI worker · 08:41 · 184s</small>
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
              <span className="section-kicker">DATA PROTECTION</span>
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
          <p>
            <Icon name="lock" size={13} /> Restore is available only out-of-band through Bastion /
            CLI.
          </p>
        </section>
        <section className="panel audit-panel">
          <div className="panel-head compact">
            <div>
              <span className="section-kicker">IMMUTABLE AUDIT</span>
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
          <strong>Separation of duties:</strong> IT administrators can see technical identifiers,
          telemetry, and audit events only - never patient images, masks, or Report.
        </span>
      </div>
    </>
  );
}

export default App;
