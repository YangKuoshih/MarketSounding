import { ConsoleShell } from "@/components/console/console-shell";
import { AuthGuard } from "@/components/auth-guard";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ConsoleShell>{children}</ConsoleShell>
    </AuthGuard>
  );
}
