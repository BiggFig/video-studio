"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionResponse } from "@/lib/contracts";

type StudioContextValue = { session: SessionResponse | null; loading: boolean; error: string | null; refresh: () => Promise<void>; openGuest: () => Promise<void>; retryAccess: () => Promise<void> };
const StudioContext = createContext<StudioContextValue | null>(null);

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && (path.startsWith("/api/jobs") || path.startsWith("/api/uploads")) && typeof window !== "undefined") window.dispatchEvent(new Event("studio:session-expired"));
    const message = typeof body?.error === "string" ? body.error : body?.error?.message || body?.message;
    throw new Error(message || (response.status === 401 ? "This browser’s workspace access has ended. Please reconnect to continue." : "We couldn’t connect. Please try again."));
  }
  return body as T;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentSession = useRef<SessionResponse | null>(null);
  const sessionRequest = useRef<Promise<void> | null>(null);
  const guestRequest = useRef<Promise<void> | null>(null);
  const guestAttempted = useRef(false);
  const refresh = useCallback((): Promise<void> => {
    if (sessionRequest.current) return sessionRequest.current;
    if (guestRequest.current) return guestRequest.current;
    const request = (async () => {
      try {
        const next = await api<SessionResponse>("/api/session");
        const lostAccess = Boolean(currentSession.current?.user && !next.user);
        currentSession.current = next; setSession(next);
        setError(previous => lostAccess ? "This browser no longer has access to the previous workspace. Reconnect to open a new one." : !next.user && guestAttempted.current ? previous || "This browser’s workspace access has ended. Reconnect to continue." : null);
      } catch (error) { setError(error instanceof Error ? error.message : "Unable to open your studio."); }
      finally { setLoading(false); sessionRequest.current = null; }
    })();
    sessionRequest.current = request;
    return request;
  }, []);
  const openGuest = useCallback((): Promise<void> => {
    if (guestRequest.current) return guestRequest.current;
    if (currentSession.current?.user || guestAttempted.current) return Promise.resolve();
    // One context-owned attempt survives Strict Mode effect replay and route changes.
    guestAttempted.current = true; setLoading(true); setError(null);
    const request = (async () => {
      try {
        await api("/api/auth/guest", { method: "POST" });
        const next = await api<SessionResponse>("/api/session");
        if (!next.user) throw new Error("Your browser couldn’t keep this workspace open. Allow cookies for this site, then try again.");
        currentSession.current = next; setSession(next); setError(null);
      } catch (error) { setError(error instanceof Error ? error.message : "We couldn’t open your workspace. Please try again."); }
      finally { setLoading(false); guestRequest.current = null; }
    })();
    guestRequest.current = request;
    return request;
  }, []);
  const retryAccess = useCallback(async () => {
    if (sessionRequest.current) await sessionRequest.current;
    if (guestRequest.current) return guestRequest.current;
    guestAttempted.current = false;
    await openGuest();
  }, [openGuest]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const expired = () => { void refresh(); }; window.addEventListener("studio:session-expired", expired); return () => window.removeEventListener("studio:session-expired", expired); }, [refresh]);
  return <StudioContext.Provider value={{ session, loading, error, refresh, openGuest, retryAccess }}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("StudioProvider is required");
  return value;
}

export function formatBytes(bytes: number) {
  return bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : bytes >= 1_000_000 ? `${Math.round(bytes / 1_000_000)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}
