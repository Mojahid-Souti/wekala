import type { DemoStatus } from "@/components/chat/useDemoPlayer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DEMO_SCENARIOS, type DemoScenario } from "@/mock/demoScenarios";
import { Pause, Play, RotateCcw } from "lucide-react";

type Props = {
  selectedScenario: DemoScenario | null;
  status: DemoStatus;
  stepIndex: number;
  onPause: () => void;
  onPlay: () => void;
  onReset: () => void;
  onSelectScenario: (id: string) => void;
};

export function DemoPlayer({
  selectedScenario,
  status,
  stepIndex,
  onPause,
  onPlay,
  onReset,
  onSelectScenario,
}: Props) {
  const totalSteps = selectedScenario?.steps.length ?? 0;
  const isPlaying = status === "playing";
  const isDone = status === "done";
  const canPlay = selectedScenario !== null && (status === "idle" || status === "paused");
  const canReset = status !== "idle";
  const progressPct = totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;

  return (
    <div className="shrink-0 border-b border-neutral-200 bg-amber-50/60 px-4 py-2.5">
      <div className="mx-auto max-w-2xl space-y-2">
        {/* Scenario picker row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 shrink-0 text-xs font-medium text-neutral-500">
            Demo scenarios:
          </span>
          {DEMO_SCENARIOS.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={selectedScenario?.id === s.id ? "default" : "outline"}
              disabled={isPlaying}
              onClick={() => onSelectScenario(s.id)}
              className="h-6 px-2.5 text-xs"
            >
              {s.title}
            </Button>
          ))}
        </div>

        {/* Playback controls row — only rendered once a scenario is chosen */}
        {selectedScenario !== null && (
          <div className="flex items-center gap-2">
            {/* Play / Pause toggle */}
            {isPlaying ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onPause}
                className="h-6 gap-1 px-2.5 text-xs"
              >
                <Pause className="size-3" />
                Pause
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!canPlay}
                onClick={onPlay}
                className="h-6 gap-1 px-2.5 text-xs"
              >
                <Play className="size-3" />
                {status === "paused" ? "Resume" : "Play"}
              </Button>
            )}

            {/* Reset */}
            <Button
              size="icon"
              variant="ghost"
              disabled={!canReset}
              onClick={onReset}
              aria-label="Reset demo"
              title="Reset"
              className="size-6"
            >
              <RotateCcw className="size-3" />
            </Button>

            <Separator orientation="vertical" className="h-4" />

            {/* Progress bar + step counter */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-neutral-900 transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                {isDone ? (
                  <span className="font-medium text-emerald-600">Complete ✓</span>
                ) : (
                  `${stepIndex} / ${totalSteps}`
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
