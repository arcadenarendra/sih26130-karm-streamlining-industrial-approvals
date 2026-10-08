import http from "node:http";
import { app } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
const server = await connectDb().then(() =>
  http.createServer(app).listen(env.port, () => console.log(`KARM API listening on ${env.port}`)),
);
const shutdown = async () => {
  server.close();
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
