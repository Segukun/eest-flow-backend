import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Category from "../src/models/category.model.js";
import Sector from "../src/models/sector.model.js";
import {
  adminClient,
  app,
  COLORS,
  createCategory,
  createSector,
  createUser,
  loginAs,
  request,
  resetDatabase,
} from "./helpers.js";

beforeEach(resetDatabase);

describe("POST /api/categories", () => {
  it("exige autenticación", async () => {
    const sector = await createSector();

    const res = await request(app)
      .post("/api/categories")
      .send({ name: "Docencia", color: COLORS.valid, sectors: [sector._id] });

    assert.equal(res.status, 401);
  });

  it("un collaborator no puede crear categorías (403)", async () => {
    const sector = await createSector();
    const { client } = await loginAs(
      await createUser({ sectors: [sector._id] }),
    );

    const res = await client
      .post("/api/categories")
      .send({ name: "Docencia", color: COLORS.valid, sectors: [sector._id] });

    assert.equal(res.status, 403);
    assert.equal(await Category.countDocuments({}), 0);
  });

  it("un admin crea la categoría y persiste", async () => {
    const sector = await createSector();
    const { client } = await adminClient();

    const res = await client.post("/api/categories").send({
      name: "Docencia",
      color: COLORS.valid,
      sectors: [sector._id.toString()],
    });

    assert.equal(res.status, 201);

    const stored = await Category.findById(res.body._id);
    assert.equal(stored.name, "Docencia");
    assert.equal(stored.sectors[0].toString(), sector._id.toString());
    assert.equal(stored.active, true);
  });

  it("rechaza una categoría sin sectors con 400 (regla del modelo)", async () => {
    const { client } = await adminClient();

    const res = await client
      .post("/api/categories")
      .send({ name: "Sin sector", color: COLORS.valid, sectors: [] });

    assert.equal(res.status, 400);
  });

  it("rechaza un name duplicado", async () => {
    const sector = await createSector();
    const { client } = await adminClient();
    const payload = {
      name: "Repetida",
      color: COLORS.valid,
      sectors: [sector._id.toString()],
    };

    await client.post("/api/categories").send(payload);
    const res = await client.post("/api/categories").send(payload);

    assert.equal(res.status, 400);
  });

  it("rechaza un color inválido con 400", async () => {
    const sector = await createSector();
    const { client } = await adminClient();

    const res = await client
      .post("/api/categories")
      .send({
        name: "Color malo",
        color: COLORS.invalid,
        sectors: [sector._id.toString()],
      });

    assert.equal(res.status, 400);
  });
});

describe("GET /api/categories", () => {
  it("exige autenticación", async () => {
    const res = await request(app).get("/api/categories");

    assert.equal(res.status, 401);
  });

  it("lista solo las categorías activas", async () => {
    const sector = await createSector();
    await createCategory({ name: "Activa", sectors: [sector._id] });
    await createCategory({
      name: "Inactiva",
      sectors: [sector._id],
      active: false,
    });
    const { client } = await adminClient();

    const res = await client.get("/api/categories");

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((c) => c.name),
      ["Activa"],
    );
  });

  it("devuelve 404 para una categoría inexistente y 400 para un id inválido", async () => {
    const { client } = await adminClient();

    const missing = await client.get("/api/categories/507f1f77bcf86cd799439011");
    assert.equal(missing.status, 404);

    const malformed = await client.get("/api/categories/no-es-un-objectid");
    assert.equal(malformed.status, 400);
  });
});

describe("PUT /api/categories/:id", () => {
  it("actualiza name y color, y el cambio persiste", async () => {
    const sector = await createSector();
    const category = await createCategory({
      name: "Antes",
      sectors: [sector._id],
    });
    const { client } = await adminClient();

    const res = await client
      .put(`/api/categories/${category._id}`)
      .send({ name: "Despues", color: "#123456" });

    assert.equal(res.status, 200);

    const stored = await Category.findById(category._id);
    assert.equal(stored.name, "Despues");
    assert.equal(stored.color, "#123456");
  });

  it("rechaza un color inválido con 400", async () => {
    const sector = await createSector();
    const category = await createCategory({
      name: "Antes",
      sectors: [sector._id],
    });
    const { client } = await adminClient();

    const res = await client
      .put(`/api/categories/${category._id}`)
      .send({ color: COLORS.invalid });

    assert.equal(res.status, 400);

    const stored = await Category.findById(category._id);
    assert.equal(stored.color, COLORS.valid);
  });
});

