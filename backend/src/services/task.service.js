import mongoose from "mongoose";
import Task from "../models/task.model.js";
import ApiError from "../utils/apiError.js";
import { safeNotify } from "./notification.service.js";

const toIds = (list) => (Array.isArray(list) ? list.map(String) : []);

const notifyAssigned = (task, recipients, actor) =>
  safeNotify({
    recipients,
    actorId: actor?._id,
    category: "task",
    type: "task_assigned",
    title: `Te asignaron la tarea: ${task.title}`,
    description: "Tocá para verla en el tablero",
    link: `/?task=${task._id}`,
  });

// posición libre al final de una columna
const nextPosition = async (category, state, excludeId = null) => {
  const filter = { deletedAt: null, category: category ?? null, state };
  if (excludeId) filter._id = { $ne: excludeId };

  const last = await Task.findOne(filter).sort({ position: -1 }).select("position");
  return (last?.position ?? -1) + 1;
};

export const createTask = async (taskData, actor) => {
  const exists = await Task.findOne({ title: taskData.title, deletedAt: null });
  if (exists) {
    throw new ApiError(409, "A task with that title already exists");
  }

  const state = taskData.state ?? "pending";
  const position = await nextPosition(taskData.category, state);

  const task = await Task.create({ ...taskData, state, position });
  await notifyAssigned(task, toIds(task.assignedUser), actor);
  return task;
};

export const getTasks = async () => {
  // el orden por posición se respeta dentro de cada columna
  return await Task.find({ deletedAt: null }).sort({ position: 1, createdAt: 1 });
};

export const getTasksById = async (taskId) => {
  const task = await Task.findOne({ _id: taskId, deletedAt: null });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
};

export const updateTask = async (taskId, taskData, actor) => {
  const previous = await Task.findOne({ _id: taskId, deletedAt: null }).select(
    "assignedUser state category",
  );
  if (!previous) throw new ApiError(404, "Task not found");

  const update = { ...taskData };

  // si cambia de columna por edición (no por drag and drop), queda al final de la nueva
  if (update.state !== undefined && update.state !== previous.state) {
    update.position = await nextPosition(
      update.category ?? previous.category,
      update.state,
      taskId,
    );
  }

  const task = await Task.findOneAndUpdate({ _id: taskId, deletedAt: null }, update, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!task) throw new ApiError(404, "Task not found");

  if (taskData.assignedUser !== undefined) {
    const before = toIds(previous.assignedUser);
    const newlyAssigned = toIds(task.assignedUser).filter((id) => !before.includes(id));
    await notifyAssigned(task, newlyAssigned, actor);
  }

  return task;
};

/**
 * Mueve una tarea a una columna y la inserta ANTES de `beforeId`
 * (null = al final). Renumera toda la columna destino para que las
 * posiciones queden consecutivas y sin empates.
 */
export const moveTask = async (taskId, { state, beforeId = null }) => {
  if (!mongoose.isValidObjectId(taskId)) throw new ApiError(400, "Invalid task id");

  const task = await Task.findOne({ _id: taskId, deletedAt: null }).select("category state");
  if (!task) throw new ApiError(404, "Task not found");

  // soltar una tarjeta sobre sí misma no cambia nada
  if (beforeId && String(beforeId) === String(taskId)) {
    return await Task.findById(taskId);
  }

  const siblings = await Task.find({
    deletedAt: null,
    category: task.category ?? null,
    state,
    _id: { $ne: taskId },
  })
    .sort({ position: 1, createdAt: 1 })
    .select("_id");

  const ids = siblings.map((t) => String(t._id));

  let index = ids.length;
  if (beforeId) {
    index = ids.indexOf(String(beforeId));
    if (index === -1) {
      // la tarjeta de referencia ya no está en esa columna (otro usuario la movió)
      throw new ApiError(409, "The reference task is no longer in that column");
    }
  }

  ids.splice(index, 0, String(taskId));

  await Task.bulkWrite(
    ids.map((id, position) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: id === String(taskId) ? { position, state } : { position } },
      },
    })),
  );

  return await Task.findById(taskId);
};

export const softDeleteTask = async (taskId) => {
  const task = await Task.findByIdAndUpdate(
    taskId,
    { deletedAt: new Date() },
    { returnDocument: "after" },
  );
  if (!task) throw new ApiError(404, "Task not found");
  return task;
};