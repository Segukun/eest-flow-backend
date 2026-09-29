import * as taskService from "../services/task.service.js";

export async function createTask(req, res, next) {
  try {
    const {
      title,
      description,
      assignedUser,
      dueDate,
      priority,
      category,
      state,
      labels,
    } = req.body;

    const task = await taskService.createTask({
      title,
      description,
      assignedUser,
      dueDate,
      priority,
      category,
      state,
      labels,
    });
    return res.status(201).json(task);
  } catch (error) {
    return next(error);
  }
}

export async function getTasks(req, res, next) {
  try {
    const data = await taskService.getTasks();
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

export async function getTasksById(req, res, next) {
  try {
    const { id } = req.params;
    const task = await taskService.getTasksById(id);
    return res.status(200).json(task);
  } catch (error) {
    return next(error);
  }
}

export async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      assignedUser,
      dueDate,
      priority,
      category,
      state,
      labels,
    } = req.body;
    const updatedTask = await taskService.updateTask(id, {
      title,
      description,
      assignedUser,
      dueDate,
      priority,
      category,
      state,
      labels,
    });
    return res.status(200).json(updatedTask);
  } catch (error) {
    return next(error);
  }
}

export async function softDeleteTask(req, res, next) {
  try {
    const { id } = req.params;
    await taskService.softDeleteTask(id);
    return res.status(200).json({ message: "Task soft deleted" });
  } catch (error) {
    return next(error);
  }
}