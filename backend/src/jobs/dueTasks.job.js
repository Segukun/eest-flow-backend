import Task from "../models/task.model.js";
import { safeNotify } from "../services/notification.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function checkDueTasks() {
  const now = Date.now();

  const tasks = await Task.find({
    deletedAt: null,
    state: { $ne: "completed" },
    "assignedUser.0": { $exists: true },
    // desde 7 días atrás (para no avisar de cosas viejísimas) hasta mañana
    dueDate: { $ne: null, $gte: new Date(now - 8 * DAY_MS), $lte: new Date(now + DAY_MS) },
  }).select("title dueDate assignedUser");

  for (const task of tasks) {
    const dueMs = task.dueDate.getTime();
    // dueDate se guarda como fecha (medianoche UTC): se considera vencida cuando pasó ese día completo
    const overdue = now >= dueMs + DAY_MS;
    const dateKey = task.dueDate.toISOString().slice(0, 10);
    const type = overdue ? "task_overdue" : "task_due_soon";

    await safeNotify({
      recipients: task.assignedUser,
      category: "task",
      type,
      title: overdue
        ? `La tarea "${task.title}" ha vencido`
        : `La tarea "${task.title}" vence pronto`,
      description: `Fecha límite: ${dateKey}`,
      link: `/?task=${task._id}`,
      // una sola notificación por tarea, tipo y fecha; si cambian la fecha, vuelve a avisar
      dedupeKey: `${type}:${task._id}:${dateKey}`,
    });
  }
}

export function startDueTasksJob(intervalMs = 15 * 60 * 1000) {
  const run = () =>
    checkDueTasks().catch((error) => console.error("[due-tasks] error:", error.message));

  run();
  return setInterval(run, intervalMs);
}