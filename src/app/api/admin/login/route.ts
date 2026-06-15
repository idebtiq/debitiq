import { NextResponse } from "next/server";
import { adminCookieName, createAdminSessionValue, validateAdminCredentials } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");

  if (!validateAdminCredentials(username, password)) {
    return new NextResponse("403 Unauthorized", { status: 403 });
  }

  const response = NextResponse.redirect(new URL("/admin/dashboard", request.url), { status: 303 });
  response.cookies.set(adminCookieName, createAdminSessionValue(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
