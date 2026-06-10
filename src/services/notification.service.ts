// src/services/notification.service.ts

import mongoose from "mongoose";
import Notification, {
  INotification,
} from "@/models/Notification";

export class NotificationService {
  /**
   * Unread notifications.
   */
  async getUnreadNotifications(
    userId: string
  ): Promise<INotification[]> {
    return Notification.find({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      read: false,
    })
      .sort({ createdAt: -1 })
      .lean<INotification[]>();
  }

  /**
   * Count unread notifications.
   */
  async getUnreadCount(
    userId: string
  ): Promise<number> {
    return Notification.countDocuments({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      read: false,
    });
  }

  /**
   * Recent alerts for AI context.
   */
  async getRecentAlerts(
    userId: string,
    limit = 10
  ) {
    return Notification.find({
      userId: new (mongoose.Types.ObjectId as any)(userId),
      type: {
        $in: ["alert", "health_metric"],
      },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Create notification.
   */
  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    priority?: string;
  }) {
    return Notification.create({
      userId: new (mongoose.Types.ObjectId as any)(
        data.userId
      ),
      title: data.title,
      message: data.message,
      type: data.type ?? "system",
      priority: data.priority ?? "medium",
    });
  }

  /**
   * Mark notification as read.
   */
  async markAsRead(
    userId: string,
    notificationId: string
  ) {
    return Notification.findOneAndUpdate(
      {
        _id: notificationId,
        userId: new (mongoose.Types.ObjectId as any)(userId),
      },
      {
        read: true,
      },
      {
        new: true,
      }
    );
  }
}

export const notificationService =
  new NotificationService();