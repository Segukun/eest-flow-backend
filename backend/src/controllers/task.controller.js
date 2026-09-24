import * as taskService from "../services/task.service.js";

export async function createTask(req, res, next) {
  try {
    const { title, description, assignedUser, dueDate, priority, category } =
      req.body;
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!description) {
      return res.status(400).json({ message: "Description is required" });
    }

    const task = taskService.createTask({
      title,
      description,
      assignedUser,
      dueDate,
      priority,
      category,
    });
    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getTasks(req, res, next) {
  try {
    const data = await taskService.getTasks();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getTasksById(req, res, next) {
  res.status(200).json({ message: "Tarea" });
}

export async function updateTask(req, res, next) {
  res.status(200).json({ message: "Tarea actualizada" });
}

export async function softDeleteTask(req, res, next) {
  res.status(200).json({ message: "Soft delete de la tarea" });
}
