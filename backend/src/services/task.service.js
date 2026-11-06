import mongoose from "mongoose";
import Task from "../models/task.model.js";
import ApiError from "../utils/apiError.js";
import { safeNotify } from "./notification.service.js";

import {
  uploadTaskFiles,
  getTaskFileSignedUrl,
  deleteTaskStoredFile,
} from "./task-attachment-storage.service.js";

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

const notifyUpdated = (task, recipients, actor) =>
  safeNotify({
    recipients,
    actorId: actor?._id,
    category: "task",
    type: "task_updated",
    title: "Tarea actualizada",
    description: `Se modificó la tarea "${task.title}".`,
    link: `/?task=${task._id}`,
  });

// Compara valores persistidos; reordenar IDs o reenviar los mismos datos no avisa.
const idSet = (list) => JSON.stringify([...new Set(toIds(list))].sort());
const hasRelevantChanges = (before, after) =>
  ["title", "description", "priority", "state"].some(
    (field) => before[field] !== after[field],
  ) ||
  (before.dueDate?.getTime() ?? null) !== (after.dueDate?.getTime() ?? null) ||
  String(before.category ?? "") !== String(after.category ?? "") ||
  idSet(before.assignedUser) !== idSet(after.assignedUser) ||
  idSet(before.labels) !== idSet(after.labels);

/**
 * Convierte documentos Mongoose a objetos de respuesta y
 * agrega URLs firmadas a los archivos adjuntos.
 */
const withAttachmentUrls = async (taskDocument) => {
  if (!taskDocument) return taskDocument;

  const task =
    typeof taskDocument.toObject === "function"
      ? taskDocument.toObject()
      : { ...taskDocument };

  task.attachments = await Promise.all(
    (task.attachments ?? []).map(async (attachment) => ({
      ...attachment,
      url: await getTaskFileSignedUrl(attachment.path),
    })),
  );

  return task;
};

