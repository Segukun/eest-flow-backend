import * as notificationService from "../services/notification.service.js";

export const getNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getNotifications(
      req.user._id,
      req.query,
    );
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user._id);
    return res.status(200).json({ count });
  } catch (error) {
    return next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user._id,
    );
    return res.status(200).json(notification);
  } catch (error) {
    return next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user._id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};
