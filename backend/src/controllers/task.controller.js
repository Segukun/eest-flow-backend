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

    const task = await taskService.createTask(
      {
        title,
        description,
        assignedUser,
        dueDate,
        priority,
        category,
        state,
        labels,
      },
      req.user,
    );

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

    const updatedTask = await taskService.updateTask(
      id,
      {
        title,
        description,
        assignedUser,
        dueDate,
        priority,
        category,
        state,
        labels,
      },
      req.user,
    );

    return res.status(200).json(updatedTask);
  } catch (error) {
    return next(error);
  }
}

export async function moveTask(req, res, next) {
  try {
    const { id } = req.params;
    const { state, beforeId } = req.body;

    const task = await taskService.moveTask(
      id,
      { state, beforeId },
      req.user,
    );

    return res.status(200).json(task);
  } catch (error) {
    return next(error);
  }
}

/**
 * Sube uno o varios archivos a una tarea.
 */
export async function uploadTaskAttachments(req, res, next) {
  try {
    const task = await taskService.addTaskAttachments(
      req.params.id,
      req.files ?? [],
      req.user,
    );

    return res.status(200).json({ task });
  } catch (error) {
    return next(error);
  }
}

/**
 * Elimina un archivo adjunto de una tarea.
 */
export async function deleteTaskAttachment(req, res, next) {
  try {
    const task = await taskService.removeTaskAttachment(
      req.params.id,
      req.params.attachmentId,
    );

    return res.status(200).json({ task });
  } catch (error) {
    return next(error);
  }
}

/**
 * Archiva una tarea (soft delete).
 */
export async function softDeleteTask(req, res, next) {
  try {
    const { id } = req.params;

    await taskService.softDeleteTask(id, req.user);

    return res.status(200).json({
      message: "Task soft deleted",
    });
  } catch (error) {
    return next(error);
  }
}

/* ---------------------------- archivero ---------------------------- */

export async function getArchivedTasks(req, res, next) {
  try {
    const data = await taskService.getArchivedTasks({
      category: req.query.category,
    });

    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

export async function restoreTask(req, res, next) {
  try {
    const task = await taskService.restoreTask(req.params.id);

    return res.status(200).json(task);
  } catch (error) {
    return next(error);
  }
}

export async function permanentlyDeleteTask(req, res, next) {
  try {
    const result = await taskService.permanentlyDeleteTask(req.params.id);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function restoreArchivedTasks(req, res, next) {
  try {
    const result = await taskService.restoreTasks(req.body.ids);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function deleteArchivedTasks(req, res, next) {
  try {
    const result = await taskService.permanentlyDeleteTasks(req.body.ids);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}