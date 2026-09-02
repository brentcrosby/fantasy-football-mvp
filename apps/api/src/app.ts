import cors from "cors";
import express, { type ErrorRequestHandler } from "express";

import { ApiError } from "./lib/apiError.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { playersRouter } from "./routes/players.js";
import { recommendationsRouter } from "./routes/recommendations.js";
import { teamsRouter } from "./routes/teams.js";

export const app = express();

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

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found." });
});

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
