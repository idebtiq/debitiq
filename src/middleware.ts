import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const adminCookieName = "debtiq_admin_session";

async function hmacSha256Hex(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isValidAdminSession(value?: string) {
  const expectedUsername = process.env.ADMIN_USERNAME || "";
  const expectedPassword = process.env.ADMIN_PASSWORD || "";

  if (!value || !expectedUsername || !expectedPassword) return false;

  const [username, issuedAt, signature] = value.split(".");
  if (!username || !issuedAt || !signature || username !== expectedUsername) return false;

  const payload = `${username}.${issuedAt}`;
  return signature === (await hmacSha256Hex(payload, expectedPassword));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedAdminDashboard = pathname === "/admin/dashboard" || pathname.startsWith("/admin/dashboard/");

  if (!isProtectedAdminDashboard) {
    return NextResponse.next();
  }

  const isAdmin = await isValidAdminSession(request.cookies.get(adminCookieName)?.value);

  if (!isAdmin) {
    return new NextResponse("403 Unauthorized", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
