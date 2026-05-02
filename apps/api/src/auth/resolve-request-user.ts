import { UnauthorizedException } from "@nestjs/common";
import { User } from "@prisma/client";
import type { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { PrismaService } from "../prisma/prisma.service";

export type RequestWithFirebase = Request & { firebaseUser?: DecodedIdToken };

export function requireDecodedFirebaseUser(req: RequestWithFirebase): DecodedIdToken {
  const decoded = req.firebaseUser;
  if (!decoded?.email) throw new UnauthorizedException("Sesión inválida");
  return decoded;
}

/** Misma política que `GET /auth/me`: usuario Firebase ↔ fila `User`. */
export async function upsertAppUserFromFirebase(prisma: PrismaService, decoded: DecodedIdToken): Promise<User> {
  const email = decoded.email;
  if (!email) throw new UnauthorizedException("Sesión inválida");
  const name = decoded.name ?? email.split("@")[0];
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
}

export async function upsertAppUserFromRequest(prisma: PrismaService, req: RequestWithFirebase): Promise<User> {
  return upsertAppUserFromFirebase(prisma, requireDecodedFirebaseUser(req));
}
