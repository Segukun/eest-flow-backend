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

export const createTask = async (taskData, actor) => {
  const exists = await Task.findOne({ title: taskData.title, deletedAt: null });
  if (exists) {
    throw new ApiError(409, "A task with that title already exists");
  }

  const task = await Task.create(taskData);
  await notifyAssigned(task, toIds(task.assignedUser), actor);
  return task;
};

export const getTasks = async () => {
  return await Task.find({ deletedAt: null });
};

export const getTasksById = async (taskId) => {
  const task = await Task.findOne({ _id: taskId, deletedAt: null });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
};

export const updateTask = async (taskId, taskData, actor) => {
  // necesitamos los asignados anteriores para saber quién es NUEVO
  const previous = await Task.findOne({ _id: taskId, deletedAt: null }).select("assignedUser");
  if (!previous) throw new ApiError(404, "Task not found");

  const task = await Task.findOneAndUpdate({ _id: taskId, deletedAt: null }, taskData, {
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

export const softDeleteTask = async (taskId) => {
  const task = await Task.findByIdAndUpdate(
    taskId,
    { deletedAt: new Date() },
    { returnDocument: "after" },
  );
  if (!task) throw new ApiError(404, "Task not found");
  return task;
};