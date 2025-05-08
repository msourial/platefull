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
  
  // Get popular categories based on order history
  getPopularCategories: async (limit: number = 3) => {
    try {
      // This is a simplified implementation since we don't have actual order analytics yet
      // In a real implementation, we would count orders by category and return the most ordered
      return await db.query.categories.findMany({
        where: eq(schema.categories.isActive, true),
        orderBy: asc(schema.categories.displayOrder),
        limit
      });
    } catch (error) {
      console.error("Error getting popular categories:", error);
      return [];
    }
  },
  
  // Get popular menu items based on order history
  getPopularItems: async (limit: number = 5) => {
    try {
      // This is a simplified implementation
      // In a real implementation, we would count orders by item and return the most ordered
      return await db.query.menuItems.findMany({
        where: eq(schema.menuItems.isAvailable, true),
        orderBy: desc(schema.menuItems.id), // Using ID as temporary proxy for popularity
        limit,
        with: {
          category: true
        }
      });
    } catch (error) {
      console.error("Error getting popular items:", error);
      return [];
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
        category: true,
        customizationOptions: true
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
      where: eq(schema.conversations.telegramUserId, telegramUserId),
      with: {
        messages: {
          orderBy: asc(schema.conversationMessages.timestamp)
        }
      }
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
  
  // Conversation messages methods
  addMessageToConversation: async (message: schema.InsertConversationMessage) => {
    try {
      schema.insertConversationMessageSchema.parse(message);
      const [newMessage] = await db.insert(schema.conversationMessages).values(message).returning();
      return newMessage;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      throw error;
    }
  },
  
  // Alias for addMessageToConversation to maintain backward compatibility
  createConversationMessage: async (conversationId: number, messageData: { text: string, isFromUser: boolean }) => {
    try {
      const message: schema.InsertConversationMessage = {
        conversationId,
        text: messageData.text,
        isFromUser: messageData.isFromUser,
        timestamp: new Date()
      };
      
      schema.insertConversationMessageSchema.parse(message);
      const [newMessage] = await db.insert(schema.conversationMessages).values(message).returning();
      
      // Update the conversation's lastMessageId
      await db.update(schema.conversations)
        .set({ lastMessageId: newMessage.id, updatedAt: new Date() })
        .where(eq(schema.conversations.id, conversationId));
        
      return newMessage;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      console.error("Error creating conversation message:", error);
      throw error;
    }
  },
  
  getConversationMessages: async (conversationId: number) => {
    return await db.query.conversationMessages.findMany({
      where: eq(schema.conversationMessages.conversationId, conversationId),
      orderBy: asc(schema.conversationMessages.timestamp)
    });
  },
  
  getLastBotMessage: async (conversationId: number) => {
    // Find the most recent message from the bot (not from user)
    const messages = await db.query.conversationMessages.findMany({
      where: and(
        eq(schema.conversationMessages.conversationId, conversationId),
        eq(schema.conversationMessages.isFromUser, false)
      ),
      orderBy: desc(schema.conversationMessages.timestamp),
      limit: 1
    });
    
    return messages.length > 0 ? messages[0] : null;
  },
  
  // Get user preferences from their order history and conversations
  getUserPreferences: async (telegramUserId: number) => {
    try {
      // Get completed orders
      const orders = await db.query.orders.findMany({
        where: and(
          eq(schema.orders.telegramUserId, telegramUserId),
          eq(schema.orders.status, "completed")
        ),
        with: {
          orderItems: {
            with: {
              menuItem: {
                with: {
                  category: true
                }
              }
            }
          }
        }
      });
      
      // Get conversation history for preference analysis
      const conversation = await db.query.conversations.findFirst({
        where: eq(schema.conversations.telegramUserId, telegramUserId),
        with: {
          messages: {
            orderBy: desc(schema.conversationMessages.timestamp),
            limit: 50 // Get the last 50 messages
          }
        }
      });
      
      // Process orders to extract preferences
      const categoryFrequency: Record<string, number> = {};
      const itemFrequency: Record<string, number> = {};
      
      // Calculate category and item frequencies
      orders.forEach(order => {
        order.orderItems.forEach(item => {
          const categoryName = item.menuItem.category?.name;
          if (categoryName) {
            categoryFrequency[categoryName] = (categoryFrequency[categoryName] || 0) + 1;
          }
          
          const itemName = item.menuItem.name;
          itemFrequency[itemName] = (itemFrequency[itemName] || 0) + 1;
        });
      });
      
      // Find favorite categories and items
      const favoriteCategories = Object.entries(categoryFrequency)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 3);
        
      const favoriteItems = Object.entries(itemFrequency)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 5);
      
      // Return a structured preferences object
      return {
        favoriteCategories,
        favoriteItems,
        orderCount: orders.length,
        hasOrderHistory: orders.length > 0,
        lastInteraction: conversation?.updatedAt || null
      };
    } catch (error) {
      console.error("Error getting user preferences:", error);
      return null;
    }
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
  
  // Get order history for a telegram user with formatted item data
  getOrderHistoryByTelegramUserId: async (telegramId: string) => {
    const user = await db.query.telegramUsers.findFirst({
      where: eq(schema.telegramUsers.telegramId, telegramId)
    });
    
    if (!user) {
      return [];
    }
    
    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.telegramUserId, user.id),
        eq(schema.orders.status, "completed")
      ),
      orderBy: desc(schema.orders.createdAt),
      with: {
        orderItems: {
          with: {
            menuItem: {
              with: {
                category: true
              }
            }
          }
        }
      }
    });
    
    // Format the order history
    return orders.map(order => {
      return {
        id: order.id,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: order.orderItems.map(item => {
          return {
            id: item.id,
            name: item.menuItem.name,
            price: item.price,
            quantity: item.quantity,
            category: item.menuItem.category?.name || '',
            customizations: item.customizations
          };
        })
      };
    });
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
  
  // Alias for getOrderItemsByOrderId to support both naming conventions
  getOrderItems: async (orderId: number) => {
    return await db.query.orderItems.findMany({
      where: eq(schema.orderItems.orderId, orderId),
      with: {
        menuItem: true
      }
    });
  },
  
  getOrderItemById: async (id: number) => {
    return await db.query.orderItems.findFirst({
      where: eq(schema.orderItems.id, id),
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
