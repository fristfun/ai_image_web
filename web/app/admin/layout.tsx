"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentRole, isTokenExpired } from "@/lib/auth";

const links = [
  { href: "/admin/users", label: "用户" },
  { href: "/admin/orders", label: "订单" },
  { href: "/admin/ledgers", label: "流水" },
  { href: "/admin/generations", label: "生成记录" },
  { href: "/admin/templates", label: "模板" }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (isTokenExpired()) {
      setAllowed(false);
      router.replace("/login");
      return;
    }
    const role = getCurrentRole();
    if (role !== "ADMIN") {
      setAllowed(false);
      return;
    }
    setAllowed(true);
  }, [router]);

  if (allowed === null) {
    return <main className="container-page">检查权限中...</main>;
  }

  if (!allowed) {
    return <main className="container-page text-sm text-red-600">无后台访问权限，请使用管理员账号登录。</main>;
  }

  return (
    <main className="container-page">
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-md border border-slate-300 px-3 py-1">
            {link.label}
          </Link>
        ))}
      </div>
      {children}
    </main>
  );
}
