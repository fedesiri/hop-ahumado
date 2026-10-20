import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { PrismaService } from "../prisma/prisma.service";
import { firebaseAdmin } from "./firebase-admin";
import { requireAppUserFromFirebase } from "./resolve-request-user";

export type FirebaseRequest = Request & { firebaseUser?: DecodedIdToken };

function getBearerToken(header: string | undefined) {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return undefined;
  return token;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    // Permitir CORS preflight
    if (request.method === "OPTIONS") return true;

    // Permitir health + auth endpoints (/auth/me hace su propia verificación)
    const path = request.path || "";
    if (path === "/health" || path.startsWith("/auth")) return true;

    if (!firebaseAdmin.apps.length) {
      throw new UnauthorizedException("Firebase Admin no configurado");
    }

    const idToken = getBearerToken(request.headers.authorization);
    if (!idToken) throw new UnauthorizedException("Missing bearer token");

    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    // Un token válido de Firebase no alcanza: el email tiene que existir en la tabla User.
    await requireAppUserFromFirebase(this.prisma, decoded);
    (request as FirebaseRequest).firebaseUser = decoded;
    return true;
  }
}
