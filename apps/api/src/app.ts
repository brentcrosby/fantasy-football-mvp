import { fileURLToPath } from "node:url";

import cors from "cors";
import express, { type ErrorRequestHandler } from "express";

import { ApiError } from "./lib/apiError.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { playersRouter } from "./routes/players.js";
import { recommendationsRouter } from "./routes/recommendations.js";
import { teamsRouter } from "./routes/teams.js";

export const app = express();
app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (process.env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'"
    );
  }

  next();
});

app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json());

app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/players", playersRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/teams", teamsRouter);

const notFoundHandler = (_request: express.Request, response: express.Response) => {
  response.status(404).json({ error: "Route not found." });
};

app.use("/api", notFoundHandler);
app.use("/health", notFoundHandler);

if (process.env.NODE_ENV === "production") {
  const webDistPath = fileURLToPath(new URL("../../web/dist", import.meta.url));
  const webIndexPath = fileURLToPath(new URL("../../web/dist/index.html", import.meta.url));

  app.use(express.static(webDistPath));
  app.get(/.*/, (_request, response, next) => {
    response.sendFile(webIndexPath, (error) => {
      if (error) next(error);
    });
  });
} else {
  app.use(notFoundHandler);
}

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message, ...error.details });
    return;
  }

  if (isBadJsonError(error)) {
    response.status(400).json({ error: "Invalid JSON request body." });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error." });
};

app.use(errorHandler);

function isBadJsonError(error: unknown): error is SyntaxError & { status: number } {
  return error instanceof SyntaxError && "status" in error && error.status === 400;
}
