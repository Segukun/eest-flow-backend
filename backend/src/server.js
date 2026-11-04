import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Usar el .env del backend incluso si Node se ejecuta desde otro directorio.
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
});

import { connectDB } from "./config/db.js";
import { startDueTasksJob } from "./jobs/dueTasks.job.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not defined");
  process.exit(1);
}

try {
  await connectDB();
} catch {
  process.exit(1);
}

const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startDueTasksJob();
});
