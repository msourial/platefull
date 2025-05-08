import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { sendMenuCategories, sendMenuItems, sendOrderSummary, createInlineKeyboard } from './bot';
import { processNaturalLanguage } from '../services/nlp';
import { createOrder, addItemToOrder, removeItemFromOrder, clearOrder } from '../services/order';
import { processPayment } from '../services/payment';
import { log } from '../vite';

// Helper function to check for potential typos in dietary preferences
function containsDietaryPreference(text: string, type: string): boolean {
  // Check for common typos and variant spellings
  const dietaryPatterns: Record<string, RegExp> = {
    keto: /(keto|ketogenic|low carb|low-carb|law carb|lo carb|lo-carb|no carb|carb free|low calorie|lo cal)/i,
    vegan: /(vegan|plant[- ]based|no animal|100% plant|dairy[- ]free and meat[- ]free|veggies only)/i,
    vegetarian: /(vegetarian|veggie|no meat|meatless|meat[- ]free)/i,
    gluten_free: /(gluten[- ]free|no gluten|gluten[- ]less|celiac|no wheat)/i,
    halal: /(halal|muslim friendly|muslim[- ]friendly|islamic dietary|islam food)/i
  };

  return !!dietaryPatterns[type]?.test(text);
}

// Handle incoming messages from users
export async function handleIncomingMessage(bot: TelegramBot, msg: TelegramBot.Message) {
  if (!msg.text) return;
  
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString();
  
  if (!telegramId) {
    await bot.sendMessage(chatId, "Sorry, I couldn't identify you. Please try again.");
    return;
  }

  // Register user if not exists
  let telegramUser = await storage.getTelegramUserByTelegramId(telegramId);
  
  if (!telegramUser) {
    telegramUser = await storage.createTelegramUser({
      telegramId,
      username: msg.from?.username,
      firstName: msg.from?.first_name,
      lastName: msg.from?.last_name
    });
  } else {
    // Update last interaction time
    telegramUser = await storage.updateTelegramUser(telegramUser.id, {
      lastInteraction: new Date()
    });
  }

  // Get or create conversation
  let conversation = await storage.getConversationByTelegramUserId(telegramUser.id);
  
  if (!conversation) {
    conversation = await storage.createConversation({
      telegramUserId: telegramUser.id,
      state: 'initial',
      context: {}
    });
  }

  // Process the message based on conversation state
  switch (conversation.state) {
    case 'initial':
      // Send welcome message for new conversations
      await sendWelcomeMessage(bot, chatId);
      await storage.updateConversation(conversation.id, { state: 'menu_selection' });
      break;
      
    case 'menu_selection':
      // Process menu selection or show categories
      if (msg.text.toLowerCase() === 'show me the menu') {
        await sendMenuCategories(chatId);
      } else if (msg.text.toLowerCase() === 'i know what i want') {
        await bot.sendMessage(
          chatId,
          "Great! What would you like to order? You can type the name of the item or describe what you're looking for."
        );
        await storage.updateConversation(conversation.id, { state: 'item_selection' });
      } else {
        // Process as natural language query
        await processNaturalLanguageInput(bot, msg, telegramUser, conversation);
      }
      break;
      
    case 'item_selection':
      // Process item selection via natural language
      await processNaturalLanguageInput(bot, msg, telegramUser, conversation);
      break;
      
    case 'delivery_info':
      // Process delivery address
      await processDeliveryInfo(bot, msg, telegramUser, conversation);
      break;
      
    case 'payment_selection':
      // Process payment selection
      await processPaymentSelection(bot, msg, telegramUser, conversation);
      break;
      
    case 'order_confirmation':
      // Process final confirmation
      await processOrderConfirmation(bot, msg, telegramUser, conversation);
      break;
      
    default:
      // Handle any other states or reset to initial
      await processNaturalLanguageInput(bot, msg, telegramUser, conversation);
      break;
  }
}

