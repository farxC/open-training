import { useCallback, useState } from "react";
import { getSessions, getSessionWithSets } from "@/db/queries";
import type { SessionSummary, SessionWithSets } from "@/types";

export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>(() => getSessions());

  const refresh = useCallback(() => {
    setSessions(getSessions());
  }, []);

  return { sessions, refresh };
}

export function useSession(id: number) {
  const [session, setSession] = useState<SessionWithSets | null>(() =>
    getSessionWithSets(id)
  );

  const refresh = useCallback(() => {
    setSession(getSessionWithSets(id));
  }, [id]);

  return { session, refresh };
}
