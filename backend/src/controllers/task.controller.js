import * as taskService from "../services/task.service.js";

export async function createTask(req, res, next) {
  res.status(200).json({ message: "Tarea creada" });
}

export async function getTasks(req, res, next) {
  res.status(200).json({ message: "Tareas" });
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
