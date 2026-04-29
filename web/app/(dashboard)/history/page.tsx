"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type TaskItem = {
  id: number;
  prompt: string;
  size: string;
  quality: string;
  format: string;
  status: string;
  price_points: number;
  image_file_path?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function resolveImageUrl(filePath: string): string {
  const normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${API_BASE}${normalized}`;
}

function extractFileName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || "generated-image";
}

export default function HistoryPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const token = getAccessToken();
        if (!token) {
          setError("请先登录");
          return;
        }
        const resp = await apiFetch<TaskItem[]>("/api/v1/me/generations", { token });
        setTasks(resp);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      }
    }
    void run();
  }, []);

  async function onDownload(item: TaskItem) {
    if (!item.image_file_path) return;
    setDownloadingId(item.id);
    try {
      const imageUrl = resolveImageUrl(item.image_file_path);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("下载失败，请稍后重试");
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = extractFileName(item.image_file_path);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "下载失败");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">生成历史</h1>
      <div className="card">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <ul className="space-y-2 text-sm">
          {tasks.map((item) => (
            <li key={item.id} className="space-y-2 rounded border p-2">
              <p>任务 #{item.id}</p>
              <p>状态: {item.status}</p>
              <p className="break-all">
                参数: {item.size} / {item.quality} / {item.format}
              </p>
              <p>扣费: {item.price_points} 积分</p>
              {item.image_file_path ? (
                <div className="space-y-2">
                  <img
                    alt={`任务 ${item.id} 生成图`}
                    className="max-h-64 w-full rounded border object-contain"
                    src={resolveImageUrl(item.image_file_path)}
                  />
                  <button
                    className="w-full rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
                    disabled={downloadingId === item.id}
                    onClick={() => void onDownload(item)}
                    type="button"
                  >
                    {downloadingId === item.id ? "下载中..." : "重新下载"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">暂无生成图片文件。</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
