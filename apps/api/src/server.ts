import cors from "cors";
import "dotenv/config";
import express from "express";

import { healthRouter } from "./routes/health.js";
import { playersRouter } from "./routes/players.js";
import { recommendationsRouter } from "./routes/recommendations.js";
import { teamsRouter } from "./routes/teams.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.use("/health", healthRouter);
app.use("/api/players", playersRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/teams", teamsRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found." });
});

app.listen(port, () => {
  console.log(`Fantasy football API listening on http://localhost:${port}`);
});

