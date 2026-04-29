"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type LedgerItem = {
  id: number;
  user_id: number;
  user_email?: string | null;
  type: string;
  amount: number;
  balance_after: number;
  reference?: string | null;
  created_at: string;
};

type LedgersResponse = {
  items: LedgerItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

type LedgerStats = {
  total_records: number;
  total_amount: number;
  income_amount: number;
  expense_amount: number;
  unique_users: number;
};

export default function AdminLedgersPage() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 0 });
  const [typeFilter, setTypeFilter] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function buildQuery(targetPage = page): string {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    query.set("page_size", String(pageSize));
    if (typeFilter) query.set("ledger_type", typeFilter);
    if (startTime) query.set("start_time", startTime);
    if (endTime) query.set("end_time", endTime);
    return query.toString();
  }

  async function loadLedgers(targetPage = page) {
    const token = getAccessToken();
    if (!token) {
      setError("请先登录管理员账号");
      return;
    }
    const data = await apiFetch<LedgersResponse>(`/api/v1/admin/ledgers?${buildQuery(targetPage)}`, { token });
    setItems(data.items);
    setPagination(data.pagination);
    setPage(data.pagination.page);
  }

  async function loadStats() {
    const token = getAccessToken();
    if (!token) {
      setError("请先登录管理员账号");
      return;
    }
    const query = new URLSearchParams();
    if (typeFilter) query.set("ledger_type", typeFilter);
    if (startTime) query.set("start_time", startTime);
    if (endTime) query.set("end_time", endTime);
    const data = await apiFetch<LedgerStats>(`/api/v1/admin/ledgers/stats?${query.toString()}`, { token });
    setStats(data);
  }

  async function loadAll(targetPage = 1) {
    try {
      setError("");
      await Promise.all([loadLedgers(targetPage), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  useEffect(() => {
    void loadAll(1);
  }, []);

  return (
    <section className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold">余额流水</h1>
        <p className="mt-2 text-sm text-slate-500">增加筛选、分页和统计展示。</p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">流水总条数</p>
            <p className="text-lg font-semibold">{stats?.total_records ?? "--"}</p>
          </div>
          <div className="rounded border bg-slate-50 p-3">
            <p className="text-xs text-slate-500">净变动</p>
            <p className="text-lg font-semibold">{stats?.total_amount ?? "--"}</p>
          </div>
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">入账总额</p>
            <p className="text-lg font-semibold text-emerald-900">{stats?.income_amount ?? "--"}</p>
          </div>
          <div className="rounded border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-700">出账总额</p>
            <p className="text-lg font-semibold text-rose-900">{stats?.expense_amount ?? "--"}</p>
          </div>
          <div className="rounded border border-sky-200 bg-sky-50 p-3">
            <p className="text-xs text-sky-700">涉及用户数</p>
            <p className="text-lg font-semibold text-sky-900">{stats?.unique_users ?? "--"}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <select className="rounded border p-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">全部类型</option>
            <option value="TOPUP">TOPUP</option>
            <option value="FREEZE">FREEZE</option>
            <option value="CAPTURE">CAPTURE</option>
            <option value="RELEASE">RELEASE</option>
            <option value="REFUND">REFUND</option>
            <option value="ARREARS_INCUR">ARREARS_INCUR</option>
            <option value="ARREARS_SETTLE">ARREARS_SETTLE</option>
          </select>
          <input className="rounded border p-2 text-sm" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <input className="rounded border p-2 text-sm" type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          <select className="rounded border p-2 text-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={20}>每页 20 条</option>
            <option value={50}>每页 50 条</option>
            <option value={100}>每页 100 条</option>
          </select>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => void loadAll(1)} type="button">
            查询
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li className="rounded border p-3" key={item.id}>
            <div className="flex items-center justify-between">
              <p className="font-medium">流水 #{item.id} · {item.user_email || `用户ID ${item.user_id}`}</p>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{item.type}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-4">
              <p>金额：{item.amount}</p>
              <p>变动后余额：{item.balance_after}</p>
              <p>来源：{item.reference || "--"}</p>
              <p>时间：{new Date(item.created_at).toLocaleString("zh-CN", { hour12: false })}</p>
            </div>
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
            onClick={() => void loadLedgers(pagination.page - 1)}
            type="button"
          >
            上一页
          </button>
          <button
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() => void loadLedgers(pagination.page + 1)}
            type="button"
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}
