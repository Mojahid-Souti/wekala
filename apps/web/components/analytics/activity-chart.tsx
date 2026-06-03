"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart3 } from "lucide-react";
import type { ComponentProps } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

export type ActivityPoint = {
  day: string; // ISO date, e.g. "2026-03-14"
  invocations: number;
  tool_calls: number;
};

// Monochrome series — invocations dark, tool calls light grey. Colors are applied
// directly on the <Bar fill> below (the tooltip swatch reads them from the item).
const INVOCATIONS_FILL = "#171717";
const TOOL_CALLS_FILL = "#a3a3a3";
const chartConfig = {
  invocations: { label: "Invocations" },
  tool_calls: { label: "Tool calls" },
} satisfies ChartConfig;

/** Legend rendered in the panel header, beside the title. */
export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-neutral-500">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-neutral-900" />
        Invocations
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-neutral-400" />
        Tool calls
      </span>
    </div>
  );
}

/** "2026-03-14" -> "Mar 14"; falls back to MM-DD. */
function shortDay(day: string): string {
  const dt = new Date(`${day}T00:00:00`);
  return Number.isNaN(dt.getTime())
    ? day.slice(5)
    : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Only show the tooltip for days that actually have activity (no 0/0 popups). */
function ActivityTooltip(props: ComponentProps<typeof ChartTooltipContent>) {
  const sum = (props.payload ?? []).reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  if (!props.active || sum === 0) return null;
  return <ChartTooltipContent {...props} />;
}

/**
 * Daily activity bar chart (invocations + tool calls) via Recharts.
 * Complexity: O(n) over days; n = points in range (<= 90).
 */
export function ActivityChart({ data }: { data: ActivityPoint[] }) {
  const total = data.reduce((s, d) => s + d.invocations + d.tool_calls, 0);

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-neutral-300">
        <BarChart3 className="size-7" />
        <p className="text-sm text-neutral-400">No activity in this range yet.</p>
      </div>
    );
  }

  const rows = data.map((d) => ({ ...d, label: shortDay(d.day) }));

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <BarChart accessibilityLayer data={rows} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ActivityTooltip />} />
        <Bar dataKey="invocations" fill={INVOCATIONS_FILL} radius={[4, 4, 0, 0]} />
        <Bar dataKey="tool_calls" fill={TOOL_CALLS_FILL} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
