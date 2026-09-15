import dotenv from "dotenv";

dotenv.config();

import { connectDB } from "./config/db.js";

await connectDB();

const { default: app } = await import("./app.js");

const PORT = process.env.PORT;

app.listen(PORT, async () => {
  //console.log(`Server is running on port ${PORT}`);
});
