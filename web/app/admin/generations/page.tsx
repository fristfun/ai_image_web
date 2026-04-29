"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type GenerationItem = {
  id: number;
  user_id: number;
  user_email?: string | null;
  status: string;
  prompt: string;
  size: string;
  quality: string;
  format: string;
  price_points: number;
  actual_cost_usd: number;
  created_at: string;
  error_message?: string | null;
};

type TodayStats = {
  unique_users: number;
  total_images: number;
  total_points: number;
  total_actual_cost_usd: number;
  success_count: number;
  failed_count: number;
};

type GenerationListResponse = {
  items: GenerationItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

type StatusFilter = "ALL" | "SUCCESS" | "FAILED";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function AdminGenerationsPage() {
  const [items, setItems] = useState<GenerationItem[]>([]);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 0 });
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  function buildQuery(targetPage = page): string {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    query.set("page_size", String(pageSize));
    if (statusFilter !== "ALL") query.set("status", statusFilter);
    if (startTime) query.set("start_time", startTime);
    if (endTime) query.set("end_time", endTime);
    return query.toString();
  }

  async function loadStats() {
    const token = getAccessToken();
    if (!token) {
      setError("请先登录管理员账号");
      return;
    }
    const daily = await apiFetch<TodayStats>("/api/v1/admin/generations/stats/today", { token });
    setStats(daily);
  }

  async function loadRecords(targetPage = page) {
    const token = getAccessToken();
    if (!token) {
      setError("请先登录管理员账号");
      return;
    }
    const data = await apiFetch<GenerationListResponse>(`/api/v1/admin/generations?${buildQuery(targetPage)}`, { token });
    setItems(data.items);
    setPagination(data.pagination);
    setPage(data.pagination.page);
  }

  async function loadAll(targetPage = 1) {
    try {
      setError("");
      await Promise.all([loadStats(), loadRecords(targetPage)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  useEffect(() => {
    void loadAll(1);
  }, []);

  async function onExportCsv() {
    try {
      const token = getAccessToken();
      if (!token) {
        setError("请先登录管理员账号");
        return;
      }
      setExporting(true);
      const query = buildQuery(1);
      const response = await fetch(`${API_BASE}/api/v1/admin/generations/export-csv?${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("导出失败");
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `generations_export_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold">生成记录</h1>
        <p className="mt-2 text-sm text-slate-500">今日统计（按服务器本地时间）</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">今日用户数</p>
            <p className="text-xl font-semibold">{stats?.unique_users ?? "--"}</p>
          </div>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">今日生图总量</p>
            <p className="text-xl font-semibold">{stats?.total_images ?? "--"}</p>
          </div>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">今日收取积分</p>
            <p className="text-xl font-semibold">{stats?.total_points ?? "--"}</p>
          </div>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">今日实际消耗美元（6位小数）</p>
            <p className="text-xl font-semibold">${(stats?.total_actual_cost_usd ?? 0).toFixed(6)}</p>
          </div>
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">成功次数</p>
            <p className="text-xl font-semibold text-emerald-900">{stats?.success_count ?? "--"}</p>
          </div>
          <div className="rounded border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-700">失败次数</p>
            <p className="text-xl font-semibold text-rose-900">{stats?.failed_count ?? "--"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">生成记录列表</h2>
        <p className="mt-1 text-sm text-slate-500">展示实际 API 成本与任务详情</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          <select
            className="rounded border p-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="ALL">全部状态</option>
            <option value="SUCCESS">仅成功</option>
            <option value="FAILED">仅失败</option>
          </select>
          <input className="rounded border p-2 text-sm" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <input className="rounded border p-2 text-sm" type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          <select className="rounded border p-2 text-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={20}>每页 20 条</option>
            <option value={50}>每页 50 条</option>
            <option value={100}>每页 100 条</option>
          </select>
          <div className="flex gap-2">
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => void loadAll(1)} type="button">
              查询
            </button>
            <button
              className="rounded border px-3 py-2 text-sm disabled:opacity-60"
              disabled={exporting}
              onClick={() => void onExportCsv()}
              type="button"
            >
              {exporting ? "导出中..." : "导出 CSV"}
            </button>
          </div>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li className="rounded border p-3 text-sm" key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">
                任务 #{item.id} · {item.user_email || `用户ID ${item.user_id}`}
              </p>
              <span className={item.status === "SUCCESS" ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700" : "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700"}>
                {item.status}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.prompt}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-4">
              <p>尺寸：{item.size}</p>
              <p>质量：{item.quality}</p>
              <p>格式：{item.format}</p>
              <p>扣费：{item.price_points} 积分</p>
              <p>实际 API 成本（USD，6位小数）：${item.actual_cost_usd.toFixed(6)}</p>
              <p className="col-span-2 md:col-span-3">时间：{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</p>
            </div>
            {item.error_message ? <p className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-700">失败原因：{item.error_message}</p> : null}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          共 {pagination.total} 条 · 第 {pagination.page}/{pagination.total_pages || 1} 页
        </span>
        <div className="flex gap-2">
          <button
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pagination.page <= 1}
            onClick={() => void loadRecords(pagination.page - 1)}
            type="button"
          >
            上一页
          </button>
          <button
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() => void loadRecords(pagination.page + 1)}
            type="button"
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}
