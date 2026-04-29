"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAccessToken, isAuthenticated } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = isAuthenticated();
    if (!ok) {
      clearAccessToken();
      setAllowed(false);
      router.replace("/login");
      return;
    }
    setAllowed(true);
  }, [pathname, router]);

  if (allowed === null) {
    return <main className="container-page">检查登录状态中...</main>;
  }

  if (!allowed) {
    return <main className="container-page text-sm text-slate-600">正在跳转到登录页...</main>;
  }

  return <main className="container-page">{children}</main>;
}
