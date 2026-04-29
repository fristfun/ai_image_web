"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type TemplateItem = {
  id: number;
  category: string;
  title: string;
  content: string;
  variable_desc?: string | null;
  effect_image_url?: string | null;
  default_size: string;
  default_quality: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function resolveEffectImage(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE}${normalized}`;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [primaryCategories, setPrimaryCategories] = useState<string[]>([]);
  const [selectedPrimaryCategory, setSelectedPrimaryCategory] = useState<string>("all");
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const token = getAccessToken();
        if (!token) {
          setError("请先登录");
          return;
        }
        const data = await apiFetch<TemplateItem[]>("/api/v1/templates", { token });
        const categories = Array.from(new Set(data.map((item) => item.category).filter(Boolean)));
        setPrimaryCategories(categories);
      } catch (err) {
        setError(err instanceof Error ? err.message : "模板加载失败");
      }
    }
    void run();
  }, []);

  useEffect(() => {
    async function run() {
      try {
        setLoading(true);
        setError("");
        const token = getAccessToken();
        if (!token) {
          setError("请先登录");
          return;
        }
        const params = new URLSearchParams();
        if (selectedPrimaryCategory !== "all") {
          params.set("primary_category", selectedPrimaryCategory);
        }
        const path = params.size ? `/api/v1/templates?${params.toString()}` : "/api/v1/templates";
        const data = await apiFetch<TemplateItem[]>(path, { token });
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "模板加载失败");
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [selectedPrimaryCategory]);

  function useTemplate(templateId: number) {
    router.push(`/generate?templateId=${templateId}`);
  }

  const categoryOptions = [{ value: "all", label: "全部" }, ...primaryCategories.map((category) => ({ value: category, label: category }))];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">模板库</h1>
            <p className="mt-1 text-sm text-slate-500">按一级分类快速筛选模板</p>
          </div>
          <div className="w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
            {selectedPrimaryCategory === "all" ? "全部分类" : selectedPrimaryCategory} · {items.length} 个模板
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">一级分类</p>
          <select
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 md:hidden"
            value={selectedPrimaryCategory}
            onChange={(event) => setSelectedPrimaryCategory(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden flex-wrap gap-2 md:flex">
          {categoryOptions.map((option) => (
            <button
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                selectedPrimaryCategory === option.value
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
              key={option.value}
              onClick={() => setSelectedPrimaryCategory(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">模板加载中...</div>
        ) : null}
        {!loading && items.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={item.id}>
                <div className="aspect-video bg-slate-100 p-2">
                  {resolveEffectImage(item.effect_image_url) ? (
                    <button
                      className="h-full w-full"
                      onClick={() =>
                        setPreviewImage({
                          url: resolveEffectImage(item.effect_image_url) ?? "",
                          title: item.title
                        })
                      }
                      type="button"
                    >
                      <img
                        alt={`${item.title} 效果图`}
                        className="h-full w-full rounded object-contain"
                        src={resolveEffectImage(item.effect_image_url) ?? ""}
                      />
                    </button>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">暂无效果图</div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <p className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.category}</p>
                  <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                  <p className="line-clamp-3 text-sm text-slate-600">{item.content}</p>
                  {item.variable_desc ? <p className="text-xs text-slate-500">变量：{item.variable_desc}</p> : null}
                  <p className="text-xs text-slate-500">
                    默认参数：{item.default_size} / {item.default_quality}
                  </p>
                  <button className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" onClick={() => useTemplate(item.id)} type="button">
                    使用此模板
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {!loading && !items.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            当前分类暂无模板，请先在后台创建并配置效果图。
          </div>
        ) : null}
      </div>
      {previewImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImage(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl rounded bg-white p-3"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="pr-2 text-sm font-medium">{previewImage.title} - 效果图预览</p>
              <button className="rounded border px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setPreviewImage(null)} type="button">
                关闭
              </button>
            </div>
            <img alt={`${previewImage.title} 高清效果图`} className="max-h-[78vh] w-full object-contain" src={previewImage.url} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