// Handle callback queries (button clicks)
export async function handleCallbackQuery(bot: TelegramBot, query: TelegramBot.CallbackQuery) {
  if (!query.data || !query.message) return;
  
  const chatId = query.message.chat.id;
  const telegramId = query.from.id.toString();
  
  // Acknowledge the callback query
  await bot.answerCallbackQuery(query.id);
  
  // Get user
  const telegramUser = await storage.getTelegramUserByTelegramId(telegramId);
  
  if (!telegramUser) {
    await bot.sendMessage(chatId, "Sorry, I couldn't identify you. Please try again later.");
    return;
  }
  
  // Get conversation
  let conversation = await storage.getConversationByTelegramUserId(telegramUser.id);
  
  if (!conversation) {
    conversation = await storage.createConversation({
      telegramUserId: telegramUser.id,
      state: 'menu_selection',
      context: {}
    });
  }
  
  // Process based on callback data
  const [action, ...params] = query.data.split(':');
  
  log(`Processing callback query: Action=${action}, Params=${params.join(',')}`, 'telegram-callback');
  
  switch (action) {
    case 'menu':
      await sendMenuCategories(chatId);
      await storage.updateConversation(conversation.id, { state: 'menu_selection' });
      break;
      
    case 'menu_item':
      try {
        if (params[0]) {
          const menuItemId = parseInt(params[0]);
          log(`Processing menu item selection with ID: ${menuItemId}`, 'telegram-callback');
          
          const menuItem = await storage.getMenuItemById(menuItemId);
          
          if (!menuItem) {
            await bot.sendMessage(chatId, "Sorry, this item is not available.");
            return;
          }
          
          log(`Found menu item: ${menuItem.name}, Price: ${menuItem.price}`, 'telegram-callback');
          
          // Get or create an order for the user
          const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
          let orderId: number;
          
          if (activeOrder) {
            orderId = activeOrder.id;
            log(`Using existing order with ID: ${orderId}`, 'telegram-callback');
          } else {
            // Create a new order with explicit totalAmount to avoid validation errors
            log(`Creating new order for user ${telegramUser.id}`, 'telegram-callback');
            try {
              const newOrder = await storage.createOrder({
                telegramUserId: telegramUser.id,
                status: "pending",
                totalAmount: "0.00",
                deliveryFee: "0.00",
                isDelivery: true,
                paymentMethod: "cash",
                paymentStatus: "pending"
              });
              orderId = newOrder.id;
              log(`Successfully created new order with ID: ${orderId}`, 'telegram-callback');
            } catch (createOrderError) {
              log(`Error creating order directly: ${createOrderError}`, 'telegram-error');
              throw new Error(`Failed to create order: ${createOrderError}`);
            }
          }
          
          // Add the item to the order
          log(`Adding menu item ${menuItemId} to order ${orderId}`, 'telegram-callback');
          try {
            await addItemToOrder(orderId, menuItemId);
            log(`Successfully added item to order`, 'telegram-callback');
            
            // Check the category of the item to determine appropriate follow-up
            const category = await storage.getCategoryById(menuItem.categoryId);
            
            // Update conversation context to track ordering flow
            if (category) {
              // For main dishes, set context for suggesting sides
              if (['Pitas', 'Wraps', 'Platters', 'Main Dishes'].includes(category.name)) {
                await storage.updateConversation(conversation.id, {
                  context: {
                    ...conversation.context,
                    lastOrderedItem: menuItem.name,
                    lastOrderedCategory: category.name,
                    pendingSuggestSides: true,
                    pendingSuggestDrinks: false,
                    pendingSuggestDesserts: false
                  }
                });
                await suggestSides(bot, chatId, orderId, menuItem);
                return;
              }
              
              // For sides, set context for suggesting drinks
              if (['Sides', 'Salads'].includes(category.name)) {
                await storage.updateConversation(conversation.id, {
                  context: {
                    ...conversation.context,
                    lastOrderedItem: menuItem.name,
                    lastOrderedCategory: category.name,
                    pendingSuggestSides: false,
                    pendingSuggestDrinks: true,
                    pendingSuggestDesserts: false
                  }
                });
                await suggestDrinks(bot, chatId, orderId);
                return;
              }
              
              // For drinks, set context for suggesting desserts
              if (['Beverages', 'Drinks'].includes(category.name)) {
                await storage.updateConversation(conversation.id, {
                  context: {
                    ...conversation.context,
                    lastOrderedItem: menuItem.name,
                    lastOrderedCategory: category.name,
                    pendingSuggestSides: false,
                    pendingSuggestDrinks: false,
                    pendingSuggestDesserts: true
                  }
                });
                await suggestDesserts(bot, chatId, orderId);
                return;
              }
            }
          } catch (addItemError) {
            log(`Error adding item to order: ${addItemError}`, 'telegram-error');
            throw new Error(`Failed to add item to order: ${addItemError}`);
          }
          
          // Default fallback if no specific category-based suggestion flow
          await bot.sendMessage(
            chatId,
            `Perfect choice! I've added *${menuItem.name}* to your order. Would you like anything else?`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: "View My Order", callback_data: "view_order" }],
                  [{ text: "Add More Items", callback_data: "menu" }],
                  [{ text: "Checkout", callback_data: "checkout" }]
                ]
              }
            }
          );
        } else {
          await bot.sendMessage(
            chatId,
            "Sorry, I couldn't find that menu item. Let me show you our menu categories instead.",
            createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
          );
        }
      } catch (error) {
        log(`Error handling menu_item callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "Sorry, I encountered an error adding that item to your order. Let's try something else.",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
      }
      break;

    case 'direct_order':
      await bot.sendMessage(
        chatId,
        "Please type what you'd like to order. For example, you can say 'I want a chicken shawarma pita' or 'I'd like a beef platter and a side of hummus'.",
        { parse_mode: 'Markdown' }
      );
      await storage.updateConversation(conversation.id, { state: 'item_selection' });
      break;
    
    case 'customize':
      try {
        if (params[0]) {
          const menuItemId = parseInt(params[0]);
          log(`Processing customize with ID: ${menuItemId}`, 'telegram-callback');
          
          const menuItem = await storage.getMenuItemById(menuItemId);
          
          if (!menuItem) {
            await bot.sendMessage(chatId, "Sorry, this item is not available.");
            return;
          }
          
          log(`Found menu item for customization: ${menuItem.name}`, 'telegram-callback');
          
          // Get or create an order for the user
          const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
          let orderId: number;
          
          if (activeOrder) {
            orderId = activeOrder.id;
            log(`Using existing order with ID: ${orderId}`, 'telegram-callback');
          } else {
            // Create a new order with explicit totalAmount to avoid validation errors
            log(`Creating new order for user ${telegramUser.id}`, 'telegram-callback');
            try {
              const newOrder = await storage.createOrder({
                telegramUserId: telegramUser.id,
                status: "pending",
                totalAmount: "0.00",
                deliveryFee: "0.00",
                isDelivery: true,
                paymentMethod: "cash",
                paymentStatus: "pending"
              });
              orderId = newOrder.id;
              log(`Successfully created new order with ID: ${orderId}`, 'telegram-callback');
            } catch (createOrderError) {
              log(`Error creating order directly: ${createOrderError}`, 'telegram-error');
              throw new Error(`Failed to create order: ${createOrderError}`);
            }
          }
          
          // Add the item to the order first
          log(`Adding customizable menu item ${menuItemId} to order ${orderId}`, 'telegram-callback');
          try {
            await addItemToOrder(orderId, menuItemId);
            log(`Successfully added item to order for customization`, 'telegram-callback');
          } catch (addItemError) {
            log(`Error adding item to order for customization: ${addItemError}`, 'telegram-error');
            throw new Error(`Failed to add item to order: ${addItemError}`);
          }
          
          // Then ask for customizations
          if (menuItem.customizationOptions && menuItem.customizationOptions.length > 0) {
            await askForCustomizations(bot, chatId, menuItem, orderId);
          } else {
            // Check the category of the item to determine appropriate follow-up
            const category = await storage.getCategoryById(menuItem.categoryId);
            
            if (category) {
              // For main dishes (pitas, wraps, platters), ask about sides
              if (['Pitas', 'Wraps', 'Platters', 'Main Dishes'].includes(category.name)) {
                await suggestSides(bot, chatId, orderId, menuItem);
                return;
              }
              
              // For sides, suggest drinks if not already ordered
              if (['Sides', 'Salads'].includes(category.name)) {
                await suggestDrinks(bot, chatId, orderId);
                return;
              }
              
              // For drinks, suggest desserts if not already ordered
              if (['Beverages', 'Drinks'].includes(category.name)) {
                await suggestDesserts(bot, chatId, orderId);
                return;
              }
            }
            
            // Default fallback if no specific suggestions
            await bot.sendMessage(
              chatId,
              `✅ Perfect choice! I've added *${menuItem.name}* to your order. Would you like anything else? 🍽️`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🛒 View My Order", callback_data: "view_order" }],
                    [{ text: "📋 Add More Items", callback_data: "menu" }],
                    [{ text: "💳 Checkout", callback_data: "checkout" }]
                  ]
                }
              }
            );
          }
        } else {
          await bot.sendMessage(
            chatId,
            "Sorry, I couldn't find that menu item for customization. Let me show you our menu categories instead.",
            createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
          );
        }
      } catch (error) {
        log(`Error handling customize callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "Sorry, I encountered an error customizing that item. Let's try something else.",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
      }
      break;
      
    case 'special_request':
      await bot.sendMessage(
        chatId,
        "*Tell me what you're in the mood for and I'll recommend the perfect Boustan dishes for you!*\n\nYou can say things like:\n- \"What's good for vegetarians?\"\n- \"I want something spicy\"\n- \"I'm really hungry and need a filling meal\"\n- \"What's popular at Boustan?\"\n- \"I need a quick lunch option\"",
        { parse_mode: 'Markdown' }
      );
      await storage.updateConversation(conversation.id, { state: 'item_selection' });
      break;
      
    case 'follow_up':
      // This is a follow-up question from AI recommendations
      // The question text is stored in context, retrieve it and process as a message
      
      if (!conversation.context || !conversation.context.followUpQuestions || !params[0]) {
        await bot.sendMessage(
          chatId,
          "I'm sorry, I lost track of our conversation. How can I help you?",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
        break;
      }
      
      const questionIndex = parseInt(params[0]);
      const followUpQuestions = conversation.context.followUpQuestions as string[];
      
      if (questionIndex >= 0 && questionIndex < followUpQuestions.length) {
        const question = followUpQuestions[questionIndex];
        
        // Let the user know which question we're answering
        await bot.sendMessage(
          chatId,
          `*Answering:* ${question}`,
          { parse_mode: 'Markdown' }
        );
        
        // Create a fake message to process the follow-up question
        const fakeMessage: TelegramBot.Message = {
          message_id: Date.now(),
          from: query.from,
          chat: query.message.chat,
          date: Math.floor(Date.now() / 1000),
          text: question
        };
        
        // Process this as a natural language query
        await processNaturalLanguageInput(bot, fakeMessage, telegramUser, conversation);
      } else {
        await bot.sendMessage(
          chatId,
          "I'm sorry, I don't recognize that question. Would you like to see our menu or ask me about something specific?",
          createInlineKeyboard([
            [{ text: "Show Menu", callback_data: "menu" }],
            [{ text: "Make Recommendations", callback_data: "special_request" }]
          ])
        );
      }
      break;
      
    case 'category':
      if (params[0]) {
        const categoryId = parseInt(params[0]);
        await sendMenuItems(chatId, categoryId);
      }
      break;
      
    case 'add_item':
      try {
        if (params[0]) {
          const menuItemId = parseInt(params[0]);
          log(`Processing add_item with ID: ${menuItemId}`, 'telegram-callback');
          
          const menuItem = await storage.getMenuItemById(menuItemId);
          
          if (!menuItem) {
            await bot.sendMessage(chatId, "Sorry, this item is not available.");
            return;
          }
          
          log(`Found menu item: ${menuItem.name}, Price: ${menuItem.price}`, 'telegram-callback');
          
          // Get or create an order for the user
          const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
          let orderId: number;
          
          if (activeOrder) {
            orderId = activeOrder.id;
            log(`Using existing order with ID: ${orderId}`, 'telegram-callback');
          } else {
            // Create a new order with explicit totalAmount to avoid validation errors
            log(`Creating new order for user ${telegramUser.id}`, 'telegram-callback');
            try {
              const newOrder = await storage.createOrder({
                telegramUserId: telegramUser.id,
                status: "pending",
                totalAmount: "0.00",
                deliveryFee: "0.00",
                isDelivery: true,
                paymentMethod: "cash",
                paymentStatus: "pending"
              });
              orderId = newOrder.id;
              log(`Successfully created new order with ID: ${orderId}`, 'telegram-callback');
            } catch (createOrderError) {
              log(`Error creating order directly: ${createOrderError}`, 'telegram-error');
              throw new Error(`Failed to create order: ${createOrderError}`);
            }
          }
          
          // Check if this is an answer to a suggestion (from a no_drinks, no_sides callback)
          // This uses the conversation context to determine if we're in a suggestion flow
          const isFollowupSuggestion = conversation.context && (
            conversation.context.pendingSuggestSides || 
            conversation.context.pendingSuggestDrinks ||
            conversation.context.pendingSuggestDesserts
          );
          
          // Add the item to the order
          log(`Adding menu item ${menuItemId} to order ${orderId}`, 'telegram-callback');
          try {
            await addItemToOrder(orderId, menuItemId);
            log(`Successfully added item to order`, 'telegram-callback');
          } catch (addItemError) {
            log(`Error adding item to order: ${addItemError}`, 'telegram-error');
            throw new Error(`Failed to add item to order: ${addItemError}`);
          }
          
          // Update conversation context
          if (conversation.context) {
            if (conversation.context.pendingSuggestSides) {
              // If we were suggesting sides, move to suggesting drinks next
              await storage.updateConversation(conversation.id, {
                context: {
                  ...conversation.context,
                  pendingSuggestSides: false,
                  pendingSuggestDrinks: true
                }
              });
            } else if (conversation.context.pendingSuggestDrinks) {
              // If we were suggesting drinks, move to suggesting desserts next
              await storage.updateConversation(conversation.id, {
                context: {
                  ...conversation.context,
                  pendingSuggestDrinks: false,
                  pendingSuggestDesserts: true
                }
              });
            } else if (conversation.context.pendingSuggestDesserts) {
              // If we were suggesting desserts, clear the suggestion flow
              await storage.updateConversation(conversation.id, {
                context: {
                  ...conversation.context,
                  pendingSuggestDesserts: false
                }
              });
            }
          }
          
          // If the item has customization options, ask for them
          if (menuItem.customizationOptions && menuItem.customizationOptions.length > 0) {
            await askForCustomizations(bot, chatId, menuItem, orderId);
          } else {
            // Check the category of the item to determine appropriate follow-up
            const category = await storage.getCategoryById(menuItem.categoryId);
            
            if (category && !isFollowupSuggestion) {
              // For main dishes (pitas, wraps, platters), ask about sides
              if (['Pitas', 'Wraps', 'Platters', 'Main Dishes'].includes(category.name)) {
                // Update context to mark that we're suggesting sides
                await storage.updateConversation(conversation.id, {
                  context: {
                    ...conversation.context,
                    pendingSuggestSides: true
                  }
                });
                await suggestSides(bot, chatId, orderId, menuItem);
                return;
              }
              
              // For sides, suggest drinks if not already ordered
              if (['Sides', 'Salads'].includes(category.name)) {
                // Update context to mark that we're suggesting drinks
                await storage.updateConversation(conversation.id, {
                  context: {
                    ...conversation.context,
                    pendingSuggestDrinks: true
                  }
                });
                await suggestDrinks(bot, chatId, orderId);
                return;
              }
              
              // For drinks, suggest desserts if not already ordered
              if (['Beverages', 'Drinks'].includes(category.name)) {
                // Update context to mark that we're suggesting desserts
                await storage.updateConversation(conversation.id, {
                  context: {
                    ...conversation.context,
                    pendingSuggestDesserts: true
                  }
                });
                await suggestDesserts(bot, chatId, orderId);
                return;
              }
            } else if (isFollowupSuggestion) {
              // Continue the existing suggestion flow
              if (conversation.context && conversation.context.pendingSuggestDrinks) {
                await suggestDrinks(bot, chatId, orderId);
                return;
              } else if (conversation.context && conversation.context.pendingSuggestDesserts) {
                await suggestDesserts(bot, chatId, orderId);
                return;
              } else {
                // If we've completed the suggestion flow or something went wrong,
                // just ask if they want anything else
                await askForMoreItems(bot, chatId, orderId);
                return;
              }
            }
            
            // Default fallback if no specific suggestions
            await bot.sendMessage(
              chatId,
              `✅ Perfect choice! I've added *${menuItem.name}* to your order. Would you like anything else? 🍽️`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🛒 View My Order", callback_data: "view_order" }],
                    [{ text: "📋 Add More Items", callback_data: "menu" }],
                    [{ text: "💳 Checkout", callback_data: "checkout" }]
                  ]
                }
              }
            );
          }
        } else {
          await bot.sendMessage(
            chatId,
            "Sorry, I couldn't find that menu item. Let me show you our menu categories instead.",
            createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
          );
        }
      } catch (error) {
        log(`Error handling add_item callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "Sorry, I encountered an error adding that item to your order. Let's try something else.",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
      }
      break;
      
    case 'customization':
      try {
        if (params.length >= 3) {
          const [orderItemId, optionName, choice] = params;
          log(`Processing customization for order item ${orderItemId}, option: ${optionName}, choice: ${choice}`, 'telegram-callback');
          
          // Parse the order item ID safely
          const orderItemIdNum = parseInt(orderItemId);
          if (isNaN(orderItemIdNum)) {
            throw new Error(`Invalid order item ID: ${orderItemId}`);
          }
          
          // Update the order item with the chosen customization
          const orderItem = await storage.getOrderItemById(orderItemIdNum);
          
          if (!orderItem) {
            log(`Order item not found: ${orderItemIdNum}`, 'telegram-error');
            await bot.sendMessage(
              chatId,
              "Sorry, I couldn't find that item in your order. Let me show you your current order.",
              createInlineKeyboard([[{ text: "View Order", callback_data: "view_order" }]])
            );
            return;
          }
          
          log(`Found order item for customization: ${JSON.stringify(orderItem)}`, 'telegram-callback');
          
          // Safely handle customizations object
          const customizations = orderItem.customizations && typeof orderItem.customizations === 'object' 
            ? orderItem.customizations as Record<string, string> 
            : {};
          
          // Add the new customization choice
          customizations[optionName] = choice;
          
          // Update the order item
          log(`Updating order item ${orderItemIdNum} with customization: ${optionName}=${choice}`, 'telegram-callback');
          try {
            await storage.updateOrderItem(orderItemIdNum, {
              customizations
            });
            log(`Successfully updated order item with customization`, 'telegram-callback');
            
            // Get the menu item name for a better user experience
            const menuItem = await storage.getMenuItemById(orderItem.menuItemId);
            const itemName = menuItem ? menuItem.name : 'item';
            
            await bot.sendMessage(
              chatId,
              `✅ Great! I've updated your *${itemName}* with *${optionName}: ${choice}*`,
              {
                parse_mode: 'Markdown'
              }
            );
            
            // Check if there are more customization options for this item
            if (menuItem && menuItem.customizationOptions && menuItem.customizationOptions.length > 0) {
              // Check if there's any customization option that hasn't been chosen yet
              const existingCustomizations = orderItem.customizations || {};
              const remainingOptions = menuItem.customizationOptions.filter(option => 
                !existingCustomizations[option.name]
              );
              
              if (remainingOptions.length > 0) {
                // First try to get the next customization option
                const nextOption = remainingOptions[0];
                const choices = nextOption.choices as string[];
                
                const keyboard = choices.map(choice => [
                  { text: choice, callback_data: `customization:${orderItem.id}:${nextOption.name}:${choice}` }
                ]);
                
                await bot.sendMessage(
                  chatId,
                  `Please select ${nextOption.name} for your ${menuItem.name}: 👇`,
                  createInlineKeyboard(keyboard)
                );
                return;
              }
            }
            
            // No more customization options, proceed to suggest sides
            const category = await storage.getCategoryById(menuItem.categoryId);
            
            if (category) {
              // For main dishes (pitas, wraps, platters), ask about sides
              if (['Pitas', 'Wraps', 'Platters', 'Main Dishes'].includes(category.name)) {
                await suggestSides(bot, chatId, orderId, menuItem);
                return;
              }
              
              // For sides, suggest drinks if not already ordered
              if (['Sides', 'Salads'].includes(category.name)) {
                await suggestDrinks(bot, chatId, orderId);
                return;
              }
              
              // For drinks, suggest desserts if not already ordered
              if (['Beverages', 'Drinks'].includes(category.name)) {
                await suggestDesserts(bot, chatId, orderId);
                return;
              }
            }
            
            // Default fallback if no specific suggestions
            await bot.sendMessage(
              chatId,
              "Would you like anything else? 🍽️",
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🛒 View My Order", callback_data: "view_order" }],
                    [{ text: "📋 Add More Items", callback_data: "menu" }],
                    [{ text: "💳 Checkout", callback_data: "checkout" }]
                  ]
                }
              }
            );
          } catch (updateError) {
            log(`Error updating order item customization: ${updateError}`, 'telegram-error');
            throw new Error(`Failed to update customization: ${updateError}`);
          }
        } else {
          throw new Error(`Invalid customization parameters: ${params.join(', ')}`);
        }
      } catch (error) {
        log(`Error handling customization callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "Sorry, I encountered an error updating your customization. Let's try something else.",
          createInlineKeyboard([[{ text: "View Menu", callback_data: "menu" }]])
        );
      }
      break;
      
    case 'remove_item':
      try {
        if (params[0]) {
          const orderItemId = parseInt(params[0]);
          log(`Processing remove_item with ID: ${orderItemId}`, 'telegram-callback');
          
          if (isNaN(orderItemId)) {
            throw new Error(`Invalid order item ID: ${params[0]}`);
          }
          
          // Verify the item exists before trying to remove it
          const orderItem = await storage.getOrderItemById(orderItemId);
          if (!orderItem) {
            log(`Order item not found: ${orderItemId}`, 'telegram-error');
            await bot.sendMessage(
              chatId,
              "Sorry, I couldn't find that item in your order. Let me show you your current order.",
              createInlineKeyboard([[{ text: "View Order", callback_data: "view_order" }]])
            );
            return;
          }
          
          // Look up the item name before removal for better user feedback
          let itemName = "Item";
          try {
            const menuItem = await storage.getMenuItemById(orderItem.menuItemId);
            if (menuItem) {
              itemName = menuItem.name;
            }
          } catch (menuItemError) {
            log(`Failed to get menu item details: ${menuItemError}`, 'telegram-error');
          }
          
          // Remove the item
          log(`Removing order item ${orderItemId} from order`, 'telegram-callback');
          try {
            await removeItemFromOrder(orderItemId);
            log(`Successfully removed item from order`, 'telegram-callback');
            
            await bot.sendMessage(
              chatId, 
              `I've removed *${itemName}* from your order.`, 
              { parse_mode: 'Markdown' }
            );
            
            // Show updated order
            const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
            if (activeOrder) {
              // Check if there are any items left
              const orderItems = await storage.getOrderItems(activeOrder.id);
              if (orderItems && orderItems.length > 0) {
                await sendOrderSummary(chatId, activeOrder.id);
              } else {
                // Order exists but has no items
                await bot.sendMessage(
                  chatId,
                  "Your order is now empty. Would you like to browse our menu?",
                  createInlineKeyboard([
                    [{ text: "Browse Menu", callback_data: "menu" }],
                    [{ text: "Get Recommendations", callback_data: "special_request" }]
                  ])
                );
              }
            } else {
              await bot.sendMessage(
                chatId,
                "Your order is now empty. Would you like to see our menu?",
                createInlineKeyboard([
                  [{ text: "Browse Menu", callback_data: "menu" }],
                  [{ text: "Get Recommendations", callback_data: "special_request" }]
                ])
              );
            }
          } catch (removeError) {
            log(`Error removing item from order: ${removeError}`, 'telegram-error');
            throw new Error(`Failed to remove item from order: ${removeError}`);
          }
        } else {
          throw new Error(`Missing order item ID parameter`);
        }
      } catch (error) {
        log(`Error handling remove_item callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "Sorry, I encountered an error removing that item. Let me show you your current order.",
          createInlineKeyboard([[{ text: "View Order", callback_data: "view_order" }]])
        );
      }
      break;
      
    case 'view_order':
      const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
      
      if (activeOrder) {
        await sendOrderSummary(chatId, activeOrder.id);
      } else {
        await bot.sendMessage(
          chatId,
          "You don't have any active orders. Would you like to see our menu?",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
      }
      break;
      
    case 'no_sides':
      // User declined sides, move to drinks
      try {
        log(`User declined sides`, 'telegram-callback');
        const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
        
        if (activeOrder) {
          // Update conversation context to indicate we're moving to drinks
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              pendingSuggestSides: false,
              pendingSuggestDrinks: true
            }
          });
          await suggestDrinks(bot, chatId, activeOrder.id);
        } else {
          await bot.sendMessage(
            chatId,
            "Would you like to see our menu?",
            createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
          );
        }
      } catch (error) {
        log(`Error handling no_sides callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "What would you like to do next?",
          createInlineKeyboard([
            [{ text: "View Menu", callback_data: "menu" }],
            [{ text: "View Order", callback_data: "view_order" }]
          ])
        );
      }
      break;
      
    case 'no_drinks':
      // User declined drinks, move to desserts
      try {
        log(`User declined drinks`, 'telegram-callback');
        const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
        
        if (activeOrder) {
          // Update conversation context to indicate we're moving to desserts
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              pendingSuggestDrinks: false,
              pendingSuggestDesserts: true
            }
          });
          await suggestDesserts(bot, chatId, activeOrder.id);
        } else {
          await bot.sendMessage(
            chatId,
            "Would you like to see our menu?",
            createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
          );
        }
      } catch (error) {
        log(`Error handling no_drinks callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "What would you like to do next?",
          createInlineKeyboard([
            [{ text: "View Menu", callback_data: "menu" }],
            [{ text: "View Order", callback_data: "view_order" }]
          ])
        );
      }
      break;
      
    case 'no_dessert':
      // User declined desserts, ask if they want to checkout
      try {
        log(`User declined desserts`, 'telegram-callback');
        const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
        
        if (activeOrder) {
          // Update conversation context to indicate we've completed the suggestion flow
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              pendingSuggestDesserts: false
            }
          });
          await askForMoreItems(bot, chatId, activeOrder.id);
        } else {
          await bot.sendMessage(
            chatId,
            "Would you like to see our menu?",
            createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
          );
        }
      } catch (error) {
        log(`Error handling no_dessert callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "What would you like to do next?",
          createInlineKeyboard([
            [{ text: "View Menu", callback_data: "menu" }],
            [{ text: "View Order", callback_data: "view_order" }]
          ])
        );
      }
      break;

    case 'empty_cart':
      try {
        log(`Processing empty_cart request for user ${telegramUser.id}`, 'telegram-callback');
        
        const order = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
        
        if (order) {
          log(`Found active order ${order.id} to clear`, 'telegram-callback');
          
          try {
            await clearOrder(order.id);
            log(`Successfully cleared order ${order.id}`, 'telegram-callback');
            
            await bot.sendMessage(
              chatId,
              "Your order has been cleared. Would you like to start a new order?",
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "Browse Menu Categories", callback_data: "menu" }],
                    [{ text: "Get Personalized Recommendations", callback_data: "special_request" }]
                  ]
                }
              }
            );
          } catch (clearError) {
            log(`Error clearing order: ${clearError}`, 'telegram-error');
            throw new Error(`Failed to clear order: ${clearError}`);
          }
        } else {
          log(`No active order found for user ${telegramUser.id}`, 'telegram-callback');
          
          await bot.sendMessage(
            chatId,
            "You don't have any active orders. Would you like to see our menu?",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Browse Menu Categories", callback_data: "menu" }],
                  [{ text: "Get Personalized Recommendations", callback_data: "special_request" }]
                ]
              }
            }
          );
        }
      } catch (error) {
        log(`Error handling empty_cart callback: ${error}`, 'telegram-error');
        await bot.sendMessage(
          chatId,
          "Sorry, I encountered an error clearing your order. Please try again later.",
          createInlineKeyboard([[{ text: "View Your Order", callback_data: "view_order" }]])
        );
      }
      break;
      
    case 'checkout':
      await promptDeliveryOptions(bot, chatId, telegramUser, conversation);
      break;
      
    case 'delivery_method':
      await processDeliveryMethod(bot, chatId, telegramUser, conversation, params[0]);
      break;
      
    case 'payment_method':
      await processPaymentMethod(bot, chatId, telegramUser, conversation, params[0]);
      break;
      
    case 'place_order':
      await finalizeOrder(bot, chatId, telegramUser, conversation);
      break;
      
    default:
      await bot.sendMessage(chatId, "I'm not sure what to do with that selection. Let me show you the menu.");
      await sendMenuCategories(chatId);
      break;
  }
}