// Posición libre al final de una columna.
const nextPosition = async (category, state, excludeId = null) => {
  const filter = {
    deletedAt: null,
    category: category ?? null,
    state,
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const last = await Task.findOne(filter)
    .sort({ position: -1 })
    .select("position");

  return (last?.position ?? -1) + 1;
};

export const createTask = async (taskData, actor) => {
  const state = taskData.state ?? "pending";
  const position = await nextPosition(taskData.category, state);

  const task = await Task.create({
    ...taskData,
    state,
    position,
  });

  await notifyAssigned(task, toIds(task.assignedUser), actor);

  return withAttachmentUrls(task);
};

export const getTasks = async () => {
  const tasks = await Task.find({
    deletedAt: null,
  }).sort({
    position: 1,
    createdAt: 1,
  });

  return Promise.all(tasks.map(withAttachmentUrls));
};

export const getTasksById = async (taskId) => {
  const task = await Task.findOne({
    _id: taskId,
    deletedAt: null,
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return withAttachmentUrls(task);
};

export const updateTask = async (taskId, taskData, actor) => {
  const previous = await Task.findOne({
    _id: taskId,
    deletedAt: null,
  }).select("title description priority dueDate assignedUser state category labels");

  if (!previous) {
    throw new ApiError(404, "Task not found");
  }

  const update = { ...taskData };

  // Si cambia de columna por edición, queda al final de la nueva.
  if (update.state !== undefined && update.state !== previous.state) {
    update.position = await nextPosition(
      update.category ?? previous.category,
      update.state,
      taskId,
    );
  }

  const task = await Task.findOneAndUpdate(
    {
      _id: taskId,
      deletedAt: null,
    },
    update,
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  if (hasRelevantChanges(previous, task)) {
    const before = new Set(toIds(previous.assignedUser));
    const assigned = toIds(task.assignedUser);

    // Cada destinatario recibe un solo aviso: asignación nueva o actualización.
    await notifyAssigned(task, assigned.filter((id) => !before.has(id)), actor);
    await notifyUpdated(task, assigned.filter((id) => before.has(id)), actor);
  }

  return withAttachmentUrls(task);
};

/**
 * Mueve una tarea a una columna y la inserta ANTES de beforeId
 * (null = al final). Renumera la columna destino sin empates.
 */
export const moveTask = async (taskId, { state, beforeId = null }, actor) => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(400, "Invalid task id");
  }

  const task = await Task.findOne({
    _id: taskId,
    deletedAt: null,
  }).select("category state");

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Soltar una tarjeta sobre sí misma no cambia nada.
  if (beforeId && String(beforeId) === String(taskId)) {
    return withAttachmentUrls(await Task.findById(taskId));
  }

  const siblings = await Task.find({
    deletedAt: null,
    category: task.category ?? null,
    state,
    _id: { $ne: taskId },
  })
    .sort({ position: 1, createdAt: 1 })
    .select("_id");

  const ids = siblings.map((item) => String(item._id));

  let index = ids.length;

  if (beforeId) {
    index = ids.indexOf(String(beforeId));

    if (index === -1) {
      throw new ApiError(
        409,
        "The reference task is no longer in that column",
      );
    }
  }

  ids.splice(index, 0, String(taskId));

  await Task.bulkWrite(
    ids.map((id, position) => ({
      updateOne: {
        filter: { _id: id },
        update: {
          $set:
            id === String(taskId)
              ? { position, state }
              : { position },
        },
      },
    })),
  );

  const moved = await Task.findById(taskId);

  if (moved && task.state !== moved.state) {
    await notifyUpdated(moved, toIds(moved.assignedUser), actor);
  }

  return withAttachmentUrls(moved);
};

/**
 * Agrega archivos a una tarea.
 */
export const addTaskAttachments = async (taskId, files, actor) => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(400, "Invalid task id");
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw new ApiError(400, "Select at least one file to upload");
  }

  const task = await Task.findOne({
    _id: taskId,
    deletedAt: null,
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const uploaded = await uploadTaskFiles(taskId, files);

  task.attachments.push(
    ...uploaded.map((attachment) => ({
      ...attachment,
      uploadedBy: actor?._id ?? null,
    })),
  );

  try {
    await task.save();
  } catch (error) {
    // Si falla MongoDB después de subir, intentamos limpiar Storage.
    await Promise.all(
      uploaded.map((attachment) =>
        deleteTaskStoredFile(attachment.path).catch((cleanupError) => {
          console.error(
            "No se pudo limpiar el adjunto tras fallar MongoDB:",
            cleanupError,
          );
        }),
      ),
    );

    throw error;
  }

  return withAttachmentUrls(task);
};

/**
 * Elimina un adjunto de una tarea.
 */
export const removeTaskAttachment = async (taskId, attachmentId) => {
  if (
    !mongoose.isValidObjectId(taskId) ||
    !mongoose.isValidObjectId(attachmentId)
  ) {
    throw new ApiError(400, "Invalid task or attachment id");
  }

  const task = await Task.findOne({
    _id: taskId,
    deletedAt: null,
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const attachment = task.attachments.find(
    (item) => String(item._id) === String(attachmentId),
  );

  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  const storagePath = attachment.path;

  task.attachments.pull(attachmentId);

  await task.save();

  try {
    await deleteTaskStoredFile(storagePath);
  } catch (error) {
    console.error(
      "No se pudo eliminar el archivo físico del adjunto:",
      error,
    );
  }

  return withAttachmentUrls(task);
};

/**
 * Archiva una tarea (soft delete). No vuelve a archivar una ya archivada.
 */
export const softDeleteTask = async (taskId, actor) => {
  const task = await Task.findOneAndUpdate(
    { _id: taskId, deletedAt: null },
    {
      deletedAt: new Date(),
      deletedBy: actor?._id ?? null,
    },
    { returnDocument: "after" },
  );

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};

/* ---------------------------- archivero ---------------------------- */

/**
 * Lista las tareas archivadas, las más recientes primero.
 * No firma URLs de adjuntos: el archivero solo muestra el conteo.
 */
export const getArchivedTasks = async ({ category } = {}) => {
  const filter = { deletedAt: { $ne: null } };

  if (category) {
    if (!mongoose.isValidObjectId(category)) {
      throw new ApiError(400, "Invalid category id");
    }
    filter.category = category;
  }

  return await Task.find(filter)
    .sort({ deletedAt: -1 })
    .populate("deletedBy", "name")
    .lean();
};

/**
 * Restaura una tarea archivada: queda al final de su columna original.
 */
export const restoreTask = async (taskId) => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(400, "Invalid task id");
  }

  const task = await Task.findOne({
    _id: taskId,
    deletedAt: { $ne: null },
  });

  if (!task) {
    throw new ApiError(404, "Archived task not found");
  }

  task.position = await nextPosition(task.category, task.state, taskId);
  task.deletedAt = null;
  task.deletedBy = null;

  await task.save();

  return withAttachmentUrls(task);
};

/**
 * Elimina definitivamente una tarea YA archivada, junto con sus archivos.
 */
export const permanentlyDeleteTask = async (taskId) => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new ApiError(400, "Invalid task id");
  }

  const task = await Task.findOne({
    _id: taskId,
    deletedAt: { $ne: null },
  });

  if (!task) {
    throw new ApiError(404, "Archived task not found");
  }

  await Promise.all(
    (task.attachments ?? []).map((attachment) =>
      deleteTaskStoredFile(attachment.path).catch((error) => {
        console.error("No se pudo eliminar un archivo adjunto:", error);
      }),
    ),
  );

  await task.deleteOne();

  return { message: "Task permanently deleted" };
};

/**
 * Restaura varias tareas archivadas. Cada ID se procesa por separado para
 * informar los fallos individuales sin impedir las demás restauraciones.
 */
export const restoreTasks = async (ids = []) => {
  const uniqueIds = [...new Set(ids.map(String))];
  const restored = [];
  const failed = [];

  for (const id of uniqueIds) {
    try {
      restored.push(await restoreTask(id));
    } catch (error) {
      failed.push({ id, message: error.message });
    }
  }

  return { restored, failed };
};

/**
 * Elimina definitivamente varias tareas YA archivadas.
 */
export const permanentlyDeleteTasks = async (ids = []) => {
  const uniqueIds = [...new Set(ids.map(String))];
  const deleted = [];
  const failed = [];

  for (const id of uniqueIds) {
    try {
      await permanentlyDeleteTask(id);
      deleted.push(id);
    } catch (error) {
      failed.push({ id, message: error.message });
    }
  }

  return { deleted, failed };
};
