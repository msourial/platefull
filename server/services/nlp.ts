import { storage } from "../storage";
import { log } from "../vite";
import { getRecommendations } from "./ai";

interface NlpResponse {
  intent: string;
  message?: string;
  item?: string;
  category?: string;
  specialInstructions?: string;
  recommendations?: {
    name: string;
    category: string;
    reasons: string[];
  }[];
  followUpQuestions?: string[];
}

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
    
    // Store the message in conversation history
    let conversation = await storage.getConversationByTelegramUserId(user.id);
    
    // Create a new conversation if none exists
    if (!conversation) {
      conversation = await storage.createConversation({
        telegramUserId: user.id,
        state: "initial",
        context: {}
      });
    }
    
    // Add user message to conversation history
    await storage.addMessageToConversation({
      conversationId: conversation.id,
      text: text,
      isFromUser: true
    });
    
    // Check for greetings and welcome messages
    if (isGreeting(normalizedText)) {
      const response = {
        intent: "greeting",
        message: "Hello! I'm your restaurant assistant for Boustan. Would you like me to help you find something delicious to eat today?"
      };
      
      // Add bot response to conversation history
      await storage.addMessageToConversation({
        conversationId: conversation.id,
        text: response.message,
        isFromUser: false
      });
      
      return response;
    }
    
    // Check for menu requests
    if (isMenuRequest(normalizedText)) {
      // Check if a specific category is mentioned
      const categoryMatch = extractCategory(normalizedText);
      
      if (categoryMatch) {
        const response = {
          intent: "show_menu",
          category: categoryMatch,
          message: `Here are our ${categoryMatch} options.`
        };
        
        // Add bot response to conversation history
        await storage.addMessageToConversation({
          conversationId: conversation.id,
          text: response.message,
          isFromUser: false
        });
        
        return response;
      }
      
      const response = {
        intent: "show_menu",
        message: "Here's our menu. Please select a category."
      };
      
      // Add bot response to conversation history
      await storage.addMessageToConversation({
        conversationId: conversation.id,
        text: response.message,
        isFromUser: false
      });
      
      return response;
    }
    
    // Check for order viewing requests
    if (isViewOrderRequest(normalizedText)) {
      const response = {
        intent: "view_order",
        message: "Here is your current order."
      };
      
      // Add bot response to conversation history
      await storage.addMessageToConversation({
        conversationId: conversation.id,
        text: response.message,
        isFromUser: false
      });
      
      return response;
    }
    
    // Check for checkout requests
    if (isCheckoutRequest(normalizedText)) {
      const response = {
        intent: "checkout",
        message: "Let's proceed to checkout."
      };
      
      // Add bot response to conversation history
      await storage.addMessageToConversation({
        conversationId: conversation.id,
        text: response.message,
        isFromUser: false
      });
      
      return response;
    }
    
    // Check for item ordering
    const orderMatch = extractOrderItem(normalizedText);
    
    if (orderMatch) {
      const response = {
        intent: "order_item",
        item: orderMatch.item,
        specialInstructions: orderMatch.specialInstructions,
        message: `I'll add ${orderMatch.item} to your order${orderMatch.specialInstructions ? ` with the note: ${orderMatch.specialInstructions}` : ''}.`
      };
      
      // Add bot response to conversation history
      await storage.addMessageToConversation({
        conversationId: conversation.id,
        text: response.message,
        isFromUser: false
      });
      
      return response;
    }
    
    // For other inputs, use AI recommendations
    try {
      // Use the OpenAI to process the natural language and get food recommendations
      const aiResponse = await getRecommendations(text, telegramUserId);
      
      // Add bot response to conversation history
      await storage.addMessageToConversation({
        conversationId: conversation.id,
        text: aiResponse.responseMessage,
        isFromUser: false
      });
      
      return {
        intent: "recommendation",
        message: aiResponse.responseMessage,
        recommendations: aiResponse.recommendations,
        followUpQuestions: aiResponse.followUpQuestions
      };
    } catch (aiError) {
      log(`Error getting AI recommendations: ${aiError}`, 'nlp-service-error');
      
      // Default response for unrecognized input if AI fails
      const fallbackResponse = {
        intent: "unknown",
        message: "I'm not sure what you're looking for. Would you like to see our menu or place an order?"
      };
      
      // Add bot response to conversation history
      await storage.addMessageToConversation({
        conversationId: conversation.id,
        text: fallbackResponse.message,
        isFromUser: false
      });
      
      return fallbackResponse;
    }
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
  const menuKeywords = [
    'menu', 'show me', 'what do you have', 'what do you offer', 'can i see', 
    'food', 'options', 'food options', 'categories', 'offerings', 
    'what can i order', 'what food', 'selections', 'choices',
    'what is available', 'whats available', 'what\'s available',
    'list of', 'tell me about', 'display', 'show the menu'
  ];
  return menuKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function isViewOrderRequest(text: string): boolean {
  const orderKeywords = [
    'view order', 'my order', 'current order', 'what i ordered', 'show my order', 'cart', 
    'basket', 'what\'s in my cart', 'whats in my cart', 'show cart', 'view cart', 
    'order status', 'what did i order', 'items in my order', 'what have i ordered',
    'my items', 'check my order', 'see my order', 'see what i ordered'
  ];
  return orderKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function isCheckoutRequest(text: string): boolean {
  const checkoutKeywords = [
    'checkout', 'check out', 'place order', 'confirm order', 'finalize', 'done ordering', 
    'finish', 'pay', 'proceed', 'complete my order', 'submit order', 'send order',
    'ready to order', 'finalize order', 'place my order', 'finish my order',
    'order now', 'confirm my order', 'submit my order', 'complete order',
    'go to checkout', 'proceed to checkout', 'process my order', 'i\'m done'
  ];
  return checkoutKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function extractCategory(text: string): string | undefined {
  // Boustan restaurant categories
  const categoryMappings = {
    'pita': 'Pitas & Wraps',
    'wrap': 'Pitas & Wraps',
    'platter': 'Platters',
    'salad': 'Salads',
    'appetizer': 'Appetizers',
    'side': 'Sides',
    'dessert': 'Desserts',
    'drink': 'Drinks',
    'shawarma': 'Pitas & Wraps',
    'falafel': 'Pitas & Wraps',
    'kebab': 'Platters',
    'hummus': 'Appetizers',
    'garlic': 'Sides',
    'rice': 'Sides',
    'tabouleh': 'Salads',
    'baklava': 'Desserts'
  };
  
  const normalizedText = text.toLowerCase();
  
  for (const [keyword, category] of Object.entries(categoryMappings)) {
    if (normalizedText.includes(keyword)) {
      return category;
    }
  }
  
  return undefined;
}

function extractOrderItem(text: string): { item: string, specialInstructions?: string } | undefined {
  // Boustan menu items 
  const menuItems = [
    // Pitas & Wraps
    'chicken shawarma pita', 'chicken shawarma', 'shawarma pita', 'chicken pita',
    'beef shawarma pita', 'beef shawarma', 'beef pita',
    'falafel pita', 'falafel wrap', 'falafel',
    'shish taouk pita', 'shish taouk', 'taouk pita',
    'kafta pita', 'kafta wrap', 'kafta',
    'vegetarian pita', 'vegetarian wrap', 'veggie pita', 'veggie wrap',
    'mix shawarma pita', 'mix shawarma wrap', 'mixed shawarma',
    
    // Platters
    'chicken shawarma platter', 'shawarma platter', 'chicken platter',
    'beef shawarma platter', 'beef platter',
    'falafel platter',
    'shish taouk platter', 'taouk platter',
    'kafta platter',
    'mixed platter', 'mix platter', 'mix shawarma platter',
    
    // Salads & Sides
    'tabouleh', 'tabbouleh', 'tabouleh salad',
    'fattoush', 'fattoush salad',
    'greek salad',
    'hummus', 'hummus dip',
    'baba ghanouj', 'baba ganoush',
    'garlic potatoes', 'garlic potato',
    'rice', 'lebanese rice',
    'fries', 'french fries', 
    
    // Drinks
    'coke', 'coca-cola', 'diet coke', 
    'sprite', 'ginger ale',
    'water', 'bottled water',
    'ayran yogurt drink', 'ayran', 'yogurt drink',
    'jellab', 'jallab',
    'lemonade', 'mint lemonade'
  ];
  
  const normalizedText = text.toLowerCase();
  
  // Check for menu items in the text
  for (const item of menuItems) {
    if (normalizedText.includes(item)) {
      // Check for special instructions
      const specialInstructions = extractSpecialInstructions(normalizedText, item);
      
      // Normalize item names
      let normalizedItem = item;
      
      // Pitas & Wraps
      if (item === 'chicken shawarma' || item === 'shawarma pita' || item === 'chicken pita') 
        normalizedItem = 'Chicken Shawarma Pita';
      if (item === 'beef shawarma' || item === 'beef pita') 
        normalizedItem = 'Beef Shawarma Pita';
      if (item === 'falafel' || item === 'falafel wrap') 
        normalizedItem = 'Falafel Pita';
      if (item === 'shish taouk' || item === 'taouk pita') 
        normalizedItem = 'Shish Taouk Pita';
      if (item === 'kafta' || item === 'kafta wrap') 
        normalizedItem = 'Kafta Pita';
      if (item === 'vegetarian wrap' || item === 'veggie pita' || item === 'veggie wrap') 
        normalizedItem = 'Vegetarian Pita';
      if (item === 'mix shawarma wrap' || item === 'mixed shawarma') 
        normalizedItem = 'Mix Shawarma Pita';
      
      // Platters
      if (item === 'shawarma platter' || item === 'chicken platter') 
        normalizedItem = 'Chicken Shawarma Platter';
      if (item === 'beef platter') 
        normalizedItem = 'Beef Shawarma Platter';
      if (item === 'taouk platter') 
        normalizedItem = 'Shish Taouk Platter';
      if (item === 'mixed platter' || item === 'mix platter' || item === 'mix shawarma platter') 
        normalizedItem = 'Mix Shawarma Platter';
      
      // Salads & Sides
      if (item === 'tabbouleh' || item === 'tabouleh salad') 
        normalizedItem = 'Tabouleh';
      if (item === 'fattoush salad') 
        normalizedItem = 'Fattoush';
      if (item === 'hummus dip') 
        normalizedItem = 'Hummus';
      if (item === 'baba ganoush') 
        normalizedItem = 'Baba Ghanouj';
      if (item === 'garlic potato') 
        normalizedItem = 'Garlic Potatoes';
      if (item === 'lebanese rice') 
        normalizedItem = 'Rice';
      if (item === 'french fries') 
        normalizedItem = 'Fries';
      
      // Drinks
      if (item === 'coca-cola') 
        normalizedItem = 'Coke';
      if (item === 'bottled water') 
        normalizedItem = 'Water';
      if (item === 'ayran' || item === 'yogurt drink') 
        normalizedItem = 'Ayran Yogurt Drink';
      if (item === 'jallab') 
        normalizedItem = 'Jellab';
      if (item === 'mint lemonade') 
        normalizedItem = 'Lemonade';
      
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
