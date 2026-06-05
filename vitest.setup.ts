import { config } from "dotenv";
import { resolve } from "path";

// Load .env from project root so Vitest tests can read environment variables
config({ path: resolve(__dirname, ".env") });
