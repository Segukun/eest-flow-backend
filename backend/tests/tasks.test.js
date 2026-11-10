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

  it("crea sin description y persiste el valor vacio por defecto", async () => {
    const { client } = await adminClient();
    const payload = validTask();
    delete payload.description;

    const res = await client.post("/api/tasks").send(payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.description, "");
    const stored = await Task.findById(res.body._id);
    assert.equal(stored.description, "");
    assert.equal(stored.title, payload.title);
  });

  for (const description of ["", "Texto valido", "a".repeat(500)]) {
    it(`crea con description de ${description.length} caracteres`, async () => {
      const { client } = await adminClient();
      const res = await client.post("/api/tasks").send(validTask({ description }));

      assert.equal(res.status, 201);
      assert.equal(res.body.description, description);
      const stored = await Task.findById(res.body._id);
      assert.equal(stored.description, description);
    });
  }

  for (const description of [null, 123, "a".repeat(501)]) {
    it(`rechaza description invalida: ${typeof description}, longitud ${description?.length ?? "n/a"}`, async () => {
      const { client } = await adminClient();
      const res = await client.post("/api/tasks").send(validTask({ description }));
      assert.equal(res.status, 400);
      assert.equal(await Task.countDocuments({}), 0);
    });
  }

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

  it("permite crear dos tareas activas con el mismo título", async () => {
    const { client } = await adminClient();
    const payload = validTask();

    const first = await client.post("/api/tasks").send(payload);
    const second = await client.post("/api/tasks").send(payload);

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.body._id, second.body._id);
    assert.equal(second.body.title, payload.title);
    assert.equal(await Task.countDocuments({ title: payload.title, deletedAt: null }), 2);
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
  it("permite cambiar el título de una tarea por el de otra tarea activa", async () => {
    const { client } = await adminClient();
    const first = await client.post("/api/tasks").send(validTask());
    const second = await client.post("/api/tasks").send(validTask());
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);

    const updated = await client
      .put(`/api/tasks/${second.body._id}`)
      .send({ title: first.body.title });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.title, first.body.title);
    assert.notEqual(first.body._id, updated.body._id);
    assert.equal(await Task.countDocuments({ title: first.body.title, deletedAt: null }), 2);
  });

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

  for (const accountType of ["admin", "collaborator"]) {
    it(`${accountType} puede borrar la description sin alterar otros campos`, async () => {
      const sector = await createSector();
      const { client } = await loginAs(await createUser({ accountType, sectors: [sector._id] }));
      const payload = validTask({ description: "Texto anterior" });
      const created = await client.post("/api/tasks").send(payload);
      assert.equal(created.status, 201);

      const res = await client.put(`/api/tasks/${created.body._id}`).send({ description: "" });
      assert.equal(res.status, 200);
      assert.equal(res.body.description, "");
      const stored = await Task.findById(created.body._id);
      assert.equal(stored.description, "");
      for (const field of ["title", "priority", "state", "position", "category", "dueDate", "assignedUser", "labels", "deletedAt"]) {
        assert.deepEqual(res.body[field], created.body[field]);
      }
      const fetched = await client.get(`/api/tasks/${created.body._id}`);
      assert.equal(fetched.status, 200);
      assert.equal(fetched.body.description, "");
    });
  }

  it("un update vacio conserva la description anterior", async () => {
    const { client } = await adminClient();
    const created = await client.post("/api/tasks").send(validTask({ description: "Conservar" }));
    const res = await client.put(`/api/tasks/${created.body._id}`).send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.description, "Conservar");
    assert.equal((await Task.findById(created.body._id)).description, "Conservar");
  });

  for (const description of [null, 123, "a".repeat(501)]) {
    it(`update rechaza description invalida: ${typeof description}, longitud ${description?.length ?? "n/a"}`, async () => {
      const { client } = await adminClient();
      const created = await client.post("/api/tasks").send(validTask({ description: "Conservar" }));
      const res = await client.put(`/api/tasks/${created.body._id}`).send({ description });
      assert.equal(res.status, 400);
      assert.equal((await Task.findById(created.body._id)).description, "Conservar");
    });
  }

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
  it("exige autenticación y no modifica la tarea (401)", async () => {
    const { client } = await adminClient();
    const created = await client.post("/api/tasks").send(validTask());

    const res = await request(app).delete(`/api/tasks/${created.body._id}`);

    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Authentication required");

    const stored = await Task.findById(created.body._id);
    assert.equal(stored.deletedAt, null);
  });

  it("un collaborator hace soft delete y la tarea desaparece del listado", async () => {
    const sector = await createSector();
    const { client } = await loginAs(
      await createUser({ sectors: [sector._id] }),
    );
    const admin = await adminClient();
    const created = await admin.client.post("/api/tasks").send(validTask());

    const res = await client.delete(`/api/tasks/${created.body._id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Task soft deleted");

    const stored = await Task.findById(created.body._id);
    assert.ok(stored.deletedAt instanceof Date, "debería tener deletedAt");

    const list = await client.get("/api/tasks");
    assert.equal(list.status, 200);
    assert.ok(!list.body.some((t) => t._id === created.body._id));

    const one = await client.get(`/api/tasks/${created.body._id}`);
    assert.equal(one.status, 404);
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

  for (const accountType of ["admin", "collaborator"]) {
    it(`${accountType}: devuelve 404 al borrar una tarea inexistente`, async () => {
      const sector = await createSector();
      const { client } = await loginAs(
        await createUser({ accountType, sectors: [sector._id] }),
      );

      const res = await client.delete("/api/tasks/507f1f77bcf86cd799439011");

      assert.equal(res.status, 404);
      assert.equal(res.body.message, "Task not found");
    });

    it(`${accountType}: devuelve 400 para un id mal formado sin modificar tareas`, async () => {
      const sector = await createSector();
      const { client } = await loginAs(
        await createUser({ accountType, sectors: [sector._id] }),
      );
      const created = await client.post("/api/tasks").send(validTask());

      const res = await client.delete("/api/tasks/no-es-un-objectid");

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Cast to ObjectId failed/);

      const stored = await Task.findById(created.body._id);
      assert.equal(stored.deletedAt, null);
    });
  }
});

describe("restaurar tareas archivadas con títulos repetidos", () => {
  it("restaura una tarea aunque otra activa tenga el mismo título", async () => {
    const { client } = await adminClient();
    const payload = validTask();
    const archived = await client.post("/api/tasks").send(payload);
    assert.equal(archived.status, 201);
    assert.equal((await client.delete(`/api/tasks/${archived.body._id}`)).status, 200);
    const active = await client.post("/api/tasks").send(payload);
    assert.equal(active.status, 201);

    const restored = await client.patch(`/api/tasks/${archived.body._id}/restore`);

    assert.equal(restored.status, 200);
    assert.equal(restored.body._id, archived.body._id);
    assert.equal(restored.body.title, payload.title);
    assert.equal(restored.body.position, active.body.position + 1);
    assert.equal(restored.body.deletedAt, null);
    assert.equal(restored.body.deletedBy, null);
    assert.equal(await Task.countDocuments({ title: payload.title, deletedAt: null }), 2);
  });

  it("restaura en lote varias tareas con el mismo título sin duplicar IDs", async () => {
    const { client } = await adminClient();
    const payload = validTask();
    const first = await client.post("/api/tasks").send(payload);
    const second = await client.post("/api/tasks").send(payload);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal((await client.delete(`/api/tasks/${first.body._id}`)).status, 200);
    assert.equal((await client.delete(`/api/tasks/${second.body._id}`)).status, 200);
    const active = await client.post("/api/tasks").send(payload);
    assert.equal(active.status, 201);

    const result = await client.post("/api/tasks/archived/restore").send({
      ids: [first.body._id, second.body._id, first.body._id],
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body.failed, []);
    assert.deepEqual(
      result.body.restored.map((task) => task._id),
      [first.body._id, second.body._id],
    );
    assert.deepEqual(
      result.body.restored.map((task) => task.position),
      [active.body.position + 1, active.body.position + 2],
    );
    assert.equal(await Task.countDocuments({ title: payload.title, deletedAt: null }), 3);
  });
});

describe("límite de título de tareas", () => {
  it("crea con 100 caracteres y recorta espacios externos", async () => {
    const { client } = await adminClient();
    const title = "a".repeat(100);
    const res = await client.post("/api/tasks").send(validTask({ title: `  ${title}  ` }));
    assert.equal(res.status, 201);
    assert.equal(res.body.title, title);
    const stored = await Task.findById(res.body._id);
    assert.equal(stored.title, title);
  });

  it("rechaza crear con 101 caracteres sin persistir la tarea", async () => {
    const { client } = await adminClient();
    const res = await client.post("/api/tasks").send(validTask({ title: "a".repeat(101) }));
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Max 100 characters");
    assert.equal(await Task.countDocuments({}), 0);
  });

  it("edita con 100 caracteres", async () => {
    const { client } = await adminClient();
    const created = await client.post("/api/tasks").send(validTask());
    const title = "b".repeat(100);
    const res = await client.put(`/api/tasks/${created.body._id}`).send({ title });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, title);
    const stored = await Task.findById(created.body._id);
    assert.equal(stored.title, title);
  });

  it("rechaza editar con 101 caracteres y conserva el título anterior", async () => {
    const { client } = await adminClient();
    const created = await client.post("/api/tasks").send(validTask());
    const res = await client.put(`/api/tasks/${created.body._id}`).send({ title: "b".repeat(101) });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Max 100 characters");
    const stored = await Task.findById(created.body._id);
    assert.equal(stored.title, created.body.title);
  });

  it("rechaza títulos de solo espacios al crear y editar", async () => {
    const { client } = await adminClient();
    const invalid = await client.post("/api/tasks").send(validTask({ title: "   " }));
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.message, "Title is required");
    const created = await client.post("/api/tasks").send(validTask());
    const res = await client.put(`/api/tasks/${created.body._id}`).send({ title: "   " });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Title is required");
    assert.equal((await Task.findById(created.body._id)).title, created.body.title);
  });

  it("el modelo también rechaza títulos mayores a 100", async () => {
    await assert.rejects(Task.create(validTask({ title: "x".repeat(101) })), { name: "ValidationError" });
    assert.equal(await Task.countDocuments({}), 0);
  });
});
