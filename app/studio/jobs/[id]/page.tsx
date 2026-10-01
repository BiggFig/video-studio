import { JobDetail } from "@/components/job-detail";
export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <JobDetail id={id}/>; }
