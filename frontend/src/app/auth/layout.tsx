import { MarketingShell } from "@/components/marketing/marketing-shell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShell>{children}</MarketingShell>;
}
