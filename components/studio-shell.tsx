"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CircleHelp, Film, House, LoaderCircle, Plus, ShieldCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Brand } from "./brand";
import { useStudio } from "./studio-context";

export function StudioShell({ children }: { children: ReactNode }) {
  const { session, loading, error, openGuest, retryAccess } = useStudio();
  const path = usePathname();
  useEffect(() => { if (!loading && !session?.user && !error) void openGuest(); }, [loading, session, error, openGuest]);
  if (loading || (!error && !session?.user)) return <main id="main-content" className="full-page-message" aria-busy="true"><Brand/><LoaderCircle className="spin" size={23}/><p role="status">Opening your studio…</p></main>;
  if (error && !session?.user) return <main id="main-content" className="full-page-message"><Brand/><h1>Let’s try that again.</h1><p role="alert">{error}</p><button className="button button-primary" onClick={() => void retryAccess()}>Reconnect</button><Link className="text-link" href="/">Back to home</Link></main>;
  const name = session?.user?.name || "Your workspace";
  return <div className="studio-shell"><aside className="studio-sidebar"><Brand href="/studio/new"/><div className="workspace-label">Your workspace</div><nav className="studio-nav" aria-label="Studio navigation"><Link href="/studio/new" className={path === "/studio/new" ? "active" : ""} aria-current={path === "/studio/new" ? "page" : undefined}><Plus size={19}/> New video</Link><Link href="/studio" className={path === "/studio" || path.startsWith("/studio/jobs/") ? "active" : ""} aria-current={path === "/studio" ? "page" : undefined}><Film size={19}/> Your videos</Link></nav><div className="sidebar-bottom"><div className="private-note"><span className="private-note-icon"><ShieldCheck size={19} strokeWidth={1.5}/></span><strong>Your space, in this browser.</strong><p>Your files and videos are private. Return in this browser to find them again.</p><Link href="/studio/guide">A little guidance <ArrowUpRight size={14}/></Link></div><Link href="/studio/guide" className={`sidebar-help${path === "/studio/guide" ? " active" : ""}`}><CircleHelp size={18}/> How it works</Link><div className="account-row"><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong><span>Public beta</span></div><Link href="/" title="Back to home" aria-label="Back to home" className="icon-button"><House size={17}/></Link></div></div></aside><div className="studio-main"><header className="studio-topbar"><span>Workspace <span className="breadcrumb-divider">/</span> <strong>{path === "/studio/new" ? "New video" : path === "/studio/guide" ? "How it works" : path.startsWith("/studio/jobs/") ? "Your video" : "Your videos"}</strong></span><span className="beta-tag"><span/> Public beta</span></header><main id="main-content" className="studio-content">{children}</main><footer className="studio-footer"><span>Give your product a moment.</span><span>Video Studio</span></footer></div></div>;
}
