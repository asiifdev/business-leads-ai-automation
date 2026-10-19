import type { Metadata } from "next";
import { KnowledgePage } from "@/components/knowledge/knowledge-page";

export const metadata: Metadata = { title: "Knowledge base | Prospex" };

export default function Page() {
  return <KnowledgePage />;
}
