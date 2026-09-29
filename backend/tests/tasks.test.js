import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Task from "../src/models/task.model.js";
import {
  adminClient,
  app,
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

describe("POST /api/tasks", () => {
  it("exige autenticación", async () => {
    const res = await request(app).post("/api/tasks").send(validTask());

    assert.equal(res.status, 401);
  });

  it("crea la tarea y la persiste", async () => {
    const { client } = await adminClient();
    const payload = validTask();

    const res = await client.post("/api/tasks").send(payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.title, payload.title);
    assert.equal(res.body.priority, "medium");
    assert.equal(res.body.state, "pending");

    // persistencia real, no solo el status
    const stored = await Task.findOne({ title: payload.title });
    assert.ok(stored, "la tarea debería estar en la base");
    assert.equal(stored.description, payload.description);
    assert.equal(stored.deletedAt, null);
  });

  it("acepta assignedUser como array y lo guarda como tal", async () => {
    const sector = await createSector();
    const asignado = await createUser({ sectors: [sector._id] });
    const otro = await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client
      .post("/api/tasks")
      .send(validTask({ assignedUser: [asignado._id.toString(), otro._id.toString()] }));

    assert.equal(res.status, 201);

    const stored = await Task.findOne({ title: res.body.title });
    assert.equal(stored.assignedUser.length, 2);
    assert.equal(stored.assignedUser[0].toString(), asignado._id.toString());
  });

  it("convierte dueDate desde string con z.coerce.date", async () => {
    const { client } = await adminClient();
    const dueDate = "2030-03-15T10:00:00.000Z";

    const res = await client.post("/api/tasks").send(validTask({ dueDate }));

    assert.equal(res.status, 201);

    const stored = await Task.findById(res.body._id);
    assert.ok(stored.dueDate instanceof Date);
    assert.equal(stored.dueDate.toISOString(), dueDate);
  });

  it("acepta category y labels válidos", async () => {
    const sector = await createSector();
    const category = await createCategory({ sectors: [sector._id] });
    const label = await createLabel({ category: category._id });
    const { client } = await adminClient();

    const res = await client.post("/api/tasks").send(
      validTask({
        category: category._id.toString(),
        labels: [label._id.toString()],
      }),
    );

    assert.equal(res.status, 201);

    const stored = await Task.findById(res.body._id);
    assert.equal(stored.category.toString(), category._id.toString());
    assert.equal(stored.labels[0].toString(), label._id.toString());
  });

  it("rechaza un title faltante con 400", async () => {
    const { client } = await adminClient();
    const payload = validTask();
    delete payload.title;

    const res = await client.post("/api/tasks").send(payload);

    assert.equal(res.status, 400);
    assert.equal(await Task.countDocuments({}), 0);
  });

  it("rechaza una description faltante con 400", async () => {
    const { client } = await adminClient();
    const payload = validTask();
    delete payload.description;

    const res = await client.post("/api/tasks").send(payload);

    assert.equal(res.status, 400);
  });

  it("rechaza un priority fuera del enum con 400", async () => {
    const { client } = await adminClient();

    const res = await client
      .post("/api/tasks")
      .send(validTask({ priority: "urgente" }));

    assert.equal(res.status, 400);
  });

  it("rechaza un state fuera del enum con 400", async () => {
    const { client } = await adminClient();

    const res = await client
      .post("/api/tasks")
      .send(validTask({ state: "hecho" }));

    assert.equal(res.status, 400);
  });

  it("rechaza un assignedUser que no es ObjectId (regresión N7)", async () => {
    const { client } = await adminClient();

    const res = await client
      .post("/api/tasks")
      .send(validTask({ assignedUser: ["no-es-un-objectid"] }));

    assert.equal(res.status, 400);
    assert.match(res.body.message, /assignedUser/i);
  });

  it("rechaza un category que no es ObjectId (regresión N7)", async () => {
    const { client } = await adminClient();

    const res = await client
      .post("/api/tasks")
      .send(validTask({ category: "no-es-un-objectid" }));

    assert.equal(res.status, 400);
    assert.match(res.body.message, /category/i);
  });

  it("rechaza un label que no es ObjectId", async () => {
    const { client } = await adminClient();

    const res = await client
      .post("/api/tasks")
      .send(validTask({ labels: ["no-es-un-objectid"] }));

    assert.equal(res.status, 400);
  });

  it("no crea la tarea si assignedUser es un string suelto en vez de array", async () => {
    const sector = await createSector();
    const asignado = await createUser({ sectors: [sector._id] });
    const { client } = await adminClient();

    const res = await client
      .post("/api/tasks")
      .send(validTask({ assignedUser: asignado._id.toString() }));

    assert.equal(res.status, 400);
    assert.equal(await Task.countDocuments({}), 0);
  });

  it("permite crear sin category (opcional)", async () => {
    const { client } = await adminClient();

    const res = await client.post("/api/tasks").send(validTask());

    assert.equal(res.status, 201);

    const stored = await Task.findById(res.body._id);
    assert.equal(stored.category, null);
  });

  it("rechaza un title duplicado con 409", async () => {
    const { client } = await adminClient();
    const payload = validTask();

    await client.post("/api/tasks").send(payload);
    const res = await client.post("/api/tasks").send(payload);

    assert.equal(res.status, 409);
    assert.equal(await Task.countDocuments({}), 1);
  });
});

describe("GET /api/tasks", () => {
  it("exige autenticación", async () => {
    const res = await request(app).get("/api/tasks");

    assert.equal(res.status, 401);
  });

  it("lista las tareas y permite recuperarlas por id", async () => {
    const { client } = await adminClient();
    const payload = validTask();

    const created = await client.post("/api/tasks").send(payload);

    const list = await client.get("/api/tasks");
    assert.equal(list.status, 200);
    assert.ok(list.body.some((t) => t.title === payload.title));

    const one = await client.get(`/api/tasks/${created.body._id}`);
    assert.equal(one.status, 200);
    assert.equal(one.body.title, payload.title);
  });
});

describe("GET /api/tasks/:id", () => {
  it("devuelve 404 para una tarea inexistente", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/tasks/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });

  it("devuelve 400 para un id mal formado (regresión N4)", async () => {
    const { client } = await adminClient();

    const res = await client.get("/api/tasks/no-es-un-objectid");

    assert.equal(res.status, 400);
  });
});

