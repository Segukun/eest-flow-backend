import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Label from "../src/models/label.model.js";
import Task from "../src/models/task.model.js";
import {
  adminClient,
  app,
  COLORS,
  createCategory,
  createLabel,
  createSector,
  createUser,
  loginAs,
  request,
  resetDatabase,
  validTask,
} from "./helpers.js";

beforeEach(resetDatabase);

// base para las categorías, porque una label siempre pertenece a una
async function categoryFixture() {
  const sector = await createSector();
  return createCategory({ sectors: [sector._id] });
}

describe("POST /api/labels", () => {
  it("exige autenticación", async () => {
    const category = await categoryFixture();

    const res = await request(app)
      .post("/api/labels")
      .send({ title: "Urgente", color: COLORS.valid, category: category._id });

    assert.equal(res.status, 401);
  });

  it("un collaborator no puede crear labels (403)", async () => {
    const category = await categoryFixture();
    const { client } = await loginAs(
      await createUser({ sectors: [category.sectors[0]] }),
    );

    const res = await client
      .post("/api/labels")
      .send({ title: "Urgente", color: COLORS.valid, category: category._id });

    assert.equal(res.status, 403);
    assert.equal(await Label.countDocuments({}), 0);
  });

  it("un admin crea la label y persiste", async () => {
    const category = await categoryFixture();
    const { client } = await adminClient();

    const res = await client.post("/api/labels").send({
      title: "Urgente",
      color: COLORS.valid,
      category: category._id.toString(),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.title, "Urgente");

    const stored = await Label.findById(res.body._id);
    assert.equal(stored.category.toString(), category._id.toString());
    assert.equal(stored.active, true);
  });

  it("acepta una label sin title, solo color", async () => {
    const category = await categoryFixture();
    const { client } = await adminClient();

    const res = await client.post("/api/labels").send({
      color: COLORS.cssVar,
      category: category._id.toString(),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.title, "");

    const stored = await Label.findById(res.body._id);
    assert.equal(stored.title, "");
  });

  it("acepta un color CSS var", async () => {
    const category = await categoryFixture();
    const { client } = await adminClient();

    const res = await client.post("/api/labels").send({
      title: "Variable",
      color: COLORS.cssVar,
      category: category._id.toString(),
    });

    assert.equal(res.status, 201);
  });

  it("rechaza un color con formato inválido con 400 (regla del modelo)", async () => {
    const category = await categoryFixture();
    const { client } = await adminClient();

    const res = await client.post("/api/labels").send({
      title: "Mala",
      color: COLORS.invalid,
      category: category._id.toString(),
    });

    assert.equal(res.status, 400);
    assert.equal(await Label.countDocuments({}), 0);
  });

  it("rechaza una category que no es ObjectId con 400", async () => {
    const { client } = await adminClient();

    const res = await client.post("/api/labels").send({
      title: "Sin categoría",
      color: COLORS.valid,
      category: "no-es-un-objectid",
    });

    assert.equal(res.status, 400);
  });

  it("rechaza una category faltante con 400", async () => {
    const { client } = await adminClient();

    const res = await client
      .post("/api/labels")
      .send({ title: "Sin categoría", color: COLORS.valid });

    assert.equal(res.status, 400);
  });

  it("rechaza un title duplicado en la misma categoría con 409", async () => {
    const category = await categoryFixture();
    const { client } = await adminClient();

    await client
      .post("/api/labels")
      .send({ title: "Dup", color: COLORS.valid, category: category._id.toString() });
    const res = await client
      .post("/api/labels")
      .send({ title: "Dup", color: COLORS.valid, category: category._id.toString() });

    assert.equal(res.status, 409);
  });
});

describe("GET /api/labels?category=<id>", () => {
  it("exige autenticación", async () => {
    const res = await request(app).get("/api/labels?category=507f1f77bcf86cd799439011");

    assert.equal(res.status, 401);
  });

  it("devuelve 400 si falta category", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/labels");

    assert.equal(res.status, 400);
  });

  it("devuelve 400 si category no es un ObjectId", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/labels?category=no-es-un-objectid");

    assert.equal(res.status, 400);
  });

  it("solo devuelve las labels de esa categoría (regresión N5)", async () => {
    const categoryA = await categoryFixture();
    const categoryB = await categoryFixture();
    const deA = await createLabel({ title: "De A", category: categoryA._id });
    const deB = await createLabel({ title: "De B", category: categoryB._id });
    const { client } = await adminClient();

    const res = await client.get(`/api/labels?category=${categoryA._id}`);

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((l) => l.title),
      ["De A"],
    );
    assert.ok(!res.body.some((l) => l._id === deB._id.toString()));
    assert.ok(res.body.some((l) => l._id === deA._id.toString()));
  });

  it("no incluye las labels desactivadas", async () => {
    const category = await categoryFixture();
    await createLabel({ title: "Activa", category: category._id });
    const inactiva = await createLabel({
      title: "Inactiva",
      category: category._id,
      active: false,
    });
    const { client } = await adminClient();

    const res = await client.get(`/api/labels?category=${category._id}`);

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((l) => l.title),
      ["Activa"],
    );
    assert.ok(!res.body.some((l) => l._id === inactiva._id.toString()));
  });
});

