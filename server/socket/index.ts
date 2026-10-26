// Entry point: `npm run socket` (or `npm run socket:dev` to restart on change).

import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createAccessResolver, createTokenVerifier } from "./auth.ts";
import { createRealtimeServer } from "./server.ts";

const envFile = resolve(import.meta.dirname, "../../.env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key. See .env.example.");
  process.exit(1);
}

// Railway (and most hosts) assign the port via PORT.
const port = Number(process.env.SOCKET_PORT ?? process.env.PORT ?? 3001);
const corsOrigin = (process.env.SOCKET_CORS_ORIGINS ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    return;
  }
  res.writeHead(404).end();
});

const realtime = createRealtimeServer(httpServer, {
  verifyToken: createTokenVerifier(supabaseUrl),
  resolveAccess: createAccessResolver(supabaseUrl, supabaseKey),
  corsOrigin,
});

httpServer.listen(port, () => {
  console.log(`[socket] listening on :${port} (CORS: ${corsOrigin.join(", ")})`);
});

async function shutdown(signal: string) {
  console.log(`[socket] ${signal}, shutting down`);
  await realtime.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
