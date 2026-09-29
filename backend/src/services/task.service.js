import Task from "../models/task.model.js";
import ApiError from "../utils/apiError.js";

export const createTask = async (taskData) => {
  // el filtro incluye deletedAt: null para que un título liberado por un soft delete vuelva a estar disponible
  const exists = await Task.findOne({ title: taskData.title, deletedAt: null });

  if (exists) {
    throw new ApiError(409, "A task with that title already exists");
  }

  return await Task.create(taskData);
};

export const getTasks = async () => {
  return await Task.find({ deletedAt: null });
};

export const getTasksById = async (taskId) => {
  const task = await Task.findOne({ _id: taskId, deletedAt: null });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};

export const updateTask = async (taskId, taskData) => {
  const task = await Task.findOneAndUpdate(
    { _id: taskId, deletedAt: null },
    taskData,
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};

export const softDeleteTask = async (taskId) => {
  const task = await Task.findByIdAndUpdate(
    taskId,
    { deletedAt: new Date() },
    { returnDocument: "after" },
  );

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};
