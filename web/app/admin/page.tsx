 "use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { getAccessToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

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

  useEffect(() => {
    async function loadSettings() {
      try {
        const token = getAccessToken();
        if (!token) {
          setError("请先登录管理员账号");
          return;
        }
        const [hintData, qrData] = await Promise.all([
          apiFetch<{ hint_text: string }>("/api/v1/admin/settings/generate-hint", { token }),
          apiFetch<{ qr_image_url: string }>("/api/v1/admin/settings/wechat-topup-qr", { token }),
        ]);
        setHintText(hintData.hint_text ?? "");
        setWechatQrUrl(qrData.qr_image_url ?? "");
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
    </section>
  );
}
