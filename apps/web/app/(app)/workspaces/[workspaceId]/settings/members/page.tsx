"use client";

import { InviteMemberForm, MemberList } from "@/components/workspace/members";
import { SettingsSection } from "@/components/workspace/settings-section";
import { useWorkspaceRole } from "@/components/workspace/use-workspace-role";
import { useParams } from "next/navigation";

export default function MembersSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { isAdmin, userId } = useWorkspaceRole(workspaceId);

  return (
    <div>
      <SettingsSection
        title="Members"
        description="People with access to this workspace and their roles."
      >
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <MemberList workspaceId={workspaceId} canManage={isAdmin} currentUserId={userId} />
        </div>
      </SettingsSection>

      {isAdmin && (
        <SettingsSection
          title="Invite a member"
          description="Add a teammate by email address and assign their role."
        >
          <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-5">
            <InviteMemberForm workspaceId={workspaceId} />
          </div>
        </SettingsSection>
      )}
    </div>
  );
}
