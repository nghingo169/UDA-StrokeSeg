import { useState } from "react";
import { ClinicalComposer } from "../shared/ClinicalComposer";

type Props = {
  open: boolean;
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onConfirm: (stepUpPassword: string) => Promise<void> | void;
  notify: (message: string) => void;
  draftKey: string;
};

export function ConsensusFinalizeModal({
  open,
  notes,
  onNotesChange,
  onClose,
  onConfirm,
}: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card consensus-finalize-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consensus-finalize-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="consensus-finalize-title">Sign the consultation conclusion</h2>
        <p>
          The Chairman confirms the written conclusion. The password produces the digital
          signature stored on the chart.
        </p>
        <label>
          Conclusion
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            rows={5}
            placeholder="Record the panel conclusion for the electronic chart…"
          />
        </label>
        <label>
          Step-up password
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Pass@123"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy || !notes.trim() || !password}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm(password);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Finalize failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Signing…" : "Sign into chart"}
          </button>
        </div>
      </div>
    </div>
  );
}
