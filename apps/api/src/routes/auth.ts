import { Prisma } from "@prisma/client";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { ApiError } from "../lib/apiError.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { clearSession, createSession, findSessionUser } from "../lib/session.js";
import { prisma } from "../lib/prisma.js";
import { authCredentialsSchema } from "../lib/validation.js";

export const authRouter = Router();

const authenticationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Try again later." }
});

authRouter.use(["/register", "/login"], authenticationRateLimit);

authRouter.post("/register", async (request, response) => {
  const parsed = authCredentialsSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid registration request.", issues: parsed.error.issues });
    return;
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password)
      },
      select: { id: true, email: true }
    });

    await createSession(user.id, response);
    response.status(201).json({ user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "An account with that email already exists.");
    }

    throw error;
  }
});

authRouter.post("/login", async (request, response) => {
  const parsed = authCredentialsSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid login request.", issues: parsed.error.issues });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  let passwordMatches = false;

  if (user) {
    passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);
  } else {
    await hashPassword(parsed.data.password);
  }

  if (!user || !passwordMatches) {
    throw new ApiError(401, "Invalid email or password.");
  }

  await createSession(user.id, response);
  response.json({ user: { id: user.id, email: user.email } });
});

authRouter.get("/session", async (request, response) => {
  const user = await findSessionUser(request);

  if (!user) {
    throw new ApiError(401, "Authentication required.");
  }

  response.json({ user });
});

authRouter.post("/logout", async (request, response) => {
  await clearSession(request, response);
  response.status(204).end();
});
