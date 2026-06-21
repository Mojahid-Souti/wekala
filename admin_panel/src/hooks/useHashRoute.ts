import { useEffect, useState } from "react";

/**
 * Minimal hash-based router. Returns the current path (e.g. "/", "/reports")
 * plus a navigate() helper. No dependency — swap for a real router on integration.
 */
function readPath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash.length > 0 ? hash : "/";
}

export function useHashRoute(): { path: string; navigate: (to: string) => void } {
  const [path, setPath] = useState<string>(readPath);

  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to;
  };

  return { path, navigate };
}