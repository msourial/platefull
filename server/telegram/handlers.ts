import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { sendMenuCategories, sendMenuItems, sendOrderSummary, createInlineKeyboard } from './bot';
import { processNaturalLanguage } from '../services/nlp';
import { createOrder, addItemToOrder, removeItemFromOrder, clearOrder } from '../services/order';
import { processPayment } from '../services/payment';
import { log } from '../vite';

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
  
  switch (action) {
    case 'menu':
      await sendMenuCategories(chatId);
      await storage.updateConversation(conversation.id, { state: 'menu_selection' });
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
        
        // Create a fake message to process the follow-up question
        const fakeMessage: TelegramBot.Message = {
          message_id: Date.now(),
          from: query.from,
          chat: query.message.chat,
          date: Math.floor(Date.now() / 1000),
          text: question
        };
        
        // Process this as a regular message
        await handleIncomingMessage(bot, fakeMessage);
      } else {
        await bot.sendMessage(
          chatId,
          "I'm sorry, I don't recognize that question. How can I help you?",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
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
      if (params[0]) {
        const menuItemId = parseInt(params[0]);
        const menuItem = await storage.getMenuItemById(menuItemId);
        
        if (!menuItem) {
          await bot.sendMessage(chatId, "Sorry, this item is not available.");
          return;
        }
        
        // Get or create an order for the user
        const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
        let orderId: number;
        
        if (activeOrder) {
          orderId = activeOrder.id;
        } else {
          const newOrder = await createOrder(telegramUser.id);
          orderId = newOrder.id;
        }
        
        // Add the item to the order
        await addItemToOrder(orderId, menuItemId);
        
        // If the item has customization options, ask for them
        if (menuItem.customizationOptions && menuItem.customizationOptions.length > 0) {
          await askForCustomizations(bot, chatId, menuItem, orderId);
        } else {
          await bot.sendMessage(
            chatId,
            `Added ${menuItem.name} to your order. Anything else?`,
            createInlineKeyboard([
              [{ text: "View Order", callback_data: "view_order" }],
              [{ text: "Continue Shopping", callback_data: "menu" }]
            ])
          );
        }
      }
      break;
      
    case 'customization':
      if (params.length >= 3) {
        const [orderItemId, optionName, choice] = params;
        
        // Update the order item with the chosen customization
        const orderItem = await storage.getOrderItemById(parseInt(orderItemId));
        
        if (orderItem) {
          const customizations = orderItem.customizations as Record<string, string> || {};
          customizations[optionName] = choice;
          
          await storage.updateOrderItem(parseInt(orderItemId), {
            customizations
          });
          
          await bot.sendMessage(
            chatId,
            `Updated your order with ${optionName}: ${choice}. Anything else?`,
            createInlineKeyboard([
              [{ text: "View Order", callback_data: "view_order" }],
              [{ text: "Continue Shopping", callback_data: "menu" }]
            ])
          );
        }
      }
      break;
      
    case 'remove_item':
      if (params[0]) {
        const orderItemId = parseInt(params[0]);
        await removeItemFromOrder(orderItemId);
        await bot.sendMessage(chatId, "Item removed from your order.");
        
        // Show updated order
        const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
        if (activeOrder) {
          await sendOrderSummary(chatId, activeOrder.id);
        } else {
          await bot.sendMessage(
            chatId,
            "Your order is now empty. Would you like to see the menu?",
            createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
          );
        }
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
      
    case 'empty_cart':
      const order = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
      
      if (order) {
        await clearOrder(order.id);
        await bot.sendMessage(
          chatId,
          "Your order has been cleared. Would you like to start a new order?",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
      } else {
        await bot.sendMessage(
          chatId,
          "You don't have any active orders. Would you like to see our menu?",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
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
    "👋 Welcome to Delicious Restaurant! I'm your AI assistant and I'm here to help you order delicious food. Would you like to see our menu, or do you already know what you'd like to order?",
    createInlineKeyboard([
      [{ text: "Show me the menu", callback_data: "menu" }],
      [{ text: "I know what I want", callback_data: "direct_order" }],
      [{ text: "Special requests", callback_data: "special_request" }]
    ])
  );
}

async function processNaturalLanguageInput(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  telegramUser: any,
  conversation: any
) {
  try {
    const response = await processNaturalLanguage(msg.text!, telegramUser.id);
    
    // Update conversation based on NLP response
    if (response.intent === "order_item") {
      // User wants to order a specific item
      const menuItems = await storage.getMenuItemsByName(response.item!);
      
      if (menuItems.length === 0) {
        await bot.sendMessage(
          msg.chat.id,
          `I'm sorry, I couldn't find "${response.item}" on our menu. Would you like to see the menu?`,
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
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
        
        await bot.sendMessage(
          msg.chat.id,
          `I've added 1 ${menuItem.name} to your order${response.specialInstructions ? ` (${response.specialInstructions})` : ''}. Would you like anything else?`,
          createInlineKeyboard([
            [{ text: "View Order", callback_data: "view_order" }],
            [{ text: "Continue Shopping", callback_data: "menu" }]
          ])
        );
      } else {
        // Multiple matches found
        await bot.sendMessage(msg.chat.id, "I found multiple items that match. Please select one:");
        
        const keyboard = menuItems.map(item => [
          { text: `${item.name} - $${parseFloat(item.price.toString()).toFixed(2)}`, callback_data: `add_item:${item.id}` }
        ]);
        
        await bot.sendMessage(
          msg.chat.id,
          "Which one would you like to add to your order?",
          createInlineKeyboard(keyboard)
        );
      }
    } else if (response.intent === "show_menu") {
      // User wants to see the menu
      if (response.category) {
        // Show items for specific category
        const categories = await storage.getCategories();
        const category = categories.find(c => c.name.toLowerCase() === response.category!.toLowerCase());
        
        if (category) {
          await sendMenuItems(msg.chat.id, category.id);
        } else {
          await bot.sendMessage(
            msg.chat.id,
            `I couldn't find the category "${response.category}". Here are all our categories:`,
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
      
      if (activeOrder) {
        await sendOrderSummary(msg.chat.id, activeOrder.id);
      } else {
        await bot.sendMessage(
          msg.chat.id,
          "You don't have an active order yet. Would you like to see our menu?",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
      }
    } else if (response.intent === "checkout") {
      // User wants to checkout
      const activeOrder = await storage.getActiveOrderByTelegramUserId(telegramUser.id);
      
      if (activeOrder && activeOrder.orderItems.length > 0) {
        await promptDeliveryOptions(bot, msg.chat.id, telegramUser, conversation);
      } else {
        await bot.sendMessage(
          msg.chat.id,
          "You don't have any items in your order yet. Would you like to see our menu?",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
      }
    } else if (response.intent === "recommendation") {
      // AI has provided recommendations based on user query
      await bot.sendMessage(
        msg.chat.id,
        response.message || "Based on what you're looking for, I have some recommendations for you!"
      );
      
      // Store follow-up questions in conversation context for later use
      if (response.followUpQuestions && response.followUpQuestions.length > 0) {
        await storage.updateConversation(conversation.id, {
          context: {
            ...conversation.context,
            followUpQuestions: response.followUpQuestions
          }
        });
      }
      
      // If we have specific recommendations, show them with buttons to add to cart
      if (response.recommendations && response.recommendations.length > 0) {
        // Get the actual menu items to show prices and details
        const recommendedItems = await Promise.all(
          response.recommendations.map(async (rec) => {
            const items = await storage.getMenuItemsByName(rec.name);
            return items.length > 0 ? items[0] : null;
          })
        );
        
        // Filter out any null items
        const validItems = recommendedItems.filter(item => item !== null);
        
        if (validItems.length > 0) {
          // Create buttons for each recommendation
          const keyboard = validItems.map(item => [
            { text: `Add ${item!.name} - $${parseFloat(item!.price.toString()).toFixed(2)}`, callback_data: `add_item:${item!.id}` }
          ]);
          
          // Add a "View Menu" button at the end
          keyboard.push([{ text: "View Full Menu", callback_data: "menu" }]);
          
          await bot.sendMessage(
            msg.chat.id,
            "Would you like to add any of these to your order?",
            createInlineKeyboard(keyboard)
          );
        }
        
        // If we have follow-up questions, create buttons for them
        if (response.followUpQuestions && response.followUpQuestions.length > 0) {
          const questionKeyboard = response.followUpQuestions.map((question, index) => [
            { text: question, callback_data: `follow_up:${index}` }
          ]);
          
          await bot.sendMessage(
            msg.chat.id,
            "You can also ask me more about:",
            createInlineKeyboard(questionKeyboard)
          );
        }
      } else {
        // Default menu button if we don't have specific recommendations
        await bot.sendMessage(
          msg.chat.id,
          "Would you like to see our full menu?",
          createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
        );
      }
    } else {
      // Default response for other intents
      await bot.sendMessage(
        msg.chat.id,
        response.message || "I'm not sure what you're looking for. Would you like to see our menu?",
        createInlineKeyboard([[{ text: "Show Menu", callback_data: "menu" }]])
      );
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
      `Please select ${option.name} for your ${menuItem.name}:`,
      createInlineKeyboard(keyboard)
    );
    
    // Only ask for one customization at a time
    break;
  }
}

async function promptDeliveryOptions(
  bot: TelegramBot,
  chatId: number,
  telegramUser: any,
  conversation: any
) {
  await bot.sendMessage(
    chatId,
    "Please select your preferred delivery method:",
    createInlineKeyboard([
      [{ text: "Delivery (+$2.00)", callback_data: "delivery_method:delivery" }],
      [{ text: "Pickup (No fee)", callback_data: "delivery_method:pickup" }]
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
    "Please select your payment method:",
    createInlineKeyboard([
      [{ text: "Coinbase (Cryptocurrency)", callback_data: "payment_method:crypto" }],
      [{ text: "Cash on Delivery/Pickup", callback_data: "payment_method:cash" }]
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
      "I didn't understand your payment selection. Please choose from the options below:",
      createInlineKeyboard([
        [{ text: "Coinbase (Cryptocurrency)", callback_data: "payment_method:crypto" }],
        [{ text: "Cash on Delivery/Pickup", callback_data: "payment_method:cash" }]
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
