import Task from "../models/task.model.js";
import ApiError from "../utils/apiError.js";

export const createTask = async (taskData) => {
  const exists = await Task.findOne({ title: taskData.title });

  if (exists) {
    throw new ApiError(409, "A task with that title already exists");
  }

  return await Task.create(taskData);
};

export const getTasks = async () => {
  return await Task.find({ deletedAt: null });
};

export const getTasksById = async (taskId) => {
  const task = await Task.findOne({ id: taskId });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};

export const updateTask = async (taskId, taskData) => {
  const task = await Task.findByIdAndUpdate(taskId, taskData, {
    new: true,
    runValidators: true,
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};

export const softDeleteTask = async (taskId) => {
  const task = await Task.findByIdAndUpdate(
    taskId,
    { deletedAt: new Date() },
    { new: true },
  );

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
};
