"use client";

import { useSearchParams } from "next/navigation";
import { JobDetail } from "./JobDetail.jsx";

export function AdminJobDetail() {
  const searchParams = useSearchParams();
  return <JobDetail jobId={searchParams.get("id")?.trim() || ""} />;
}
