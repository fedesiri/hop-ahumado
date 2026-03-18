import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const LOGIN_PATH = "/login";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Paths públicos (para no romper assets / login)
  if (
    pathname === LOGIN_PATH ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/assets/")
  ) {
    return NextResponse.next();
  }

  // Verificamos sesión llamando al backend (que valida Firebase).
  const cookieHeader = req.headers.get("cookie") || "";
  try {
    const meRes = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (meRes.ok) return NextResponse.next();
  } catch {
    // si falla, redirigimos
  }

  const url = req.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-|login).*)"],
};
