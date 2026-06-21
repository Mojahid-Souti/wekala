import { useState } from "react";
import { MOCK_MEMBERS } from "@/mock/data";
import type { Member } from "@/types/api";

const ROLES = ["admin", "builder", "reviewer", "hirer", "viewer"] as const;

// Built once from the original constant so invited-by names survive member removal.
const INVITER_NAME: Record<string, string> = Object.fromEntries(
  MOCK_MEMBERS.map((m): [string, string] => [
    m.user_id,
    m.full_name ?? m.email ?? m.user_id,
  ])
);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>(() => [...MOCK_MEMBERS]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function updateRole(userId: string, role: string) {
    setMembers((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, role } : m))
    );
  }

  function removeMember(userId: string) {
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    setConfirmId(null);
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
        <p className="font-medium text-neutral-700 text-sm">No members</p>
        <p className="mt-1 text-neutral-500 text-sm">
          All members have been removed from this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-neutral-100 border-b">
            <th className="px-4 py-3 text-start font-medium text-neutral-500">Member</th>
            <th className="px-4 py-3 text-start font-medium text-neutral-500">Role</th>
            <th className="px-4 py-3 text-start font-medium text-neutral-500 whitespace-nowrap">
              Invited by
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {members.map((member) => {
            const isConfirming = confirmId === member.user_id;
            const displayName = member.full_name ?? member.email ?? member.user_id;

            return (
              <tr key={member.user_id} className="hover:bg-neutral-50">

                {/* Name + email */}
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{displayName}</p>
                  {member.full_name && member.email && (
                    <p className="text-neutral-400 text-xs">{member.email}</p>
                  )}
                </td>

                {/* Role select — change is immediate */}
                <td className="px-4 py-3">
                  <select
                    value={member.role}
                    aria-label={`Role for ${displayName}`}
                    onChange={(e) => updateRole(member.user_id, e.target.value)}
                    className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {capitalize(r)}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Invited by */}
                <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                  {member.invited_by ? (
                    INVITER_NAME[member.invited_by] ?? member.invited_by
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>

                {/* Actions — two-step confirm before removal */}
                <td className="px-4 py-3 text-end whitespace-nowrap">
                  {isConfirming ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-neutral-500 text-xs">
                        Remove {displayName}?
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMember(member.user_id)}
                        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(member.user_id)}
                      className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:border-red-200 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
