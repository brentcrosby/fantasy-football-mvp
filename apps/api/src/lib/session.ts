import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedUser } from "@fantasy-football/shared";

import { ApiError } from "./apiError.js";
import { prisma } from "./prisma.js";

const sessionCookieName = "ff_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string, response: Response): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt }
  });

  response.cookie(sessionCookieName, token, cookieOptions(expiresAt));
}

export async function clearSession(request: Request, response: Response): Promise<void> {
  const token = readSessionToken(request);

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  response.clearCookie(sessionCookieName, cookieOptions());
}

export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const user = await findSessionUser(request);

    if (!user) {
      throw new ApiError(401, "Authentication required.");
    }

    response.locals.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthenticatedUser(response: Response): AuthenticatedUser {
  const user = response.locals.authUser as AuthenticatedUser | undefined;

  if (!user) {
    throw new ApiError(401, "Authentication required.");
  }

  return user;
}

export async function findSessionUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = readSessionToken(request);

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true } } }
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

function readSessionToken(request: Request): string | null {
  const cookies = request.headers.cookie?.split(";") ?? [];

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (name === sessionCookieName) {
      const value = valueParts.join("=");

      try {
        return value ? decodeURIComponent(value) : null;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expires ? { expires } : {})
  };
}