// Helper functions

async function sendWelcomeMessage(bot: TelegramBot, chatId: number) {
  await bot.sendMessage(
    chatId,
    "👋 *Welcome to Boustan Lebanese Restaurant!* I'm your AI assistant and I'm here to help you order delicious authentic Lebanese food.\n\nI can recommend dishes based on your preferences - just tell me what you're in the mood for! For example, you can say *\"I want something spicy\"* or *\"What's good for vegetarians?\"*",
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "Browse Menu Categories", callback_data: "menu" }],
          [{ text: "I Know What I Want", callback_data: "direct_order" }],
          [{ text: "Recommend Something", callback_data: "special_request" }]
        ]
      }
    }
  );
}

async function processNaturalLanguageInput(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  telegramUser: any,
  conversation: any
) {
  try {
    // Log the user's request for debugging
    log(`Processing natural language input: "${msg.text}" from user ${telegramUser.telegramId}`, 'telegram-nlp');
    
    // Record the start time for performance tracking
    const startTime = Date.now();
    
    // Quick check if this is a dietary preference query for enhanced detection
    const text = msg.text?.toLowerCase() || "";
    if (/keto|diet|vegetarian|vegan|gluten|halal/.test(text)) {
      log(`Detected potential dietary preference keywords in: "${text}"`, 'telegram-nlp-debug');
    }
    
    // Check if it's a very short response to a previous question (like "yes", "no", "mild", "spicy")
    const isShortResponse = msg.text && msg.text.trim().split(/\s+/).length <= 3;
    const lastBotMessage = await storage.getLastBotMessage(conversation.id);
    
    // If it's a short response to a previous question, enhance the context for better understanding
    if (isShortResponse && lastBotMessage) {
      // Combine the last bot message with the user's response to provide context for the NLP
      log(`Adding context from previous conversation for short response: "${msg.text}"`, 'telegram-nlp');
      
      // Modify short answers like "yes" to be more specific based on the last bot question
      if (/would you like your falafel spicy or mild/i.test(lastBotMessage.text) || 
          /spicy or mild/i.test(lastBotMessage.text)) {
        if (/spicy|hot/i.test(msg.text!)) {
          await bot.sendMessage(
            msg.chat.id,
            "Perfect! I'll make sure your order is prepared with our special spicy seasoning. It has a nice kick but won't overwhelm the delicious flavors. Would you like to add garlic sauce on the side for an extra burst of flavor?"
          );
          // Save this preference in the conversation context for future recommendations
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              spicePreference: 'spicy'
            }
          });
        } else if (/mild|not spicy|no spice/i.test(msg.text!)) {
          await bot.sendMessage(
            msg.chat.id,
            "Great choice! Our mild preparation lets you enjoy the delicate blend of herbs and authentic Lebanese flavors without any heat. It's our most popular preparation. Would you like to add our famous garlic sauce on the side?"
          );
          // Save this preference in the conversation context for future recommendations
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              spicePreference: 'mild'
            }
          });
        }
        return; // We've handled this response specifically
      } 
      
      if (/any allergies|allergies/i.test(lastBotMessage.text)) {
        if (/yes|i do|have|nut|sesame|dairy|gluten/i.test(msg.text!)) {
          // Extract the specific allergy if mentioned
          let allergyType = 'food';
          if (/nut|peanut|tree nut/i.test(msg.text!)) allergyType = 'nuts';
          if (/sesame|tahini/i.test(msg.text!)) allergyType = 'sesame';
          if (/dairy|milk|cheese/i.test(msg.text!)) allergyType = 'dairy';
          if (/gluten|wheat/i.test(msg.text!)) allergyType = 'gluten';
          
          await bot.sendMessage(
            msg.chat.id,
            `Thanks for letting me know about your ${allergyType} allergy. I'll make sure to note that in your order so our kitchen can prepare your food safely. We take allergies very seriously at Boustan.`
          );
          
          // Save this allergy info in the conversation context for future recommendations
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              allergyInfo: allergyType
            }
          });
          return; // We've handled this response specifically
        } else if (/no|don't have|none/i.test(msg.text!)) {
          await bot.sendMessage(
            msg.chat.id,
            "Great! No allergies to worry about. You'll be able to enjoy the full flavors of our authentic Lebanese cuisine. Would you like me to recommend our most popular dish?"
          );
          // Save this preference in the conversation context for future recommendations
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              allergyInfo: 'none'
            }
          });
          return; // We've handled this response specifically
        }
      }
      
      if (/prefer a wrap or a full platter/i.test(lastBotMessage.text) ||
          /wrap or platter/i.test(lastBotMessage.text)) {
        if (/wrap|pita/i.test(msg.text!)) {
          await bot.sendMessage(
            msg.chat.id,
            "Perfect! Our wraps are a great choice for a satisfying meal on the go. They're made with fresh, warm pita bread and packed with delicious fillings. Would you like to add a side of fresh-cut fries or a drink to complete your meal?"
          );
          // Save this preference in the conversation context
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              servicePreference: 'wrap'
            }
          });
          return; // We've handled this response specifically
        } else if (/platter|plate|full meal/i.test(msg.text!)) {
          await bot.sendMessage(
            msg.chat.id,
            "Excellent choice! Our platters are perfect for a complete meal experience. They come with your choice of protein, rice or fries, salad, and our house-made garlic sauce. Is there a specific type of platter you'd like to try?"
          );
          // Save this preference in the conversation context
          await storage.updateConversation(conversation.id, {
            context: {
              ...conversation.context,
              servicePreference: 'platter'
            }
          });
          return; // We've handled this response specifically
        }
      }
    }
    
    // Continuing with message processing...
    
    // Check for dietary preferences with typo tolerance
    if (containsDietaryPreference(msg.text!, 'keto')) {
      // Directly handle keto requests with typo tolerance
      log(`Directly handling keto dietary preference for message: "${msg.text}"`, 'telegram-nlp');
      await bot.sendMessage(
        msg.chat.id,
        "For keto-friendly options, I'd recommend our Chicken Shawarma Salad or Beef Kafta with extra vegetables instead of rice. These options are high in protein and lower in carbs. Would you like to try one of these?"
      );
      await bot.sendMessage(
        msg.chat.id,
        "Our Chicken Shawarma Salad features marinated chicken with fresh vegetables and no pita bread, making it a perfect low-carb option. Would you like to add that to your order?",
        createInlineKeyboard([
          [{ text: "Add Chicken Shawarma Salad", callback_data: "menu_item:23" }],
          [{ text: "See More Options", callback_data: "special_request:keto" }]
        ])
      );
      return;
    }
    
    if (containsDietaryPreference(msg.text!, 'vegan')) {
      // Directly handle vegan requests with typo tolerance
      log(`Directly handling vegan dietary preference for message: "${msg.text}"`, 'telegram-nlp');
      await bot.sendMessage(
        msg.chat.id,
        "For vegan options, I'd recommend our Falafel Wrap or Vegetarian Platter. Our falafel is made from a blend of chickpeas and herbs - 100% plant-based and delicious!"
      );
      await bot.sendMessage(
        msg.chat.id,
        "The Vegetarian Platter includes hummus, tabbouleh, grape leaves, and falafel - all completely vegan. Would you like to add that to your order?",
        createInlineKeyboard([
          [{ text: "Add Vegetarian Platter", callback_data: "menu_item:15" }],
          [{ text: "Add Falafel Wrap", callback_data: "menu_item:3" }],
          [{ text: "See More Options", callback_data: "special_request:vegan" }]
        ])
      );
      return;
    }
    
    if (containsDietaryPreference(msg.text!, 'vegetarian')) {
      // Directly handle vegetarian requests with typo tolerance
      log(`Directly handling vegetarian dietary preference for message: "${msg.text}"`, 'telegram-nlp');
      await bot.sendMessage(
        msg.chat.id,
        "For vegetarian options at Boustan, I'd recommend our Falafel Wrap, Vegetarian Platter, or our delicious Hummus with fresh pita bread. All of these are made without meat and are very popular!"
      );
      await bot.sendMessage(
        msg.chat.id,
        "Our Vegetarian Platter is especially popular, featuring hummus, tabbouleh, grape leaves, and falafel. Would you like to add that to your order?",
        createInlineKeyboard([
          [{ text: "Add Vegetarian Platter", callback_data: "menu_item:15" }],
          [{ text: "Add Falafel Wrap", callback_data: "menu_item:3" }],
          [{ text: "See More Options", callback_data: "special_request:vegetarian" }]
        ])
      );
      return;
    }
    
    if (containsDietaryPreference(msg.text!, 'gluten_free')) {
      // Directly handle gluten-free requests with typo tolerance
      log(`Directly handling gluten-free dietary preference for message: "${msg.text}"`, 'telegram-nlp');
      await bot.sendMessage(
        msg.chat.id,
        "For gluten-free options at Boustan, I'd recommend our Chicken or Beef Shawarma Salad (without pita), or any of our protein platters without the pita bread. You can also enjoy our hummus with vegetables instead of bread."
      );
      await bot.sendMessage(
        msg.chat.id,
        "Our Chicken Shawarma Salad is a great gluten-free choice, featuring marinated chicken with fresh vegetables. Would you like to add that to your order?",
        createInlineKeyboard([
          [{ text: "Add Chicken Shawarma Salad", callback_data: "menu_item:23" }],
          [{ text: "Add Beef Shawarma Salad", callback_data: "menu_item:24" }],
          [{ text: "See More Options", callback_data: "special_request:gluten_free" }]
        ])
      );
      return;
    }
    
    if (containsDietaryPreference(msg.text!, 'halal')) {
      // Directly handle halal requests with typo tolerance
      log(`Directly handling halal dietary preference for message: "${msg.text}"`, 'telegram-nlp');
      await bot.sendMessage(
        msg.chat.id,
        "Good news! All of Boustan's meat options are halal certified. Our chicken and beef are prepared according to Islamic dietary guidelines, so you can enjoy any of our meat dishes with confidence."
      );
      await bot.sendMessage(
        msg.chat.id,
        "Our most popular halal items are the Chicken Shawarma and Beef Kafta. Would you like to add one of these to your order?",
        createInlineKeyboard([
          [{ text: "Add Chicken Shawarma", callback_data: "menu_item:1" }],
          [{ text: "Add Beef Kafta", callback_data: "menu_item:8" }],
          [{ text: "See Full Menu", callback_data: "menu" }]
        ])
      );
      return;
    }
    
    // Process the natural language using OpenAI
    const response = await processNaturalLanguage(msg.text!, telegramUser.telegramId);
    
    // Log performance metrics
    const processingTime = Date.now() - startTime;
    log(`NLP processing time: ${processingTime}ms for intent: ${response.intent}`, 'telegram-nlp');
    
    // Create conversation message record to track history
    await storage.createConversationMessage(conversation.id, {
      text: msg.text || "",
      isFromUser: true
    });
    
    // Update conversation based on NLP response
    if (response.intent === "order_item" || response.intent === "direct_order") {
      // User wants to order a specific item
      if (!response.item) {
        await bot.sendMessage(
          msg.chat.id,
          "I'm not sure what you'd like to order. Can you be more specific about which menu item you want?",
          createInlineKeyboard([
            [{ text: "Show Menu", callback_data: "menu" }],
            [{ text: "Help Me Choose", callback_data: "special_request" }]
          ])
        );
        return;
      }
      
      // Handle special case for multiple options
      if (response.item === 'multiple-options' && response.specialInstructions) {
        try {
          // Parse the JSON with potential matches
          const potentialMatches = JSON.parse(response.specialInstructions);
          
          if (potentialMatches && potentialMatches.length > 0) {
            // Create keyboard buttons for each match
            const keyboard = potentialMatches.map(item => [
              { text: `${item.name} - $${parseFloat(item.price.toString()).toFixed(2)}`, callback_data: `add_item:${item.id}` }
            ]);
            
            keyboard.push([{ text: "Show Full Menu", callback_data: "menu" }]);
            
            await bot.sendMessage(
              msg.chat.id,
              "I found multiple options that match your request. Which one would you like?",
              createInlineKeyboard(keyboard)
            );
            return;
          }
        } catch (error) {
          log(`Error parsing multiple options: ${error}`, 'telegram-error');
        }
      }
      
      const menuItems = await storage.getMenuItemsByName(response.item);
      
      if (menuItems.length === 0) {
        // Try fuzzy search for similar items
        const allMenuItems = await storage.getMenuItems();
        const similarItems = allMenuItems.filter(item => 
          item.name.toLowerCase().includes(response.item!.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(response.item!.toLowerCase()))
        ).slice(0, 3); // Limit to 3 similar items
        
        if (similarItems.length > 0) {
          await bot.sendMessage(
            msg.chat.id,
            `I couldn't find "${response.item}" exactly, but here are similar items:`,
            { parse_mode: 'Markdown' }
          );
          
          const keyboard = similarItems.map(item => [
            { text: `${item.name} - $${parseFloat(item.price.toString()).toFixed(2)}`, callback_data: `add_item:${item.id}` }
          ]);
          
          keyboard.push([{ text: "Show Full Menu", callback_data: "menu" }]);
          
          await bot.sendMessage(
            msg.chat.id,
            "Would you like to add any of these to your order?",
            createInlineKeyboard(keyboard)
          );
        } else {
          await bot.sendMessage(
            msg.chat.id,
            `I'm sorry, I couldn't find "${response.item}" on our menu. Would you like me to recommend something similar?`,
            createInlineKeyboard([
              [{ text: "Recommend Something", callback_data: "special_request" }],
              [{ text: "Show Menu", callback_data: "menu" }]
            ])
          );
        }
      } else if (menuItems.length === 1) {
        // Exact match found
        const menuItem = menuItems[0];
        
        // Get or create order
        const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
        let orderId: number;
        
        if (activeOrder) {
          orderId = activeOrder.id;
        } else {
          const newOrder = await createOrder(telegramUser.id);
          orderId = newOrder.id;
        }
        
        // Add item to order with special instructions if any
        const orderItem = await addItemToOrder(orderId, menuItem.id, 1, response.specialInstructions);
        
        // Confirmation message with Markdown formatting and emojis
        await bot.sendMessage(
          msg.chat.id,
          `✅ *Added to your order:* ${menuItem.name}${response.specialInstructions ? `\n_Special instructions: ${response.specialInstructions}_` : ''}`,
          {
            parse_mode: 'Markdown'
          }
        );
        
        // If item has customization options, ask for them
        if (menuItem.customizationOptions && menuItem.customizationOptions.length > 0) {
          await askForCustomizations(bot, msg.chat.id, menuItem, orderId);
          return; // Stop here as we're now asking for customizations
        }
        
        // Check the category of the item to determine appropriate follow-up
        const category = await storage.getCategoryById(menuItem.categoryId);
        
        if (category) {
          // For main dishes (pitas, wraps, platters), ask about sides
          if (['Pitas', 'Wraps', 'Platters', 'Main Dishes'].includes(category.name)) {
            await suggestSides(bot, msg.chat.id, orderId, menuItem);
            return;
          }
          
          // For sides, suggest drinks if not already ordered
          if (['Sides', 'Salads'].includes(category.name)) {
            await suggestDrinks(bot, msg.chat.id, orderId);
            return;
          }
          
          // For drinks, suggest desserts if not already ordered
          if (['Beverages', 'Drinks'].includes(category.name)) {
            await suggestDesserts(bot, msg.chat.id, orderId);
            return;
          }
        }
        
        // Default fallback if no specific suggestions
        await bot.sendMessage(
          msg.chat.id,
          "Would you like to add anything else to your order? 🍽️",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🛒 View Order", callback_data: "view_order" }],
                [{ text: "📋 Continue Shopping", callback_data: "menu" }],
                [{ text: "💳 Checkout", callback_data: "checkout" }]
              ]
            }
          }
        );
      } else {
        // Multiple matches found - present options with prices and descriptions
        await bot.sendMessage(
          msg.chat.id,
          `I found multiple items matching "${response.item}". Please select one:`,
          { parse_mode: 'Markdown' }
        );
        
        // Display each matching item with details
        for (const item of menuItems) {
          await bot.sendMessage(
            msg.chat.id,
            `*${item.name}* - $${parseFloat(item.price.toString()).toFixed(2)}\n${item.description || ''}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: `Add to Order`, callback_data: `add_item:${item.id}` }]
                ]
              }
            }
          );
        }
      }
    } else if (response.intent === "show_menu") {
      // User wants to see the menu
      if (response.category) {
        // Show items for specific category
        const categories = await storage.getCategories();
        const category = categories.find(c => 
          c.name.toLowerCase() === response.category!.toLowerCase() ||
          c.name.toLowerCase().includes(response.category!.toLowerCase())
        );
        
        if (category) {
          await sendMenuItems(msg.chat.id, category.id);
        } else {
          await bot.sendMessage(
            msg.chat.id,
            `I couldn't find the category "${response.category}". Here are all our menu categories:`,
            { parse_mode: 'Markdown' }
          );
          await sendMenuCategories(msg.chat.id);
        }
      } else {
        // Show all categories
        await sendMenuCategories(msg.chat.id);
      }
    } else if (response.intent === "view_order") {
      // User wants to see their current order
      const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
      
      if (activeOrder && activeOrder.orderItems.length > 0) {
        await sendOrderSummary(msg.chat.id, activeOrder.id);
      } else {
        await bot.sendMessage(
          msg.chat.id,
          "*Your order is empty*\n\nYou don't have any items in your order yet. Would you like to see our menu or get recommendations?",
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: "Browse Menu", callback_data: "menu" }],
                [{ text: "Get Recommendations", callback_data: "special_request" }]
              ]
            }
          }
        );
      }
    } else if (response.intent === "checkout") {
      // User wants to checkout
      const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
      
      if (activeOrder && activeOrder.orderItems.length > 0) {
        // Show order summary before proceeding to delivery options
        await sendOrderSummary(msg.chat.id, activeOrder.id);
        await bot.sendMessage(
          msg.chat.id,
          "*Ready to complete your order!*\n\nLet's set up delivery or pickup.",
          { parse_mode: 'Markdown' }
        );
        await promptDeliveryOptions(bot, msg.chat.id, telegramUser, conversation);
      } else {
        await bot.sendMessage(
          msg.chat.id,
          "You don't have any items in your order yet. Let's add some delicious Lebanese food first!",
          createInlineKeyboard([
            [{ text: "Browse Menu", callback_data: "menu" }],
            [{ text: "Get Recommendations", callback_data: "special_request" }]
          ])
        );
      }
    } else if (response.intent === "dietary_recommendation" || response.intent === "recommendation") {
      // Log the response for debugging
      log(`${response.intent} response received from AI with ${response.recommendations?.length || 0} items`, 'telegram-ai');
      
      // Send the AI's personalized message first
      await bot.sendMessage(
        msg.chat.id,
        response.message || "*Based on what you're looking for, here are my Boustan recommendations:*",
        { parse_mode: 'Markdown' }
      );
      
      // Store follow-up questions in conversation context for later use
      if (response.followUpQuestions && response.followUpQuestions.length > 0) {
        await storage.updateConversation(conversation.id, {
          context: {
            ...conversation.context,
            followUpQuestions: response.followUpQuestions
          }
        });
        
        // Save response message to conversation for context
        await storage.createConversationMessage(conversation.id, {
          text: response.message || "Based on what you're looking for, here are my recommendations:",
          isFromUser: false
        });
      }
      
      // If we have specific recommendations, show them with buttons to add to cart
      if (response.recommendations && response.recommendations.length > 0) {
        // Get the actual menu items to show prices and details
        const recommendedItems = await Promise.all(
          response.recommendations.map(async (rec) => {
            const items = await storage.getMenuItemsByName(rec.name);
            return items.length > 0 ? { 
              menuItem: items[0], 
              recommendation: rec 
            } : null;
          })
        );
        
        // Filter out any null items
        const validItems = recommendedItems.filter(item => item !== null);
        
        if (validItems.length > 0) {
          // Display each recommendation with rich details
          for (const itemData of validItems) {
            if (!itemData) continue;
            
            const { menuItem, recommendation } = itemData;
            
            // Create rich message with item details and personalized reasons
            let itemMessage = `*${menuItem.name}* - $${parseFloat(menuItem.price.toString()).toFixed(2)}\n`;
            itemMessage += `${menuItem.description || 'Authentic Lebanese cuisine'}\n\n`;
            
            // Add reasons why this was recommended if available
            if (recommendation.reasons && recommendation.reasons.length > 0) {
              itemMessage += "*Why I recommend this:*\n";
              recommendation.reasons.forEach(reason => {
                itemMessage += `• ${reason}\n`;
              });
            }
            
            // Add buttons: primary action to add to order, secondary to customize
            const keyboard = [
              [{ 
                text: `Add to Order ($${parseFloat(menuItem.price.toString()).toFixed(2)})`, 
                callback_data: `add_item:${menuItem.id}` 
              }]
            ];
            
            // If item has customization options, add a customize button
            if (menuItem.customizationOptions && menuItem.customizationOptions.length > 0) {
              keyboard.push([{ 
                text: "Add with Customizations", 
                callback_data: `customize:${menuItem.id}` 
              }]);
            }
            
            await bot.sendMessage(
              msg.chat.id,
              itemMessage,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: keyboard
                }
              }
            );
            
            // Brief pause between messages to prevent rate limiting and improve readability
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          // Add comprehensive navigation options after all recommendations
          const navKeyboard = [
            [{ text: "View Full Menu", callback_data: "menu" }],
            [{ text: "Get Different Recommendations", callback_data: "special_request" }],
            [{ text: "View Current Order", callback_data: "view_order" }]
          ];
          
          await bot.sendMessage(
            msg.chat.id,
            "Would you like to explore more options or proceed with your order?",
            createInlineKeyboard(navKeyboard)
          );
        }
        
        // If we have follow-up questions, create buttons for them
        if (response.followUpQuestions && response.followUpQuestions.length > 0) {
          // Format the questions as buttons with better prompts
          const questionKeyboard = response.followUpQuestions.map((question, index) => {
            // Limit question length for button display
            const displayText = question.length > 40 
              ? question.substring(0, 37) + '...' 
              : question;
              
            return [{ text: displayText, callback_data: `follow_up:${index}` }];
          });
          
          await bot.sendMessage(
            msg.chat.id,
            "*Would you like to know more?*\nI can answer these questions for you:",
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: questionKeyboard
              }
            }
          );
        }
      } else {
        // No specific recommendations found - suggest popular items or categories
        try {
          const popularCategories = await storage.getPopularCategories();
          const popularItems = await storage.getPopularItems(3); // Get top 3 popular items
          
          if (popularItems && popularItems.length > 0) {
            await bot.sendMessage(
              msg.chat.id,
              "*Our Most Popular Items:*\nHere are some customer favorites you might enjoy:",
              { parse_mode: 'Markdown' }
            );
            
            // Display popular items
            for (const item of popularItems) {
              await bot.sendMessage(
                msg.chat.id,
                `*${item.name}* - $${parseFloat(item.price.toString()).toFixed(2)}\n${item.description || ''}`,
                {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "Add to Order", callback_data: `add_item:${item.id}` }]
                    ]
                  }
                }
              );
            }
          }
          
          await bot.sendMessage(
            msg.chat.id,
            "Would you like to see our full menu or tell me more about what you're looking for?",
            createInlineKeyboard([
              [{ text: "Show Full Menu", callback_data: "menu" }],
              [{ text: "Get Personalized Recommendations", callback_data: "special_request" }]
            ])
          );
        } catch (error) {
          // Default menu button if we can't get popular items
          await bot.sendMessage(
            msg.chat.id,
            "Would you like to see our full menu of authentic Lebanese cuisine?",
            createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
          );
        }
      }
    } else {
      // Default response for other intents
      await bot.sendMessage(
        msg.chat.id,
        response.message || "I'm not sure what you're looking for. Would you like to see our menu?",
        createInlineKeyboard([
          [{ text: "Show Menu", callback_data: "menu" }],
          [{ text: "Get Recommendations", callback_data: "special_request" }]
        ])
      );
      
      // Save the response to conversation history
      if (response.message) {
        await storage.createConversationMessage(conversation.id, {
          text: response.message,
          isFromUser: false
        });
      }
    }
  } catch (error) {
    log(`Error processing natural language input: ${error}`, 'telegram-error');
    await bot.sendMessage(
      msg.chat.id,
      "I'm having trouble understanding your request. Would you like to see our menu?",
      createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
    );
  }
}

