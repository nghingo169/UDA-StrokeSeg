import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { saveClinicalNote } from "../../services/demoApi";

export function clearClinicalDraft(draftKey: string) {
  try {
    window.localStorage.removeItem(`clinical-note:${draftKey}`);
  } catch {
    /* draft clear is best-effort */
  }
}

type NoteSaveStatus = "idle" | "dirty" | "saving" | "saved";

function ComposerIcon({ name, size = 16 }: { name: "shield" | "plus" | "mic" | "pause" | "check"; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    check: <path d="m5 12 4 4L19 6" />,
    mic: (
      <>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
    pause: <path d="M9 5v14M15 5v14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    shield: (
      <>
        <path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.6 7.5 9.5 4.4-1.9 7.5-4.9 7.5-9.5V6L12 3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
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

export function ClinicalComposer({
  label,
  value,
  onChange,
  voiceText,
  placeholder,
  notify,
  metricText,
  draftKey,
  onInsertDraft,
  syncStudyNote = true,
  disabled = false,
  helper,
  error,
  onBlur,
  chrome = "full",
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  voiceText: string;
  placeholder: string;
  notify: (message: string) => void;
  metricText?: string;
  draftKey?: string;
  onInsertDraft?: () => void;
  /** Review notes sync to the study record. Other notes stay in the local draft. */
  syncStudyNote?: boolean;
  disabled?: boolean;
  helper?: string;
  error?: string;
  onBlur?: () => void;
  /** Studio review uses a mic and save indicator only. */
  chrome?: "full" | "minimal";
  hideLabel?: boolean;
}) {
  const helpId = useId();
  const [recording, setRecording] = useState(false);
  const internalChange = useRef(false);
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const latestValue = useRef(value);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    latestValue.current = value;
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    if (!value.trim() && !lastSavedAt) return;
    queueAutoSave(value);
  }, [value]);

  useEffect(() => {
    if (!draftKey) return;
    try {
      const stored = window.localStorage.getItem(`clinical-note:${draftKey}`);
      if (stored && !value.trim()) {
        onChange(stored);
        setSaveStatus("saved");
        setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    } catch {
      /* draft restore is best-effort */
    }
  }, [draftKey]);

  const persistNote = (source: "auto" | "manual", nextValue = latestValue.current) => {
    setSaveStatus("saving");
    if (draftKey) {
      try {
        if (nextValue.trim()) {
          window.localStorage.setItem(`clinical-note:${draftKey}`, nextValue);
        } else {
          window.localStorage.removeItem(`clinical-note:${draftKey}`);
        }
      } catch {
        /* local draft persistence is best-effort */
      }
      const studyId = draftKey.split(":")[0];
      if (syncStudyNote && studyId.startsWith("AIS-")) {
        void saveClinicalNote(studyId, nextValue, source).catch(() => undefined);
      }
    }
    window.setTimeout(() => {
      const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSavedAt(stamp);
      setSaveStatus("saved");
      if (source === "manual") notify("Clinical note saved");
    }, source === "manual" ? 280 : 420);
  };

  const queueAutoSave = (nextValue: string) => {
    setSaveStatus(nextValue.trim() || lastSavedAt ? "dirty" : "idle");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (!nextValue.trim() && !lastSavedAt) {
        setSaveStatus("idle");
        return;
      }
      persistNote("auto", nextValue);
    }, 1400);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const toggleRecording = () => {
    if (disabled) return;
    if (recording) {
      const next = `${value}${value.trim() ? "\n" : ""}${voiceText}`;
      internalChange.current = true;
      onChange(next);
      setRecording(false);
      notify("Voice transcript added - review the text before saving");
      queueAutoSave(next);
      return;
    }
    setRecording(true);
  };

  const saveLabel =
    chrome === "minimal"
      ? saveStatus === "saving"
        ? "Saving…"
        : saveStatus === "dirty"
          ? "Unsaved"
          : saveStatus === "saved"
            ? "Auto-saved"
            : "Auto-save"
      : saveStatus === "saving"
        ? "Saving…"
        : saveStatus === "saved" && lastSavedAt
          ? `Saved · ${lastSavedAt}`
          : saveStatus === "dirty"
            ? "Unsaved changes"
            : "Auto-save on";

  return (
    <div className="composer-field">
    <div className={`clinical-composer ${recording ? "recording" : ""} ${error ? "invalid" : ""}`}>
      {!hideLabel && (
        <div className="composer-heading">
          <label>{label}</label>
          {chrome === "full" && (
            <span className={`composer-save-status ${saveStatus}`} role="status" aria-live="polite">
              {saveLabel}
            </span>
          )}
        </div>
      )}
      <textarea
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={helper ? helpId : undefined}
        disabled={disabled}
        value={value}
        onBlur={onBlur}
        onChange={(event) => {
          const next = event.target.value;
          internalChange.current = true;
          onChange(next);
          queueAutoSave(next);
        }}
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
      <div className={`composer-toolbar ${chrome === "minimal" ? "composer-toolbar-minimal" : ""}`}>
        {chrome === "minimal" ? (
          <span className={`composer-save-status ${saveStatus}`} role="status" aria-live="polite">
            {saveLabel}
          </span>
        ) : (
          <span>
            <ComposerIcon name="shield" size={13} /> Not signed
          </span>
        )}
        <div className="composer-toolbar-actions">
          {chrome === "full" && (
            <>
          {onInsertDraft && (
            <button type="button" className="autofill-button" disabled={disabled} onClick={onInsertDraft}>
              <ComposerIcon name="plus" size={14} /> Insert draft conclusion
            </button>
          )}
          {metricText && (
            <button
              type="button"
              className="autofill-button"
              disabled={disabled}
              onClick={() => {
                const next = `${value}${value.trim() ? "\n" : ""}${metricText}`;
                internalChange.current = true;
                onChange(next);
                notify("Verified lesion measurements inserted");
                queueAutoSave(next);
              }}
            >
              <ComposerIcon name="plus" size={14} /> Insert measurements
            </button>
          )}
            </>
          )}
          {chrome === "full" && (
          <select aria-label="Dictation language" defaultValue="en-US" disabled={disabled}>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
          </select>
          )}
          <button
            type="button"
            className={recording ? "recording" : ""}
            onClick={toggleRecording}
            disabled={disabled}
            aria-label={recording ? "Stop dictation" : "Start dictation"}
            title={recording ? "Stop dictation" : "Start dictation"}
          >
            <ComposerIcon name={recording ? "pause" : "mic"} size={16} />
          </button>
          {chrome === "full" && (
          <button
            type="button"
            className="composer-save-button"
            disabled={disabled || saveStatus === "saving" || (!value.trim() && saveStatus === "idle")}
            onClick={() => {
              if (saveTimer.current) window.clearTimeout(saveTimer.current);
              persistNote("manual");
            }}
          >
            <ComposerIcon name="check" size={14} /> Save draft
          </button>
          )}
        </div>
      </div>
    </div>
    {helper && (
      <small id={helpId} className="field-help">
        {helper}
      </small>
    )}
    {error && (
      <small className="field-error" role="alert">
        {error}
      </small>
    )}
    </div>
  );
}
