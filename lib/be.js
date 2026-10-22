import "server-only";
import { cookies } from "next/headers";

const BASE = process.env.BE_API_URL || "http://localhost:3000/api";
export const COOKIE = "dq_session";

export async function be(path, { method = "GET", token, body, service = false } = {}) {
  try {
    const res = await fetch(BASE + path, {
      method, cache: "no-store",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(service ? { "x-service-key": process.env.SERVICE_KEY || "" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 503, data: { error: "Backend be-web-learn tidak dapat dihubungi. Pastikan sudah berjalan dan BE_API_URL benar." } };
  }
}

export async function getToken() { return (await cookies()).get(COOKIE)?.value || null; }

export const cookieOpts = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7, secure: false };

// Tolak request lintas-origin untuk aksi yang mengubah state (perlindungan CSRF sederhana)
export function sameOrigin(req) {
  const o = req.headers.get("origin");
  return !o || new URL(o).host === req.headers.get("host");
}