/**
 * Ask user for customization options for their menu item
 */
async function askForCustomizations(
  bot: TelegramBot,
  chatId: number,
  menuItem: any,
  orderId: number
) {
  // Get the most recent order item for this menu item
  const orderItems = await storage.getOrderItemsByOrderId(orderId);
  const orderItem = orderItems.find(item => item.menuItemId === menuItem.id);
  
  if (!orderItem) return;
  
  for (const option of menuItem.customizationOptions) {
    const choices = option.choices as string[];
    
    const keyboard = choices.map(choice => [
      { text: choice, callback_data: `customization:${orderItem.id}:${option.name}:${choice}` }
    ]);
    
    await bot.sendMessage(
      chatId,
      `Please select ${option.name} for your ${menuItem.name}: 👇`,
      createInlineKeyboard(keyboard)
    );
    
    // Only ask for one customization at a time
    break;
  }
}

/**
 * Suggests side dishes after ordering a main course
 */
async function suggestSides(
  bot: TelegramBot,
  chatId: number,
  orderId: number,
  mainItem: any
) {
  // Find all active side dishes
  const sideCategories = await storage.getCategories();
  const sidesCategory = sideCategories.find(c => 
    ['Sides', 'Salads', 'Side Dishes'].includes(c.name)
  );
  
  if (!sidesCategory) {
    // Fallback if sides category not found
    await suggestDrinks(bot, chatId, orderId);
    return;
  }
  
  // Get popular sides
  const sideItems = await storage.getMenuItems(sidesCategory.id);
  const popularSides = sideItems.slice(0, 3); // Take up to 3 popular sides
  
  if (popularSides.length === 0) {
    // No sides available, skip to drink suggestions
    await suggestDrinks(bot, chatId, orderId);
    return;
  }
  
  // Create a message with emojis
  const itemName = mainItem.name || 'meal';
  const message = `Would you like to add a side to your ${itemName}? 🥗`;
  
  // Create keyboard with side options and prices
  const keyboard = popularSides.map(side => [
    { 
      text: `${side.name} - $${parseFloat(side.price.toString()).toFixed(2)}`, 
      callback_data: `add_item:${side.id}` 
    }
  ]);
  
  // Add options to skip
  keyboard.push([{ text: "No sides, thanks", callback_data: "no_sides" }]);
  keyboard.push([{ text: "See all sides", callback_data: `category:${sidesCategory.id}` }]);
  
  await bot.sendMessage(
    chatId,
    message,
    createInlineKeyboard(keyboard)
  );
}

