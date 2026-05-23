import { AnimatedFormPanel } from "@/components/auth/animated-form-panel";
import { AuthShell } from "@/components/auth/auth-shell";
import { GuestGuard } from "@/components/auth/guest-guard";
import { ToastProvider } from "@/lib/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GuestGuard>
        <AuthShell>
          <AnimatedFormPanel>{children}</AnimatedFormPanel>
        </AuthShell>
      </GuestGuard>
    </ToastProvider>
  );
}
