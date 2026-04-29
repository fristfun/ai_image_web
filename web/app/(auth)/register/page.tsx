"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAuthenticated, setAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type RegisterResponse = {
  access_token: string;
  token_type: string;
  username: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<RegisterResponse>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password })
      });
      setAccessToken(data.access_token);
      router.push("/generate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container-page">
      <section className="card mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-semibold">注册</h1>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-md border p-2"
            placeholder="用户名"
            type="text"
            value={username}
            required
            maxLength={50}
            onChange={(event) => setUsername(event.target.value)}
          />
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
            placeholder="密码（至少8位）"
            type="password"
            value={password}
            required
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
          />
          <input
            className="w-full rounded-md border p-2"
            placeholder="确认密码"
            type="password"
            value={confirmPassword}
            required
            minLength={8}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="w-full rounded-md bg-slate-900 py-2 text-white" type="submit">
            {loading ? "创建中..." : "创建账号"}
          </button>
        </form>
        <p className="text-sm text-slate-600">
          已有账号？{" "}
          <Link className="text-slate-900 underline" href="/login">
            去登录
          </Link>
        </p>
      </section>
    </main>
  );
}
