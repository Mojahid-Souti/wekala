import { useEffect, useState } from "react";

const DEFAULT_SPEED_MS = 26; // milliseconds per character

type Typewriter = {
  displayed: string;
  isDone: boolean;
};

/**
 * Reveal `text` one character at a time. Restarts whenever `text` changes (so a
 * new caption retypes from scratch) and clears its timer on unmount. O(1) work
 * per tick; the substring is sliced, never rebuilt char-by-char.
 */
export function useTypewriter(text: string, speedMs: number = DEFAULT_SPEED_MS): Typewriter {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!text) return;

    const timer = setInterval(() => {
      setCount((current) => {
        if (current >= text.length) {
          clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, speedMs);

    return () => clearInterval(timer);
  }, [text, speedMs]);

  return { displayed: text.slice(0, count), isDone: count >= text.length };
}
