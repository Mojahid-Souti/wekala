"use client";

import { useEffect, useState } from "react";

export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);
  return isMac;
}

export function modifierMatches(
  event: KeyboardEvent | React.KeyboardEvent,
  isMac: boolean
): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}
