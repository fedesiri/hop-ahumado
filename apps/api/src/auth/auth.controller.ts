import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { firebaseAdmin } from "./firebase-admin";
import { upsertAppUserFromFirebase } from "./resolve-request-user";

function getBearerToken(header: string | undefined) {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return undefined;
  return token;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  async getMe(@Req() req: any) {
    if (!firebaseAdmin.apps.length) {
      throw new UnauthorizedException("Firebase Admin no configurado");
    }

    const idToken = getBearerToken(req.headers?.authorization as string | undefined);
    if (!idToken) throw new UnauthorizedException("Missing bearer token");

    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken, true);
    const user = await upsertAppUserFromFirebase(this.prisma, decoded);

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
}