describe("PUT /api/tasks/:id", () => {
  it("actualiza state y labels, y el cambio queda persistido", async () => {
    const sector = await createSector();
    const category = await createCategory({ sectors: [sector._id] });
    const label = await createLabel({ category: category._id });
    const { client } = await adminClient();
    const created = await client.post("/api/tasks").send(validTask());

    const res = await client.put(`/api/tasks/${created.body._id}`).send({
      state: "completed",
      labels: [label._id.toString()],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.state, "completed");

    // re-consulta para confirmar que quedó en la base
    const stored = await Task.findById(created.body._id);
    assert.equal(stored.state, "completed");
    assert.equal(stored.labels[0].toString(), label._id.toString());
  });

  it("es un update parcial: no borra los campos que no se envían", async () => {
    const { client } = await adminClient();
    const payload = validTask();
    const created = await client.post("/api/tasks").send(payload);

    const res = await client
      .put(`/api/tasks/${created.body._id}`)
      .send({ state: "in_progress" });

    assert.equal(res.status, 200);

    const stored = await Task.findById(created.body._id);
    assert.equal(stored.title, payload.title);
    assert.equal(stored.description, payload.description);
    assert.equal(stored.priority, payload.priority);
    assert.equal(stored.state, "in_progress");
  });

  it("rechaza un state inválido con 400", async () => {
    const { client } = await adminClient();
    const created = await client.post("/api/tasks").send(validTask());

    const res = await client
      .put(`/api/tasks/${created.body._id}`)
      .send({ state: "inventado" });

    assert.equal(res.status, 400);
  });

  it("devuelve 404 para una tarea inexistente", async () => {
    const { client } = await adminClient();

    const res = await client
      .put("/api/tasks/507f1f77bcf86cd799439011")
      .send({ state: "completed" });

    assert.equal(res.status, 404);
  });

  it("devuelve 400 para un id mal formado", async () => {
    const { client } = await adminClient();

    const res = await client
      .put("/api/tasks/no-es-un-objectid")
      .send({ state: "completed" });

    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/tasks/:id", () => {
  it("un collaborator no puede borrar tareas (403)", async () => {
    const sector = await createSector();
    const { client } = await loginAs(
      await createUser({ sectors: [sector._id] }),
    );
    const admin = await adminClient();
    const created = await admin.client.post("/api/tasks").send(validTask());

    const res = await client.delete(`/api/tasks/${created.body._id}`);

    assert.equal(res.status, 403);

    const stored = await Task.findById(created.body._id);
    assert.equal(stored.deletedAt, null);
  });

  it("un admin hace soft delete y la tarea desaparece del listado", async () => {
    const { client } = await adminClient();
    const payload = validTask();
    const created = await client.post("/api/tasks").send(payload);

    const res = await client.delete(`/api/tasks/${created.body._id}`);

    assert.equal(res.status, 200);

    const stored = await Task.findById(created.body._id);
    assert.ok(stored.deletedAt instanceof Date, "debería tener deletedAt");

    const list = await client.get("/api/tasks");
    assert.ok(!list.body.some((t) => t.title === payload.title));
  });

  it("una tarea soft-deleted devuelve 404 al pedirla por id", async () => {
    const { client } = await adminClient();
    const created = await client.post("/api/tasks").send(validTask());

    await client.delete(`/api/tasks/${created.body._id}`);

    const res = await client.get(`/api/tasks/${created.body._id}`);
    assert.equal(res.status, 404);
  });

  it("no se puede actualizar una tarea soft-deleted (fuga de soft delete)", async () => {
    const { client } = await adminClient();
    const created = await client.post("/api/tasks").send(validTask());

    await client.delete(`/api/tasks/${created.body._id}`);
    const res = await client
      .put(`/api/tasks/${created.body._id}`)
      .send({ state: "completed" });

    assert.equal(res.status, 404);

    const stored = await Task.findById(created.body._id);
    assert.equal(stored.state, "pending", "no debería haberse modificado");
  });

  it("permite reutilizar el título de una tarea soft-deleted (regresión N13)", async () => {
    const { client } = await adminClient();
    const payload = validTask();
    const created = await client.post("/api/tasks").send(payload);

    await client.delete(`/api/tasks/${created.body._id}`);

    const res = await client.post("/api/tasks").send(payload);
    assert.equal(res.status, 201);
    assert.notEqual(res.body._id, created.body._id);
  });

  it("devuelve 404 al borrar una tarea inexistente", async () => {
    const { client } = await adminClient();

    const res = await client.delete("/api/tasks/507f1f77bcf86cd799439011");

    assert.equal(res.status, 404);
  });
});