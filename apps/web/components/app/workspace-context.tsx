"use client";

import { api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Workspace = { id: string; name: string; slug: string };

type WorkspaceContextValue = {
  workspaces: Workspace[];
  currentId: string | null;
  current: Workspace | null;
  loading: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  currentId: null,
  current: null,
  loading: true,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const token = useToken();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    api.workspaces
      .list(token)
      .then((data) => {
        if (!cancelled) setWorkspaces(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const currentId = useMemo(() => {
    const m = pathname.match(/^\/workspaces\/([^/]+)/);
    return m?.[1] ?? workspaces[0]?.id ?? null;
  }, [pathname, workspaces]);

  const current = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? null,
    [workspaces, currentId]
  );

  const value = useMemo(
    () => ({ workspaces, currentId, current, loading }),
    [workspaces, currentId, current, loading]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaces(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}
