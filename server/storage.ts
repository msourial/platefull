import { db } from "@db";
import * as schema from "@shared/schema";
import { eq, and, desc, asc, like, isNull, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const storage = {
  // Instagram User Methods
  getInstagramUserByInstagramId: async (instagramId: string) => {
    return await db.query.instagramUsers.findFirst({
      where: eq(schema.instagramUsers.instagramId, instagramId)
    });
  },
  
  getInstagramUserById: async (id: number) => {
    return await db.query.instagramUsers.findFirst({
      where: eq(schema.instagramUsers.id, id)
    });
  },
  
  createInstagramUser: async (instagramUser: schema.InsertInstagramUser) => {
    try {
      schema.insertInstagramUserSchema.parse(instagramUser);
      const [newUser] = await db.insert(schema.instagramUsers).values(instagramUser).returning();
      return newUser;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      throw error;
    }
  },
  
  updateInstagramUser: async (id: number, data: Partial<schema.InsertInstagramUser>) => {
    const [updatedUser] = await db.update(schema.instagramUsers)
      .set({ ...data, lastInteraction: new Date() })
      .where(eq(schema.instagramUsers.id, id))
      .returning();
    return updatedUser;
  },
  
  // Instagram Conversation Methods
  getInstagramConversationByUserId: async (instagramUserId: number) => {
    return await db.query.instagramConversations.findFirst({
      where: eq(schema.instagramConversations.instagramUserId, instagramUserId),
      with: {
        messages: {
          orderBy: asc(schema.instagramConversationMessages.timestamp)
        }
      }
    });
  },
  
  createInstagramConversation: async (conversation: schema.InsertInstagramConversation) => {
    try {
      schema.insertInstagramConversationSchema.parse(conversation);
      const [newConversation] = await db.insert(schema.instagramConversations).values(conversation).returning();
      return newConversation;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      throw error;
    }
  },
  
  updateInstagramConversation: async (id: number, data: Partial<schema.InsertInstagramConversation>) => {
    const [updatedConversation] = await db.update(schema.instagramConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.instagramConversations.id, id))
      .returning();
    return updatedConversation;
  },
  
  // Instagram Conversation Message Methods
  createInstagramConversationMessage: async (conversationId: number, messageData: { text: string, isFromUser: boolean, timestamp?: Date }) => {
    try {
      const message: schema.InsertInstagramConversationMessage = {
        conversationId,
        text: messageData.text,
        isFromUser: messageData.isFromUser,
        timestamp: messageData.timestamp || new Date()
      };
      
      schema.insertInstagramConversationMessageSchema.parse(message);
      const [newMessage] = await db.insert(schema.instagramConversationMessages).values(message).returning();
      
      // Update the conversation's lastMessageId
      await db.update(schema.instagramConversations)
        .set({ lastMessageId: newMessage.id, updatedAt: new Date() })
        .where(eq(schema.instagramConversations.id, conversationId));
        
      return newMessage;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(fromZodError(error).message);
      }
      console.error("Error creating Instagram conversation message:", error);
      throw error;
    }
  },
  
  getInstagramConversationMessages: async (conversationId: number, limit: number = 0) => {
    let query = db.query.instagramConversationMessages.findMany({
      where: eq(schema.instagramConversationMessages.conversationId, conversationId),
      orderBy: asc(schema.instagramConversationMessages.timestamp)
    });
    
    if (limit > 0) {
      query = db.query.instagramConversationMessages.findMany({
        where: eq(schema.instagramConversationMessages.conversationId, conversationId),
        orderBy: desc(schema.instagramConversationMessages.timestamp),
        limit
      });
      
      const messages = await query;
      return messages.reverse(); // Reverse to get chronological order
    }
    
    return await query;
  },
  
  getLastInstagramBotMessage: async (conversationId: number) => {
    // Find the most recent message from the bot (not from user)
    const messages = await db.query.instagramConversationMessages.findMany({
      where: and(
        eq(schema.instagramConversationMessages.conversationId, conversationId),
        eq(schema.instagramConversationMessages.isFromUser, false)
      ),
      orderBy: desc(schema.instagramConversationMessages.timestamp),
      limit: 1
    });
    
    return messages.length > 0 ? messages[0] : null;
  },
  
  // Order methods for Instagram users
  getActiveOrderByInstagramUserId: async (instagramUserId: number) => {
    // Add the ordersWithInstagramUser relationship first
    return await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.instagramUserId, instagramUserId),
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
  
  getOrdersByInstagramUserId: async (instagramUserId: number) => {
    return await db.query.orders.findMany({
      where: eq(schema.orders.instagramUserId, instagramUserId),
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
  getPopularMenuItems: async (limit: number = 3) => {
    // Get menu items ordered by popularity (most ordered)
    // For now, we'll just return some menu items since we don't have actual order data yet
    const items = await db.query.menuItems.findMany({
      limit,
      with: {
        category: true
      }
    });
    
    return items;
  },
  
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
      // This implementation returns categories ordered by popularity based on order items
      // Count orders by category and return the most ordered
      const categoryStats = await db.execute(
        `SELECT c.id, c.name, COUNT(oi.id) as order_count
         FROM categories c
         JOIN menu_items mi ON mi.category_id = c.id
         JOIN order_items oi ON oi.menu_item_id = mi.id
         JOIN orders o ON o.id = oi.order_id
         WHERE c.is_active = true
         GROUP BY c.id, c.name
         ORDER BY order_count DESC
         LIMIT ${limit}`
      );
      
      if (categoryStats.rows && categoryStats.rows.length > 0) {
        return categoryStats.rows.map(row => ({
          id: row.id,
          name: row.name,
          orderCount: row.order_count
        }));
      }
      
      // Fallback to default ordering if no stats available
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
      // This implementation returns items ordered by popularity based on order data
      const itemStats = await db.execute(
        `SELECT mi.id, mi.name, mi.price, mi.description, mi.category_id, mi.image_url, COUNT(oi.id) as order_count
         FROM menu_items mi
         JOIN order_items oi ON oi.menu_item_id = mi.id
         JOIN orders o ON o.id = oi.order_id
         WHERE mi.is_available = true
         GROUP BY mi.id, mi.name, mi.price, mi.description, mi.category_id, mi.image_url
         ORDER BY order_count DESC
         LIMIT ${limit}`
      );
      
      if (itemStats.rows && itemStats.rows.length > 0) {
        const categoryMap = new Map();
        
        // Get all relevant categories
        const categoryIds: number[] = [];
        itemStats.rows.forEach(row => {
          if (row.category_id && !categoryIds.includes(row.category_id)) {
            categoryIds.push(row.category_id);
          }
        });
        
        const categories = await db.query.categories.findMany({
          where: inArray(schema.categories.id, categoryIds)
        });
        
        // Create a map for quick lookup
        categories.forEach(cat => categoryMap.set(cat.id, cat));
        
        // Format with appropriate structure
        return itemStats.rows.map(row => ({
          id: row.id,
          name: row.name,
          price: row.price,
          description: row.description,
          imageUrl: row.image_url,
          categoryId: row.category_id,
          isAvailable: true,
          category: categoryMap.get(row.category_id),
          orderCount: row.order_count
        }));
      }
      
      // Fallback to default ordering if no stats available
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
  
  // Alias for getPopularItems with different name for clarity
  getPopularMenuItems: async (limit: number = 5) => {
    return await storage.getPopularItems(limit);
  },
  
  // Get menu items for a specific category
  getMenuItemsForCategory: async (categoryId: number) => {
    return await db.query.menuItems.findMany({
      where: and(
        eq(schema.menuItems.categoryId, categoryId),
        eq(schema.menuItems.isAvailable, true)
      ),
      with: {
        category: true,
        customizationOptions: true
      }
    });
  },
  
  // Get a telegram user by ID
  getTelegramUserById: async (id: number) => {
    return await db.query.telegramUsers.findFirst({
      where: eq(schema.telegramUsers.id, id)
    });
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
  
  findMenuItemsByPartialName: async (partialName: string) => {
    // Search for menu items that contain the partial name in their name or description
    return await db.query.menuItems.findMany({
      where: and(
        eq(schema.menuItems.isAvailable, true),
        or(
          like(schema.menuItems.name, `%${partialName}%`),
          like(schema.menuItems.description, `%${partialName}%`)
        )
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
