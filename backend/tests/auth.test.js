import assert from "node:assert/strict";
import crypto from "node:crypto";
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

// ------------------------------------------------- recuperacion de password --

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

// Escribe directamente el código/token hasheados, para no depender del valor
// aleatorio que genera el servicio en el paso 1.
async function setCodeHash(user, code, expiresInMs = 10 * 60 * 1000) {
  await User.updateOne(
    { _id: user._id },
    {
      resetCode: sha256(code),
      resetCodeExpires: new Date(Date.now() + expiresInMs),
    },
  );
}

async function setResetToken(user, token, expiresInMs = 10 * 60 * 1000) {
  await User.updateOne(
    { _id: user._id },
    {
      resetPasswordToken: sha256(token),
      resetPasswordExpires: new Date(Date.now() + expiresInMs),
    },
  );
}

describe("POST /api/auth/forgot-password", () => {
  it("devuelve existe true y guarda el código hasheado para un email existente", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { existe: true });

    const stored = await User.findById(user._id).select("+resetCode +resetCodeExpires");
    assert.match(stored.resetCode, /^[0-9a-f]{64}$/, "esperaba un hash sha256");
    assert.ok(stored.resetCodeExpires.getTime() > Date.now());
    // nunca guarda el código en claro: el hash no son 6 dígitos
    assert.ok(!/^\d{6}$/.test(stored.resetCode));
  });

  it("devuelve existe false para un email inexistente", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nadie@test.local" });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { existe: false });
  });

  it("rechaza un email con formato inválido con 400", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "no-es-un-email" });

    assert.equal(res.status, 400);
  });
});

describe("POST /api/auth/resend-code", () => {
  it("genera un código nuevo y devuelve ok", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });

    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });
    const before = await User.findById(user._id).select("+resetCode");

    const res = await request(app)
      .post("/api/auth/resend-code")
      .send({ email: user.email });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });

    const after = await User.findById(user._id).select("+resetCode");
    assert.notEqual(after.resetCode, before.resetCode);
  });

  it("devuelve ok false si el email no exista", async () => {
    const res = await request(app)
      .post("/api/auth/resend-code")
      .send({ email: "nadie@test.local" });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: false });
  });
});

describe("POST /api/auth/verify-code", () => {
  it("valida el código correcto y entrega un resetToken", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    await setCodeHash(user, "123456");

    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: user.email, code: "123456" });

    assert.equal(res.status, 200);
    assert.equal(res.body.valido, true);
    assert.ok(res.body.resetToken, "esperaba un resetToken");

    const stored = await User.findById(user._id).select(
      "+resetPasswordToken +resetPasswordExpires +resetCode +resetCodeExpires",
    );
    assert.ok(stored.resetPasswordToken, "el token debe quedar guardado hasheado");
    assert.ok(stored.resetPasswordExpires.getTime() > Date.now());
    assert.ok(!stored.resetCode, "el código debe limpiarse tras verificar");
  });

  it("rechaza un código incorrecto", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    await setCodeHash(user, "123456");

    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: user.email, code: "000000" });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { valido: false });
  });

  it("rechaza un código vencido", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    await setCodeHash(user, "123456", -1000);

    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: user.email, code: "123456" });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { valido: false });
  });

  it("rechaza un código con formato inválido con 400", async () => {
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "x@test.local", code: "12" });

    assert.equal(res.status, 400);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("cambia la contraseña y permite iniciar sesión con la nueva", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    await setResetToken(user, "token-valido");

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: user.email,
        resetToken: "token-valido",
        newPassword: "nueva123",
      });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });

    const loginNew = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "nueva123" });
    assert.equal(loginNew.status, 200);

    const loginOld = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "secret123" });
    assert.equal(loginOld.status, 401);

    const stored = await User.findById(user._id).select(
      "+password +resetPasswordToken +resetCode",
    );
    assert.ok(!stored.resetPasswordToken, "el token debe limpiarse");
    assert.ok(await stored.comparePassword("nueva123"));
    expectNoPasswordLeak(res.body, "reset-password response");
  });

  it("rechaza un token inválido con 400", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    await setResetToken(user, "token-valido");

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: user.email,
        resetToken: "otro-token",
        newPassword: "nueva123",
      });

    assert.equal(res.status, 400);
  });

  it("rechaza un token vencido con 400", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    await setResetToken(user, "token-vencido", -1000);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: user.email,
        resetToken: "token-vencido",
        newPassword: "nueva123",
      });

    assert.equal(res.status, 400);
  });

  it("rechaza una contraseña corta con 400", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "x@test.local",
        resetToken: "algo",
        newPassword: "123",
      });

    assert.equal(res.status, 400);
  });
});

describe("POST /api/auth/change-password", () => {
  it("cambia la contraseña de un usuario autenticado y permite volver a entrar", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(user);

    const res = await client.post("/api/auth/change-password").send({
      newPassword: "otra1234",
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    expectNoPasswordLeak(res.body, "change-password response");

    // se puede entrar con la nueva y ya no con la anterior
    const loginNew = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "otra1234" });
    assert.equal(loginNew.status, 200);

    const loginOld = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "secret123" });
    assert.equal(loginOld.status, 401);

    // sigue guardado como hash, nunca en claro
    const stored = await User.findById(user._id).select("+password");
    assert.ok(await stored.comparePassword("otra1234"));
    assert.notEqual(stored.password, "otra1234");
    assert.match(stored.password, /^\$2[aby]\$/);

    // la sesión abierta sigue siendo válida después del cambio
    const tasks = await client.get("/api/tasks");
    assert.equal(tasks.status, 200);
  });

  it("exige autenticación (401)", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ newPassword: "otra1234" });

    assert.equal(res.status, 401);
  });

  it("rechaza una nueva contraseña corta con 400", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(user);

    const res = await client.post("/api/auth/change-password").send({
      newPassword: "123",
    });

    assert.equal(res.status, 400);
  });

  it("limpia cualquier código o token de recuperación pendiente", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    await setResetToken(user, "token-pendiente");
    await setCodeHash(user, "123456");
    const { client } = await loginAs(user);

    const res = await client.post("/api/auth/change-password").send({
      newPassword: "otra1234",
    });

    assert.equal(res.status, 200);

    const stored = await User.findById(user._id).select(
      "+resetPasswordToken +resetCode",
    );
    assert.ok(!stored.resetPasswordToken, "el token de recuperación debe limpiarse");
    assert.ok(!stored.resetCode, "el código de recuperación debe limpiarse");
  });
});
