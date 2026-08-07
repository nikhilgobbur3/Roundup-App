import { getToken } from "../storage/secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

class ApiError extends Error {
  status: number | undefined;
  body: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const TIMEOUT_MS = 30_000;

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      throw new ApiError(
        (body as { message?: string })?.message ?? `HTTP ${res.status}`,
        res.status,
        body
      );
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};

export { ApiError };
