"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { defaultImageSizeOptions, normalizeImageSizeOptions, type ImageSizeOption } from "@/lib/imageSizes";

type VariableItem = {
  id: string;
  name: string;
  description: string;
  example_value: string;
};

type VariablePayload = {
  name: string;
  description: string;
  example_value: string;
};

type TemplateDetail = {
  id: number;
  category: string;
  title: string;
  content: string;
  variable_desc?: string | null;
  effect_image_url?: string | null;
  default_size: string;
  default_quality: string;
  variables: VariablePayload[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function resolveImageUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export default function AdminTemplateEditPage() {
  const params = useParams<{ id: string }>();
  const templateId = params?.id;

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [effectImageUrl, setEffectImageUrl] = useState("");
  const [sizeOptions, setSizeOptions] = useState<ImageSizeOption[]>(defaultImageSizeOptions);
  const [defaultSize, setDefaultSize] = useState("1024x1024");
  const [defaultQuality, setDefaultQuality] = useState<"low" | "medium" | "high">("medium");
  const [variables, setVariables] = useState<VariableItem[]>([{ id: crypto.randomUUID(), name: "", description: "", example_value: "" }]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) return;
      try {
        const token = getAccessToken();
        if (!token) throw new Error("请先登录管理员账号");
        const data = await apiFetch<TemplateDetail>(`/api/v1/admin/templates/${templateId}`, { token });
        setCategory(data.category);
        setTitle(data.title);
        setContent(data.content);
        setEffectImageUrl(data.effect_image_url ?? "");
        setDefaultSize(data.default_size);
        setDefaultQuality((data.default_quality as "low" | "medium" | "high") ?? "medium");
        setVariables(
          data.variables.length
            ? data.variables.map((item) => ({ ...item, id: crypto.randomUUID() }))
            : [{ id: crypto.randomUUID(), name: "", description: "", example_value: "" }]
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    void loadTemplate();
  }, [templateId]);

  useEffect(() => {
    async function loadImageSizes() {
      try {
        const token = getAccessToken();
        if (!token) return;
        const data = await apiFetch<{ options: ImageSizeOption[] }>("/api/v1/admin/settings/image-sizes", { token });
        setSizeOptions(normalizeImageSizeOptions(data.options));
      } catch {
        setSizeOptions(defaultImageSizeOptions);
      }
    }
    void loadImageSizes();
  }, []);

  function updateVariable(index: number, key: keyof VariableItem, value: string) {
    setVariables((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  }

  async function onUploadEffectImage(file: File | null) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("请先登录管理员账号");
      const form = new FormData();
      form.append("file", file);
      const data = await apiFetch<{ effect_image_url: string }>("/api/v1/admin/templates/upload-effect-image", {
        method: "POST",
        token,
        body: form
      });
      setEffectImageUrl(data.effect_image_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const token = getAccessToken();
      if (!token) throw new Error("请先登录管理员账号");
      await apiFetch<{ ok: boolean }>(`/api/v1/admin/templates/${templateId}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          category,
          title,
          content,
          effect_image_url: effectImageUrl,
          default_size: defaultSize,
          default_quality: defaultQuality,
          variables: variables.filter((item) => item.name && item.description)
        })
      });
      setSuccess("模板更新成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    }
  }

  if (loading) {
    return <section className="card text-sm text-slate-600">加载模板中...</section>;
  }

  return (
    <section className="card space-y-3">
      <h1 className="text-xl font-semibold">修改模板 #{templateId}</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input className="w-full rounded-md border p-2" placeholder="分类" value={category} onChange={(event) => setCategory(event.target.value)} />
        <input className="w-full rounded-md border p-2" placeholder="标题" value={title} onChange={(event) => setTitle(event.target.value)} />
        <textarea
          className="w-full rounded-md border p-2"
          placeholder="模板内容"
          rows={6}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <input
          className="w-full rounded-md border p-2"
          placeholder="效果图 URL（可选，可手动填）"
          value={effectImageUrl}
          onChange={(event) => setEffectImageUrl(event.target.value)}
        />
        <div className="space-y-2">
          <label className="block text-sm text-slate-600">上传效果图</label>
          <input
            accept=".jpg,.jpeg,.png,.webp"
            className="w-full rounded-md border p-2"
            type="file"
            onChange={(event) => void onUploadEffectImage(event.target.files?.[0] ?? null)}
          />
          {uploading ? <p className="text-xs text-slate-500">上传中...</p> : null}
          {effectImageUrl ? (
            <img alt="效果图预览" className="max-h-48 rounded border object-contain" src={resolveImageUrl(effectImageUrl)} />
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="w-full rounded-md border p-2"
            value={defaultSize}
            onChange={(event) => setDefaultSize(event.target.value)}
          >
            {sizeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-md border p-2"
            value={defaultQuality}
            onChange={(event) => setDefaultQuality(event.target.value as "low" | "medium" | "high")}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">变量说明</p>
          {variables.map((item, index) => (
            <div className="grid grid-cols-3 gap-2" key={item.id}>
              <input
                className="rounded-md border p-2"
                placeholder="变量名"
                value={item.name}
                onChange={(event) => updateVariable(index, "name", event.target.value)}
              />
              <input
                className="rounded-md border p-2"
                placeholder="变量说明"
                value={item.description}
                onChange={(event) => updateVariable(index, "description", event.target.value)}
              />
              <input
                className="rounded-md border p-2"
                placeholder="示例值"
                value={item.example_value}
                onChange={(event) => updateVariable(index, "example_value", event.target.value)}
              />
            </div>
          ))}
          <button
            className="rounded border px-3 py-1 text-sm"
            type="button"
            onClick={() => setVariables((prev) => [...prev, { id: crypto.randomUUID(), name: "", description: "", example_value: "" }])}
          >
            添加变量
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-green-700">{success}</p> : null}
        <button className="rounded-md bg-slate-900 px-4 py-2 text-white" type="submit">
          保存修改
        </button>
      </form>
    </section>
  );
}
