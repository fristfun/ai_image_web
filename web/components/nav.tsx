"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clearAccessToken, getAuthChangedEventName, getCurrentRole, getCurrentUsername, isAuthenticated } from "@/lib/auth";

const guestLinks = [
  { href: "/login", label: "登录" },
  { href: "/register", label: "注册" }
];

const userLinks = [
  { href: "/templates", label: "模板库" },
  { href: "/generate", label: "生成" },
  { href: "/history", label: "历史" },
  { href: "/wallet", label: "钱包" }
];

const adminLinks = [
  { href: "/admin", label: "后台" }
];

export function Nav() {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const syncAuthState = () => {
      const ok = isAuthenticated();
      if (!ok) {
        setAuthed(false);
        setRole(null);
        setUsername(null);
        return;
      }
      setAuthed(true);
      setRole(getCurrentRole());
      setUsername(getCurrentUsername());
    };

    syncAuthState();
    const authEvent = getAuthChangedEventName();
    window.addEventListener(authEvent, syncAuthState);
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener(authEvent, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const links = useMemo(() => {
    if (!authed) {
      return [...guestLinks, ...userLinks];
    }
    return role === "ADMIN" ? [...userLinks, ...adminLinks] : userLinks;
  }, [authed, role]);

  function logout() {
    clearAccessToken();
    setAuthed(false);
    setRole(null);
    setUsername(null);
    window.location.href = "/login";
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="container-page py-3 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link className="font-semibold" href="/">
            AI 生图站
          </Link>
          <button
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            type="button"
          >
            {mobileMenuOpen ? "收起菜单" : "展开菜单"}
          </button>
        </div>

        <div className="mt-3 hidden items-center gap-3 text-sm md:flex">
          {links.map((link) => (
            <Link key={link.href} className="text-slate-600 hover:text-slate-900" href={link.href}>
              {link.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {authed ? (
              <>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  已登录{username ? ` · ${username}` : ""}{role ? ` (${role})` : ""}
                </span>
                <button className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={logout} type="button">
                  退出
                </button>
              </>
            ) : (
              <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">未登录</span>
            )}
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:hidden">
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <Link key={link.href} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col items-start gap-2">
              {authed ? (
                <>
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    已登录{username ? ` · ${username}` : ""}{role ? ` (${role})` : ""}
                  </span>
                  <button className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={logout} type="button">
                    退出
                  </button>
                </>
              ) : (
                <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">未登录</span>
              )}
            </div>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
