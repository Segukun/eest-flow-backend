import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import labelRoutes from "./routes/label.routes.js";
import likeRoutes from "./routes/like.routes.js";
import sectorRoutes from "./routes/sector.routes.js";
import taskRoutes from "./routes/task.routes.js";
import userRoutes from "./routes/user.routes.js";

// routes/post.routes.js arrastra config/supabase.js, que lanza al importarse si no
// encuentra SUPABASE_URL / SUPABASE_SECRET_KEY. Como las rutas cuelgan de app.js,
// ese throw tumbaba la API completa al arrancar (auth, tasks, users, labels...).
// Se resuelve de forma diferida para que la configuración ausente no se lleve el resto.
let postRoutes = null;

try {
  postRoutes = (await import("./routes/post.routes.js")).default;
} catch (error) {
  console.error(`[app] rutas del foro no montadas: ${error.message}`);
}

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(cookieParser());

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sectors", sectorRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/labels", labelRoutes);

if (postRoutes) {
  app.use("/api/posts", postRoutes);
}

app.use("/api", commentRoutes);
app.use("/api", likeRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// sin esto Express devuelve su 404 en HTML y la API quedaría con dos formatos de error distintos según la ruta
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
