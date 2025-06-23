import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { handleIncomingMessage, handleCallbackQuery } from './handlers';
import { log } from '../vite';

// Telegram Bot Token should be set in environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;

let bot: TelegramBot | null = null;
let isInitialized = false;

export const initBot = () => {
  if (!token) {
    log('TELEGRAM_BOT_TOKEN is not set in environment variables. Telegram bot will not start.', 'telegram');
    return null;
  }

  // Prevent multiple initializations
  if (isInitialized) {
    log('Telegram bot already initialized, skipping...', 'telegram');
    return bot;
  }

  try {
    // Create a new bot instance with polling enabled
    log('Initializing Telegram bot...', 'telegram');
    bot = new TelegramBot(token, { polling: true });
    isInitialized = true;

    // Listen for incoming messages
    bot.on('message', async (msg) => {
      try {
        await handleIncomingMessage(bot!, msg);
      } catch (error) {
        log(`Error handling message: ${error}`, 'telegram-error');
        
        // Send a generic error message to the user
        bot!.sendMessage(
          msg.chat.id,
          'Sorry, I encountered an error while processing your message. Please try again later.'
        );
      }
    });

    // Listen for callback queries (button clicks)
    bot.on('callback_query', async (query) => {
      try {
        await handleCallbackQuery(bot!, query);
      } catch (error) {
        log(`Error handling callback query: ${error}`, 'telegram-error');
        
        // Send a generic error message to the user
        bot!.answerCallbackQuery(query.id, {
          text: 'Sorry, I encountered an error. Please try again.',
          show_alert: true
        });
      }
    });

    // Handle errors
    bot.on('polling_error', (error) => {
      log(`Polling error: ${error.message}`, 'telegram-error');
    });

    log('Telegram bot initialized successfully!', 'telegram');
    return bot;
  } catch (error) {
    log(`Failed to initialize Telegram bot: ${error}`, 'telegram-error');
    return null;
  }
};

export const getBot = () => {
  if (!bot) {
    throw new Error('Telegram bot has not been initialized');
  }
  return bot;
};

// Helper function to create inline keyboard buttons
export const createInlineKeyboard = (buttons: TelegramBot.InlineKeyboardButton[][]) => {
  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
};

// Helper function to send menu categories
export const sendMenuCategories = async (chatId: number) => {
  try {
    const categories = await storage.getCategories();
    
    const keyboardButtons = categories.map(category => [{
      text: category.name,
      callback_data: `category:${category.id}`
    }]);
    
    await getBot().sendMessage(
      chatId,
      "📜 Here's our menu. Please select a category to see the items:",
      createInlineKeyboard(keyboardButtons)
    );
  } catch (error) {
    log(`Error sending menu categories: ${error}`, 'telegram-error');
    throw error;
  }
};

// Helper function to send menu items for a category
export const sendMenuItems = async (chatId: number, categoryId: number) => {
  try {
    const category = await storage.getCategoryById(categoryId);
    const menuItems = await storage.getMenuItems(categoryId);
    
    if (!category || menuItems.length === 0) {
      await getBot().sendMessage(
        chatId,
        "Sorry, I couldn't find any items in this category."
      );
      return;
    }
    
    await getBot().sendMessage(
      chatId,
      `🍽️ Here are our ${category.name.toLowerCase()} options. Tap on any item to add it to your order:`
    );
    
    for (const item of menuItems) {
      const message = `*${item.name}* - $${parseFloat(item.price.toString()).toFixed(2)}\n${item.description || 'Delicious choice!'}`;
      
      const keyboard = [
        [{
          text: `🛒 Add to order - $${parseFloat(item.price.toString()).toFixed(2)}`,
          callback_data: `add_item:${item.id}`
        }]
      ];
      
      // For now, let's send all items as text messages to avoid image loading issues
      await getBot().sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }
    
    // Add a navigation button to go back to categories
    await getBot().sendMessage(
      chatId,
      "Would you like to see another category or proceed with your order?",
      createInlineKeyboard([
        [{ text: "📋 Back to Categories", callback_data: "menu" }],
        [{ text: "🛒 View Current Order", callback_data: "view_order" }]
      ])
    );
  } catch (error) {
    log(`Error sending menu items: ${error}`, 'telegram-error');
    throw error;
  }
};

// Helper function to send order summary
export const sendOrderSummary = async (chatId: number, orderId: number) => {
  try {
    const order = await storage.getOrderById(orderId);
    
    if (!order || order.orderItems.length === 0) {
      await getBot().sendMessage(
        chatId,
        "🛒 Your order is empty. Please add some items to your order first."
      );
      return;
    }
    
    let messageText = "*Your Order Summary*\n\n";
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
    }
    
    messageText += `*Total: $${total.toFixed(2)}*`;
    
    const keyboard = [
      [
        { text: "➕ Add More Items", callback_data: "menu" },
        { text: "✅ Checkout", callback_data: "checkout" }
      ],
      [
        { text: "🗑️ Empty Cart", callback_data: "empty_cart" }
      ]
    ];
    
    await getBot().sendMessage(chatId, messageText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    log(`Error sending order summary: ${error}`, 'telegram-error');
    throw error;
  }
};
