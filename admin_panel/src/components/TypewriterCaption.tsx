import { useTypewriter } from "@/hooks/useTypewriter";

type TypewriterCaptionProps = {
  text: string;
  speedMs?: number;
  className?: string;
  /** Show a blinking caret while typing (hidden once finished). */
  showCaret?: boolean;
};

export function TypewriterCaption({
  text,
  speedMs,
  className,
  showCaret = true,
}: TypewriterCaptionProps) {
  const { displayed, isDone } = useTypewriter(text, speedMs);

  return (
    <p className={className} aria-live="polite">
      {displayed}
      {showCaret && !isDone && (
        <span className="ml-0.5 inline-block animate-pulse text-neutral-400" aria-hidden="true">
          ▍
        </span>
      )}
    </p>
  );
}
