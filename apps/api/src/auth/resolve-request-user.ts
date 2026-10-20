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

/**
 * Allowlist de la plataforma: solo entra quien ya tiene una fila `User` con ese email.
 * Nunca crea usuarios; las altas se hacen por `POST /users` o directo en la base.
 */
export async function requireAppUserFromFirebase(prisma: PrismaService, decoded: DecodedIdToken): Promise<User> {
  const email = decoded.email;
  if (!email) throw new UnauthorizedException("Sesión inválida");
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (!user) throw new UnauthorizedException("Sesión inválida");
  return user;
}

export async function requireAppUserFromRequest(prisma: PrismaService, req: RequestWithFirebase): Promise<User> {
  return requireAppUserFromFirebase(prisma, requireDecodedFirebaseUser(req));
}
