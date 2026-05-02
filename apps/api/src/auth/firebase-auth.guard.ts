import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { firebaseAdmin } from "./firebase-admin";

export type FirebaseRequest = Request & { firebaseUser?: DecodedIdToken };

function getBearerToken(header: string | undefined) {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return undefined;
  return token;
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

    const idToken = getBearerToken(request.headers.authorization);
    if (!idToken) throw new UnauthorizedException("Missing bearer token");

    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken, true);
    (request as FirebaseRequest).firebaseUser = decoded;
    return true;
  }
}
