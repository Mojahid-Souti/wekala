import { GuestGuard } from "@/components/auth/guest-guard";
import { ToastProvider } from "@/lib/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GuestGuard>{children}</GuestGuard>
    </ToastProvider>
  );
}
