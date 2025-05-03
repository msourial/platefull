import { storage } from "../storage";
import { log } from "../vite";

interface NlpResponse {
  intent: string;
  message?: string;
  item?: string;
  category?: string;
  specialInstructions?: string;
}

// This is a simplified NLP implementation
// In a real-world scenario, this would use a more sophisticated NLP library or service

/**
 * Process natural language input from a user
 * @param text The text to process
 * @param telegramUserId The Telegram user ID
 * @returns A processed NLP response with detected intent and entities
 */
export async function processNaturalLanguage(text: string, telegramUserId: string): Promise<NlpResponse> {
  try {
    const normalizedText = text.toLowerCase().trim();
    
    // Get user
    const user = await storage.getTelegramUserByTelegramId(telegramUserId);
    
    if (!user) {
      return {
        intent: "error",
        message: "User not found"
      };
    }
    
    // Check for greetings and welcome messages
    if (isGreeting(normalizedText)) {
      return {
        intent: "greeting",
        message: "Hello! I'm your restaurant assistant. Would you like to see our menu?"
      };
    }
    
    // Check for menu requests
    if (isMenuRequest(normalizedText)) {
      // Check if a specific category is mentioned
      const categoryMatch = extractCategory(normalizedText);
      
      if (categoryMatch) {
        return {
          intent: "show_menu",
          category: categoryMatch,
          message: `Here are our ${categoryMatch} options.`
        };
      }
      
      return {
        intent: "show_menu",
        message: "Here's our menu. Please select a category."
      };
    }
    
    // Check for order viewing requests
    if (isViewOrderRequest(normalizedText)) {
      return {
        intent: "view_order",
        message: "Here is your current order."
      };
    }
    
    // Check for checkout requests
    if (isCheckoutRequest(normalizedText)) {
      return {
        intent: "checkout",
        message: "Let's proceed to checkout."
      };
    }
    
    // Check for item ordering
    const orderMatch = extractOrderItem(normalizedText);
    
    if (orderMatch) {
      return {
        intent: "order_item",
        item: orderMatch.item,
        specialInstructions: orderMatch.specialInstructions,
        message: `I'll add ${orderMatch.item} to your order${orderMatch.specialInstructions ? ` with the note: ${orderMatch.specialInstructions}` : ''}.`
      };
    }
    
    // Default response for unrecognized input
    return {
      intent: "unknown",
      message: "I'm not sure what you're looking for. Would you like to see our menu or place an order?"
    };
  } catch (error) {
    log(`Error processing natural language: ${error}`, 'nlp-service-error');
    return {
      intent: "error",
      message: "I encountered an error processing your request. Let me show you our menu instead."
    };
  }
}

// Helper functions for intent recognition

function isGreeting(text: string): boolean {
  const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'howdy'];
  return greetings.some(greeting => text.includes(greeting));
}

function isMenuRequest(text: string): boolean {
  const menuKeywords = ['menu', 'show me', 'what do you have', 'what do you offer', 'can i see', 'food', 'options'];
  return menuKeywords.some(keyword => text.includes(keyword));
}

function isViewOrderRequest(text: string): boolean {
  const orderKeywords = ['view order', 'my order', 'current order', 'what i ordered', 'show my order', 'cart'];
  return orderKeywords.some(keyword => text.includes(keyword));
}

function isCheckoutRequest(text: string): boolean {
  const checkoutKeywords = ['checkout', 'check out', 'place order', 'confirm order', 'finalize', 'done ordering', 'finish', 'pay', 'proceed'];
  return checkoutKeywords.some(keyword => text.includes(keyword));
}

function extractCategory(text: string): string | undefined {
  const categories = ['burger', 'burgers', 'pizza', 'pizzas', 'pasta', 'drink', 'drinks', 'beverage', 'beverages'];
  
  for (const category of categories) {
    if (text.includes(category)) {
      // Normalize category names
      if (category === 'burger' || category === 'burgers') return 'Burgers';
      if (category === 'pizza' || category === 'pizzas') return 'Pizza';
      if (category === 'pasta') return 'Pasta';
      if (category === 'drink' || category === 'drinks' || category === 'beverage' || category === 'beverages') return 'Drinks';
    }
  }
  
  return undefined;
}

function extractOrderItem(text: string): { item: string, specialInstructions?: string } | undefined {
  // Common food items in the menu
  const menuItems = [
    'classic burger', 'deluxe burger', 'veggie burger', 'burger',
    'margherita pizza', 'pepperoni pizza', 'pizza',
    'spaghetti bolognese', 'fettuccine alfredo', 'pasta',
    'coke', 'coca-cola', 'diet coke', 'water', 'bottled water'
  ];
  
  // Check for menu items in the text
  for (const item of menuItems) {
    if (text.includes(item)) {
      // Check for special instructions
      const specialInstructions = extractSpecialInstructions(text, item);
      
      // Normalize item names
      let normalizedItem = item;
      if (item === 'burger') normalizedItem = 'Classic Burger';
      if (item === 'pizza') normalizedItem = 'Margherita Pizza';
      if (item === 'pasta') normalizedItem = 'Spaghetti Bolognese';
      if (item === 'coke' || item === 'coca-cola') normalizedItem = 'Coca-Cola';
      
      return {
        item: normalizedItem,
        specialInstructions
      };
    }
  }
  
  return undefined;
}

function extractSpecialInstructions(text: string, item: string): string | undefined {
  // Check for common phrases that indicate special instructions
  const phrases = [
    'no ', 'without ', 'extra ', 'add ', 'with ', 'but ', 'not ', 'don\'t ', 'hold the ',
    'less ', 'more ', 'light ', 'heavy '
  ];
  
  // Remove the item from the text
  const remainingText = text.replace(item, '');
  
  // Check for special instruction phrases
  for (const phrase of phrases) {
    if (remainingText.includes(phrase)) {
      // Find the start of the special instruction
      const startIndex = remainingText.indexOf(phrase);
      
      // Extract the special instruction
      // This is a simplified approach and would need to be more sophisticated in a real NLP system
      const instruction = remainingText.substring(startIndex).trim();
      
      return instruction;
    }
  }
  
  return undefined;
}
