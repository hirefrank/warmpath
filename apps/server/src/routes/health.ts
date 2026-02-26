import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({ ok: true, service: "warmpath-server" });
});

export default app;
