import bcrypt from "bcryptjs";
import supertest from "supertest";

import app from "../src/app.js";
import Category from "../src/models/category.model.js";
import Label from "../src/models/label.model.js";
import Sector from "../src/models/sector.model.js";
import Task from "../src/models/task.model.js";
import User from "../src/models/user.model.js";

export { app };
export const request = supertest;

export const COLORS = {
  valid: "#ff0000",
  cssVar: "var(--primary)",
  invalid: "not-a-color",
};

// ---------------------------------------------------------------- limpieza --

export async function resetDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    Category.deleteMany({}),
    Label.deleteMany({}),
    Sector.deleteMany({}),
  ]);
}

// ------------------------------------------------------------------ seeds --

let sequence = 0;
const unique = (prefix) => `${prefix}-${process.pid}-${sequence++}`;

export async function createSector(overrides = {}) {
  return Sector.create({
    name: overrides.name ?? unique("sector"),
    color: overrides.color ?? COLORS.valid,
    ...overrides,
  });
}

export async function createCategory(overrides = {}) {
  return Category.create({
    name: overrides.name ?? unique("category"),
    color: overrides.color ?? COLORS.valid,
    sectors: overrides.sectors ?? [],
    ...overrides,
  });
}

export async function createLabel(overrides = {}) {
  return Label.create({
    color: overrides.color ?? COLORS.valid,
    ...overrides,
  });
}

export async function createUser(overrides = {}) {
  const password = overrides.password ?? "secret123";
  return User.create({
    name: overrides.name ?? unique("user"),
    email: overrides.email ?? `${unique("user")}@test.local`,
    password: await bcrypt.hash(password, Number(process.env.SALT_ROUNDS)),
    accountType: overrides.accountType ?? "collaborator",
    sectors: overrides.sectors ?? [],
    ...overrides,
  });
}

// ----------------------------------------------------------------- agents --

// Un `request.agent()` mantiene el cookie de sesión entre llamadas, que es como funciona el frontend real.
export function agent() {
  return request.agent(app);
}

export async function loginAs(user, password = "secret123") {
  const client = agent();
  const res = await client
    .post("/api/auth/login")
    .send({ email: user.email, password });

  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { client, token: res.body.token, res };
}

// Crea un admin y devuelve un client ya autenticado como tal. El modelo exige al menos un sector, así que se crea uno si no viene dado.
export async function adminClient(overrides = {}) {
  const sectors = overrides.sectors ?? [(await createSector())._id];
  const user = await createUser({
    accountType: "admin",
    ...overrides,
    sectors,
  });
  return loginAs(user, overrides.password);
}

export const validTask = (overrides = {}) => ({
  title: overrides.title ?? unique("task"),
  description: overrides.description ?? "descripcion de prueba",
  priority: overrides.priority ?? "medium",
  state: overrides.state ?? "pending",
  ...overrides,
});

// ---------------------------------------------------------------- asserts --

export function expectNoPasswordLeak(payload, label = "payload") {
  const serialized = JSON.stringify(payload ?? {});
  if (serialized.includes('"$2')) {
    throw new Error(`bcrypt hash leaked in ${label}: ${serialized}`);
  }
}