describe("DELETE /api/categories/:id", () => {
  it("un admin desactiva la categoría (regresión N2: siempre fallaba con 500)", async () => {
    const sector = await createSector();
    const category = await createCategory({
      name: "Temporal",
      sectors: [sector._id],
    });
    const { client } = await adminClient();

    const res = await client.delete(`/api/categories/${category._id}`);

    assert.equal(res.status, 200);

    const stored = await Category.findById(category._id);
    assert.equal(stored.active, false);
  });

  it("la categoría desactivada desaparece del listado", async () => {
    const sector = await createSector();
    const category = await createCategory({
      name: "Temporal",
      sectors: [sector._id],
    });
    const { client } = await adminClient();

    await client.delete(`/api/categories/${category._id}`);
    const res = await client.get("/api/categories");

    assert.ok(!res.body.some((c) => c._id === category._id.toString()));
  });

  it("un collaborator no puede borrar categorías (403)", async () => {
    const sector = await createSector();
    const category = await createCategory({
      name: "Intacta",
      sectors: [sector._id],
    });
    const { client } = await loginAs(
      await createUser({ sectors: [sector._id] }),
    );

    const res = await client.delete(`/api/categories/${category._id}`);

    assert.equal(res.status, 403);

    const stored = await Category.findById(category._id);
    assert.equal(stored.active, true);
  });

  it("devuelve 404 para una categoría inexistente", async () => {
    const { client } = await adminClient();

    const res = await client.delete("/api/categories/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });
});

describe("GET /api/sectors", () => {
  it("exige autenticación", async () => {
    const res = await request(app).get("/api/sectors");

    assert.equal(res.status, 401);
  });

  it("lista los sectores activos ordenados por nombre", async () => {
    await createSector({ name: "Zeta" });
    await createSector({ name: "Alfa" });
    await createSector({ name: "Oculto", active: false });
    // se le pasa un sector explícito para que adminClient no cree uno extra
    const { client } = await adminClient({
      sectors: [(await createSector({ name: "Sede" }))._id],
    });

    const res = await client.get("/api/sectors");

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((s) => s.name),
      ["Alfa", "Sede", "Zeta"],
    );
    assert.ok(!res.body.some((s) => s.name === "Oculto"));
  });
});

describe("POST /api/sectors", () => {
  it("un admin crea el sector y persiste", async () => {
    const { client } = await adminClient();

    const res = await client.post("/api/sectors").send({
      name: "Preceptoria",
      color: COLORS.valid,
    });

    assert.equal(res.status, 201);

    const stored = await Sector.findById(res.body._id);
    assert.equal(stored.name, "Preceptoria");
    assert.equal(stored.icon, "FiUsers", "debería usar el icono por defecto");
  });

  it("un collaborator no puede crear sectores (403)", async () => {
    const sector = await createSector();
    const { client } = await loginAs(
      await createUser({ sectors: [sector._id] }),
    );

    const res = await client
      .post("/api/sectors")
      .send({ name: "Intruso", color: COLORS.valid });

    assert.equal(res.status, 403);
  });

  it("rechaza un nombre duplicado con 409", async () => {
    const existing = await createSector({ name: "Repetido" });
    const { client } = await adminClient();

    const res = await client
      .post("/api/sectors")
      .send({ name: "Repetido", color: COLORS.valid });

    assert.equal(res.status, 409);
    assert.ok(existing._id);
  });
});

describe("DELETE /api/sectors/:id", () => {
  it("bloquea con 409 si el sector todavía tiene miembros activos", async () => {
    const sector = await createSector();
    await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client.delete(`/api/sectors/${sector._id}`);

    assert.equal(res.status, 409);

    const stored = await Sector.findById(sector._id);
    assert.equal(stored.active, true);
  });

  it("desactiva el sector si no tiene miembros activos", async () => {
    const sector = await createSector();
    const { client } = await adminClient();

    const res = await client.delete(`/api/sectors/${sector._id}`);

    assert.equal(res.status, 200);

    const stored = await Sector.findById(sector._id);
    assert.equal(stored.active, false);
  });
});

describe("GET /api/sectors/:id/members", () => {
  it("devuelve el sector y sus miembros activos", async () => {
    const sector = await createSector({ name: "Secretaría" });
    const miembro = await createUser({ sectors: [sector._id] });
    await createUser({ sectors: [sector._id], active: false });
    const { client } = await adminClient();

    const res = await client.get(`/api/sectors/${sector._id}/members`);

    assert.equal(res.status, 200);
    assert.equal(res.body.sector.name, "Secretaría");
    assert.deepEqual(
      res.body.members.map((m) => m.email),
      [miembro.email],
    );
  });

  it("no expone el password de los miembros", async () => {
    const sector = await createSector();
    await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client.get(`/api/sectors/${sector._id}/members`);

    for (const member of res.body.members) {
      assert.ok(!("password" in member));
    }
  });

  it("devuelve 404 para un sector inexistente", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/sectors/507f1f77bcf86cd799439011/members");

    assert.equal(res.status, 404);
  });
});