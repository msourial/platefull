import { db } from "@db";
import * as schema from "@shared/schema";
import { eq, and, desc, asc, like, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const storage = {
  // Category methods
  getCategories: async () => {
    return await db.query.categories.findMany({
      where: eq(schema.categories.isActive, true),
      orderBy: asc(schema.categories.displayOrder)
    });
  },

  getCategoryById: async (id: number) => {
    return await db.query.categories.findFirst({
      where: eq(schema.categories.id, id)
    });
  },

  // Menu Item methods
  getMenuItems: async (categoryId?: number) => {
    if (categoryId) {
      return await db.query.menuItems.findMany({
        where: and(
          eq(schema.menuItems.categoryId, categoryId),
          eq(schema.menuItems.isAvailable, true)
        ),
        with: {
          category: true
        }
      });
    } else {
      return await db.query.menuItems.findMany({
        where: eq(schema.menuItems.isAvailable, true),
        with: {
          category: true
        }
      });
    }
  },

  getMenuItemById: async (id: number) => {
    return await db.query.menuItems.findFirst({
      where: eq(schema.menuItems.id, id),
      with: {
        category: true,
        customizationOptions: true
      }
    });
  },

  getMenuItemsByName: async (query: string) => {
    return await db.query.menuItems.findMany({
      where: and(
        like(schema.menuItems.name, `%${query}%`),
        eq(schema.menuItems.isAvailable, true)
      ),
      with: {
        category: true
      }
    });
  },

  // Telegram User methods
  getTelegramUserByTelegramId: async (telegramId: string) => {
    return await db.query.telegramUsers.findFirst({
      where: eq(schema.telegramUsers.telegramId, telegramId)
    });
  },

  createTelegramUser: async (telegramUser: schema.InsertTelegramUser) => {
    try {
      schema.insertTelegramUserSchema.parse(telegramUser);
      const [newUser] = await db.insert(schema.telegramUsers).values(telegramUser).returning();
      return newUser;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      throw error;
    }
  },

  updateTelegramUser: async (id: number, data: Partial<schema.InsertTelegramUser>) => {
    const [updatedUser] = await db.update(schema.telegramUsers)
      .set({ ...data, lastInteraction: new Date() })
      .where(eq(schema.telegramUsers.id, id))
      .returning();
    return updatedUser;
  },

  // Conversation methods
  getConversationByTelegramUserId: async (telegramUserId: number) => {
    return await db.query.conversations.findFirst({
      where: eq(schema.conversations.telegramUserId, telegramUserId)
    });
  },

  createConversation: async (conversation: schema.InsertConversation) => {
    try {
      schema.insertConversationSchema.parse(conversation);
      const [newConversation] = await db.insert(schema.conversations).values(conversation).returning();
      return newConversation;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      throw error;
    }
  },

  updateConversation: async (id: number, data: Partial<schema.InsertConversation>) => {
    const [updatedConversation] = await db.update(schema.conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.conversations.id, id))
      .returning();
    return updatedConversation;
  },

  // Order methods
  createOrder: async (order: schema.InsertOrder) => {
    try {
      schema.insertOrderSchema.parse(order);
      const [newOrder] = await db.insert(schema.orders).values(order).returning();
      return newOrder;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      throw error;
    }
  },

  getOrderById: async (id: number) => {
    return await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
      with: {
        telegramUser: true,
        orderItems: {
          with: {
            menuItem: true
          }
        }
      }
    });
  },

  getOrdersByTelegramUserId: async (telegramUserId: number) => {
    return await db.query.orders.findMany({
      where: eq(schema.orders.telegramUserId, telegramUserId),
      orderBy: desc(schema.orders.createdAt),
      with: {
        orderItems: {
          with: {
            menuItem: true
          }
        }
      }
    });
  },

  getActiveOrderByTelegramUserId: async (telegramUserId: number) => {
    return await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.telegramUserId, telegramUserId),
        or(
          eq(schema.orders.status, "pending"),
          eq(schema.orders.status, "processing")
        )
      ),
      with: {
        orderItems: {
          with: {
            menuItem: true
          }
        }
      }
    });
  },

  updateOrder: async (id: number, data: Partial<schema.InsertOrder>) => {
    const [updatedOrder] = await db.update(schema.orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.orders.id, id))
      .returning();
    return updatedOrder;
  },

  // Order Item methods
  createOrderItem: async (orderItem: schema.InsertOrderItem) => {
    try {
      schema.insertOrderItemSchema.parse(orderItem);
      const [newOrderItem] = await db.insert(schema.orderItems).values(orderItem).returning();
      return newOrderItem;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      throw error;
    }
  },

  updateOrderItem: async (id: number, data: Partial<schema.InsertOrderItem>) => {
    const [updatedOrderItem] = await db.update(schema.orderItems)
      .set(data)
      .where(eq(schema.orderItems.id, id))
      .returning();
    return updatedOrderItem;
  },

  deleteOrderItem: async (id: number) => {
    await db.delete(schema.orderItems).where(eq(schema.orderItems.id, id));
  },

  getOrderItemsByOrderId: async (orderId: number) => {
    return await db.query.orderItems.findMany({
      where: eq(schema.orderItems.orderId, orderId),
      with: {
        menuItem: true
      }
    });
  },

  // Admin methods
  getAllOrders: async (status?: string, limit: number = 100) => {
    if (status) {
      return await db.query.orders.findMany({
        where: eq(schema.orders.status, status),
        orderBy: desc(schema.orders.createdAt),
        limit,
        with: {
          telegramUser: true,
          orderItems: {
            with: {
              menuItem: true
            }
          }
        }
      });
    } else {
      return await db.query.orders.findMany({
        orderBy: desc(schema.orders.createdAt),
        limit,
        with: {
          telegramUser: true,
          orderItems: {
            with: {
              menuItem: true
            }
          }
        }
      });
    }
  }
};
