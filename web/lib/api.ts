const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ApiOptions = RequestInit & {
  token?: string;
};

export async function apiFetch<T>(path: string, init?: ApiOptions): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init?.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new Error(`无法连接后端服务（${API_BASE}），请确认服务已启动且端口配置正确。`);
  }

  if (!response.ok) {
    let message = `API ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string; detail?: string };
      if (payload.message) {
        message = payload.message;
      } else if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}
