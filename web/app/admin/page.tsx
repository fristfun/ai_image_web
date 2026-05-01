 "use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import {
  defaultBillingRules,
  ensurePriceRowsForSizes,
  normalizeBillingRules,
  qualityKeys,
  type BillingRules,
  type Quality,
} from "@/lib/billingRules";
import { defaultImageSizeOptions, normalizeImageSizeOptions, type ImageSizeOption } from "@/lib/imageSizes";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function resolveImageUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
}

export default function AdminHomePage() {
  const [hintText, setHintText] = useState("");
  const [wechatQrUrl, setWechatQrUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrSaving, setQrSaving] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrSuccess, setQrSuccess] = useState("");
  const [sizeOptions, setSizeOptions] = useState<ImageSizeOption[]>(defaultImageSizeOptions);
  const [sizeSaving, setSizeSaving] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const [sizeSuccess, setSizeSuccess] = useState("");
  const [billingRules, setBillingRules] = useState<BillingRules>(defaultBillingRules);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingSuccess, setBillingSuccess] = useState("");
  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState("");
  const [openaiApiKeyMasked, setOpenaiApiKeyMasked] = useState("");
  const [openaiApiKeyConfigured, setOpenaiApiKeyConfigured] = useState(false);
  const [openaiApiKeySaving, setOpenaiApiKeySaving] = useState(false);
  const [openaiApiKeyError, setOpenaiApiKeyError] = useState("");
  const [openaiApiKeySuccess, setOpenaiApiKeySuccess] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const token = getAccessToken();
        if (!token) {
          setError("请先登录管理员账号");
          return;
        }
        const [hintData, qrData, sizeData, billingData, openaiApiKeyData] = await Promise.all([
          apiFetch<{ hint_text: string }>("/api/v1/admin/settings/generate-hint", { token }),
          apiFetch<{ qr_image_url: string }>("/api/v1/admin/settings/wechat-topup-qr", { token }),
          apiFetch<{ options: ImageSizeOption[] }>("/api/v1/admin/settings/image-sizes", { token }),
          apiFetch<{ rules: BillingRules }>("/api/v1/admin/settings/billing-rules", { token }),
          apiFetch<{ has_api_key: boolean; masked_api_key: string }>("/api/v1/admin/settings/openai-api-key", { token }),
        ]);
        setHintText(hintData.hint_text ?? "");
        setWechatQrUrl(qrData.qr_image_url ?? "");
        const normalizedSizes = normalizeImageSizeOptions(sizeData.options);
        setSizeOptions(normalizedSizes);
        setBillingRules(ensurePriceRowsForSizes(normalizeBillingRules(billingData.rules), normalizedSizes.map((item) => item.value)));
        setOpenaiApiKeyConfigured(Boolean(openaiApiKeyData.has_api_key));
        setOpenaiApiKeyMasked(openaiApiKeyData.masked_api_key ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      }
    }
    void loadSettings();
  }, []);

  async function saveHint() {
    try {
      const token = getAccessToken();
      if (!token) {
        setError("请先登录管理员账号");
        return;
      }
      setSaving(true);
      setError("");
      setSuccess("");
      await apiFetch<{ ok: boolean }>("/api/v1/admin/settings/generate-hint", {
        method: "PUT",
        token,
        body: JSON.stringify({ hint_text: hintText })
      });
      setSuccess("提示文案已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveWechatQr() {
    try {
      const token = getAccessToken();
      if (!token) {
        setQrError("请先登录管理员账号");
        return;
      }
      setQrSaving(true);
      setQrError("");
      setQrSuccess("");
      await apiFetch<{ ok: boolean }>("/api/v1/admin/settings/wechat-topup-qr", {
        method: "PUT",
        token,
        body: JSON.stringify({ qr_image_url: wechatQrUrl }),
      });
      setQrSuccess("微信充值二维码已保存");
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setQrSaving(false);
    }
  }

  async function onUploadWechatQr(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const token = getAccessToken();
      if (!token) {
        setQrError("请先登录管理员账号");
        return;
      }
      setQrUploading(true);
      setQrError("");
      setQrSuccess("");
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiFetch<{ qr_image_url: string }>("/api/v1/admin/settings/upload-wechat-topup-qr", {
        method: "POST",
        token,
        body: formData,
      });
      setWechatQrUrl(data.qr_image_url || "");
      setQrSuccess("二维码上传成功，请点击保存生效");
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setQrUploading(false);
      event.target.value = "";
    }
  }

  function updateSizeOption(index: number, key: keyof ImageSizeOption, value: string) {
    setSizeOptions((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  }

  function addSizeOption() {
    setSizeOptions((prev) => [...prev, { value: "", label: "" }]);
  }

  function removeSizeOption(index: number) {
    setSizeOptions((prev) => prev.filter((_, idx) => idx !== index));
  }

  function resetSizeOptions() {
    setSizeOptions(defaultImageSizeOptions);
    setSizeError("");
    setSizeSuccess("");
  }

  async function saveSizeOptions() {
    try {
      const token = getAccessToken();
      if (!token) {
        setSizeError("请先登录管理员账号");
        return;
      }
      const normalized = normalizeImageSizeOptions(sizeOptions);
      if (normalized.length !== sizeOptions.filter((item) => item.value.trim()).length) {
        setSizeError("存在无效或重复的尺寸配置，请检查后再保存");
        return;
      }
      setSizeSaving(true);
      setSizeError("");
      setSizeSuccess("");
      const data = await apiFetch<{ ok: boolean; options: ImageSizeOption[] }>("/api/v1/admin/settings/image-sizes", {
        method: "PUT",
        token,
        body: JSON.stringify({ options: normalized }),
      });
      const nextSizeOptions = normalizeImageSizeOptions(data.options);
      setSizeOptions(nextSizeOptions);
      setBillingRules((current) => ensurePriceRowsForSizes(current, nextSizeOptions.map((item) => item.value)));
      setSizeSuccess("图片尺寸配置已保存");
    } catch (err) {
      setSizeError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSizeSaving(false);
    }
  }

  function updateBillingMultiplier(value: string) {
    setBillingRules((prev) => ({
      ...prev,
      billing_cost_multiplier: Number(value),
    }));
  }

  function updateTokenPrice(key: keyof BillingRules["openai_token_prices_usd_per_1m"], value: string) {
    setBillingRules((prev) => ({
      ...prev,
      openai_token_prices_usd_per_1m: {
        ...prev.openai_token_prices_usd_per_1m,
        [key]: Number(value),
      },
    }));
  }

  function updateUsdPrice(size: string, quality: Quality, value: string) {
    setBillingRules((prev) => ({
      ...prev,
      usd_price_table: {
        ...prev.usd_price_table,
        [size]: {
          ...(prev.usd_price_table[size] ?? { low: 0, medium: 0, high: 0 }),
          [quality]: Number(value),
        },
      },
    }));
  }

  function resetBillingRules() {
    setBillingRules(ensurePriceRowsForSizes(defaultBillingRules, sizeOptions.map((item) => item.value)));
    setBillingError("");
    setBillingSuccess("");
  }

  async function saveBillingRules() {
    try {
      const token = getAccessToken();
      if (!token) {
        setBillingError("请先登录管理员账号");
        return;
      }
      const normalized = ensurePriceRowsForSizes(normalizeBillingRules(billingRules), sizeOptions.map((item) => item.value));
      setBillingSaving(true);
      setBillingError("");
      setBillingSuccess("");
      const data = await apiFetch<{ ok: boolean; rules: BillingRules }>("/api/v1/admin/settings/billing-rules", {
        method: "PUT",
        token,
        body: JSON.stringify({ rules: normalized }),
      });
      setBillingRules(ensurePriceRowsForSizes(normalizeBillingRules(data.rules), sizeOptions.map((item) => item.value)));
      setBillingSuccess("计费规则已保存");
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBillingSaving(false);
    }
  }

  async function saveOpenaiApiKey() {
    try {
      const token = getAccessToken();
      if (!token) {
        setOpenaiApiKeyError("请先登录管理员账号");
        return;
      }
      const apiKey = openaiApiKeyInput.trim();
      if (!apiKey) {
        setOpenaiApiKeyError("请输入新的 OpenAI API Key");
        return;
      }
      setOpenaiApiKeySaving(true);
      setOpenaiApiKeyError("");
      setOpenaiApiKeySuccess("");
      const data = await apiFetch<{ ok: boolean; has_api_key: boolean; masked_api_key: string }>("/api/v1/admin/settings/openai-api-key", {
        method: "PUT",
        token,
        body: JSON.stringify({ api_key: apiKey }),
      });
      setOpenaiApiKeyInput("");
      setOpenaiApiKeyConfigured(Boolean(data.has_api_key));
      setOpenaiApiKeyMasked(data.masked_api_key ?? "");
      setOpenaiApiKeySuccess("OpenAI API Key 已保存，下一次生成会立即使用新配置");
    } catch (err) {
      setOpenaiApiKeyError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setOpenaiApiKeySaving(false);
    }
  }

  return (
    <section className="card space-y-4">
      <h1 className="text-2xl font-bold">后台总览</h1>
      <p className="mt-2 text-sm text-slate-500">查看用户、订单、余额流水、生成记录和模板管理。</p>
      <div className="rounded border p-3">
        <h2 className="text-lg font-semibold">生成页提示文案</h2>
        <p className="mt-1 text-xs text-slate-500">该文案会显示在用户“生成图片”页面顶部，用于引导填写提示词。</p>
        <textarea
          className="mt-3 min-h-[120px] w-full rounded border p-2 text-sm"
          placeholder="例如：建议先描述主体、场景、光线，再补充风格和构图。"
          value={hintText}
          onChange={(event) => setHintText(event.target.value)}
        />
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={saving} onClick={() => void saveHint()} type="button">
            {saving ? "保存中..." : "保存提示文案"}
          </button>
          {success ? <span className="text-sm text-green-700">{success}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </div>
      <div className="rounded border p-3">
        <h2 className="text-lg font-semibold">微信充值二维码</h2>
        <p className="mt-1 text-xs text-slate-500">钱包页“微信充值”弹窗会展示此二维码，支持上传或手动填写图片地址。</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
          <input
            className="rounded border p-2 text-sm"
            placeholder="例如：uploads/settings/wechat-topup-qr/xxx.png 或 https://..."
            value={wechatQrUrl}
            onChange={(event) => setWechatQrUrl(event.target.value)}
          />
          <label className="inline-flex cursor-pointer items-center justify-center rounded border px-3 py-2 text-sm hover:bg-slate-50">
            {qrUploading ? "上传中..." : "上传二维码"}
            <input accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void onUploadWechatQr(event)} type="file" />
          </label>
        </div>
        {wechatQrUrl ? <img alt="微信充值二维码预览" className="mt-3 h-48 w-48 rounded border object-contain" src={resolveImageUrl(wechatQrUrl)} /> : null}
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={qrSaving} onClick={() => void saveWechatQr()} type="button">
            {qrSaving ? "保存中..." : "保存二维码配置"}
          </button>
          {qrSuccess ? <span className="text-sm text-green-700">{qrSuccess}</span> : null}
          {qrError ? <span className="text-sm text-red-600">{qrError}</span> : null}
        </div>
      </div>
      <div className="rounded border p-3">
        <h2 className="text-lg font-semibold">OpenAI API Key</h2>
        <p className="mt-1 text-xs text-slate-500">
          保存后后端会在下一次生成图片时使用新的 API Key。为安全起见，已保存的 Key 只展示脱敏结果。
        </p>
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
          当前状态：
          {openaiApiKeyConfigured ? (
            <span className="font-medium text-emerald-700"> 已配置（{openaiApiKeyMasked}）</span>
          ) : (
            <span className="font-medium text-amber-700"> 未在后台配置，将使用后端 .env 中的 OPENAI_API_KEY</span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
          <input
            className="rounded border p-2 text-sm"
            placeholder="输入新的 OpenAI API Key"
            type="password"
            value={openaiApiKeyInput}
            onChange={(event) => setOpenaiApiKeyInput(event.target.value)}
          />
          <button
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            disabled={openaiApiKeySaving}
            onClick={() => void saveOpenaiApiKey()}
            type="button"
          >
            {openaiApiKeySaving ? "保存中..." : "保存 API Key"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {openaiApiKeySuccess ? <span className="text-sm text-green-700">{openaiApiKeySuccess}</span> : null}
          {openaiApiKeyError ? <span className="text-sm text-red-600">{openaiApiKeyError}</span> : null}
        </div>
      </div>
      <div className="rounded border p-3">
        <h2 className="text-lg font-semibold">图片尺寸选项</h2>
        <p className="mt-1 text-xs text-slate-500">这里会控制用户生成页和模板默认尺寸里的可选项。value 使用 auto 或 宽x高，例如 1024x1536。</p>
        <div className="mt-3 space-y-2">
          {sizeOptions.map((item, index) => (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr_auto]" key={`${item.value}-${index}`}>
              <input
                className="rounded border p-2 text-sm"
                placeholder="auto 或 1024x1024"
                value={item.value}
                onChange={(event) => updateSizeOption(index, "value", event.target.value)}
              />
              <input
                className="rounded border p-2 text-sm"
                placeholder="展示文案"
                value={item.label}
                onChange={(event) => updateSizeOption(index, "label", event.target.value)}
              />
              <button className="rounded border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => removeSizeOption(index)} type="button">
                删除
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="rounded border px-3 py-2 text-sm hover:bg-slate-50" onClick={addSizeOption} type="button">
            添加尺寸
          </button>
          <button className="rounded border px-3 py-2 text-sm hover:bg-slate-50" onClick={resetSizeOptions} type="button">
            恢复默认清单
          </button>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={sizeSaving} onClick={() => void saveSizeOptions()} type="button">
            {sizeSaving ? "保存中..." : "保存尺寸配置"}
          </button>
          {sizeSuccess ? <span className="text-sm text-green-700">{sizeSuccess}</span> : null}
          {sizeError ? <span className="text-sm text-red-600">{sizeError}</span> : null}
        </div>
      </div>
      <div className="rounded border p-3">
        <h2 className="text-lg font-semibold">积分冻结与收费规则</h2>
        <p className="mt-1 text-xs text-slate-500">
          生成前冻结积分 = 尺寸/质量预估美元价 * 积分倍率 * 100。生成成功后优先按 OpenAI usage token 单价结算；没有 usage 时回退到同一张预估价格表。
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            积分倍率
            <input
              className="mt-1 w-full rounded border p-2 text-sm"
              min={0}
              step={0.01}
              type="number"
              value={billingRules.billing_cost_multiplier}
              onChange={(event) => updateBillingMultiplier(event.target.value)}
            />
          </label>
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            例：预估价 0.2 美元、倍率 10，则冻结 0.2 * 10 * 100 = 200 积分。
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">OpenAI usage token 单价（美元 / 100万 tokens）</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
            {[
              ["input_text", "输入文本"],
              ["input_image", "输入图片"],
              ["output_text", "输出文本"],
              ["output_image", "输出图片"],
            ].map(([key, label]) => (
              <label className="text-xs text-slate-600" key={key}>
                {label}
                <input
                  className="mt-1 w-full rounded border p-2 text-sm"
                  min={0}
                  step={0.01}
                  type="number"
                  value={billingRules.openai_token_prices_usd_per_1m[key as keyof BillingRules["openai_token_prices_usd_per_1m"]]}
                  onChange={(event) =>
                    updateTokenPrice(key as keyof BillingRules["openai_token_prices_usd_per_1m"], event.target.value)
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-sm font-medium text-slate-700">各尺寸预估美元价（用于冻结积分和 usage 缺失时的最终扣费）</p>
          <table className="min-w-full border text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="border p-2">尺寸</th>
                <th className="border p-2">low</th>
                <th className="border p-2">medium</th>
                <th className="border p-2">high</th>
              </tr>
            </thead>
            <tbody>
              {sizeOptions.map((item) => {
                const prices = billingRules.usd_price_table[item.value] ?? { low: 0, medium: 0, high: 0 };
                return (
                  <tr key={item.value}>
                    <td className="min-w-48 border p-2">
                      <div className="font-medium text-slate-800">{item.value}</div>
                      <div className="text-xs text-slate-500">{item.label}</div>
                    </td>
                    {qualityKeys().map((quality) => (
                      <td className="border p-2" key={quality}>
                        <input
                          className="w-28 rounded border p-1.5 text-sm"
                          min={0}
                          step={0.0001}
                          type="number"
                          value={prices[quality]}
                          onChange={(event) => updateUsdPrice(item.value, quality, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="rounded border px-3 py-2 text-sm hover:bg-slate-50" onClick={resetBillingRules} type="button">
            恢复默认计费
          </button>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={billingSaving} onClick={() => void saveBillingRules()} type="button">
            {billingSaving ? "保存中..." : "保存计费规则"}
          </button>
          {billingSuccess ? <span className="text-sm text-green-700">{billingSuccess}</span> : null}
          {billingError ? <span className="text-sm text-red-600">{billingError}</span> : null}
        </div>
      </div>
    </section>
  );
}
