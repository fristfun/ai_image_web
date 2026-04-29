"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type TemplateItem = {
  id: number;
  category: string;
  title: string;
  effect_image_url?: string | null;
};

export default function AdminTemplatesPage() {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadTemplates() {
    try {
      const token = getAccessToken();
      if (!token) {
        setError("请先登录管理员账号");
        return;
      }
      const data = await apiFetch<TemplateItem[]>("/api/v1/admin/templates", { token });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function onDelete(id: number) {
    const confirmed = window.confirm(`确认删除模板 #${id} 吗？`);
    if (!confirmed) return;
    try {
      const token = getAccessToken();
      if (!token) throw new Error("请先登录管理员账号");
      setDeletingId(id);
      await apiFetch<{ ok: boolean }>(`/api/v1/admin/templates/${id}`, { method: "DELETE", token });
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card space-y-2">
      <h1 className="text-xl font-semibold">模板管理</h1>
      <p className="text-sm text-slate-500">对应后端接口：GET/POST/PUT/DELETE /api/v1/admin/templates</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li className="flex items-center justify-between gap-2 rounded border p-2" key={item.id}>
            <span>
              #{item.id} [{item.category}] {item.title}
              {item.effect_image_url ? <span className="ml-2 text-slate-500">已配置效果图</span> : null}
            </span>
            <span className="flex items-center gap-2">
              <Link className="rounded border px-2 py-1 text-xs hover:bg-slate-50" href={`/admin/templates/${item.id}`}>
                修改
              </Link>
              <button
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                disabled={deletingId === item.id}
                onClick={() => onDelete(item.id)}
                type="button"
              >
                {deletingId === item.id ? "删除中..." : "删除"}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <Link className="inline-block rounded-md bg-slate-900 px-3 py-2 text-sm text-white" href="/admin/templates/new">
        新建模板
      </Link>
    </section>
  );
}
