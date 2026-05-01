"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { defaultBillingRules, estimatePoints, normalizeBillingRules, type BillingRules } from "@/lib/billingRules";
import { defaultImageSizeOptions, normalizeImageSizeOptions, type ImageSizeOption } from "@/lib/imageSizes";

const qualities = ["low", "medium", "high"] as const;
const formats = ["webp", "png", "jpeg"] as const;
const imageModels = ["gpt-image-2"] as const;
const REFERENCE_SLOT_COUNT = 5;
const IMAGE_TAG_REGEX = /\{图片([1-5])\}/g;
const PROMPT_TAG_DISPLAY_SPLIT_REGEX = /(\{[^{}]+\})/g;

type GenerateResponse = {
  task_id: number;
  status: string;
  file_path: string;
  price_points: number;
  charged_points?: number;
  arrears_points?: number;
  actual_cost_usd?: number;
  model?: string;
};

type TemplateItem = {
  id: number;
  title?: string;
  content: string;
  variable_desc?: string | null;
  default_size: string;
  default_quality: string;
  variables?: Array<{
    name: string;
    description: string;
    example_value?: string;
  }>;
};

type TemplateVariableInput = {
  name: string;
  description: string;
  example_value?: string;
};

type WalletBrief = {
  arrears_points: number;
};

