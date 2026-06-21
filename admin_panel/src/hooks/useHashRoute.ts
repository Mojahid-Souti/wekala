import { useEffect, useState } from "react";

export function useHashRoute(): string {
  const [path, setPath] = useState<string>(() => {
    const hash = window.location.hash.slice(1);
    return hash || "/";
  });

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1);
      setPath(hash || "/");
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return path;
}
