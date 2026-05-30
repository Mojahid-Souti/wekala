"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import {
  ArrowRight,
  Bell,
  Bot,
  Calendar,
  Database,
  FileText,
  HardDrive,
  Hash,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Play,
  Search,
  Sheet,
  Sparkles,
  Wrench,
} from "lucide-react";

export type AgentNodeKind =
  | "start"
  | "end"
  | "writer"
  | "email"
  | "notification"
  | "search"
  | "bot"
  | "tool"
  | "data"
  | "slack"
  | "drive"
  | "sheets"
  | "calendar"
  | "notion"
  | "teams"
  | "outlook"
  | "openai";

export type AgentNodeData = {
  kind: AgentNodeKind;
  title: string;
  subtitle?: string;
  description?: string;
  tags?: string[];
};

type Palette = {
  bg: string;
  fg: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PALETTE: Record<AgentNodeKind, Palette> = {
  start: { bg: "bg-blue-500", fg: "text-white", icon: MessageCircle },
  end: { bg: "bg-neutral-500", fg: "text-white", icon: ArrowRight },
  writer: { bg: "bg-orange-500", fg: "text-white", icon: Pencil },
  email: { bg: "bg-red-500", fg: "text-white", icon: Mail },
  notification: { bg: "bg-emerald-500", fg: "text-white", icon: Bell },
  search: { bg: "bg-purple-500", fg: "text-white", icon: Search },
  bot: { bg: "bg-indigo-500", fg: "text-white", icon: Bot },
  tool: { bg: "bg-neutral-800", fg: "text-white", icon: Wrench },
  data: { bg: "bg-sky-500", fg: "text-white", icon: Database },
  slack: { bg: "bg-violet-500", fg: "text-white", icon: Hash },
  drive: { bg: "bg-yellow-500", fg: "text-white", icon: HardDrive },
  sheets: { bg: "bg-green-600", fg: "text-white", icon: Sheet },
  calendar: { bg: "bg-blue-600", fg: "text-white", icon: Calendar },
  notion: { bg: "bg-neutral-900", fg: "text-white", icon: FileText },
  teams: { bg: "bg-indigo-600", fg: "text-white", icon: MessageSquare },
  outlook: { bg: "bg-sky-600", fg: "text-white", icon: Mail },
  openai: { bg: "bg-teal-600", fg: "text-white", icon: Sparkles },
};

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as AgentNodeData;
  const palette = PALETTE[d.kind] ?? PALETTE.bot;
  const Icon = palette.icon;
  const isStart = d.kind === "start";
  const isEnd = d.kind === "end";

  return (
    <div className="group relative w-[220px]">
      {/* Play indicator on left for the Start node */}
      {isStart && (
        <div className="absolute -left-7 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-neutral-950 text-white shadow">
          <Play className="size-2.5 fill-white" />
        </div>
      )}

      {/* Card */}
      <div
        className={`relative flex items-center gap-3 rounded-xl border bg-white p-2.5 transition-shadow ${
          selected
            ? "border-neutral-950 shadow-lg ring-2 ring-neutral-200"
            : "border-neutral-200 shadow-sm hover:shadow-md"
        }`}
      >
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${palette.bg} ${palette.fg}`}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-neutral-950">{d.title}</div>
          {d.subtitle && <div className="truncate text-xs text-neutral-500">{d.subtitle}</div>}
        </div>
      </div>

      {/* Description + tags floating below the card */}
      {(d.description || (d.tags && d.tags.length > 0)) && (
        <div className="mt-2 px-1">
          {d.description && (
            <p className="text-xs leading-relaxed text-neutral-600">{d.description}</p>
          )}
          {d.tags && d.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {d.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-5 items-center rounded-full bg-neutral-100 px-2 text-[10px] font-medium text-neutral-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Connection handles — green on hover */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2.5 !-translate-x-1 !border-2 !border-white !bg-neutral-300 group-hover:!bg-emerald-500"
        />
      )}
      {!isEnd && (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2.5 !translate-x-1 !border-2 !border-white !bg-neutral-300 group-hover:!bg-emerald-500"
        />
      )}
    </div>
  );
}
