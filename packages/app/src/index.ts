import { startApp } from "./start.js";

try {
  await startApp({
    port: Number(process.env["JUDG3D_APP_PORT"] ?? "8787"),
    development: process.env["JUDG3D_APP_SERVE_CLIENT"] === "0",
  });
} catch (error) {
  process.stderr.write(
    `judg3d: ${error instanceof Error ? error.message : "Could not start the app."}\n`,
  );
  process.exitCode = 2;
}
