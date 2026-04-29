"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type WalletResponse = {
  balance: number;
  frozen: number;
  arrears_points: number;
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  ledger: Array<{
    id: number;
    type: string;
    amount: number;
    balance_after: number;
    created_at: string;
  }>;
};

type WechatTopupQrResponse = {
  qr_image_url: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const ledgerTypeLabel: Record<string, string> = {
  TOPUP: "充值",
  FREEZE: "冻结",
  CAPTURE: "扣费",
  RELEASE: "解冻返还",
  REFUND: "退款",
  ARREARS_INCUR: "欠费记账",
  ARREARS_SETTLE: "欠费结清",
};

function formatLedgerType(type: string): string {
  return ledgerTypeLabel[type] ?? type;
}

function formatAmount(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function resolveImageUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
}

export default function WalletPage() {
  const [data, setData] = useState<WalletResponse | null>(null);
  const [error, setError] = useState("");
  const [wechatQrUrl, setWechatQrUrl] = useState("");
  const [showWechatModal, setShowWechatModal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  async function loadWallet(targetPage?: number) {
    try {
      const token = getAccessToken();
      if (!token) {
        setError("请先登录");
        return;
      }
      const query = new URLSearchParams();
      query.set("page", String(targetPage ?? page));
      query.set("page_size", String(pageSize));
      if (startTime) query.set("start_time", startTime);
      if (endTime) query.set("end_time", endTime);
      const resp = await apiFetch<WalletResponse>(`/api/v1/me/wallet?${query.toString()}`, { token });
      setData(resp);
      setPage(resp.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function loadWechatTopupQr() {
    try {
      const token = getAccessToken();
      if (!token) return;
      const resp = await apiFetch<WechatTopupQrResponse>("/api/v1/settings/wechat-topup-qr", { token });
      setWechatQrUrl(resp.qr_image_url || "");
    } catch {
      setWechatQrUrl("");
    }
  }

  useEffect(() => {
    void loadWallet(1);
    void loadWechatTopupQr();
  }, [pageSize]);

  async function onSearch() {
    setError("");
    await loadWallet(1);
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">钱包</h1>
      <div className="card space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">可用余额</p>
            <p className="mt-1 text-xl font-semibold text-emerald-900">{data?.balance ?? "--"} 积分</p>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-700">冻结余额</p>
            <p className="mt-1 text-xl font-semibold text-amber-900">{data?.frozen ?? "--"} 积分</p>
          </div>
          <div className="rounded border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-700">欠费金额</p>
            <p className="mt-1 text-xl font-semibold text-rose-900">{data?.arrears_points ?? "--"} 积分</p>
          </div>
        </div>
        {(data?.arrears_points ?? 0) > 0 ? (
          <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">当前存在欠费，需先充值结清后才能继续生成图片。</p>
        ) : null}
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <button
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            onClick={() => setShowWechatModal(true)}
            type="button"
          >
            微信充值
          </button>
          <p className="text-xs text-slate-500">点击后扫码添加微信进行充值</p>
        </div>
        <div className="rounded border p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">流水查询</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              className="rounded border p-2 text-sm"
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
            <input
              className="rounded border p-2 text-sm"
              type="datetime-local"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
            <select className="rounded border p-2 text-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>每页 10 条</option>
              <option value={20}>每页 20 条</option>
              <option value={50}>每页 50 条</option>
            </select>
            <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => void onSearch()} type="button">
              查询
            </button>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">流水明细</p>
            <p className="text-xs text-slate-500">
              共 {data?.pagination.total ?? 0} 条 / 第 {data?.pagination.page ?? 1} 页
            </p>
          </div>
          <ul className="mt-2 space-y-2">
            {(data?.ledger ?? []).map((item) => (
              <li className="rounded border p-2 text-sm" key={item.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{formatLedgerType(item.type)}</span>
                  <span className={item.amount >= 0 ? "font-medium text-emerald-600" : "font-medium text-rose-600"}>
                    {formatAmount(item.amount)} 积分
                  </span>
                </div>
                <div className="mt-1 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>变动后余额：{item.balance_after}</span>
                  <span>{formatTime(item.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button
              className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={(data?.pagination.page ?? 1) <= 1}
              onClick={() => void loadWallet((data?.pagination.page ?? 1) - 1)}
              type="button"
            >
              上一页
            </button>
            <button
              className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={(data?.pagination.page ?? 1) >= (data?.pagination.total_pages ?? 0)}
              onClick={() => void loadWallet((data?.pagination.page ?? 1) + 1)}
              type="button"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
      {showWechatModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">微信充值</h2>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => setShowWechatModal(false)} type="button">
                关闭
              </button>
            </div>
            {wechatQrUrl ? (
              <div className="mt-3">
                <img alt="微信充值二维码" className="mx-auto aspect-square w-full max-w-[18rem] rounded border object-contain" src={resolveImageUrl(wechatQrUrl)} />
                <p className="mt-2 text-center text-xs text-slate-500">请使用微信扫一扫，添加后备注“充值”</p>
              </div>
            ) : (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">暂未配置微信二维码，请联系管理员。</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
