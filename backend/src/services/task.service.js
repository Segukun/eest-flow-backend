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

/**
 * Convierte documentos Mongoose a objetos de respuesta y
 * agrega URLs firmadas a los archivos adjuntos.
 *
 * Las URLs se cachean para evitar generar una nueva en
 * cada consulta automática del tablero.
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
  const exists = await Task.findOne({
    title: taskData.title,
    deletedAt: null,
  });

  if (exists) {
    throw new ApiError(409, "A task with that title already exists");
  }

  const state = taskData.state ?? "pending";
  const position = await nextPosition(taskData.category, state);

  const task = await Task.create({
    ...taskData,
    state,
    position,
  });

  await notifyAssigned(
    task,
    toIds(task.assignedUser),
    actor,
  );

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
  }).select("assignedUser state category");

  if (!previous) {
    throw new ApiError(404, "Task not found");
  }

  const update = { ...taskData };

  // Si cambia de columna por edición, queda al final de la nueva.
  if (
    update.state !== undefined &&
    update.state !== previous.state
  ) {
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

  if (taskData.assignedUser !== undefined) {
    const before = toIds(previous.assignedUser);

    const newlyAssigned = toIds(task.assignedUser).filter(
      (id) => !before.includes(id),
    );

    await notifyAssigned(task, newlyAssigned, actor);
  }

  return withAttachmentUrls(task);
};

/**
 * Mueve una tarea a una columna y la inserta ANTES de beforeId.
 * (null = al final).
 *
 * Renumera la columna destino sin empates.
 */
export const moveTask = async (
  taskId,
  { state, beforeId = null },
) => {
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

  return withAttachmentUrls(await Task.findById(taskId));
};

/**
 * Agrega archivos a una tarea.
 *
 * 1. Comprueba que exista la tarea.
 * 2. Sube los archivos a Supabase.
 * 3. Guarda los metadatos en MongoDB.
 */
export const addTaskAttachments = async (
  taskId,
  files,
  actor,
) => {
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
        deleteTaskStoredFile(attachment.path).catch(
          (cleanupError) => {
            console.error(
              "No se pudo limpiar el adjunto tras fallar MongoDB:",
              cleanupError,
            );
          },
        ),
      ),
    );

    throw error;
  }

  return withAttachmentUrls(task);
};

/**
 * Elimina un adjunto de una tarea.
 */
export const removeTaskAttachment = async (
  taskId,
  attachmentId,
) => {
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

  // La referencia se elimina primero de MongoDB.
  // Si Storage falla, se registra para limpieza posterior.
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

export const softDeleteTask = async (taskId) => {
  const task = await Task.findByIdAndUpdate(
    taskId,
    {
      deletedAt: new Date(),
    },
    {
      returnDocument: "after",
    },
  );

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};