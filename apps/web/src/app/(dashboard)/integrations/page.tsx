import type { Metadata } from "next";
import { IntegrationsPage } from "@/components/integrations/integrations-page";

export const metadata: Metadata = { title: "Integrations | Prospex" };

export default function Page() {
  return <IntegrationsPage />;
}
