import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { firebaseAdmin } from "./firebase-admin";

const COOKIE_NAME = process.env.FIREBASE_SESSION_COOKIE_NAME || "hop_auth_session";

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  for (const p of parts) {
    if (p.startsWith(prefix)) return decodeURIComponent(p.substring(prefix.length));
  }
  return undefined;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    // Permitir CORS preflight
    if (request.method === "OPTIONS") return true;

    // Permitir health + auth endpoints
    const path = request.path || "";
    if (path === "/health" || path.startsWith("/auth")) return true;

    if (!firebaseAdmin.apps.length) {
      throw new UnauthorizedException("Firebase Admin no configurado");
    }

    const cookieHeader = request.headers.cookie as string | undefined;
    const sessionCookie = getCookieValue(cookieHeader, COOKIE_NAME);
    if (!sessionCookie) throw new UnauthorizedException("No hay sesión");

    await firebaseAdmin.auth().verifySessionCookie(sessionCookie, true);
    return true;
  }
}
