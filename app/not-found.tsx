import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
export default function NotFound() { return <main id="main-content" className="full-page-message"><Brand/><span className="eyebrow">Out of frame</span><h1>This page isn’t here.</h1><p>Let’s get you back to your studio.</p><Link className="button button-primary" href="/studio"><ArrowLeft size={17}/> Your videos</Link></main>; }
