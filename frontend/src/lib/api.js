import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

/**
 * Stream answer tokens from /api/ask/stream. Uses fetch with a ReadableStream
 * to consume Server-Sent Events (browsers don't allow POST via EventSource).
 * Calls onEvent({event, data}) for each SSE message.
 */
export async function askAnalystStream({ analyst_id, question, session_id }, onEvent, onError) {
  const controller = new AbortController();
  try {
    const res = await fetch(`${API}/ask/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ analyst_id, question, session_id }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Ask failed: ${res.status} ${detail}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // Parse SSE frames separated by \n\n
      const frames = buf.split("\n\n");
      buf = frames.pop() || "";
      for (const frame of frames) {
        const lines = frame.split("\n").filter(Boolean);
        let event = "message";
        let data = "";
        for (const l of lines) {
          if (l.startsWith("event:")) event = l.slice(6).trim();
          else if (l.startsWith("data:")) data += l.slice(5).trim();
        }
        if (!data) continue;
        try {
          onEvent({ event, data: JSON.parse(data) });
        } catch {
          onEvent({ event, data });
        }
      }
    }
  } catch (e) {
    if (onError) onError(e);
  }
  return () => controller.abort();
}
