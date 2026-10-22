import { MongoMemoryReplSet } from "mongodb-memory-server";

// Un único replica set en memoria para toda la run. Los tests NUNCA tocan el
// MONGODB_URI real (Atlas): se fuerza NODE_ENV=test y una URI propia antes de
// que se cargue la app.
//
// Se usa un replica set (y no un mongod standalone) porque el foro usa
// transacciones de MongoDB en comentarios y likes; en modo standalone el server
// responde "Transaction numbers are only allowed on a replica set member or mongos".
let mongoReplSet;

export async function globalSetup() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-production";
  process.env.SALT_ROUNDS = "4"; // hash rápido: los tests no usan bcrypt real
  process.env.PORT = "0";
  process.env.CORS_ORIGIN = "http://localhost:5173";

  // config/supabase.js lanza al importarse si faltan estas variables y eso deja
  // las rutas del foro sin montar. En test no se habla con Supabase (los posts
  // de prueba son solo texto), así que alcanza con valores ficticios.
  process.env.SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SECRET_KEY = "test-supabase-secret";
  process.env.SUPABASE_STORAGE_BUCKET = "test-bucket";

  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ dbName: "eest-flow-test" }],
  });

  process.env.MONGODB_URI = mongoReplSet.getUri("eest-flow-test");

  // app.js lee process.env.CORS_ORIGIN al importarse, así que el orden importa: primero se fijan las variables, después se levanta el server.
  const { connectDB } = await import("../src/config/db.js");
  await connectDB();
}

export async function globalTeardown() {
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
  if (mongoReplSet) await mongoReplSet.stop();
}
