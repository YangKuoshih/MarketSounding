"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, clearToken } from "@/lib/api-client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("ms-token");
    if (!token) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    // Validate token against the server — rejects stale/demo tokens
    api.auth.me().then(() => {
      setChecked(true);
    }).catch(() => {
      clearToken();
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    });
  }, [pathname, router]);

  if (!checked) return null;
  return <>{children}</>;
}