describe("GET /api/labels/:id", () => {
  it("devuelve la label puntual (regresión N5: la ruta estaba inalcanzable)", async () => {
    const category = await categoryFixture();
    const label = await createLabel({ title: "Puntual", category: category._id });
    const { client } = await adminClient();

    const res = await client.get(`/api/labels/${label._id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.title, "Puntual");
  });

  it("devuelve 404 para una label inexistente", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/labels/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });

  it("devuelve 400 para un id mal formado", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/labels/no-es-un-objectid");

    assert.equal(res.status, 400);
  });
});

describe("PUT /api/labels/:id", () => {
  it("un admin actualiza title y color, y el cambio persiste", async () => {
    const category = await categoryFixture();
    const label = await createLabel({ title: "Antes", category: category._id });
    const { client } = await adminClient();

    const res = await client.put(`/api/labels/${label._id}`).send({
      title: "Despues",
      color: "#00ff00",
    });

    assert.equal(res.status, 200);

    const stored = await Label.findById(label._id);
    assert.equal(stored.title, "Despues");
    assert.equal(stored.color, "#00ff00");
  });

  it("rechaza un color inválido con 400", async () => {
    const category = await categoryFixture();
    const label = await createLabel({ title: "Antes", category: category._id });
    const { client } = await adminClient();

    const res = await client
      .put(`/api/labels/${label._id}`)
      .send({ color: COLORS.invalid });

    assert.equal(res.status, 400);

    const stored = await Label.findById(label._id);
    assert.equal(stored.color, COLORS.valid, "no debería haberse modificado");
  });

  it("un collaborator no puede actualizar labels (403)", async () => {
    const category = await categoryFixture();
    const label = await createLabel({ title: "Antes", category: category._id });
    const { client } = await loginAs(
      await createUser({ sectors: [category.sectors[0]] }),
    );

    const res = await client
      .put(`/api/labels/${label._id}`)
      .send({ title: "Hackeada" });

    assert.equal(res.status, 403);
  });

  it("devuelve 404 para una label inexistente", async () => {
    const { client } = await adminClient();

    const res = await client
      .put("/api/labels/507f1f77bcf86cd799439011")
      .send({ title: "Nada" });

    assert.equal(res.status, 404);
  });
});

describe("DELETE /api/labels/:id", () => {
  it("un admin desactiva la label y desaparece del listado", async () => {
    const category = await categoryFixture();
    const label = await createLabel({ title: "Temporal", category: category._id });
    const { client } = await adminClient();

    const res = await client.delete(`/api/labels/${label._id}`);

    assert.equal(res.status, 200);

    const stored = await Label.findById(label._id);
    assert.equal(stored.active, false);

    const list = await client.get(`/api/labels?category=${category._id}`);
    assert.ok(!list.body.some((l) => l._id === label._id.toString()));
  });

  it("una tarea que ya referencia la label conserva la referencia", async () => {
    const category = await categoryFixture();
    const label = await createLabel({ title: "Se queda", category: category._id });
    const { client } = await adminClient();
    const task = await client.post("/api/tasks").send(
      validTask({ labels: [label._id.toString()] }),
    );

    await client.delete(`/api/labels/${label._id}`);

    const res = await client.get(`/api/tasks/${task.body._id}`);
    assert.equal(res.status, 200);

    const stored = await Task.findById(task.body._id);
    assert.equal(stored.labels.length, 1, "la referencia no debería borrarse");
    assert.equal(stored.labels[0].toString(), label._id.toString());
  });

  it("un collaborator no puede desactivar labels (403)", async () => {
    const category = await categoryFixture();
    const label = await createLabel({ title: "Intacta", category: category._id });
    const { client } = await loginAs(
      await createUser({ sectors: [category.sectors[0]] }),
    );

    const res = await client.delete(`/api/labels/${label._id}`);

    assert.equal(res.status, 403);

    const stored = await Label.findById(label._id);
    assert.equal(stored.active, true);
  });

  it("devuelve 404 para una label inexistente", async () => {
    const { client } = await adminClient();

    const res = await client.delete("/api/labels/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });
});