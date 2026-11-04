// Vitest globalSetup: use the same fail-fast gate as standalone recorders.
import { requireRuntimeEnvironment } from "./runtime.mjs";

export default async function runtimeGuard() {
  await requireRuntimeEnvironment();
}
