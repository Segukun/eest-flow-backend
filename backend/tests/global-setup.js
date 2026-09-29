import { MongoMemoryServer } from "mongodb-memory-server";

// Un único mongod en memoria para toda la run. Los tests NUNCA tocan el MONGODB_URI real (Atlas): se fuerza NODE_ENV=test y una URI propia antes de que se cargue la app.
let mongoServer;

export async function globalSetup() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-production";
  process.env.SALT_ROUNDS = "4"; // hash rápido: los tests no usan bcrypt real
  process.env.PORT = "0";
  process.env.CORS_ORIGIN = "http://localhost:5173";

  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: "eest-flow-test" },
  });

  process.env.MONGODB_URI = mongoServer.getUri("eest-flow-test");

  // app.js lee process.env.CORS_ORIGIN al importarse, así que el orden importa: primero se fijan las variables, después se levanta el server.
  const { connectDB } = await import("../src/config/db.js");
  await connectDB();
}

export async function globalTeardown() {
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}
