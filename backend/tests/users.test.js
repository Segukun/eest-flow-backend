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

describe("GET /api/users", () => {
  it("exige autenticación", async () => {
    const res = await request(app).get("/api/users");

    assert.equal(res.status, 401);
  });

  it("lista solo los usuarios activos", async () => {
    const sector = await createSector();
    const activo = await createUser({ sectors: [sector._id] });
    const inactivo = await createUser({
      sectors: [sector._id],
      active: false,
    });
    const { client } = await adminClient();

    const res = await client.get("/api/users");

    assert.equal(res.status, 200);
    const emails = res.body.map((u) => u.email);
    assert.ok(emails.includes(activo.email));
    assert.ok(!emails.includes(inactivo.email));
  });

  it("filtra por sector con ?sector=<id>", async () => {
    const [sectorA, sectorB] = [await createSector(), await createSector()];
    const enA = await createUser({ sectors: [sectorA._id] });
    const enB = await createUser({ sectors: [sectorB._id] });
    const { client } = await adminClient();

    const res = await client.get(`/api/users?sector=${sectorA._id}`);

    assert.equal(res.status, 200);
    const emails = res.body.map((u) => u.email);
    assert.ok(emails.includes(enA.email));
    assert.ok(!emails.includes(enB.email));
  });

  it("popula los sectores con nombre y color", async () => {
    const sector = await createSector({ name: "Preceptoria", color: "#123456" });
    await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client.get("/api/users");

    const user = res.body.find((u) => Array.isArray(u.sectors) && u.sectors.length);
    assert.equal(user.sectors[0].name, "Preceptoria");
    assert.equal(user.sectors[0].color, "#123456");
  });

  it("nunca expone contraseñas", async () => {
    const sector = await createSector();
    await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client.get("/api/users");

    for (const user of res.body) {
      assert.ok(!("password" in user), "el listado no debe traer password");
      assert.ok(!("refreshToken" in user));
      assert.ok(!("resetPasswordToken" in user));
    }
    expectNoPasswordLeak(res.body, "GET /api/users");
  });
});

describe("GET /api/users/:id", () => {
  it("devuelve el usuario activo", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client.get(`/api/users/${user._id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.email, user.email);
    expectNoPasswordLeak(res.body, "GET /api/users/:id");
  });

  it("devuelve 404 para un usuario inexistente", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/users/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });

  it("devuelve 404 para un usuario desactivado", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id], active: false });
    const { client } = await adminClient();

    const res = await client.get(`/api/users/${user._id}`);

    assert.equal(res.status, 404);
  });

  it("devuelve 400 para un id mal formado", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/users/no-es-un-objectid");

    assert.equal(res.status, 400);
  });
});

describe("PUT /api/users/:id", () => {
  it("un collaborator puede actualizar sus propios datos básicos", async () => {
    const sector = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(user);

    const res = await client
      .put(`/api/users/${user._id}`)
      .send({ name: "Nombre Nuevo" });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Nombre Nuevo");

    const stored = await User.findById(user._id);
    assert.equal(stored.name, "Nombre Nuevo");
  });

  it("un collaborator no puede tocar el accountType ni los sectors, ni sobre sí mismo", async () => {
    const sector = await createSector();
    const otro = await createSector();
    const user = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(user);

    const res = await client
      .put(`/api/users/${user._id}`)
      .send({ accountType: "admin", sectors: [otro._id.toString()] });

    assert.equal(res.status, 200);

    const stored = await User.findById(user._id);
    assert.equal(stored.accountType, "collaborator");
    assert.equal(stored.sectors[0].toString(), sector._id.toString());
  });

  it("un collaborator no puede actualizar a otro usuario (403)", async () => {
    const sector = await createSector();
    const yo = await createUser({ sectors: [sector._id] });
    const otro = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(yo);

    const res = await client
      .put(`/api/users/${otro._id}`)
      .send({ name: "Hackeado" });

    assert.equal(res.status, 403);

    const stored = await User.findById(otro._id);
    assert.notEqual(stored.name, "Hackeado");
  });

  it("un admin sí puede cambiar accountType y sectors, y persiste el cambio", async () => {
    const sector = await createSector();
    const objetivo = await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client
      .put(`/api/users/${objetivo._id}`)
      .send({ accountType: "admin", sectors: [sector._id.toString()] });

    assert.equal(res.status, 200);
    assert.equal(res.body.accountType, "admin");

    const stored = await User.findById(objetivo._id);
    assert.equal(stored.accountType, "admin");
  });

  it("un admin no puede asignar un sector inexistente (400)", async () => {
    const sector = await createSector();
    const objetivo = await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client
      .put(`/api/users/${objetivo._id}`)
      .send({ sectors: ["507f1f77bcf86cd799439011"] });

    assert.equal(res.status, 400);
  });

  it("devuelve 409 al cambiar el email a uno ya usado", async () => {
    const sector = await createSector();
    const yo = await createUser({ sectors: [sector._id] });
    const ocupado = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(yo);

    const res = await client
      .put(`/api/users/${yo._id}`)
      .send({ email: ocupado.email });

    assert.equal(res.status, 409);

    const stored = await User.findById(yo._id);
    assert.equal(stored.email, yo.email);
  });

  it("devuelve 404 al actualizar un usuario inexistente", async () => {
    const { client } = await adminClient();

    const res = await client
      .put("/api/users/507f1f77bcf86cd799439011")
      .send({ name: "Nada" });

    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/users/:id", () => {
  it("un collaborator no puede desactivar usuarios (403)", async () => {
    const sector = await createSector();
    const yo = await createUser({ sectors: [sector._id] });
    const objetivo = await createUser({ sectors: [sector._id] });
    const { client } = await loginAs(yo);

    const res = await client.delete(`/api/users/${objetivo._id}`);

    assert.equal(res.status, 403);

    const stored = await User.findById(objetivo._id);
    assert.equal(stored.active, true);
  });

  it("un admin desactiva el usuario y el cambio queda persistido", async () => {
    const sector = await createSector();
    const objetivo = await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client.delete(`/api/users/${objetivo._id}`);

    assert.equal(res.status, 200);

    const stored = await User.findById(objetivo._id);
    assert.equal(stored.active, false);
  });

  it("un usuario desactivado ya no puede iniciar sesión", async () => {
    const sector = await createSector();
    const objetivo = await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    await client.delete(`/api/users/${objetivo._id}`);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: objetivo.email, password: "secret123" });

    assert.equal(res.status, 403);
  });

  it("un usuario desactivado pierde el acceso con su sesión ya abierta", async () => {
    const sector = await createSector();
    const objetivo = await createUser({ sectors: [sector._id] });
    const { client: suSesion } = await loginAs(objetivo);
    const { client: admin } = await adminClient();

    await admin.delete(`/api/users/${objetivo._id}`);

    const res = await suSesion.get("/api/users");

    assert.equal(res.status, 401);
  });
});