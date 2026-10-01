"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useStudio } from "./studio-context";

export function AccessPanel() {
  const { session } = useStudio();
  return <div className="public-access"><Link className="button button-primary" href="/studio/new">{session?.user ? "Open your studio" : "Create a video"} <ArrowRight size={17}/></Link><p className="access-caption">Free public beta. No sign-up needed.</p><p className="access-workspace-note">Your private workspace stays with this browser.</p>{session && !session.acceptingJobs && <p className="access-availability" role="status">Explore the studio now. Video generation is paused while we finish checking the hosted service.</p>}</div>;
}
