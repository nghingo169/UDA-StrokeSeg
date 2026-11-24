import { useEffect, useRef, useState } from "react";
import type { ConsultationViewport } from "../../types/consultation.types";

type CursorPeer = {
  actor: string;
  display_name: string;
  initials: string;
  x: number;
  y: number;
};

type Props = {
  viewport: ConsultationViewport;
  readOnly?: boolean;
  isChair?: boolean;
  cursors?: CursorPeer[];
  onViewportChange?: (viewport: ConsultationViewport) => void;
  onCursorMove?: (x: number, y: number) => void;
};

export function CollaborativeCanvas({
  viewport,
  readOnly = false,
  isChair = false,
  cursors = [],
  onViewportChange,
  onCursorMove,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [localSlice, setLocalSlice] = useState(viewport.slice);

  useEffect(() => {
    setLocalSlice(viewport.slice);
  }, [viewport.slice]);

  const canControl = isChair && !readOnly;

  const publishSlice = (slice: number) => {
    setLocalSlice(slice);
    onViewportChange?.({ ...viewport, slice });
  };

  return (
    <section className="viewer consultation-canvas">
      <div className="viewer-toolbar">
        <span className="viewer-sync-label">Synchronized series</span>
        <span>
          Axial slice {localSlice + 1} of 34
          {!canControl && <em className="canvas-follow-hint">, following Chair</em>}
        </span>
      </div>
      <div
        className="scan-grid"
        ref={surfaceRef}
        onMouseMove={(event) => {
          if (!surfaceRef.current || readOnly) return;
          const rect = surfaceRef.current.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          onCursorMove?.(x, y);
        }}
      >
        {["DWI", "ADC", "FLAIR"].map((sequence, index) => (
          <div className={`scan scan-${index + 1}`} key={sequence}>
            <span className="sequence-label">{sequence}</span>
            <div className="brain-scan" style={{ transform: `scale(${viewport.zoom})` }}>
              <i className="hemisphere left" />
              <i className="hemisphere right" />
              <i className="lesion" />
              <i className="crosshair-x" />
              <i className="crosshair-y" />
            </div>
          </div>
        ))}
        {cursors.map((cursor) => (
          <div
            key={cursor.actor}
            className="peer-cursor"
            style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
            title={cursor.display_name}
          >
            <span>{cursor.initials}</span>
            <em>{cursor.display_name}</em>
          </div>
        ))}
      </div>
      <div className="slice-control">
        <button
          type="button"
          aria-label="Previous slice"
          disabled={!canControl}
          onClick={() => publishSlice(Math.max(0, localSlice - 1))}
        >
          −
        </button>
        <input
          aria-label="Consultation MRI slice"
          type="range"
          min={0}
          max={33}
          value={localSlice}
          disabled={!canControl}
          onChange={(event) => publishSlice(Number(event.target.value))}
        />
        <button
          type="button"
          aria-label="Next slice"
          disabled={!canControl}
          onClick={() => publishSlice(Math.min(33, localSlice + 1))}
        >
          +
        </button>
      </div>
    </section>
  );
}