/**
 * Suggests drinks after ordering a main course or sides
 */
async function suggestDrinks(
  bot: TelegramBot,
  chatId: number,
  orderId: number
) {
  // Find drinks category
  const categories = await storage.getCategories();
  const drinksCategory = categories.find(c => 
    ['Beverages', 'Drinks'].includes(c.name)
  );
  
  if (!drinksCategory) {
    // Fallback if drinks category not found
    await askForMoreItems(bot, chatId, orderId);
    return;
  }
  
  // Get popular drinks
  const drinkItems = await storage.getMenuItems(drinksCategory.id);
  const popularDrinks = drinkItems.slice(0, 3); // Take up to 3 popular drinks
  
  if (popularDrinks.length === 0) {
    // No drinks available, skip to final step
    await askForMoreItems(bot, chatId, orderId);
    return;
  }
  
  // Check if user already has drinks in their order
  const orderItems = await storage.getOrderItemsByOrderId(orderId);
  const hasDrink = orderItems.some(item => {
    const menuItem = item.menuItem;
    return menuItem && menuItem.categoryId === drinksCategory.id;
  });
  
  if (hasDrink) {
    // User already has a drink, skip to desserts
    await suggestDesserts(bot, chatId, orderId);
    return;
  }
  
  // Create a message with emojis
  const message = "Would you like to add a refreshing drink to your order? 🥤🧊 Stay hydrated!";
  
  // Create keyboard with drink options
  const keyboard = popularDrinks.map(drink => [
    { 
      text: `🥤 ${drink.name} - $${parseFloat(drink.price.toString()).toFixed(2)}`, 
      callback_data: `add_item:${drink.id}` 
    }
  ]);
  
  // Add options to skip
  keyboard.push([{ text: "👋 No drinks, thanks", callback_data: "no_drinks" }]);
  keyboard.push([{ text: "🔍 See all drinks", callback_data: `category:${drinksCategory.id}` }]);
  
  await bot.sendMessage(
    chatId,
    message,
    createInlineKeyboard(keyboard)
  );
}

