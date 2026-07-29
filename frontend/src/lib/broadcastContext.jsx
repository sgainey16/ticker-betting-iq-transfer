import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

// Shared broadcast state — topics list + which one is currently active.
// Lives above the Router so LiveDesk (mounted once in Layout) survives every
// route change. Consumers (Home, Ticker, LiveDesk mini bar) read/write here.

const BroadcastContext = createContext(null);

const DEFAULT_TOPIC = "wildcard_night_apr_8_2025";

export function BroadcastProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [activeTopic, setActiveTopic] = useState(DEFAULT_TOPIC);

  useEffect(() => {
    api
      .get("/topics")
      .then((r) => setTopics(r.data.topics || []))
      .catch(() => setTopics([]));
  }, []);

  return (
    <BroadcastContext.Provider
      value={{ topics, activeTopic, setActiveTopic }}
    >
      {children}
    </BroadcastContext.Provider>
  );
}

export function useBroadcast() {
  const ctx = useContext(BroadcastContext);
  if (!ctx) throw new Error("useBroadcast must be used inside BroadcastProvider");
  return ctx;
}

export const BROADCAST_SLOT_ID = "broadcast-slot";
