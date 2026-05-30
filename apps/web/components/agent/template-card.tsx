"use client";

import type { TemplateOut } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  FileText,
  type LucideIcon,
  MessageCircle,
  Monitor,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Monitor,
  BookOpen,
  Users,
  TrendingUp,
  FileText,
  ShieldCheck,
  MessageCircle,
};

export function TemplateCard({
  template,
  onSelect,
}: {
  template: TemplateOut;
  onSelect: (template: TemplateOut) => void;
}) {
  const Icon = ICONS[template.icon_name ?? "Sparkles"] ?? Sparkles;

  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={cn(
        "group flex min-h-[112px] items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors",
        "hover:border-neutral-400 hover:bg-neutral-50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
      )}
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700">
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-sm font-medium text-neutral-950">{template.name}</h3>
          <span className="shrink-0 text-[10px] text-neutral-400">
            {template.classification ?? "Internal"}
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-neutral-500">{template.description}</p>
      </div>
    </button>
  );
}
