import { pgTable, text, serial, integer, boolean, timestamp, json, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Users table (for admin users)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Telegram users table (for customers using the bot)
export const telegramUsers = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phoneNumber: text("phone_number"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastInteraction: timestamp("last_interaction").defaultNow().notNull(),
});

export const insertTelegramUserSchema = createInsertSchema(telegramUsers, {
  telegramId: (schema) => schema.min(1, "Telegram ID is required"),
});

export type InsertTelegramUser = z.infer<typeof insertTelegramUserSchema>;
export type TelegramUser = typeof telegramUsers.$inferSelect;

// Menu categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  icon: text("icon").notNull(),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const insertCategorySchema = createInsertSchema(categories, {
  name: (schema) => schema.min(2, "Category name must be at least 2 characters"),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Menu items table
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  isAvailable: boolean("is_available").default(true),
});

export const insertMenuItemSchema = createInsertSchema(menuItems, {
  name: (schema) => schema.min(2, "Item name must be at least 2 characters"),
  description: (schema) => schema.min(5, "Description must be at least 5 characters"),
  price: (schema) => schema.refine((val) => parseFloat(val.toString()) > 0, "Price must be greater than 0"),
});

export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

// Customization options table
export const customizationOptions = pgTable("customization_options", {
  id: serial("id").primaryKey(),
  menuItemId: integer("menu_item_id").references(() => menuItems.id).notNull(),
  name: text("name").notNull(),
  choices: json("choices").$type<string[]>().notNull(),
  isRequired: boolean("is_required").default(false),
});

export const insertCustomizationOptionsSchema = createInsertSchema(customizationOptions);
export type InsertCustomizationOption = z.infer<typeof insertCustomizationOptionsSchema>;
export type CustomizationOption = typeof customizationOptions.$inferSelect;

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  telegramUserId: integer("telegram_user_id").references(() => telegramUsers.id),
  instagramUserId: integer("instagram_user_id").references(() => instagramUsers.id),
  status: text("status").notNull().default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  isDelivery: boolean("is_delivery").default(true),
  deliveryAddress: text("delivery_address"),
  deliveryInstructions: text("delivery_instructions"),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders, {
  // Allow zero for initial order creation - will be updated with actual items later
  totalAmount: (schema) => schema.refine((val) => parseFloat(val.toString()) >= 0, "Total amount must be non-negative"),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  menuItemId: integer("menu_item_id").references(() => menuItems.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  customizations: json("customizations").$type<Record<string, string>>(),
  specialInstructions: text("special_instructions"),
});

export const insertOrderItemSchema = createInsertSchema(orderItems, {
  quantity: (schema) => schema.refine((val) => val > 0, "Quantity must be greater than 0"),
  price: (schema) => schema.refine((val) => parseFloat(val.toString()) > 0, "Price must be greater than 0"),
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Conversations table for tracking conversation state
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  telegramUserId: integer("telegram_user_id").references(() => telegramUsers.id).notNull(),
  state: text("state").notNull().default("initial"),
  context: json("context").$type<Record<string, any>>().default({}),
  lastMessageId: integer("last_message_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Conversation messages table
export const conversationMessages = pgTable("conversation_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  text: text("text").notNull(),
  isFromUser: boolean("is_from_user").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations);
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const insertConversationMessageSchema = createInsertSchema(conversationMessages);
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;

// Instagram users table (for customers using Instagram)
export const instagramUsers = pgTable("instagram_users", {
  id: serial("id").primaryKey(),
  instagramId: text("instagram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profilePic: text("profile_pic"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastInteraction: timestamp("last_interaction").defaultNow().notNull(),
});

export const insertInstagramUserSchema = createInsertSchema(instagramUsers, {
  instagramId: (schema) => schema.min(1, "Instagram ID is required"),
});

export type InsertInstagramUser = z.infer<typeof insertInstagramUserSchema>;
export type InstagramUser = typeof instagramUsers.$inferSelect;

// Instagram conversations table
export const instagramConversations = pgTable("instagram_conversations", {
  id: serial("id").primaryKey(),
  instagramUserId: integer("instagram_user_id").references(() => instagramUsers.id).notNull(),
  state: text("state").notNull().default("initial"),
  context: json("context").$type<Record<string, any>>().default({}),
  lastMessageId: integer("last_message_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Instagram conversation messages table
export const instagramConversationMessages = pgTable("instagram_conversation_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => instagramConversations.id).notNull(),
  text: text("text").notNull(),
  isFromUser: boolean("is_from_user").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertInstagramConversationSchema = createInsertSchema(instagramConversations);
export type InsertInstagramConversation = z.infer<typeof insertInstagramConversationSchema>;
export type InstagramConversation = typeof instagramConversations.$inferSelect;

export const insertInstagramConversationMessageSchema = createInsertSchema(instagramConversationMessages);
export type InsertInstagramConversationMessage = z.infer<typeof insertInstagramConversationMessageSchema>;
export type InstagramConversationMessage = typeof instagramConversationMessages.$inferSelect;

// Define all relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  menuItems: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(categories, { fields: [menuItems.categoryId], references: [categories.id] }),
  customizationOptions: many(customizationOptions),
  orderItems: many(orderItems),
}));

export const customizationOptionsRelations = relations(customizationOptions, ({ one }) => ({
  menuItem: one(menuItems, { fields: [customizationOptions.menuItemId], references: [menuItems.id] }),
}));

export const telegramUsersRelations = relations(telegramUsers, ({ many }) => ({
  orders: many(orders),
  conversations: many(conversations),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  telegramUser: one(telegramUsers, { fields: [orders.telegramUserId], references: [telegramUsers.id] }),
  instagramUser: one(instagramUsers, { fields: [orders.instagramUserId], references: [instagramUsers.id] }),
  orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, { fields: [orderItems.menuItemId], references: [menuItems.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  telegramUser: one(telegramUsers, { fields: [conversations.telegramUserId], references: [telegramUsers.id] }),
  messages: many(conversationMessages)
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, { fields: [conversationMessages.conversationId], references: [conversations.id] })
}));

// Instagram user relations
export const instagramUsersRelations = relations(instagramUsers, ({ many }) => ({
  instagramConversations: many(instagramConversations),
  orders: many(orders)
}));

// Instagram conversation relations
export const instagramConversationsRelations = relations(instagramConversations, ({ one, many }) => ({
  instagramUser: one(instagramUsers, { fields: [instagramConversations.instagramUserId], references: [instagramUsers.id] }),
  messages: many(instagramConversationMessages)
}));

// Instagram conversation messages relations
export const instagramConversationMessagesRelations = relations(instagramConversationMessages, ({ one }) => ({
  conversation: one(instagramConversations, { fields: [instagramConversationMessages.conversationId], references: [instagramConversations.id] })
}));
