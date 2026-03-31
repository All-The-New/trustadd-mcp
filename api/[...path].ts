import { app, initPromise } from "../server/app";

// Ensure routes are registered before handling any request
await initPromise;

export default app;
