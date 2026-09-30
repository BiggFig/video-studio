"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { api, useStudio } from "./studio-context";

export function AccessPanel({ initialToken = "", autoFocus = false }: { initialToken?: string; autoFocus?: boolean }) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { session, loading, refresh } = useStudio();
  const router = useRouter();
  useEffect(() => { setToken(initialToken); }, [initialToken]);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  async function redeem(event: FormEvent) {
    event.preventDefault(); if (busy || !token.trim()) return;
    setBusy(true); setError(null);
    try { await api("/api/auth/redeem", { method: "POST", body: JSON.stringify({ token: token.trim() }) }); await refresh(); router.replace("/studio/new"); }
    catch (error) { setError(error instanceof Error ? error.message : "This invitation could not be opened."); setBusy(false); }
  }
  if (!loading && session?.user) return <Link className="button button-primary" href="/studio/new">Open your studio <ArrowRight size={17}/></Link>;
  return <form className="access-form" onSubmit={redeem}>
    <label htmlFor="invitation-code">Your invitation code</label>
    <div className="access-input-row"><div className="input-with-icon"><LockKeyhole size={17} aria-hidden="true"/><input ref={input} id="invitation-code" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter your invitation code" autoComplete="off" required aria-invalid={Boolean(error)} aria-describedby={error ? "invitation-error" : undefined}/></div><button className="button button-primary" disabled={busy || !token.trim()} type="submit" aria-busy={busy}>{busy ? <><LoaderCircle className="spin" size={17}/> Opening…</> : <>Enter studio <ArrowRight size={17}/></>}</button></div>
    {error && <p id="invitation-error" className="form-error" role="alert">{error}</p>}
    {session && !session.configured && <p className="field-hint">The studio is being set up. Invitations will work once private access is configured.</p>}
    <p className="access-caption">A small, free private beta. Access is by invitation.</p>
  </form>;
}
