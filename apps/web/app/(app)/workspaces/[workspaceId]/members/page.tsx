"use client";

import { ROUTES } from "@/lib/constants";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Members management moved under Settings → Members. This route is kept only as
// a redirect for stale links/bookmarks. Client-side redirect so it works inside
// the (app) AuthGuard, which gates server children until the token is checked.
export default function MembersRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(ROUTES.workspaceMembers(workspaceId));
  }, [router, workspaceId]);

  return null;
}
