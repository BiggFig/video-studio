"use client";
import Link from "next/link";
import { RotateCw } from "lucide-react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main id="main-content" className="full-page-message"><h1>Something interrupted the studio.</h1><p>Please try again. Submitted videos keep running in the background.</p><button className="button button-primary" onClick={reset}><RotateCw size={16}/> Try again</button><Link className="text-link" href="/studio">Your videos</Link></main>; }
