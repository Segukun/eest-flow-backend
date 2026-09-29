import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import User from "../src/models/user.model.js";
import {
  adminClient,
  app,
  createSector,
  createUser,
  expectNoPasswordLeak,
  loginAs,
  request,
  resetDatabase,
} from "./helpers.js";

beforeEach(resetDatabase);

describe("POST /api/auth/login", () => {
  it("autentica con credenciales válidas y devuelve user + token", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });

    const res = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "secret123",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Login successful");
    assert.ok(res.body.token, "esperaba un token");
    assert.equal(res.body.user.email, user.email);
  });

  it("nunca devuelve el hash de la contraseña (regresión N1)", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });

    const res = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "secret123",
    });

    assert.equal(res.status, 200);
    expectNoPasswordLeak(res.body, "login response");
    assert.ok(
      !("password" in res.body.user),
      "el campo password no debería estar presente en el usuario",
    );
  });

  it("deja el token en una cookie httpOnly llamada accessToken", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });

    const res = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "secret123",
    });

    const cookies = res.headers["set-cookie"] ?? [];
    const accessToken = cookies.find((c) => c.startsWith("accessToken="));

    assert.ok(accessToken, "esperaba la cookie accessToken");
    assert.match(accessToken, /HttpOnly/i);
    assert.match(accessToken, /SameSite=Lax/i);
    assert.ok(
      !/;\s*Secure/i.test(accessToken),
      "en tests NODE_ENV no es production, así que no debe ir Secure",
    );
  });

  it("rechaza un email inexistente con 404", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nadie@test.local", password: "secret123" });

    assert.equal(res.status, 404);
  });

  it("rechaza una contraseña incorrecta con 401", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "no-es-la-password" });

    assert.equal(res.status, 401);
  });

  it("rechaza un usuario inactivo con 403", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id], active: false });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "secret123" });

    assert.equal(res.status, 403);
  });

  it("rechaza credenciales incompletas con 400", async () => {
    const res = await request(app).post("/api/auth/login").send({});

    assert.equal(res.status, 400);
  });

  it("rechaza un email con formato inválido con 400", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "no-es-un-email", password: "secret123" });

    assert.equal(res.status, 400);
  });
});

describe("middleware authenticate", () => {
  it("rechaza rutas protegidas sin cookie con 401", async () => {
    const res = await request(app).get("/api/tasks");

    assert.equal(res.status, 401);
  });

  it("rechaza un token inválido con 401", async () => {
    const res = await request(app)
      .get("/api/tasks")
      .set("Cookie", "accessToken=token.invalido");

    assert.equal(res.status, 401);
  });

  it("rechaza con 401 cuando el usuario del token ya no existe", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(user);

    await User.deleteOne({ _id: user._id });

    const res = await client.get("/api/tasks");

    assert.equal(res.status, 401);
  });

  it("deja de autenticar a un usuario desactivado", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(user);

    await User.updateOne({ _id: user._id }, { active: false });

    const res = await client.get("/api/tasks");

    assert.equal(res.status, 401);
  });

  it("permite el acceso con la cookie emitida en el login", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(user);

    const res = await client.get("/api/tasks");

    assert.equal(res.status, 200);
  });
});

describe("POST /api/auth/logout", () => {
  it("limpia la cookie de sesión", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(user);

    const res = await client.post("/api/auth/logout");

    assert.equal(res.status, 200);
    const cookies = res.headers["set-cookie"] ?? [];
    const cleared = cookies.find((c) => c.startsWith("accessToken="));
    assert.ok(cleared, "esperaba que se enviara la cookie a limpiar");
    assert.match(cleared, /accessToken=;/);
  });
});

describe("POST /api/auth/accounts", () => {
  it("crea la cuenta y hashea la contraseña", async () => {
    const sector = await createSector();
    const { client } = await adminClient();

    const email = `nuevo-${Date.now()}@test.local`;

    const res = await client.post("/api/auth/accounts").send({
      name: "Nuevo Usuario",
      email,
      password: "secret123",
      sectors: [sector._id.toString()],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Account created");
    assert.equal(res.body.user.email, email);

    // el spread del documento se iba en $__/_doc y arrastraba el hash (regresión)
    assert.ok(
      !("$__" in res.body),
      "no debería filtrar estado interno de Mongoose",
    );
    assert.ok(!("_doc" in res.body), "no debería filtrar _doc de Mongoose");
    assert.ok(
      !("password" in res.body.user),
      "el usuario no debe traer password",
    );

    // verificación en base, no solo el status
    const stored = await User.findOne({ email }).select("+password");
    assert.ok(stored, "el usuario debería existir en la base");
    assert.notEqual(stored.password, "secret123");
    assert.match(stored.password, /^\$2[aby]\$/, "esperaba un hash bcrypt");
    assert.ok(await stored.comparePassword("secret123"));
    expectNoPasswordLeak(res.body, "create account response");
  });

  it("rechaza un email duplicado con 409", async () => {
    const sector = await createSector();
    const existing = await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client.post("/api/auth/accounts").send({
      name: "Duplicado",
      email: existing.email,
      password: "secret123",
      sectors: [sector._id.toString()],
    });

    assert.equal(res.status, 409);
  });

  it("rechaza un sector inexistente con 400", async () => {
    const { client } = await adminClient();

    const res = await client.post("/api/auth/accounts").send({
      name: "Sin sector real",
      email: `sin-sector-${Date.now()}@test.local`,
      password: "secret123",
      sectors: ["507f1f77bcf86cd799439011"],
    });

    assert.equal(res.status, 400);
    assert.equal(
      await User.countDocuments({ email: "sin-sector@test.local" }),
      0,
    );
  });

  it("impide que un collaborator cree cuentas (403)", async () => {
    const sector = await createSector();
    const { client } = await loginAs(
      await createUser({ sectors: [sector._id] }),
    );

    const res = await client.post("/api/auth/accounts").send({
      name: "Intruso",
      email: `intruso-${Date.now()}@test.local`,
      password: "secret123",
      sectors: [sector._id.toString()],
    });

    assert.equal(res.status, 403);
  });

  it("impide que un collaborator aplique validación antes de autorizar (401)", async () => {
    // la validación va después de authenticate: sin sesión ni siquiera se llega al schema
    const res = await request(app).post("/api/auth/accounts").send({});

    assert.equal(res.status, 401);
  });
});
