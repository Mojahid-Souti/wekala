"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PieChart as PieIcon } from "lucide-react";
import { Cell, Label, Pie, PieChart } from "recharts";

export type AgentSlice = { name: string; invocations: number };

// Monochrome slices, darkest = busiest agent.
const SHADES = ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"];
const chartConfig = { value: { label: "Invocations" } } satisfies ChartConfig;

/**
 * Donut of invocations by agent (top 5). Complexity: O(n log n) to sort agents.
 */
export function InvocationsPie({ agents }: { agents: AgentSlice[] }) {
  const top = agents
    .filter((a) => a.invocations > 0)
    .sort((a, b) => b.invocations - a.invocations)
    .slice(0, 5);
  const total = top.reduce((s, a) => s + a.invocations, 0);

  if (top.length === 0 || total === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-neutral-300">
        <PieIcon className="size-7" />
        <p className="text-sm text-neutral-400">No agent activity yet.</p>
      </div>
    );
  }

  const data = top.map((a, i) => ({
    name: a.name,
    value: a.invocations,
    fill: SHADES[i % SHADES.length],
  }));

  return (
    <div>
      <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[210px]">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" />} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} strokeWidth={3}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-neutral-950 text-2xl font-semibold"
                      >
                        {total.toLocaleString()}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 20}
                        className="fill-neutral-400 text-xs"
                      >
                        invocations
                      </tspan>
                    </text>
                  );
                }
                return null;
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="mt-3 space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.fill }}
              />
              <span className="truncate text-neutral-700">{d.name}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-neutral-500">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