/**
 * Suggests desserts after ordering main items
 */
async function suggestDesserts(
  bot: TelegramBot,
  chatId: number,
  orderId: number
) {
  // Find desserts category
  const categories = await storage.getCategories();
  const dessertsCategory = categories.find(c => 
    ['Desserts', 'Sweets'].includes(c.name)
  );
  
  if (!dessertsCategory) {
    // Fallback if desserts category not found
    await askForMoreItems(bot, chatId, orderId);
    return;
  }
  
  // Get popular desserts
  const dessertItems = await storage.getMenuItems(dessertsCategory.id);
  const popularDesserts = dessertItems.slice(0, 2); // Take up to 2 popular desserts
  
  if (popularDesserts.length === 0) {
    // No desserts available, skip to final step
    await askForMoreItems(bot, chatId, orderId);
    return;
  }
  
  // Check if user already has desserts in their order
  const orderItems = await storage.getOrderItemsByOrderId(orderId);
  const hasDessert = orderItems.some(item => {
    const menuItem = item.menuItem;
    return menuItem && menuItem.categoryId === dessertsCategory.id;
  });
  
  if (hasDessert) {
    // User already has a dessert, skip to final step
    await askForMoreItems(bot, chatId, orderId);
    return;
  }
  
  // Create a message with emojis
  const message = "Would you like to complete your meal with a sweet dessert? 🍰 The perfect way to end your meal! 🍮";
  
  // Create keyboard with dessert options
  const keyboard = popularDesserts.map(dessert => [
    { 
      text: `🍰 ${dessert.name} - $${parseFloat(dessert.price.toString()).toFixed(2)}`, 
      callback_data: `add_item:${dessert.id}` 
    }
  ]);
  
  // Add options to skip
  keyboard.push([{ text: "👋 No dessert, thanks", callback_data: "no_dessert" }]);
  keyboard.push([{ text: "🔍 See all desserts", callback_data: `category:${dessertsCategory.id}` }]);
  
  await bot.sendMessage(
    chatId,
    message,
    createInlineKeyboard(keyboard)
  );
}

