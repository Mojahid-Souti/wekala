/**
 * Admin Panel shell — wires in the screens. Add pages under src/pages/,
 * components under src/components/, hooks under src/hooks/.
 */
import { SilaPage } from "@/pages/SilaPage";
import { VoicePage } from "@/pages/VoicePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AuditLogPage } from "@/pages/AuditLogPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { LocaleToggle } from "@/components/LocaleToggle";

const ARABIC_WEIGHTS = [
  { weight: 400, label: "Regular", className: "font-normal" },
  { weight: 500, label: "Medium", className: "font-medium" },
  { weight: 600, label: "Semibold", className: "font-semibold" },
  { weight: 700, label: "Bold", className: "font-bold" },
] as const;

export function App() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-start justify-between border-neutral-200 border-b bg-white px-6 py-4">
        <div>
          <h1 className="font-semibold text-lg tracking-tight">Sila · Admin Panel</h1>
          <p className="text-neutral-500 text-sm">
            Standalone work area. Build your assigned screen here; it gets integrated into
            the main app later.
          </p>
        </div>
        <LocaleToggle />
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <SilaPage />
        <VoicePage />
        <DashboardPage />
        <AuditLogPage />
        <ReportsPage />
        {/* L6 verification surface: Arabic webfont (IBM Plex Sans Arabic), loaded
            self-hosted and applied via locale-scoped CSS. The block below is
            marked lang="ar" so it always renders in the Arabic face (proving the
            :lang(ar) scoping); the header toggle flips <html lang/dir> to show
            the document-level switch. */}
        <section className="rounded-xl border border-neutral-200 bg-white p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-semibold text-base text-neutral-800">
              Arabic typography — IBM Plex Sans Arabic
            </h2>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-medium text-neutral-600 text-xs">
              L6 · locale-scoped font
            </span>
          </div>

          <div lang="ar" dir="rtl" className="space-y-5">
            <p className="text-2xl leading-relaxed font-semibold">
              مرحبًا بك في لوحة تحكم صلة
            </p>
            <p className="text-neutral-600 leading-loose">
              تُدار الوكلاء والأعضاء والتقارير وسجلّات التدقيق من هذه اللوحة. هذا
              النص يستخدم خط IBM Plex Sans Arabic للتأكد من وضوح القراءة وجمال
              العرض باللغة العربية.
            </p>

            <div className="grid gap-3 border-neutral-100 border-t pt-5 sm:grid-cols-2">
              {ARABIC_WEIGHTS.map(({ weight, label, className }) => (
                <div key={weight} className="flex items-baseline justify-between gap-4">
                  <span dir="ltr" className="text-neutral-400 text-xs">
                    {label} · {weight}
                  </span>
                  <span className={`text-lg ${className}`}>الذكاء الاصطناعي السيادي</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-neutral-400 text-xs">
          Reference shapes: <code className="rounded bg-neutral-100 px-1">src/types/api.ts</code>{" "}
          · mock data: <code className="rounded bg-neutral-100 px-1">src/mock/data.ts</code>
        </p>
      </main>
    </div>
  );
}