type PromptTagInput = {
  display_name: string;
  tag_name: string;
  value: string;
  kind: "TEXT" | "REFERENCE_IMAGE";
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

function isPromptTagSegment(segment: string): boolean {
  return /^\{[^{}]+\}$/.test(segment);
}

const qualityLabelMap: Record<(typeof qualities)[number], string> = {
  low: "一般质量",
  medium: "中等质量",
  high: "极致质量",
};

export default function GeneratePage() {
  const searchParams = useSearchParams();
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [sizeOptions, setSizeOptions] = useState<ImageSizeOption[]>(defaultImageSizeOptions);
  const [size, setSize] = useState("auto");
  const [quality, setQuality] = useState<(typeof qualities)[number]>("medium");
  const [format, setFormat] = useState<(typeof formats)[number]>("webp");
  const [model, setModel] = useState<(typeof imageModels)[number]>("gpt-image-2");
  const [visibleReferenceSlots, setVisibleReferenceSlots] = useState(1);
  const [referenceFiles, setReferenceFiles] = useState<Array<File | null>>(() => Array.from({ length: REFERENCE_SLOT_COUNT }, () => null));
  const [referencePreviews, setReferencePreviews] = useState<Array<string | null>>(
    () => Array.from({ length: REFERENCE_SLOT_COUNT }, () => null)
  );
  const [loading, setLoading] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [hintText, setHintText] = useState("");
  const [billingRules, setBillingRules] = useState<BillingRules>(defaultBillingRules);
  const [arrearsPoints, setArrearsPoints] = useState(0);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateVariables, setTemplateVariables] = useState<TemplateVariableInput[]>([]);
  const [promptTagInputs, setPromptTagInputs] = useState<PromptTagInput[]>([]);
  const estimatedPoints = estimatePoints(size, quality, billingRules);

  function findTemplateVariableByTag(tagName: string): TemplateVariableInput | undefined {
    const normalizedTag = tagName.trim();
    return templateVariables.find((item) => {
      if (item.name.trim() === normalizedTag) return true;
      if ((item.example_value ?? "").trim() === normalizedTag) return true;
      return false;
    });
  }

  function applyPromptTagValues(rawPrompt: string): string {
    if (!promptTagInputs.length) return rawPrompt;
    let nextPrompt = rawPrompt;
    promptTagInputs.forEach((item) => {
      if (item.kind !== "TEXT") return;
      const value = item.value.trim();
      if (!value) return;
      const wrappedValue = `{${value}}`;
      const escapedName = item.tag_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const bracePattern = new RegExp(`\\{${escapedName}\\}`, "g");
      const doubleBracePattern = new RegExp(`\\{\\{${escapedName}\\}\\}`, "g");
      nextPrompt = nextPrompt.replace(bracePattern, wrappedValue).replace(doubleBracePattern, wrappedValue);
    });
    return nextPrompt;
  }

  function replacePromptTagInText(rawPrompt: string, tagName: string, nextValue: string): string {
    const value = nextValue.trim();
    if (!value) return rawPrompt;
    const wrappedValue = `{${value}}`;
    const escapedName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bracePattern = new RegExp(`\\{${escapedName}\\}`, "g");
    const doubleBracePattern = new RegExp(`\\{\\{${escapedName}\\}\\}`, "g");
    return rawPrompt.replace(bracePattern, wrappedValue).replace(doubleBracePattern, wrappedValue);
  }

  function confirmTagValueToPrompt(tag: PromptTagInput) {
    const nextTagName = tag.value.trim();
    if (!nextTagName) return;
    setPrompt((prevPrompt) => replacePromptTagInText(prevPrompt, tag.tag_name, tag.value));
    if (tag.kind === "TEXT") {
      setPromptTagInputs((prev) =>
        prev.map((item) => (item.display_name === tag.display_name ? { ...item, tag_name: nextTagName } : item))
      );
    }
  }

  function renderPromptTagButtons(rawPrompt: string) {
    return rawPrompt
      .split(PROMPT_TAG_DISPLAY_SPLIT_REGEX)
      .filter((segment) => segment.length > 0)
      .map((segment, index) =>
        isPromptTagSegment(segment) ? (
          <button
            className="mx-0.5 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"
            key={`tag-${index}-${segment}`}
            type="button"
          >
            {segment}
          </button>
        ) : (
          <span className="text-slate-600" key={`text-${index}`}>
            {segment}
          </span>
        )
      );
  }

  function buildPromptWithReferenceBindings(rawPrompt: string): string {
    const matches = Array.from(rawPrompt.matchAll(IMAGE_TAG_REGEX));
    if (!matches.length) return rawPrompt;

    const requiredSlots = Array.from(new Set(matches.map((match) => Number(match[1])))).sort((a, b) => a - b);
    const missingSlots = requiredSlots.filter((slot) => !referenceFiles[slot - 1]);
    if (missingSlots.length) {
      throw new Error(
        `提示词中引用了 ${missingSlots.map((slot) => `{图片${slot}}`).join("、")}，请先上传对应的参考图。`
      );
    }

    const mappingText = requiredSlots
      .map((slot) => `- {图片${slot}} 对应第${slot}张上传参考图`)
      .join("\n");

    return `${rawPrompt}\n\n参考图标签绑定规则（请严格按此理解）：\n${mappingText}`;
  }

  useEffect(() => {
    return () => {
      referencePreviews.forEach((preview) => {
        if (preview) {
          window.URL.revokeObjectURL(preview);
        }
      });
    };
  }, [referencePreviews]);

  useEffect(() => {
    const TAG_REGEX = /\{([^{}]+)\}/g;
    const names: string[] = [];
    for (const match of prompt.matchAll(TAG_REGEX)) {
      const name = match[1].trim();
      if (!name) continue;
      if (!names.includes(name)) names.push(name);
    }

    const templateExampleMap = new Map(templateVariables.map((item) => [item.name, item.example_value ?? ""]));
    setPromptTagInputs((prev) => {
      const prevMapByTag = new Map(prev.map((item) => [item.tag_name, item]));
      return names.map((name) => {
        const kind: PromptTagInput["kind"] = /^图片[1-5]$/.test(name) ? "REFERENCE_IMAGE" : "TEXT";
        const templateVar = kind === "TEXT" ? findTemplateVariableByTag(name) : undefined;
        const displayName = templateVar?.name ?? name;
        const previous = prevMapByTag.get(name);
        if (previous) {
          return { ...previous, kind, display_name: displayName };
        }
        const fromPreviousValue = prev.find((item) => item.kind === "TEXT" && item.value.trim() === name);
        if (fromPreviousValue) {
          // Keep a stable display name (e.g. 年龄) even when tag value changes (e.g. {29} -> {35}).
          return { ...fromPreviousValue, display_name: fromPreviousValue.display_name, tag_name: name, kind };
        }
        return {
          display_name: displayName,
          tag_name: name,
          kind,
          value: kind === "TEXT" ? templateExampleMap.get(displayName) ?? "" : "",
        };
      });
    });
  }, [prompt, templateVariables]);

  useEffect(() => {
    async function loadHintAndWallet() {
      try {
        const token = getAccessToken();
        if (!token) return;
        const [hintData, walletData, billingData] = await Promise.all([
          apiFetch<{ hint_text: string; billing_cost_multiplier?: number }>("/api/v1/settings/generate-hint", { token }),
          apiFetch<WalletBrief>("/api/v1/me/wallet?page=1&page_size=1", { token }),
          apiFetch<{ rules: BillingRules }>("/api/v1/settings/billing-rules", { token }),
        ]);
        setHintText(hintData.hint_text ?? "");
        setBillingRules(normalizeBillingRules(billingData.rules));
        setArrearsPoints(walletData.arrears_points ?? 0);
      } catch {
        // ignore failures to avoid blocking generation flow
      }
    }
    void loadHintAndWallet();
  }, []);

  useEffect(() => {
    async function loadImageSizes() {
      try {
        const token = getAccessToken();
        if (!token) return;
        const data = await apiFetch<{ options: ImageSizeOption[] }>("/api/v1/settings/image-sizes", { token });
        const options = normalizeImageSizeOptions(data.options);
        setSizeOptions(options);
        setSize((current) => (options.some((item) => item.value === current) ? current : options[0]?.value ?? "auto"));
      } catch {
        setSizeOptions(defaultImageSizeOptions);
      }
    }
    void loadImageSizes();
  }, []);

  useEffect(() => {
    async function loadTemplateFromQuery() {
      const templateId = searchParams.get("templateId");
      if (!templateId) {
        setTemplateTitle("");
        setTemplateVariables([]);
        return;
      }
      try {
        const token = getAccessToken();
        if (!token) return;
        const data = await apiFetch<TemplateItem>(`/api/v1/templates/${templateId}`, { token });
        setPrompt(data.content);
        setTemplateTitle(data.title ?? "");
        setTemplateVariables(
          Array.isArray(data.variables)
            ? data.variables.map((item) => ({
                name: item.name,
                description: item.description,
                example_value: item.example_value,
              }))
            : []
        );
        if (sizeOptions.some((item) => item.value === data.default_size)) {
          setSize(data.default_size);
        }
        if (qualities.includes(data.default_quality as (typeof qualities)[number])) {
          setQuality(data.default_quality as (typeof qualities)[number]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "模板加载失败");
      }
    }
    void loadTemplateFromQuery();
  }, [searchParams, sizeOptions]);

  useEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [prompt]);

  useEffect(() => {
    if (!loading) {
      return;
    }
    setGenerationSeconds(0);
    const timer = window.setInterval(() => {
      setGenerationSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  function onReferenceChange(index: number, file: File | null) {
    setReferenceFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    setReferencePreviews((prev) => {
      const next = [...prev];
      if (next[index]) {
        window.URL.revokeObjectURL(next[index]!);
      }
      next[index] = file ? window.URL.createObjectURL(file) : null;
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error("请先登录");
      }

      const formData = new FormData();
      const promptWithValues = applyPromptTagValues(prompt);
      const boundPrompt = buildPromptWithReferenceBindings(promptWithValues);
      formData.append("prompt", boundPrompt);
      formData.append("size", size);
      formData.append("quality", quality);
      formData.append("output_format", format);
      formData.append("model", model);

      referenceFiles.forEach((file, index) => {
        if (file) {
          // Keep slot index in uploaded filename to strengthen model-side association.
          formData.append("reference_images", file, `slot${index + 1}__${file.name}`);
        }
      });

      const data = await apiFetch<GenerateResponse>("/api/v1/generations", {
        method: "POST",
        body: formData,
        token
      });
      setResult(data);
      if ((data.arrears_points ?? 0) > 0) {
        setArrearsPoints(data.arrears_points ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function onDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const imageUrl = resolveImageUrl(result.file_path);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("下载失败，请稍后重试");
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = extractFileName(result.file_path);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "下载失败");
    } finally {
      setDownloading(false);
    }
  }

  const textTagInputs = promptTagInputs.filter((item) => item.kind === "TEXT");
  const uploadedReferenceCount = referenceFiles.filter(Boolean).length;
  const referencedSlots = promptTagInputs
    .filter((item) => item.kind === "REFERENCE_IMAGE")
    .map((item) => Number(item.display_name.replace("图片", "")))
    .filter((slot) => Number.isFinite(slot) && slot >= 1 && slot <= REFERENCE_SLOT_COUNT);
  const requiredReferenceSlotCount = referencedSlots.length ? Math.max(...referencedSlots) : 0;
  const lastUploadedReferenceIndex = referenceFiles.reduce((lastIndex, file, index) => (file ? index : lastIndex), -1);
  const minimumVisibleReferenceSlots = Math.max(1, requiredReferenceSlotCount, lastUploadedReferenceIndex + 1);
  const displayedReferenceSlotCount = Math.min(
    REFERENCE_SLOT_COUNT,
    Math.max(visibleReferenceSlots, minimumVisibleReferenceSlots)
  );
  const canAddReferenceSlot = displayedReferenceSlotCount < REFERENCE_SLOT_COUNT;
  const hasPrompt = prompt.trim().length > 0;
  const canGenerate = hasPrompt && arrearsPoints <= 0 && !loading;
  const waitHint =
    generationSeconds < 20
      ? "图片正在生成，请保持页面打开"
      : generationSeconds < 60
        ? "高清图片可能需要更久一点，系统仍在处理中"
        : "仍在等待服务返回结果，请不要重复提交";
  const stepStatus = [
    textTagInputs.length === 0 || textTagInputs.every((item) => item.value.trim()),
    true, // reference image is optional
    hasPrompt,
    true, // size / quality / format always have defaults
    true, // model always has default
    canGenerate,
  ];

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">生成图片</h1>
        <p className="mt-1 text-sm text-slate-500">按顺序填写信息，最后确认生成</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {[
            "模板变量与标签",
            "参考图（可选）",
            "提示词",
            "尺寸质量格式",
            "模型",
            "确认生成",
          ].map((label, index) => (
            <div
              className={`rounded-lg border px-2 py-2 text-center text-xs font-medium ${
                stepStatus[index]
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
              key={label}
            >
              <span className="mr-1 font-semibold">{index + 1}.</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {hintText ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <p className="mb-1 font-medium">使用提示</p>
          <p className="whitespace-pre-wrap">{hintText}</p>
        </div>
      ) : null}
      <form className="card space-y-3" onSubmit={onSubmit}>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-800">步骤1：模板提示词参数</p>
            <span className="text-xs text-slate-500">{templateTitle ? `模板：${templateTitle}` : "未使用模板"}</span>
          </div>
          {promptTagInputs.length ? (
            <>
              <p className="text-xs text-slate-500">
                来自提示词中的 {"{}"} 标签。文本标签输入后失焦会自动写入提示词；参考图标签会在步骤 2 自动绑定。
              </p>
              <div className="space-y-2">
                {promptTagInputs.map((item) => {
                  const matchedTemplateVar = item.kind === "TEXT" ? findTemplateVariableByTag(item.tag_name) : undefined;
                  if (item.kind === "REFERENCE_IMAGE") {
                    const slot = Number(item.display_name.replace("图片", ""));
                    const uploaded = Number.isFinite(slot) && !!referenceFiles[slot - 1];
                    return (
                      <div className="rounded border border-violet-200 bg-violet-50 p-2" key={item.display_name}>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr]">
                        <span className="inline-flex w-fit items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">
                            {`{${item.display_name}}`}
                          </span>
                          <p className={uploaded ? "text-xs text-emerald-700" : "text-xs text-amber-700"}>
                            {uploaded
                              ? `这是“第 ${slot} 张参考图”占位标签，当前已绑定成功。`
                              : `这是“第 ${slot} 张参考图”占位标签，可在步骤 2 上传对应图片。`}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="rounded border border-slate-200 bg-white p-2" key={item.display_name}>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr]">
                        <span className="inline-flex w-fit items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
                          {`{${item.display_name}}`}
                        </span>
                        <div className="space-y-1">
                          {matchedTemplateVar?.description ? (
                            <p className="text-xs text-slate-600">说明：{matchedTemplateVar.description}</p>
                          ) : (
                            <p className="text-xs text-slate-500">请填写这个标签在提示词中的具体内容。</p>
                          )}
                          {matchedTemplateVar?.example_value ? <p className="text-xs text-slate-500">示例：{matchedTemplateVar.example_value}</p> : null}
                        </div>
                      </div>
                      <input
                        className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
                        placeholder={matchedTemplateVar?.example_value ? `例如：${matchedTemplateVar.example_value}` : `请输入 ${item.display_name}`}
                        value={item.value}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setPromptTagInputs((prev) =>
                            prev.map((it) => (it.display_name === item.display_name ? { ...it, value: nextValue } : it))
                          );
                        }}
                        onBlur={(event) => confirmTagValueToPrompt({ ...item, value: event.target.value })}
                      />
                      <p className="mt-2 text-xs text-slate-500">输入框失焦后会自动同步更新到提示词</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">当前提示词未检测到标签参数，可直接进入下一步。</p>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <label className="block text-sm font-medium text-slate-800">步骤 2：参考图（可选，0-5 张，单图 &lt;= 10MB）</label>
            <span className="text-xs text-slate-500">
              已上传 {uploadedReferenceCount}/5 · 当前显示 {displayedReferenceSlotCount} 个槽位
            </span>
          </div>
          <p className="text-xs text-slate-500">没有参考图需求可不上传，系统会仅基于提示词生成。</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: displayedReferenceSlotCount }, (_, index) => {
              const slotName = `图片${index + 1}`;
              const inputId = `reference-input-${index}`;
              const preview = referencePreviews[index];
              return (
                <div key={slotName} className="rounded-md border bg-white p-2">
                  <p className="mb-2 text-xs text-slate-600">{slotName}</p>
                  <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded border bg-slate-50 p-1">
                    {preview ? (
                      <img alt={slotName} className="h-full w-full object-contain" src={preview} />
                    ) : (
                      <span className="text-xs text-slate-400">暂无图片</span>
                    )}
                  </div>
                  <input
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    id={inputId}
                    type="file"
                    onChange={(event) => onReferenceChange(index, event.target.files?.[0] ?? null)}
                  />
                  <label className="mb-2 block cursor-pointer rounded border px-2 py-1 text-center text-xs font-medium hover:bg-slate-50" htmlFor={inputId}>
                    {referenceFiles[index] ? "更换" : "添加"}
                  </label>
                  <button
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!referenceFiles[index]}
                    onClick={() => onReferenceChange(index, null)}
                    type="button"
                  >
                    清空
                  </button>
                </div>
              );
            })}
            {canAddReferenceSlot ? (
              <div className="rounded-md border bg-white p-2">
                <p className="mb-2 text-xs text-slate-400">新增</p>
                <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded border bg-slate-50 p-1">
                  <button
                    className="flex h-16 w-16 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    onClick={() => setVisibleReferenceSlots((prev) => Math.min(REFERENCE_SLOT_COUNT, prev + 1))}
                    type="button"
                  >
                    <span className="text-lg leading-none">+</span>
                    <span className="mt-1 text-[10px]">添加</span>
                  </button>
                </div>
                <p className="text-center text-xs text-slate-400">添加参考图</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-sm font-medium text-slate-800">步骤 3：提示词</p>
          {prompt.includes("{") && prompt.includes("}") ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-2">
              <p className="text-xs font-medium text-sky-700">标签高亮预览</p>
              <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{renderPromptTagButtons(prompt)}</div>
            </div>
          ) : null}
          <textarea
            ref={promptRef}
            className="min-h-[180px] w-full resize-none overflow-hidden rounded-md border bg-white p-3 text-sm leading-6 text-slate-800 placeholder:text-slate-400"
            placeholder="输入提示词..."
            rows={8}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-sm font-medium text-slate-800">步骤 4：选择尺寸、质量和输出格式</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select className="rounded-md border bg-white p-2 text-sm text-slate-800" value={size} onChange={(event) => setSize(event.target.value)}>
              {sizeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-white p-2 text-sm text-slate-800"
              value={quality}
              onChange={(event) => setQuality(event.target.value as (typeof qualities)[number])}
            >
              {qualities.map((quality) => (
                <option key={quality} value={quality}>
                  {qualityLabelMap[quality]}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-white p-2 text-sm text-slate-800"
              value={format}
              onChange={(event) => setFormat(event.target.value as (typeof formats)[number])}
            >
              {formats.map((format) => (
                <option key={format}>{format}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-sm font-medium text-slate-800">步骤 5：选择模型</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              生图模型
              <select
                className="mt-1 w-full rounded-md border bg-white p-2 text-sm text-slate-800"
                value={model}
                onChange={(event) => setModel(event.target.value as (typeof imageModels)[number])}
              >
                {imageModels.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-600">
              当前将使用模型：<span className="font-medium text-slate-900">{model}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-900 bg-slate-900 p-4 text-white">
          <p className="text-sm font-medium">步骤 6：确认生成</p>
          <div className="grid grid-cols-1 gap-2 text-sm text-slate-100 md:grid-cols-2">
            <p>提示词：{hasPrompt ? "已填写" : "未填写"}</p>
            <p>参考图：{uploadedReferenceCount > 0 ? `${uploadedReferenceCount} 张` : "未上传（可选）"}</p>
            <p>参数：{size} / {qualityLabelMap[quality]} / {format}</p>
            <p>模型：{model}</p>
          </div>
          <p className="text-sm text-slate-100">预计消耗积分：{estimatedPoints}</p>
          {arrearsPoints > 0 ? (
            <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
              当前账户存在欠费 {arrearsPoints} 积分，请先到钱包页充值结清后再生成。
            </p>
          ) : null}
          {error ? <p className="text-sm text-rose-200">{error}</p> : null}
          <button
            className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            disabled={!canGenerate}
            type="submit"
          >
            {loading ? "生成中..." : "确认生成 1 张图片"}
          </button>
        </div>
      </form>
      <div className="card">
        <h2 className="mb-2 text-base font-semibold text-slate-900">结果预览</h2>
        {loading ? (
          <div className="space-y-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-sky-950">正在生成图片</p>
                <p className="mt-1 text-sky-700">{waitHint}</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-sky-800 shadow-sm">
                已等待 {generationSeconds} 秒
              </div>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-sky-100">
              <div className="absolute inset-y-0 left-0 w-1/3 animate-[loading-bar_1.4s_ease-in-out_infinite] rounded-full bg-sky-500" />
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-sky-700 sm:grid-cols-3">
              <div className="rounded border border-sky-100 bg-white/70 p-2">正在提交参数与参考图</div>
              <div className="rounded border border-sky-100 bg-white/70 p-2">模型生成中，请耐心等待</div>
              <div className="rounded border border-sky-100 bg-white/70 p-2">完成后会自动展示结果</div>
            </div>
            <style jsx>{`
              @keyframes loading-bar {
                0% {
                  transform: translateX(-110%);
                }
                50% {
                  transform: translateX(110%);
                }
                100% {
                  transform: translateX(330%);
                }
              }
            `}</style>
          </div>
        ) : result ? (
          <div className="space-y-2 text-sm text-slate-700">
            <p>任务 ID: {result.task_id}</p>
            <p>状态: {result.status}</p>
            <p>生图模型: {result.model ?? model}</p>
            <p>实际消耗积分: {result.price_points}</p>
            <p>本次实际扣除积分: {result.charged_points ?? result.price_points}</p>
            {(result.arrears_points ?? 0) > 0 ? <p className="text-rose-700">本次新增欠费: {result.arrears_points} 积分</p> : null}
            <img
              alt="生成结果"
              className="max-h-[520px] w-full rounded-md border object-contain"
              src={resolveImageUrl(result.file_path)}
            />
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={downloading}
              onClick={onDownload}
              type="button"
            >
              {downloading ? "下载中..." : "下载保存"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">生成后在这里展示图片与任务状态。</p>
        )}
      </div>
    </section>
  );
}
