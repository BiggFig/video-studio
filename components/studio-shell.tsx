"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, CircleHelp, Film, LoaderCircle, LogOut, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Brand } from "./brand";
import { api, useStudio } from "./studio-context";

export function StudioShell({ children }: { children: ReactNode }) {
  const { session, loading, error, refresh } = useStudio();
  const path = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  useEffect(() => { if (!loading && session && !session.user) router.replace("/invite"); }, [loading, session, router]);
  async function signOut() {
    setSigningOut(true); setSignOutError(null);
    try { await api("/api/auth/logout", { method: "POST" }); await refresh(); router.replace("/"); }
    catch (error) { setSignOutError(error instanceof Error ? error.message : "Couldn’t sign out. Please try again."); setSigningOut(false); }
  }
  if (loading || (!error && !session?.user)) return <main id="main-content" className="full-page-message"><Brand/><LoaderCircle className="spin" size={23}/><p>Opening your studio…</p></main>;
  if (error && !session?.user) return <main id="main-content" className="full-page-message"><Brand/><h1>Let’s try that again.</h1><p role="alert">{error}</p><button className="button button-primary" onClick={() => void refresh()}>Reconnect</button><Link className="text-link" href="/invite">Open invitation</Link></main>;
  const name = session?.user?.name || session?.user?.email?.split("@")[0] || "Your workspace";
  return <div className="studio-shell"><aside className="studio-sidebar"><Brand href="/studio/new"/><div className="workspace-label">Your workspace</div><nav className="studio-nav" aria-label="Studio navigation"><Link href="/studio/new" className={path === "/studio/new" ? "active" : ""} aria-current={path === "/studio/new" ? "page" : undefined}><Plus size={19}/> New video</Link><Link href="/studio" className={path === "/studio" || path.startsWith("/studio/jobs/") ? "active" : ""} aria-current={path === "/studio" ? "page" : undefined}><Film size={19}/> Your videos</Link></nav><div className="sidebar-bottom"><div className="private-note"><span className="private-note-icon"><ShieldCheck size={19} strokeWidth={1.5}/></span><strong>A space for your next release.</strong><p>Your source files and videos are private to your workspace.</p><Link href="/studio/guide">A little guidance <ArrowUpRight size={14}/></Link></div><Link href="/studio/guide" className={`sidebar-help${path === "/studio/guide" ? " active" : ""}`}><CircleHelp size={18}/> How it works</Link><div className="account-row"><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong><span>Private beta</span></div><button type="button" title="Sign out" aria-label="Sign out" className="icon-button" onClick={() => void signOut()} disabled={signingOut}>{signingOut ? <LoaderCircle className="spin" size={17}/> : <LogOut size={17}/>}</button></div>{signOutError && <p className="form-error" role="alert">{signOutError}</p>}</div></aside><div className="studio-main"><header className="studio-topbar"><span>Workspace <span className="breadcrumb-divider">/</span> <strong>{path === "/studio/new" ? "New video" : path === "/studio/guide" ? "How it works" : path.startsWith("/studio/jobs/") ? "Your video" : "Your videos"}</strong></span><span className="beta-tag"><span/> Private beta</span></header><main id="main-content" className="studio-content">{children}</main><footer className="studio-footer"><span>Give your product a moment.</span><span>Video Studio</span></footer></div></div>;
}