/**
 * Final step in the ordering flow - ask if user wants anything else
 */
async function askForMoreItems(
  bot: TelegramBot,
  chatId: number,
  orderId: number
) {
  // Show order summary and ask what to do next
  const order = await storage.getOrderById(orderId);
  
  if (!order) return;
  
  const total = order.orderItems.reduce((sum, item) => {
    const price = parseFloat(item.price.toString());
    const quantity = item.quantity || 1;
    return sum + (price * quantity);
  }, 0);
  
  // Final message with emojis
  await bot.sendMessage(
    chatId,
    `Your order is looking great! 👍 Current total: *$${total.toFixed(2)}*\n\nWhat would you like to do next?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 View Order", callback_data: "view_order" }],
          [{ text: "📋 Continue Shopping", callback_data: "menu" }],
          [{ text: "💳 Checkout", callback_data: "checkout" }]
        ]
      }
    }
  );
}

async function promptDeliveryOptions(
  bot: TelegramBot,
  chatId: number,
  telegramUser: any,
  conversation: any
) {
  await bot.sendMessage(
    chatId,
    "Please select your preferred delivery method: 🚚",
    createInlineKeyboard([
      [{ text: "🚚 Delivery (+$2.00)", callback_data: "delivery_method:delivery" }],
      [{ text: "🏪 Pickup (No fee)", callback_data: "delivery_method:pickup" }]
    ])
  );
  
  await storage.updateConversation(conversation.id, { 
    state: 'delivery_info',
    context: { ...conversation.context }
  });
}

async function processDeliveryMethod(
  bot: TelegramBot,
  chatId: number,
  telegramUser: any,
  conversation: any,
  method: string
) {
  const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
  
  if (!activeOrder) {
    await bot.sendMessage(
      chatId,
      "Your order seems to have expired. Would you like to start a new order?",
      createInlineKeyboard([[{ text: "Start New Order", callback_data: "menu" }]])
    );
    return;
  }
  
  // Update order with delivery method
  const isDelivery = method === 'delivery';
  await storage.updateOrder(activeOrder.id, {
    isDelivery,
    deliveryFee: isDelivery ? "2.00" : "0"
  });
  
  // Update conversation context
  await storage.updateConversation(conversation.id, {
    context: { ...conversation.context, deliveryMethod: method }
  });
  
  if (isDelivery) {
    // Ask for address if delivery
    await bot.sendMessage(
      chatId,
      "Please enter your delivery address:",
    );
  } else {
    // Skip to payment options if pickup
    await promptPaymentOptions(bot, chatId, telegramUser, conversation);
  }
}

async function processDeliveryInfo(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  telegramUser: any,
  conversation: any
) {
  const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
  
  if (!activeOrder) {
    await bot.sendMessage(
      msg.chat.id,
      "Your order seems to have expired. Would you like to start a new order?",
      createInlineKeyboard([[{ text: "Start New Order", callback_data: "menu" }]])
    );
    return;
  }
  
  // Check if we're expecting delivery info and if the delivery method is set
  if (conversation.context.deliveryMethod !== 'delivery') {
    await promptPaymentOptions(bot, msg.chat.id, telegramUser, conversation);
    return;
  }
  
  // Save address info
  await storage.updateOrder(activeOrder.id, {
    deliveryAddress: msg.text
  });
  
  // Ask for additional delivery instructions
  await bot.sendMessage(
    msg.chat.id,
    "Any special delivery instructions? (or type 'none' to skip)"
  );
  
  // Update conversation state
  await storage.updateConversation(conversation.id, {
    state: 'delivery_instructions',
    context: { ...conversation.context }
  });
}

async function processDeliveryInstructions(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  telegramUser: any,
  conversation: any
) {
  const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
  
  if (!activeOrder) {
    await bot.sendMessage(
      msg.chat.id,
      "Your order seems to have expired. Would you like to start a new order?",
      createInlineKeyboard([[{ text: "Start New Order", callback_data: "menu" }]])
    );
    return;
  }
  
  // Save delivery instructions if not "none"
  if (msg.text && msg.text.toLowerCase() !== 'none') {
    await storage.updateOrder(activeOrder.id, {
      deliveryInstructions: msg.text
    });
  }
  
  // Move to payment options
  await promptPaymentOptions(bot, msg.chat.id, telegramUser, conversation);
}

async function promptPaymentOptions(
  bot: TelegramBot,
  chatId: number,
  telegramUser: any,
  conversation: any
) {
  await bot.sendMessage(
    chatId,
    "Please select your payment method: 💳",
    createInlineKeyboard([
      [{ text: "💰 Coinbase (Cryptocurrency)", callback_data: "payment_method:crypto" }],
      [{ text: "💵 Cash on Delivery/Pickup", callback_data: "payment_method:cash" }]
    ])
  );
  
  // Update conversation state
  await storage.updateConversation(conversation.id, { 
    state: 'payment_selection',
    context: { ...conversation.context }
  });
}

async function processPaymentMethod(
  bot: TelegramBot,
  chatId: number,
  telegramUser: any,
  conversation: any,
  method: string
) {
  const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
  
  if (!activeOrder) {
    await bot.sendMessage(
      chatId,
      "Your order seems to have expired. Would you like to start a new order?",
      createInlineKeyboard([[{ text: "Start New Order", callback_data: "menu" }]])
    );
    return;
  }
  
  // Update order with payment method
  await storage.updateOrder(activeOrder.id, {
    paymentMethod: method
  });
  
  // Update conversation context
  await storage.updateConversation(conversation.id, {
    context: { ...conversation.context, paymentMethod: method }
  });
  
  // Show final order summary
  await showFinalOrderSummary(bot, chatId, activeOrder.id);
}

async function showFinalOrderSummary(
  bot: TelegramBot,
  chatId: number,
  orderId: number
) {
  const order = await storage.getOrderById(orderId);
  
  if (!order || order.orderItems.length === 0) {
    await bot.sendMessage(
      chatId,
      "Your order is empty. Please add some items to your order first.",
      createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
    );
    return;
  }
  
  let messageText = "*Order Summary*\n\n";
  let subtotal = 0;
  
  for (const item of order.orderItems) {
    const itemPrice = parseFloat(item.price.toString()) * item.quantity;
    subtotal += itemPrice;
    
    messageText += `${item.quantity}x ${item.menuItem.name} - $${itemPrice.toFixed(2)}\n`;
    
    if (item.customizations) {
      const customizations = Object.entries(item.customizations as Record<string, string>)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      
      if (customizations) {
        messageText += `   _${customizations}_\n`;
      }
    }
    
    if (item.specialInstructions) {
      messageText += `   _Note: ${item.specialInstructions}_\n`;
    }
    
    messageText += "\n";
  }
  
  const deliveryFee = parseFloat(order.deliveryFee.toString());
  const total = subtotal + deliveryFee;
  
  messageText += `Subtotal: $${subtotal.toFixed(2)}\n`;
  
  if (order.isDelivery) {
    messageText += `Delivery Fee: $${deliveryFee.toFixed(2)}\n`;
    messageText += `Delivery Address: ${order.deliveryAddress || 'Not provided'}\n`;
    
    if (order.deliveryInstructions) {
      messageText += `Instructions: ${order.deliveryInstructions}\n`;
    }
  } else {
    messageText += `Pickup: No fee\n`;
  }
  
  messageText += `Payment Method: ${order.paymentMethod === 'crypto' ? 'Coinbase (Cryptocurrency)' : 'Cash on Delivery/Pickup'}\n\n`;
  messageText += `*Total: $${total.toFixed(2)}*`;
  
  await bot.sendMessage(chatId, messageText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Modify Order", callback_data: "view_order" },
          { text: "Place Order", callback_data: "place_order" }
        ]
      ]
    }
  });
}

async function processPaymentSelection(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  telegramUser: any,
  conversation: any
) {
  // Process text input for payment selection
  const text = msg.text?.toLowerCase();
  
  if (text?.includes('crypto') || text?.includes('coinbase') || text?.includes('bitcoin')) {
    await processPaymentMethod(bot, msg.chat.id, telegramUser, conversation, 'crypto');
  } else if (text?.includes('cash')) {
    await processPaymentMethod(bot, msg.chat.id, telegramUser, conversation, 'cash');
  } else {
    await bot.sendMessage(
      msg.chat.id,
      "I didn't understand your payment selection. Please choose from the options below: 💳",
      createInlineKeyboard([
        [{ text: "💰 Coinbase (Cryptocurrency)", callback_data: "payment_method:crypto" }],
        [{ text: "💵 Cash on Delivery/Pickup", callback_data: "payment_method:cash" }]
      ])
    );
  }
}

async function processOrderConfirmation(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  telegramUser: any,
  conversation: any
) {
  const text = msg.text?.toLowerCase();
  
  if (text?.includes('confirm') || text?.includes('yes') || text?.includes('place') || text?.includes('order')) {
    await finalizeOrder(bot, msg.chat.id, telegramUser, conversation);
  } else {
    await bot.sendMessage(
      msg.chat.id,
      "Would you like to modify your order or place it as is?",
      createInlineKeyboard([
        [
          { text: "Modify Order", callback_data: "view_order" },
          { text: "Place Order", callback_data: "place_order" }
        ]
      ])
    );
  }
}

async function finalizeOrder(
  bot: TelegramBot,
  chatId: number,
  telegramUser: any,
  conversation: any
) {
  const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
  
  if (!activeOrder) {
    await bot.sendMessage(
      chatId,
      "Your order seems to have expired. Would you like to start a new order?",
      createInlineKeyboard([[{ text: "Start New Order", callback_data: "menu" }]])
    );
    return;
  }
  
  try {
    // Process payment if using crypto
    if (activeOrder.paymentMethod === 'crypto') {
      const paymentResult = await processPayment(activeOrder.id);
      
      if (!paymentResult.success) {
        await bot.sendMessage(
          chatId,
          `Payment error: ${paymentResult.message}. Please try again or select a different payment method.`,
          createInlineKeyboard([
            [{ text: "Try Again", callback_data: "payment_method:crypto" }],
            [{ text: "Use Cash Instead", callback_data: "payment_method:cash" }]
          ])
        );
        return;
      }
      
      // Update payment status
      await storage.updateOrder(activeOrder.id, {
        paymentStatus: 'paid'
      });
    }
    
    // Update order status
    await storage.updateOrder(activeOrder.id, {
      status: 'confirmed'
    });
    
    // Send confirmation message
    await bot.sendMessage(
      chatId,
      `🎉 Thank you for your order! Your order #${activeOrder.id} has been confirmed.\n\n` +
      `${activeOrder.isDelivery ? 
        `Your food will be delivered to ${activeOrder.deliveryAddress} in approximately 30-45 minutes.` : 
        'Your food will be ready for pickup in approximately 20-30 minutes.'}\n\n` +
      `Payment method: ${activeOrder.paymentMethod === 'crypto' ? 'Paid via Coinbase' : 'Cash on ' + (activeOrder.isDelivery ? 'Delivery' : 'Pickup')}\n\n` +
      `Thank you for choosing Delicious Restaurant!`,
      createInlineKeyboard([
        [{ text: "Place Another Order", callback_data: "menu" }]
      ])
    );
    
    // Reset conversation
    await storage.updateConversation(conversation.id, {
      state: 'initial',
      context: {}
    });
  } catch (error) {
    log(`Error finalizing order: ${error}`, 'telegram-error');
    await bot.sendMessage(
      chatId,
      "There was a problem processing your order. Please try again later.",
      createInlineKeyboard([
        [{ text: "View Order", callback_data: "view_order" }],
        [{ text: "Start Over", callback_data: "menu" }]
      ])
    );
  }
}
