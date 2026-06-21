import { useState } from "react";
import { MOCK_MEMBERS } from "@/mock/data";
import type { Member } from "@/types/api";

const ROLES = ["admin", "builder", "reviewer", "hirer", "viewer"] as const;

// Built from the module-level constant so invited-by names remain correct
// even after the inviter is removed during a session.
const INVITER_NAME: Record<string, string> = Object.fromEntries(
  MOCK_MEMBERS.map((m): [string, string] => [
    m.user_id,
    m.full_name ?? m.email ?? m.user_id,
  ])
);

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
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Members</h2>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-24 text-center">
          <p className="text-sm font-medium text-neutral-500">No members in this workspace.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Members</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          {members.length} {members.length === 1 ? "member" : "members"}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 text-start font-medium">Member</th>
              <th className="px-4 py-3 text-start font-medium">Role</th>
              <th className="px-4 py-3 text-start font-medium">Invited by</th>
              {/* text-end so the Actions header aligns with the end-aligned buttons */}
              <th className="px-4 py-3 text-end font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {members.map((member) => {
              const isConfirming = confirmId === member.user_id;
              const displayName = member.full_name ?? member.email ?? member.user_id;
              return (
                <tr key={member.user_id} className="hover:bg-neutral-50">
                  {/* Member */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{displayName}</p>
                    {member.email && (
                      <p className="text-xs text-neutral-500">{member.email}</p>
                    )}
                  </td>

                  {/* Role — controlled select; ps/pe instead of pl/pr for the arrow gap */}
                  <td className="px-4 py-3">
                    <select
                      value={member.role}
                      onChange={(e) => updateRole(member.user_id, e.target.value)}
                      className="rounded-md border border-neutral-200 bg-white py-1 ps-2 pe-6 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Invited by */}
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                    {member.invited_by
                      ? (INVITER_NAME[member.invited_by] ?? member.invited_by)
                      : "—"}
                  </td>

                  {/* Actions — justify-end aligns to inline-end (right in LTR, left in RTL) */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {isConfirming ? (
                        <>
                          <span className="text-xs text-neutral-500">
                            Remove {displayName}?
                          </span>
                          <button
                            type="button"
                            onClick={() => removeMember(member.user_id)}
                            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(member.user_id)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-neutral-500 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
