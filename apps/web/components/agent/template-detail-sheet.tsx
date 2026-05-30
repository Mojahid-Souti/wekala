"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TemplateOut } from "@/lib/api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import {
  BookOpen,
  FileText,
  HardDrive,
  Hash,
  Loader2,
  type LucideIcon,
  Mail,
  MessageCircle,
  Monitor,
  Search as SearchIcon,
  Sheet as SheetIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Webhook,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

const CONNECTOR_ICONS: Record<string, LucideIcon> = {
  slack: Hash,
  gmail: Mail,
  webhook: Webhook,
  sheets: SheetIcon,
  drive: HardDrive,
  kb: SearchIcon,
  http: Webhook,
};

export function TemplateDetailSheet({
  template,
  workspaceId,
  open,
  onOpenChange,
}: {
  template: TemplateOut | null;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setError(null);
    }
  }, [template]);

  if (!template) return null;

  const Icon = ICONS[template.icon_name ?? "Sparkles"] ?? Sparkles;

  async function handleCreate() {
    if (!template) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Not signed in");
      await api.agents.importTemplate(workspaceId, template.id, token);
      router.push(ROUTES.agents(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700">
              <Icon className="size-5" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-lg leading-tight">{template.name}</SheetTitle>
              <SheetDescription className="text-xs">
                {template.classification} · {template.category}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-4">
          <p className="text-sm leading-relaxed text-neutral-700">{template.description}</p>

          {(template.connectors ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Connectors used
              </p>
              <div className="flex flex-wrap gap-2">
                {(template.connectors ?? []).map((c) => {
                  const CIcon = CONNECTOR_ICONS[c] ?? Webhook;
                  return (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
                    >
                      <CIcon className="size-3.5" />
                      {c}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {(template.sample_prompts ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Sample prompts
              </p>
              <ul className="space-y-1.5">
                {(template.sample_prompts ?? []).map((p) => (
                  <li
                    key={p}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700"
                  >
                    “{p}”
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 border-t border-neutral-100 pt-5">
            <Label htmlFor="template-name" className="text-xs uppercase tracking-wider">
              Agent name in your workspace
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme IT helpdesk"
            />
            <p className="text-xs text-neutral-500">
              You'll be able to rename and customize after creation.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2 border-t border-neutral-100 pt-4">
          <Button
            onClick={handleCreate}
            disabled={submitting || !name.trim()}
            className="min-w-[140px]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create draft agent"
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
