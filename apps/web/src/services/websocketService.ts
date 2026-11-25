import { getDemoToken } from "./demoApi";

export type ConsultationWsHandler = (event: string, payload: Record<string, unknown>) => void;

export function consultationWsUrl(consultationId: string): string {
  const token = getDemoToken() || "";
  const configuredApi = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const apiUrl = configuredApi ? new URL(configuredApi) : new URL(window.location.origin);
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${apiUrl.host}${apiUrl.pathname.replace(/\/$/, "")}/api/v1/consultation/${consultationId}/ws?token=${encodeURIComponent(token)}`;
}

export function connectConsultationRoom(
  consultationId: string,
  onEvent: ConsultationWsHandler,
): { send: (event: string, payload?: Record<string, unknown>) => void; close: () => void } {
  const socket = new WebSocket(consultationWsUrl(consultationId));

  socket.addEventListener("message", (message) => {
    try {
      const data = JSON.parse(String(message.data)) as {
        event?: string;
        payload?: Record<string, unknown>;
      };
      if (data.event) onEvent(data.event, data.payload || {});
    } catch {
      /* ignore malformed */
    }
  });

  return {
    send(event, payload = {}) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event, payload }));
      }
    },
    close() {
      socket.close();
    },
  };
}

export const websocketService = {
  connectConsultationRoom,
  consultationWsUrl,
};
