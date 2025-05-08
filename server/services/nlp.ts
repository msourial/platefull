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
  dietaryPreference?: string;
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
    
    // Check for dietary preferences before going to AI
    if (hasDietaryPreference(normalizedText)) {
      const dietaryPreference = extractDietaryPreference(normalizedText);
      
      if (dietaryPreference === 'vegetarian' || dietaryPreference === 'vegan') {
        const response = {
          intent: "dietary_recommendation",
          message: `For ${dietaryPreference} options, I'd recommend our Falafel Wrap or Falafel Platter. Falafel is made from chickpeas and herbs, making it a delicious ${dietaryPreference} option. Would you like me to add one of these to your order? Or would you prefer to see more ${dietaryPreference} options?`,
          dietaryPreference: dietaryPreference,
          recommendations: [
            {
              name: "Falafel Wrap",
              category: "Pitas & Wraps",
              reasons: [`Perfect ${dietaryPreference} option made from spiced chickpeas`, "Wrapped with fresh vegetables and tahini sauce"]
            },
            {
              name: "Falafel Platter",
              category: "Platters",
              reasons: [`A complete ${dietaryPreference} meal`, "Includes falafel, hummus, salad, and rice or fries"]
            },
            {
              name: "Vegetarian Platter",
              category: "Platters",
              reasons: ["Variety of plant-based Lebanese mezze", "Includes hummus, tabbouleh, and more vegetable options"]
            }
          ],
          followUpQuestions: [
            "Would you like your falafel spicy or mild?",
            "Do you have any allergies I should know about?",
            "Would you prefer a wrap or a full platter with sides?"
          ]
        };
        
        // Add bot response to conversation history
        await storage.addMessageToConversation({
          conversationId: conversation.id,
          text: response.message,
          isFromUser: false
        });
        
        return response;
      } else if (dietaryPreference === 'gluten-free') {
        const response = {
          intent: "dietary_recommendation",
          dietaryPreference: dietaryPreference,
          message: `For gluten-free options, I'd recommend our Chicken Shawarma Platter without pita bread, or our Lebanese Salad with grilled chicken. We can prepare these dishes without any gluten-containing ingredients. Would you like me to add one of these to your order?`,
          recommendations: [
            {
              name: "Chicken Shawarma Platter",
              category: "Platters",
              reasons: ["Can be served without pita", "Includes rice, garlic sauce, and salad - all gluten-free"]
            },
            {
              name: "Lebanese Salad",
              category: "Salads",
              reasons: ["Fresh mix of vegetables with our house dressing", "Add grilled chicken for a complete gluten-free meal"]
            },
            {
              name: "Hummus with Vegetables",
              category: "Appetizers",
              reasons: ["Classic chickpea dip with olive oil", "Served with fresh vegetable crudités instead of pita"]
            }
          ],
          followUpQuestions: [
            "Do you have any other dietary restrictions besides gluten?",
            "Would you like us to ensure there's no cross-contamination in the kitchen?",
            "Would you prefer a meat option or a vegetable-based dish?"
          ]
        };
        
        // Add bot response to conversation history
        await storage.addMessageToConversation({
          conversationId: conversation.id,
          text: response.message,
          isFromUser: false
        });
        
        return response;
      } else if (dietaryPreference === 'halal') {
        const response = {
          intent: "dietary_recommendation",
          dietaryPreference: dietaryPreference,
          message: `All our meat is 100% halal certified, so you can enjoy any of our meat dishes! Our most popular halal options are the Chicken Shawarma and Beef Kafta. Would you like to try one of these authentic Lebanese specialties?`,
          recommendations: [
            {
              name: "Chicken Shawarma",
              category: "Pitas & Wraps",
              reasons: ["100% halal-certified chicken", "Marinated in our special blend of Middle Eastern spices"]
            },
            {
              name: "Beef Kafta",
              category: "Platters",
              reasons: ["Halal ground beef mixed with parsley and spices", "Grilled to perfection and served with rice and salad"]
            },
            {
              name: "Mixed Grill Platter",
              category: "Platters",
              reasons: ["Sample of our halal grilled meats", "Perfect for trying multiple halal options in one dish"]
            }
          ],
          followUpQuestions: [
            "Would you prefer chicken, beef, or lamb?",
            "Do you like your food spicy or mild?",
            "Would you like that as a wrap or a platter with sides?"
          ]
        };
        
        // Add bot response to conversation history
        await storage.addMessageToConversation({
          conversationId: conversation.id,
          text: response.message,
          isFromUser: false
        });
        
        return response;
      } else if (dietaryPreference === 'keto' || dietaryPreference === 'low-carb') {
        const response = {
          intent: "dietary_recommendation",
          dietaryPreference: dietaryPreference,
          message: `For ${dietaryPreference} options, I'd recommend our Chicken Shawarma Salad or Beef Kafta with extra vegetables instead of rice. These options are high in protein and lower in carbs. Would you like to try one of these?`,
          recommendations: [
            {
              name: "Chicken Shawarma Salad",
              category: "Salads",
              reasons: ["High protein, low carb option", "Fresh vegetables with marinated chicken, no pita"]
            },
            {
              name: "Beef Kafta",
              category: "Platters",
              reasons: ["Request extra vegetable sides instead of rice", "Protein-rich grilled beef with low-carb vegetable options"]
            },
            {
              name: "Garlic Sauce Chicken",
              category: "Platters",
              reasons: ["Flavorful chicken with our famous garlic sauce", "Ask for double vegetable portion instead of rice or fries"]
            }
          ],
          followUpQuestions: [
            "Would you like to substitute the rice for extra salad?",
            "Do you have any specific vegetables you prefer?",
            "How strictly are you following your low-carb diet?"
          ]
        };
        
        // Add bot response to conversation history
        await storage.addMessageToConversation({
          conversationId: conversation.id,
          text: response.message,
          isFromUser: false
        });
        
        return response;
      }
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
  const normalizedText = text.toLowerCase();
  const greetings = [
    'hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 
    'howdy', 'yo', 'hiya', 'sup', 'what\'s up', 'whats up', 'how are you', 'hola', 
    'bonjour', 'salam', 'marhaba', 'start', 'begin', '/start', 'let\'s start', 
    'lets start', 'hi there', 'hello there', 'get started'
  ];
  return greetings.some(greeting => normalizedText.includes(greeting));
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

/**
 * Detects if the user text contains dietary preference keywords
 * @param text The user's message
 * @returns Whether the text contains dietary preference indicators
 */
function hasDietaryPreference(text: string): boolean {
  const dietaryKeywords = [
    'vegetarian', 'vegan', 'plant-based', 'plant based', 'no meat', 'without meat', 
    'gluten-free', 'gluten free', 'dairy-free', 'dairy free', 'lactose', 'halal',
    'no dairy', 'meat-free', 'vegetable', 'vegetables', 'meatless', 'veggie',
    'allergy', 'allergic', 'allergies', 'intolerance', 'no nuts', 'nut-free', 
    'no gluten', 'health', 'diet', 'dieting', 'healthy', 'low calorie',
    'low-calorie', 'spicy', 'mild', 'hot', 'vertarin', 'vegitarian', 'veg'
  ];
  
  return dietaryKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

/**
 * Extracts the specific dietary preference from user text
 * @param text The user's message
 * @returns The identified dietary preference
 */
function extractDietaryPreference(text: string): string {
  const normalizedText = text.toLowerCase();
  
  // Vegetarian related keywords (including common misspellings)
  if (normalizedText.includes('vegetarian') || normalizedText.includes('veggie') || 
      normalizedText.includes('no meat') || normalizedText.includes('meat-free') || 
      normalizedText.includes('meatless') || normalizedText.includes('vertarin') || 
      normalizedText.includes('vegitarian') || normalizedText.includes('veg')) {
    return 'vegetarian';
  }
  
  // Vegan related keywords
  if (normalizedText.includes('vegan') || normalizedText.includes('plant-based') || 
      normalizedText.includes('plant based') || normalizedText.includes('no animal products')) {
    return 'vegan';
  }
  
  // Gluten-free related keywords
  if (normalizedText.includes('gluten-free') || normalizedText.includes('gluten free') || 
      normalizedText.includes('no gluten') || normalizedText.includes('without gluten')) {
    return 'gluten-free';
  }
  
  // Dairy-free related keywords
  if (normalizedText.includes('dairy-free') || normalizedText.includes('dairy free') || 
      normalizedText.includes('no dairy') || normalizedText.includes('lactose') || 
      normalizedText.includes('without dairy')) {
    return 'dairy-free';
  }
  
  // Halal related keywords
  if (normalizedText.includes('halal')) {
    return 'halal';
  }
  
  // Nut-free related keywords
  if (normalizedText.includes('nut-free') || normalizedText.includes('nut free') || 
      normalizedText.includes('no nuts') || normalizedText.includes('without nuts') || 
      normalizedText.includes('allergic to nuts')) {
    return 'nut-free';
  }
  
  // Keto and low-carb related keywords
  if (normalizedText.includes('keto') || normalizedText.includes('ketogenic') || 
      normalizedText.includes('low carb') || normalizedText.includes('low-carb') ||
      normalizedText.includes('no carbs') || normalizedText.includes('carb-free')) {
    return 'keto';
  }
  
  // Spice level preferences
  if (normalizedText.includes('spicy') || normalizedText.includes('hot')) {
    return 'spicy';
  }
  
  if (normalizedText.includes('mild') || normalizedText.includes('not spicy') || 
      normalizedText.includes('no spice')) {
    return 'mild';
  }
  
  // Default fallback for other health/dietary mentions
  return 'special-diet';
}
