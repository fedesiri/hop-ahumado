import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSessionCookieDto } from "./dto/create-session-cookie.dto";
import { firebaseAdmin } from "./firebase-admin";

const COOKIE_NAME = process.env.FIREBASE_SESSION_COOKIE_NAME || "hop_auth_session";
const DEFAULT_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000; // 5 días
const EXPIRES_IN_MS = Number(process.env.FIREBASE_SESSION_COOKIE_MAX_AGE_MS || DEFAULT_EXPIRES_IN_MS);

function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  for (const p of parts) {
    if (p.startsWith(prefix)) return decodeURIComponent(p.substring(prefix.length));
  }
  return undefined;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("session-cookie")
  async createSessionCookie(@Body() dto: CreateSessionCookieDto, @Res({ passthrough: true }) res: Response) {
    if (!firebaseAdmin.apps.length) {
      throw new UnauthorizedException("Firebase Admin no configurado");
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(dto.idToken, true);
    const email = decoded.email;
    if (!email) throw new UnauthorizedException("El token no tiene email");

    const name = decoded.name ?? email.split("@")[0];

    const sessionCookie = await firebaseAdmin.auth().createSessionCookie(dto.idToken, { expiresIn: EXPIRES_IN_MS });

    const isProd = process.env.NODE_ENV === "production";
    res.cookie(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: EXPIRES_IN_MS,
    });

    // Creamos o actualizamos el usuario en la API (por email).
    await this.prisma.user.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    });

    return { ok: true };
  }

  @Get("me")
  async getMe(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    if (!firebaseAdmin.apps.length) {
      throw new UnauthorizedException("Firebase Admin no configurado");
    }

    const cookieHeader = req.headers?.cookie as string | undefined;
    const sessionCookie = getCookieValue(cookieHeader, COOKIE_NAME);
    if (!sessionCookie) throw new UnauthorizedException("No hay sesión");

    const decoded = await firebaseAdmin.auth().verifySessionCookie(sessionCookie, true);
    const email = decoded.email;
    if (!email) throw new UnauthorizedException("Sesión inválida");

    const name = decoded.name ?? email.split("@")[0];

    // Aseguramos que el usuario exista en DB para que el frontend tenga un id estable.
    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    });

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      firebase: {
        uid: decoded.uid,
      },
    };
  }

  @Post("logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return { ok: true };
  }
}
