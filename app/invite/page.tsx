import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { AccessPanel } from "@/components/access-panel";
import { Brand } from "@/components/brand";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <div className="invite-page"><header className="landing-nav"><Brand/><Link className="nav-text" href="/"><ArrowLeft size={15}/> Back to home</Link></header><main id="main-content" className="invite-main"><div className="invite-symbol"><LockKeyhole size={25} strokeWidth={1.4}/></div><span className="eyebrow">Your private studio</span><h1>A good place<br/>to make an entrance.</h1><p>Welcome to Video Studio. Open your invitation to start creating your next product video.</p><AccessPanel initialToken={token || ""} autoFocus/></main><footer className="invite-footer">Free for invited beta testers.</footer></div>;
}
