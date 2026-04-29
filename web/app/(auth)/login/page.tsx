"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAuthenticated, setAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type LoginResponse = {
  access_token: string;
  token_type: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/generate");
    }
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setAccessToken(data.access_token);
      router.push("/generate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container-page">
      <section className="card mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-semibold">登录</h1>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-md border p-2"
            placeholder="邮箱"
            type="email"
            value={email}
            required
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="w-full rounded-md border p-2"
            placeholder="密码"
            type="password"
            value={password}
            required
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="w-full rounded-md bg-slate-900 py-2 text-white" type="submit">
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="text-sm text-slate-600">
          还没有账号？{" "}
          <Link className="text-slate-900 underline" href="/register">
            去注册
          </Link>
        </p>
      </section>
    </main>
  );
}
