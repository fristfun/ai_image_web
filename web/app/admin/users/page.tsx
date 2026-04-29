"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type UserItem = {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login_at?: string | null;
  balance: number;
  frozen: number;
  arrears_points: number;
  created_at: string;
};

type UserListResponse = {
  items: UserItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

type StatusFilter = "ALL" | "ACTIVE" | "BANNED";

type TopupRecord = {
  id: number;
  amount: number;
  created_at: string;
  balance_after: number;
  admin_id?: number | null;
  admin_name?: string | null;
  admin_email?: string | null;
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserItem[]>([]);
  const [error, setError] = useState("");
  const [emailKeyword, setEmailKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 0 });
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [recordUser, setRecordUser] = useState<UserItem | null>(null);
  const [records, setRecords] = useState<TopupRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const summary = items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.is_active) {
        acc.active += 1;
      } else {
        acc.banned += 1;
      }
      acc.totalBalance += item.balance;
      acc.totalArrears += item.arrears_points;
      return acc;
    },
    { total: 0, active: 0, banned: 0, totalBalance: 0, totalArrears: 0 }
  );

  function formatTime(value?: string | null): string {
    if (!value) return "从未登录";
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  }

  async function loadUsers(targetPage = page) {
    try {
      const token = getAccessToken();
      if (!token) {
        setError("请先登录管理员账号");
        return;
      }
      const query = new URLSearchParams();
      if (emailKeyword.trim()) query.set("email", emailKeyword.trim());
      if (statusFilter !== "ALL") query.set("status", statusFilter);
      query.set("page", String(targetPage));
      query.set("page_size", String(pageSize));
      const data = await apiFetch<UserListResponse>(`/api/v1/admin/users?${query.toString()}`, { token });
      setItems(data.items);
      setPagination(data.pagination);
      setPage(data.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  useEffect(() => {
    void loadUsers(1);
  }, []);

  async function onTopup(userId: number) {
    const input = window.prompt("请输入充值积分（正整数）", "100");
    if (!input) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("充值金额必须是大于0的数字");
      return;
    }
    try {
      const token = getAccessToken();
      if (!token) {
        setError("请先登录管理员账号");
        return;
      }
      setLoadingId(userId);
      await apiFetch<{ ok: boolean }>(`/api/v1/admin/users/${userId}/topup`, {
        method: "POST",
        token,
        body: JSON.stringify({ amount }),
      });
      await loadUsers(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "充值失败");
    } finally {
      setLoadingId(null);
    }
  }

  async function onToggleBan(userId: number, currentActive: boolean) {
    const actionText = currentActive ? "封禁" : "解封";
    if (!window.confirm(`确认${actionText}该用户吗？`)) return;
    try {
      const token = getAccessToken();
      if (!token) {
        setError("请先登录管理员账号");
        return;
      }
      setLoadingId(userId);
      await apiFetch<{ ok: boolean }>(`/api/v1/admin/users/${userId}/ban`, {
        method: "POST",
        token,
        body: JSON.stringify({ is_active: !currentActive }),
      });
      await loadUsers(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${actionText}失败`);
    } finally {
      setLoadingId(null);
    }
  }

  async function onOpenRecords(user: UserItem) {
    try {
      const token = getAccessToken();
      if (!token) {
        setError("请先登录管理员账号");
        return;
      }
      setRecordUser(user);
      setRecordsLoading(true);
      const data = await apiFetch<TopupRecord[]>(`/api/v1/admin/users/${user.id}/topup-records`, { token });
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载充值记录失败");
    } finally {
      setRecordsLoading(false);
    }
  }

  return (
    <section className="card space-y-3">
      <h1 className="text-xl font-semibold">用户管理</h1>
      <p className="text-sm text-slate-500">支持邮箱查询、余额查看、管理员充值、账号封禁/解封。</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <input
          className="rounded border p-2 text-sm"
          placeholder="按邮箱关键词查询"
          value={emailKeyword}
          onChange={(event) => setEmailKeyword(event.target.value)}
        />
        <select className="rounded border p-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          <option value="ALL">全部状态</option>
          <option value="ACTIVE">正常</option>
          <option value="BANNED">封禁</option>
        </select>
        <select className="rounded border p-2 text-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
          <option value={20}>每页 20 条</option>
          <option value={50}>每页 50 条</option>
          <option value={100}>每页 100 条</option>
        </select>
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => void loadUsers(1)} type="button">
          查询
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <div className="rounded border bg-slate-50 p-3">
          <p className="text-xs text-slate-500">当前筛选总用户数</p>
          <p className="mt-1 text-lg font-semibold">{summary.total}</p>
        </div>
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">正常用户数</p>
          <p className="mt-1 text-lg font-semibold text-emerald-900">{summary.active}</p>
        </div>
        <div className="rounded border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs text-rose-700">封禁用户数</p>
          <p className="mt-1 text-lg font-semibold text-rose-900">{summary.banned}</p>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">总余额（可用）</p>
          <p className="mt-1 text-lg font-semibold text-amber-900">{summary.totalBalance}</p>
        </div>
        <div className="rounded border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs text-rose-700">总欠费</p>
          <p className="mt-1 text-lg font-semibold text-rose-900">{summary.totalArrears}</p>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li className="rounded border p-3" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                #{item.id} · {item.username} · {item.email}
              </p>
              <span className={item.is_active ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700" : "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700"}>
                {item.is_active ? "正常" : "已封禁"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 md:grid-cols-3">
              <p>角色：{item.role}</p>
              <p>可用余额：{item.balance} 积分</p>
              <p>冻结余额：{item.frozen} 积分</p>
              <p>欠费：{item.arrears_points} 积分</p>
              <p>最后登录：{formatTime(item.last_login_at)}</p>
              <p>注册时间：{formatTime(item.created_at)}</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                className="rounded border px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                disabled={loadingId === item.id}
                onClick={() => void onTopup(item.id)}
                type="button"
              >
                管理员充值
              </button>
              <button
                className="rounded border border-rose-300 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                disabled={loadingId === item.id}
                onClick={() => void onToggleBan(item.id, item.is_active)}
                type="button"
              >
                {item.is_active ? "封禁账号" : "解封账号"}
              </button>
              <button className="rounded border px-3 py-1 text-xs hover:bg-slate-50" onClick={() => void onOpenRecords(item)} type="button">
                充值记录
              </button>
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
            onClick={() => void loadUsers(pagination.page - 1)}
            type="button"
          >
            上一页
          </button>
          <button
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() => void loadUsers(pagination.page + 1)}
            type="button"
          >
            下一页
          </button>
        </div>
      </div>
      {recordUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={() => setRecordUser(null)}>
          <div className="w-full max-w-3xl rounded bg-white p-4" role="presentation" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                用户 #{recordUser.id} 充值记录
              </h2>
              <button className="rounded border px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setRecordUser(null)} type="button">
                关闭
              </button>
            </div>
            {recordsLoading ? <p className="text-sm text-slate-500">加载中...</p> : null}
            {!recordsLoading ? (
              <ul className="max-h-[60vh] space-y-2 overflow-auto">
                {records.map((record) => (
                  <li className="rounded border p-2 text-sm" key={record.id}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-700">+{record.amount} 积分</span>
                      <span className="text-xs text-slate-500">{formatTime(record.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">充值后余额：{record.balance_after}</p>
                    <p className="text-xs text-slate-600">
                      操作管理员：{record.admin_name ?? "--"}{record.admin_email ? ` (${record.admin_email})` : ""}
                    </p>
                  </li>
                ))}
                {!records.length ? <li className="text-sm text-slate-500">暂无充值记录</li> : null}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
