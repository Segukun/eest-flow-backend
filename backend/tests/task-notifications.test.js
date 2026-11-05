import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import Task from "../src/models/task.model.js";
import Notification from "../src/models/notification.model.js";
import { updateTask } from "../src/services/task.service.js";
import {
  app, request, resetDatabase, userClient, createUser, createSector, validTask,
} from "./helpers.js";

beforeEach(resetDatabase);

async function setup() {
  const actor = await userClient();
  const recipient = await userClient();
  const task = await Task.create(validTask({ assignedUser: [recipient.user._id] }));
  return { actor, recipient, task };
}

describe("Notificaciones al modificar tareas", () => {
  for (const [field, value] of [
    ["title", "Preparar acto escolar"],
    ["description", "Nueva descripción"],
    ["priority", "high"],
    ["dueDate", "2027-05-01T12:00:00.000Z"],
    ["state", "review"],
  ]) {
    it(`notifica una vez al cambiar ${field}, con actor y enlace real`, async () => {
      const { actor, recipient, task } = await setup();
      const res = await actor.client.put(`/api/tasks/${task._id}`).send({ [field]: value });
      assert.equal(res.status, 200);
      const notices = await Notification.find({});
      assert.equal(notices.length, 1);
      const notice = notices[0];
      assert.equal(String(notice.recipient), String(recipient.user._id));
      assert.equal(String(notice.actor), String(actor.user._id));
      assert.equal(notice.category, "task");
      assert.equal(notice.type, "task_updated");
      assert.equal(notice.read, false);
      assert.ok(notice.description.includes(res.body.title));
      assert.equal(notice.link, `/?task=${task._id}`);

      const listed = await recipient.client.get("/api/notifications?filter=task");
      assert.equal(listed.status, 200);
      assert.equal(listed.body.data.notifications.length, 1);
      assert.equal(listed.body.data.notifications[0].actor.name, actor.user.name);
      const opened = await recipient.client.get(`/api/tasks/${task._id}`);
      assert.equal(opened.status, 200);
      assert.equal(opened.body.title, res.body.title);
    });
  }

  it("deduplica tres asignados y excluye al actor, incluso si está repetido", async () => {
    const { actor, recipient, task } = await setup();
    const sector = await createSector();
    const other = await createUser({ sectors: [sector._id] });
    task.assignedUser = [actor.user._id, recipient.user._id, other._id, recipient.user._id];
    await task.save();
    const res = await actor.client.put(`/api/tasks/${task._id}`).send({ title: "Cambio conjunto", priority: "high", state: "completed" });
    assert.equal(res.status, 200);
    const notices = await Notification.find({});
    assert.deepEqual(notices.map((n) => String(n.recipient)).sort(), [String(recipient.user._id), String(other._id)].sort());
    assert.ok(notices.every((n) => n.type === "task_updated"));
  });

  it("conserva asignación para nuevos responsables y avisa actualización a los actuales", async () => {
    const { actor, recipient, task } = await setup();
    const sector = await createSector();
    const added = await createUser({ sectors: [sector._id] });
    const removed = await createUser({ sectors: [sector._id] });
    task.assignedUser.push(removed._id);
    await task.save();
    const res = await actor.client.put(`/api/tasks/${task._id}`).send({
      assignedUser: [String(recipient.user._id), String(added._id), String(added._id)],
    });
    assert.equal(res.status, 200);
    const notices = await Notification.find({});
    assert.equal(notices.length, 2);
    assert.equal(notices.find((n) => String(n.recipient) === String(added._id)).type, "task_assigned");
    assert.equal(notices.find((n) => String(n.recipient) === String(recipient.user._id)).type, "task_updated");
    assert.equal(notices.some((n) => String(n.recipient) === String(removed._id)), false);
  });

  it("no avisa por datos equivalentes, campos internos ni reintentos sin cambios", async () => {
    const { actor, recipient, task } = await setup();
    const res = await actor.client.put(`/api/tasks/${task._id}`).send({
      title: `  ${task.title}  `,
      description: task.description,
      priority: task.priority,
      state: task.state,
      dueDate: null,
      assignedUser: [String(recipient.user._id), String(recipient.user._id)],
      order: 5,
    });
    assert.equal(res.status, 200);
    assert.equal(await Notification.countDocuments(), 0);
    for (let i = 0; i < 2; i++) {
      assert.equal((await actor.client.put(`/api/tasks/${task._id}`).send({ priority: "high" })).status, 200);
    }
    assert.equal(await Notification.countDocuments(), 1);
  });

  it("no notifica sin responsables ni cuando solo está asignado el actor", async () => {
    const { actor, task } = await setup();
    for (const assignedUser of [[], [actor.user._id]]) {
      task.assignedUser = assignedUser;
      await task.save();
      assert.equal((await actor.client.put(`/api/tasks/${task._id}`).send({ title: `Cambio ${assignedUser.length}` })).status, 200);
    }
    assert.equal(await Notification.countDocuments(), 0);
  });

  it("no genera notificaciones si la validación, autenticación o actualización falla", async () => {
    const { actor, task } = await setup();
    assert.equal((await request(app).put(`/api/tasks/${task._id}`).send({ priority: "high" })).status, 401);
    assert.equal((await actor.client.put(`/api/tasks/${task._id}`).send({ title: "x".repeat(101) })).status, 400);
    assert.equal((await actor.client.put("/api/tasks/507f1f77bcf86cd799439011").send({ priority: "high" })).status, 404);
    await assert.rejects(updateTask(task._id, { priority: "invalid" }, actor.user));
    assert.equal(await Notification.countDocuments(), 0);
    assert.equal((await Task.findById(task._id)).priority, task.priority);
  });

  it("PATCH move notifica solo el cambio de estado, no el reordenamiento de otras tarjetas", async () => {
    const { actor, recipient, task } = await setup();
    task.assignedUser.push(actor.user._id);
    await task.save();
    const sibling = await Task.create(validTask({ state: "review", assignedUser: [recipient.user._id] }));
    const res = await actor.client.patch(`/api/tasks/${task._id}/move`).send({ state: "review", beforeId: String(sibling._id) });
    assert.equal(res.status, 200);
    assert.equal(res.body.state, "review");
    assert.equal(await Notification.countDocuments(), 1);
    assert.equal((await Notification.findOne()).link, `/?task=${task._id}`);
    for (const beforeId of [null, String(task._id)]) {
      assert.equal((await actor.client.patch(`/api/tasks/${task._id}/move`).send({ state: "review", beforeId })).status, 200);
    }
    assert.equal(await Notification.countDocuments(), 1);
  });

  it("un movimiento fallido no notifica", async () => {
    const { actor, task } = await setup();
    const res = await actor.client.patch(`/api/tasks/${task._id}/move`).send({ state: "review", beforeId: "507f1f77bcf86cd799439011" });
    assert.equal(res.status, 409);
    assert.equal((await Task.findById(task._id)).state, "pending");
    assert.equal(await Notification.countDocuments(), 0);
  });

  it("un fallo secundario al notificar no revierte la tarea", async (t) => {
    const { actor, task } = await setup();
    t.mock.method(Notification, "insertMany", async () => { throw new Error("notification unavailable"); });
    const log = t.mock.method(console, "error", () => {});
    const res = await actor.client.put(`/api/tasks/${task._id}`).send({ priority: "high" });
    assert.equal(res.status, 200);
    assert.equal((await Task.findById(task._id)).priority, "high");
    assert.equal(await Notification.countDocuments(), 0);
    assert.equal(log.mock.callCount(), 1);
  });
});
