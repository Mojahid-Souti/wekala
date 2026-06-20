import { useCallback, useState } from "react";
import { MOCK_REPORTS } from "@/mock/data";
import type { AgentReport } from "@/types/api";

// Until auth lands, the acting admin is fixed. Real app reads this from the
// session/JWT. (Matches the seeded admin in MOCK_MEMBERS.)
const CURRENT_ADMIN_ID = "u1";

// A report can only be acted on while it's still active.
const ACTIONABLE_STATUSES = new Set(["open", "reviewing"]);

type Resolution = "resolved" | "dismissed";

/**
 * Holds the reports queue in local state (seeded from the mock data) and exposes
 * resolve/dismiss transitions. Both set a terminal status plus the audit stamps
 * the real API records. When wiring the live backend, replace setResolution with
 * POST /v1/workspaces/{wid}/reports/{rid}/resolve (Phase 15) and refetch.
 */
export function useReports() {
  const [reports, setReports] = useState<AgentReport[]>(() =>
    MOCK_REPORTS.map((report) => ({ ...report })),
  );

  const setResolution = useCallback((id: string, status: Resolution) => {
    setReports((prev) =>
      prev.map((report) =>
        report.id === id && ACTIONABLE_STATUSES.has(report.status)
          ? {
              ...report,
              status,
              resolved_at: new Date().toISOString(),
              resolved_by: CURRENT_ADMIN_ID,
            }
          : report,
      ),
    );
  }, []);

  const resolve = useCallback(
    (id: string) => setResolution(id, "resolved"),
    [setResolution],
  );
  const dismiss = useCallback(
    (id: string) => setResolution(id, "dismissed"),
    [setResolution],
  );

  return { reports, resolve, dismiss };
}

export function isActionable(status: string): boolean {
  return ACTIONABLE_STATUSES.has(status);
}
