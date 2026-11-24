import { useState } from "react";

type ShiftKind = "am" | "pm" | "off";

type ReviewItem = { study: string; tat: string; note: string };
type ConsultItem = { id: string; study: string; time: string; label: string };

/** Clinical demo clock. The live worklist is the morning shift on this day. */
const SHIFT_TODAY = new Date(2026, 8, 13);

const SHIFT_OVERRIDES: Record<string, ShiftKind> = {
  "2026-09-13": "am",
};

const SHIFT_REVIEWS: Record<string, ReviewItem[]> = {
  "2026-09-08": [{ study: "AIS-240908-019", tat: "19 min", note: "suggestion accepted" }],
  "2026-09-10": [{ study: "AIS-240910-027", tat: "22 min", note: "suggestion adjusted" }],
  "2026-09-11": [{ study: "AIS-240911-044", tat: "15 min", note: "suggestion accepted" }],
  "2026-09-13": [
    { study: "AIS-240913-052", tat: "18 min", note: "suggestion adjusted" },
    { study: "AIS-240913-063", tat: "13 min", note: "suggestion accepted" },
  ],
};

const SHIFT_CONSULTS: Record<string, ConsultItem[]> = {
  "2026-09-09": [
    { id: "CON-0909-006", study: "AIS-240909-033", time: "16:40", label: "multidisciplinary review" },
  ],
  "2026-09-13": [
    { id: "CON-0913-012", study: "AIS-240913-058", time: "09:30", label: "multidisciplinary review" },
  ],
  "2026-09-15": [
    { id: "CON-0915-004", study: "AIS-240915-011", time: "10:00", label: "multidisciplinary review" },
  ],
};

const AM_SHIFT = {
  label: "Morning Shift",
  window: "07:00–15:00",
  station: "ER MRI - Siemens 3.0T",
  coverage: [
    { name: "Dr. Lena Morgan", detail: "RAD-011, Morning Shift" },
    { name: "Dr. Priya Shah", detail: "RAD-014, Morning Shift" },
  ],
  handoffTime: "15:00",
  handoffWho: "Dr. Noah Williams, PM Shift",
};

const PM_SHIFT = {
  label: "PM Shift",
  window: "15:00–23:00",
  station: "ER MRI - Siemens 3.0T",
  coverage: [
    { name: "Dr. Lena Morgan", detail: "RAD-011, PM Shift" },
    { name: "Dr. Noah Williams", detail: "RAD-018, PM Shift" },
  ],
  handoffTime: "23:00",
  handoffWho: "Dr. Elena Cho, Night Shift",
};

function cloneDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = cloneDate(date);
  const day = next.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + delta);
  return next;
}

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayStamp(date: Date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function sameDay(a: Date, b: Date) {
  return dayStamp(a) === dayStamp(b);
}

function shiftKind(date: Date): ShiftKind {
  return SHIFT_OVERRIDES[dayKey(date)] ?? weekdayShift(date.getDay());
}

function weekdayShift(dow: number): ShiftKind {
  if (dow === 0 || dow === 6) return "off";
  if (dow === 3) return "pm";
  return "am";
}

function shiftStatus(date: Date, kind: ShiftKind) {
  if (kind === "off") return "Off duty";
  const delta = dayStamp(date) - dayStamp(SHIFT_TODAY);
  if (delta === 0) return "Active shift";
  if (delta < 0) return "Completed";
  return "Upcoming";
}

function shiftMeta(kind: ShiftKind) {
  return kind === "pm" ? PM_SHIFT : AM_SHIFT;
}

function rangeLabel(mode: "week" | "month", cursor: Date) {
  if (mode === "month") {
    return cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  const start = startOfWeek(cursor);
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    const month = start.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    return `${start.getDate()}–${end.getDate()} ${month}`;
  }
  const startLabel = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M10 7 5 12l5 5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ShiftDayButton({
  date,
  selected,
  outside,
  onSelect,
}: {
  date: Date;
  selected: boolean;
  outside?: boolean;
  onSelect: (date: Date) => void;
}) {
  const kind = shiftKind(date);
  const today = sameDay(date, SHIFT_TODAY);
  const kindLabel = kind === "am" ? "AM Shift" : kind === "pm" ? "PM Shift" : "Off duty";
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  return (
    <button
      type="button"
      className={`shift-day ${kind}${selected ? " is-selected" : ""}${today ? " is-today" : ""}${outside ? " is-outside" : ""}`}
      aria-pressed={selected}
      onClick={() => onSelect(date)}
    >
      <span className={`shift-day-name${outside !== undefined ? " sr-only" : ""}`}>{weekday}</span>
      <strong>{date.getDate()}</strong>
      <em>{today ? "Today" : ""}</em>
      <span className="shift-day-kind">{kindLabel}</span>
    </button>
  );
}

export function RadiologistScheduleView({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [selected, setSelected] = useState(() => cloneDate(SHIFT_TODAY));
  const [cursor, setCursor] = useState(() => cloneDate(SHIFT_TODAY));

  const kind = shiftKind(selected);
  const status = shiftStatus(selected, kind);
  const meta = shiftMeta(kind);
  const onDuty = kind !== "off";
  const reviews = onDuty && dayStamp(selected) <= dayStamp(SHIFT_TODAY) ? SHIFT_REVIEWS[dayKey(selected)] ?? [] : [];
  const consults = SHIFT_CONSULTS[dayKey(selected)] ?? [];
  const showWorklist = status === "Active shift";
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursor), index));
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthCells = Array.from({ length: 42 }, (_, index) => addDays(startOfWeek(monthStart), index));
  const visibleMonthCells = monthCells.slice(0, monthCells[35] && monthCells[35].getMonth() === cursor.getMonth() ? 42 : 35);
  const label = rangeLabel(mode, cursor);
  const longDate = selected.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const selectDay = (day: Date) => {
    setSelected(cloneDate(day));
    setCursor(cloneDate(day));
  };

  const goPrev = () => {
    setCursor((current) =>
      mode === "week" ? addDays(current, -7) : new Date(current.getFullYear(), current.getMonth() - 1, 1),
    );
  };

  const goNext = () => {
    setCursor((current) =>
      mode === "week" ? addDays(current, 7) : new Date(current.getFullYear(), current.getMonth() + 1, 1),
    );
  };

  const goToday = () => {
    setSelected(cloneDate(SHIFT_TODAY));
    setCursor(cloneDate(SHIFT_TODAY));
  };

  const reviewNote =
    !onDuty
      ? "No reading activity on an off-duty day."
      : dayStamp(selected) > dayStamp(SHIFT_TODAY)
        ? "No signed studies yet for this shift."
        : "No signed studies recorded for this shift.";

  return (
    <div className="radiologist-schedule">
      <h1 className="sr-only">My schedule</h1>
      <header className="schedule-screen-head">
        <button type="button" className="secondary-button" onClick={onBack}>
          <ArrowLeftIcon />
          Back to worklist
        </button>
        <div className="schedule-mode" role="tablist" aria-label="Calendar range">
          <button type="button" role="tab" aria-selected={mode === "week"} className={mode === "week" ? "on" : ""} onClick={() => setMode("week")}>
            Weekly
          </button>
          <button type="button" role="tab" aria-selected={mode === "month"} className={mode === "month" ? "on" : ""} onClick={() => setMode("month")}>
            Monthly
          </button>
        </div>
      </header>

      <section className="panel shift-calendar" aria-label="Shift calendar">
        <div className="shift-calendar-bar">
          <button type="button" className="secondary-button shift-nav-button prev" onClick={goPrev} aria-label={mode === "week" ? "Previous week" : "Previous month"}>
            <ChevronIcon />
          </button>
          <h2>{label}</h2>
          <button type="button" className="secondary-button shift-nav-button" onClick={goNext} aria-label={mode === "week" ? "Next week" : "Next month"}>
            <ChevronIcon />
          </button>
          <button type="button" className="secondary-button" onClick={goToday}>
            Today
          </button>
        </div>
        {mode === "week" ? (
          <div className="shift-week" role="group" aria-label={`Days in ${label}`}>
            {weekDays.map((day) => (
              <ShiftDayButton key={dayKey(day)} date={day} selected={sameDay(day, selected)} onSelect={selectDay} />
            ))}
          </div>
        ) : (
          <div className="shift-month">
            <div className="shift-month-names" aria-hidden="true">
              {weekDays.map((day) => (
                <span key={day.toDateString()}>{day.toLocaleDateString("en-GB", { weekday: "short" })}</span>
              ))}
            </div>
            <div className="shift-month-grid" role="group" aria-label={label}>
              {visibleMonthCells.map((day) => (
                <ShiftDayButton
                  key={dayKey(day)}
                  date={day}
                  selected={sameDay(day, selected)}
                  outside={day.getMonth() !== cursor.getMonth()}
                  onSelect={selectDay}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="shift-detail" aria-live="polite">
        <header className="panel shift-summary">
          <div>
            <span className="section-kicker">{longDate}</span>
            <h2>{onDuty ? meta.label : "Off duty"}</h2>
            {onDuty ? (
              <>
                <p>{meta.window}</p>
                <p>{meta.station}</p>
              </>
            ) : (
              <p>No station assigned</p>
            )}
          </div>
          <div className="shift-summary-actions">
            <span className={`shift-status ${status === "Active shift" ? "active" : status === "Upcoming" ? "upcoming" : status === "Completed" ? "completed" : "off"}`}>
              {status}
            </span>
            {showWorklist && (
              <button type="button" className="primary-button" onClick={onBack}>
                Open active worklist
              </button>
            )}
          </div>
        </header>

        <div className="shift-detail-grid">
          <section className="panel shift-card">
            <h3>Shift coverage</h3>
            {onDuty ? (
              <ul className="shift-people">
                {meta.coverage.map((person) => (
                  <li key={person.name}>
                    <strong>{person.name}</strong>
                    <span>{person.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="shift-note">You are off duty. Morning coverage is Dr. Priya Shah, RAD-014.</p>
            )}
            <h3>Handoff</h3>
            {onDuty ? (
              <p className="shift-handoff">
                {meta.handoffTime} - {meta.handoffWho}
              </p>
            ) : (
              <p className="shift-note">No handoff on an off-duty day.</p>
            )}
          </section>

          <section className="panel shift-card">
            <h3>Completed reviews</h3>
            {onDuty && reviews.length > 0 ? (
              <ul className="shift-people">
                {reviews.map((item) => (
                  <li key={item.study}>
                    <strong>{item.study}</strong>
                    <span>TAT {item.tat}, {item.note}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="shift-note">{reviewNote}</p>
            )}
            <h3>Scheduled Consultation</h3>
            {consults.length > 0 ? (
              <ul className="shift-people">
                {consults.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.time} - {item.id}
                    </strong>
                    <span>
                      {item.study}, {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="shift-note">No Consultation scheduled for this day.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
