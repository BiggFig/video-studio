"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SessionResponse } from "@/lib/contracts";

type StudioContextValue = { session: SessionResponse | null; loading: boolean; error: string | null; refresh: () => Promise<void> };
const StudioContext = createContext<StudioContextValue | null>(null);

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && (path.startsWith("/api/jobs") || path.startsWith("/api/uploads")) && typeof window !== "undefined") window.dispatchEvent(new Event("studio:session-expired"));
    const message = typeof body?.error === "string" ? body.error : body?.error?.message || body?.message;
    throw new Error(message || (response.status === 401 ? "Your session has ended. Please open your invitation again." : "We couldn’t connect. Please try again."));
  }
  return body as T;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setSession(await api<SessionResponse>("/api/session")); setError(null); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to open your studio."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const expired = () => { void refresh(); }; window.addEventListener("studio:session-expired", expired); return () => window.removeEventListener("studio:session-expired", expired); }, [refresh]);
  return <StudioContext.Provider value={{ session, loading, error, refresh }}>{children}</StudioContext.Provider>;
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
