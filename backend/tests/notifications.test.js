import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import Notification from "../src/models/notification.model.js";
import {
  app,
  createSector,
  createUser,
  request,
  resetDatabase,
  userClient,
} from "./helpers.js";

beforeEach(resetDatabase);

// El modelo de User exige al menos un sector; para destinatarios/actores que no
// inician sesión alcanza con crearles uno.
async function standbyUser(overrides = {}) {
  const sector = await createSector();
  return createUser({ sectors: [sector._id], ...overrides });
}

async function makeNotification(recipient, overrides = {}) {
  return Notification.create({
    recipient,
    category: overrides.category ?? "forum",
    type: overrides.type ?? "post_like",
    title: overrides.title ?? "Algo pasó",
    description: overrides.description ?? "",
    ...overrides,
  });
}

describe("GET /api/notifications", () => {
  it("exige autenticación", async () => {
    const res = await request(app).get("/api/notifications");

    assert.equal(res.status, 401);
  });

  it("devuelve solo las notificaciones del usuario y con el envelope { data }", async () => {
    const { user, client } = await userClient();
    const otro = await userClient();
    await makeNotification(user._id, { title: "Mía" });
    await makeNotification(otro.user._id, { title: "Ajena" });

    const res = await client.get("/api/notifications");

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.notifications.map((n) => n.title),
      ["Mía"],
    );
  });

  it("devuelve las notificaciones propias con actor poblado y paginación", async () => {
    const { user, client } = await userClient();
    const actor = await standbyUser({ name: "Ana", accountType: "collaborator" });
    await makeNotification(user._id, {
      actor: actor._id,
      title: "Mía",
      category: "forum",
    });

    const res = await client.get("/api/notifications");

    assert.equal(res.status, 200);
    assert.equal(res.body.data.notifications.length, 1);
    assert.equal(res.body.data.notifications[0].title, "Mía");
    assert.equal(res.body.data.notifications[0].actor.name, "Ana");
    assert.equal(res.body.data.notifications[0].actor.accountType, "collaborator");
    assert.equal(res.body.data.unreadCount, 1);
    assert.deepEqual(res.body.data.pagination, {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("filtra por no leídas", async () => {
    const { user, client } = await userClient();
    await makeNotification(user._id, { title: "Sin leer" });
    await makeNotification(user._id, { title: "Leída", read: true });

    const res = await client.get("/api/notifications?filter=unread");

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.notifications.map((n) => n.title),
      ["Sin leer"],
    );
    assert.equal(res.body.data.unreadCount, 1);
    assert.equal(res.body.data.pagination.total, 1);
  });

  it("filtra por foro", async () => {
    const { user, client } = await userClient();
    await makeNotification(user._id, { title: "Foro", category: "forum" });
    await makeNotification(user._id, { title: "Sistema", category: "system" });

    const res = await client.get("/api/notifications?filter=forum");

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.notifications.map((n) => n.title),
      ["Foro"],
    );
  });

  it("rechaza un filtro inválido con 400", async () => {
    const { client } = await userClient();

    const res = await client.get("/api/notifications?filter=inventado");

    assert.equal(res.status, 400);
  });

  it("rechaza una página inválida con 400", async () => {
    const { client } = await userClient();

    const res = await client.get("/api/notifications?page=abc");

    assert.equal(res.status, 400);
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("exige autenticación", async () => {
    const res = await request(app).get("/api/notifications/unread-count");

    assert.equal(res.status, 401);
  });

  it("cuenta solo las no leídas del usuario", async () => {
    const { user, client } = await userClient();
    await makeNotification(user._id);
    await makeNotification(user._id);
    await makeNotification(user._id, { read: true });
    await makeNotification((await standbyUser())._id);

    const res = await client.get("/api/notifications/unread-count");

    assert.equal(res.status, 200);
    assert.equal(res.body.data.count, 2);
  });
});

describe("PATCH /api/notifications/:id/read", () => {
  it("exige autenticación", async () => {
    const res = await request(app).patch(
      "/api/notifications/507f1f77bcf86cd799439011/read",
    );

    assert.equal(res.status, 401);
  });

  it("marca como leída una notificación propia", async () => {
    const { user, client } = await userClient();
    const notificacion = await makeNotification(user._id);

    const res = await client.patch(`/api/notifications/${notificacion._id}/read`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.read, true);
    assert.ok(res.body.data.readAt);

    const stored = await Notification.findById(notificacion._id);
    assert.equal(stored.read, true);
  });

  it("devuelve 404 al intentar leer una notificación ajena", async () => {
    const { client } = await userClient();
    const ajena = await makeNotification((await standbyUser())._id);

    const res = await client.patch(`/api/notifications/${ajena._id}/read`);

    assert.equal(res.status, 404);
  });

  it("devuelve 400 para un id mal formado", async () => {
    const { client } = await userClient();

    const res = await client.patch("/api/notifications/no-es-un-objectid/read");

    assert.equal(res.status, 400);
  });

  it("devuelve 404 para una notificación inexistente", async () => {
    const { client } = await userClient();

    const res = await client.patch(
      "/api/notifications/507f1f77bcf86cd799439011/read",
    );

    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/notifications/read-all", () => {
  it("exige autenticación", async () => {
    const res = await request(app).patch("/api/notifications/read-all");

    assert.equal(res.status, 401);
  });

  it("marca todas las no leídas del usuario", async () => {
    const { user, client } = await userClient();
    await makeNotification(user._id);
    await makeNotification(user._id);
    const ajena = await makeNotification((await standbyUser())._id);

    const res = await client.patch("/api/notifications/read-all");

    assert.equal(res.status, 200);
    assert.equal(res.body.data.updated, 2);

    assert.equal(
      await Notification.countDocuments({ recipient: user._id, read: false }),
      0,
    );
    assert.equal((await Notification.findById(ajena._id)).read, false);
  });
});
