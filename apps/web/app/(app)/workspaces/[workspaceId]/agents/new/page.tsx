import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

// The legacy /agents/new page (purple "Import" button + tabs UI) is dead.
// All new-agent flows now start from the polished /agents/templates landing,
// which links to /agents/import when the user wants to upload a YAML.
//
// Kept as a server-side redirect so any stale bookmark / shared link still
// lands somewhere useful instead of 404.

type Props = { params: Promise<{ workspaceId: string }> };

export default async function NewAgentRedirectPage({ params }: Props) {
  const { workspaceId } = await params;
  redirect(ROUTES.agentsTemplates(workspaceId));
}
