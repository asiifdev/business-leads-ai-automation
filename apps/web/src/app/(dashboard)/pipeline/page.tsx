import type { Metadata } from "next";
import { PipelinePage } from "@/components/pipeline/pipeline-page";

export const metadata: Metadata = { title: "Pipeline | Prospex" };

export default function Page() {
  return <PipelinePage />;
}
