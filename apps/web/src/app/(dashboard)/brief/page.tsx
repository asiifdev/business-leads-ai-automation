import type { Metadata } from "next";
import { BriefPage } from "@/components/marketing/brief-page";

export const metadata: Metadata = { title: "Marketing Brief | Prospex" };

export default function Page() {
  return <BriefPage />;
}
