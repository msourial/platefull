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
    const orderMatch = await extractOrderItem(normalizedText);
    
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
      log(`Detected dietary preference in text: "${text}"`, 'nlp-service-debug');
      const dietaryPreference = extractDietaryPreference(normalizedText);
      log(`Extracted preference: "${dietaryPreference}"`, 'nlp-service-debug');
      
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
          message: `For ${dietaryPreference === 'keto' ? 'keto' : 'low-carb'} options, I'd recommend our Chicken Shawarma Salad or Beef Kafta with extra vegetables instead of rice. These options are high in protein and lower in carbs. Would you like to try one of these?`,
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
      } else if (dietaryPreference === 'high-calorie' || dietaryPreference === 'high-protein') {
        // Handler for high-calorie, post-workout, gym-related requests
        const response = {
          intent: "dietary_recommendation",
          dietaryPreference: dietaryPreference,
          message: `Perfect for after a workout! I'd recommend our Mix Shawarma Platter or Beef Kafta Platter - both are high in protein and calories to fuel your muscles. Our platters come with meat, rice, garlic sauce, and salad for a complete post-gym meal. Would you like to try one of these?`,
          recommendations: [
            {
              name: "Mix Shawarma Platter",
              category: "Platters",
              reasons: ["Combination of chicken and beef shawarma for maximum protein", "Complete with rice, hummus, and salad for balanced recovery"]
            },
            {
              name: "Beef Kafta Platter",
              category: "Platters",
              reasons: ["High-protein ground beef mixed with herbs and spices", "Served with rice and sides to restore energy"]
            },
            {
              name: "Chicken Shawarma Platter",
              category: "Platters",
              reasons: ["Lean protein option with marinated chicken", "Request extra meat for additional protein"]
            }
          ],
          followUpQuestions: [
            "Would you like extra meat for more protein?",
            "Do you prefer chicken or beef for your protein source?",
            "Would you like to add a side of hummus for extra calories and healthy fats?"
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
  const normalizedText = text.toLowerCase().trim();
  
  // Check for command-style greetings first (exact match)
  if (normalizedText === '/start') {
    return true;
  }
  
  // Short text greetings (if message is just a greeting)
  const shortGreetings = [
    'hi', 'hello', 'hey', 'howdy', 'yo', 'hiya', 'sup', 'hola', 'bonjour', 'salam', 'marhaba'
  ];
  
  // Check if message is ONLY a greeting (1-word greeting)
  if (shortGreetings.includes(normalizedText)) {
    return true;
  }
  
  // Check for exact greeting phrases (full phrase match)
  const exactGreetingPhrases = [
    'good morning', 'good afternoon', 'good evening', 'what\'s up', 'whats up', 
    'how are you', 'let\'s start', 'lets start', 'hi there', 'hello there', 'get started'
  ];
  
  // Check if any exact greeting phrase is present
  return exactGreetingPhrases.some(phrase => normalizedText === phrase);
  
  // Note: We're no longer using includes() to avoid false positives on longer messages
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

async function extractOrderItem(text: string): Promise<{ item: string, specialInstructions?: string } | undefined> {
  // Handle single-word food items specially
  const words = text.trim().split(/\s+/);
  if (words.length === 1) {
    const singleWord = words[0].toLowerCase();
    log(`Processing single-word food item: "${singleWord}"`, 'nlp-service-debug');
    
    // Basic food mapping for single words - using exact menu item names from database
    const directFoodMappings: Record<string, string> = {
      // We don't directly map 'beef' anymore since we'll handle it specially for multiple options
      'chicken': 'Chicken Shawarma Pita',
      'falafel': 'Falafel Pita',
      'shawarma': 'Chicken Shawarma Pita',
      'kebab': 'Kafta Platter',
      'kafta': 'Kafta Platter',
      'taouk': 'Shish Taouk Pita',
      'hummus': 'Hummus',
      'tabouleh': 'Tabouleh',
      'fattoush': 'Fattoush',
      'rice': 'Rice',
      'water': 'Water',
      'coke': 'Coke',
      'pepsi': 'Coke',
      'soda': 'Coke',
      'drink': 'Coke',
      'baklava': 'Baklava',
      'salad': 'Fattoush'
    };
    
    // Instead of using direct mapping, let's find all menu items that match
    // This will enable us to handle multiple options for a single word like "beef"
    
    // Special case for beef, which needs to handle multiple matching products
    if (singleWord === 'beef') {
      log(`Handling special case for beef options`, 'nlp-service-debug');
      
      // Get all beef-related menu items
      const beefItems = await storage.getMenuItemsByName('Beef');
      
      if (beefItems.length > 1) {
        log(`Found ${beefItems.length} beef options`, 'nlp-service-debug');
        
        // Return these as multiple options for the user to choose from
        return {
          item: 'multiple-options',
          specialInstructions: JSON.stringify(beefItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price
          })))
        };
      } else if (beefItems.length === 1) {
        // Just one match, so return it directly
        return {
          item: beefItems[0].name
        };
      }
      
      // Fallback: If for some reason we didn't find any beef items (shouldn't happen)
      return {
        item: 'Beef Shawarma Pita'
      };
    }
    
    // For other items, check if there is a direct mapping
    if (singleWord in directFoodMappings) {
      log(`Found direct mapping for "${singleWord}" to "${directFoodMappings[singleWord]}"`, 'nlp-service-debug');
      
      // Instead of returning immediately, we'll use the direct mapping as a suggestion
      // but we'll still need to check if there are multiple options for this item
      const potentialMatches = await storage.findMenuItemsByPartialName(singleWord);
      
      // If we've found multiple options, we'll handle this as a special case
      if (potentialMatches && potentialMatches.length > 1) {
        log(`Found ${potentialMatches.length} potential matches for "${singleWord}"`, 'nlp-service-debug');
        
        // We'll handle this case in the calling function
        return {
          item: 'multiple-options',
          specialInstructions: JSON.stringify(potentialMatches.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price
          })))
        };
      }
      
      // If we only have one match or no matches, return the direct mapping
      return {
        item: directFoodMappings[singleWord]
      };
    }
  }
  
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
  const lowerText = text.toLowerCase();
  
  // Define RegExp patterns for common dietary preferences with typo tolerance - same patterns used in extractDietaryPreference
  const dietaryPatterns: Record<string, RegExp> = {
    vegetarian: /(vegetarian|veggie|no meat|meat.?free|meatless|vertarin|vegitarian|veg|veg(e|i)t(a|e)ri(a|e)n)/i,
    vegan: /(vegan|plant.?based|no animal|100% plant|dairy.?free and meat.?free|veggies only|ve+ga+n)/i,
    'gluten-free': /(gluten.?free|no gluten|gluten.?less|celiac|no wheat|without gluten|glutin)/i,
    'dairy-free': /(dairy.?free|no dairy|lactose|without dairy|no milk|milk.?free|lactos)/i,
    halal: /(halal|muslim friendly|muslim.?friendly|islamic dietary|islam food)/i,
    'nut-free': /(nut.?free|no nuts|without nuts|allergic to nuts|nut allergy)/i,
    keto: /(keto|ketogenic|low carb|low.?carb|law carb|lo carb|lo.?carb|no carb|carb free|lo cal)/i,
    allergy: /(allerg(y|ic|ies)|intolerance|cannot eat|can't eat|avoid)/i,
    healthy: /(health(y|ier)|diet(ing)?|low.?calorie|high.?protein|protein rich|no bread|paleo|atkins)/i,
    'sugar-free': /(sugar.?free|no sugar|diabetic|diabetes)/i,
    spicy: /(spicy|hot|fire|heat)/i,
    mild: /(mild|not spicy|no spice)/i,
    // Add fitness and high-calorie patterns
    'high-calorie': /(high.?calor(y|ie)|calorie dense|bulk(ing)?|gain weight|gain muscle|protein.?rich|post.?workout|after.?workout|after gym|post gym|energy dense|caloric|lots of calories)/i,
    'low-calorie': /(low.?calor(y|ie)|diet|weight.?loss|cutting|lean|slimming)/i,
    'high-protein': /(high.?protein|protein.?rich|muscle.?build|workout|gym|fitness|exercise|training)/i
  };
  
  // Check if any pattern matches
  for (const [preference, pattern] of Object.entries(dietaryPatterns)) {
    if (pattern.test(lowerText)) {
      log(`Detected dietary preference '${preference}' in: "${text}"`, 'nlp-service-debug');
      return true;
    }
  }
  
  // Check for questions about dietary specific options
  const dietaryQuestions = [
    'do you have', 'is there', 'are there', 'what options',
    'what dishes', 'which items', 'anything for', 'any options for',
    'food for', 'meals for', 'options for', 'suitable for',
    'what should', 'what can', 'can i get', 'what do you recommend for'
  ];
  
  // If not found directly, check for question format + dietary term
  for (const question of dietaryQuestions) {
    if (lowerText.includes(question)) {
      const qIndex = lowerText.indexOf(question);
      if (qIndex >= 0) {
        const afterQuestion = lowerText.substring(qIndex + question.length);
        // Check if the text after the question contains any of our dietary patterns
        for (const pattern of Object.values(dietaryPatterns)) {
          if (pattern.test(afterQuestion)) {
            log(`Detected dietary preference question in: "${text}"`, 'nlp-service-debug');
            return true;
          }
        }
      }
    }
  }
  
  log(`No dietary preferences detected in: "${text}"`, 'nlp-service-debug');
  return false;
}

/**
 * Extracts the specific dietary preference from user text
 * @param text The user's message
 * @returns The identified dietary preference
 */
function extractDietaryPreference(text: string): string {
  const normalizedText = text.toLowerCase();
  
  // Define RegExp patterns for common dietary preferences with typo tolerance
  const dietaryPatterns: Record<string, RegExp> = {
    vegetarian: /(vegetarian|veggie|no meat|meat.?free|meatless|vertarin|vegitarian|veg|veg(e|i)t(a|e)ri(a|e)n)/i,
    vegan: /(vegan|plant.?based|no animal|100% plant|dairy.?free and meat.?free|veggies only|ve+ga+n)/i,
    'gluten-free': /(gluten.?free|no gluten|gluten.?less|celiac|no wheat|without gluten|glutin)/i,
    'dairy-free': /(dairy.?free|no dairy|lactose|without dairy|no milk|milk.?free|lactos)/i,
    halal: /(halal|muslim friendly|muslim.?friendly|islamic dietary|islam food)/i,
    'nut-free': /(nut.?free|no nuts|without nuts|allergic to nuts|nut allergy)/i,
    keto: /(keto|ketogenic|low carb|low.?carb|law carb|lo carb|lo.?carb|no carb|carb free|lo cal)/i,
    spicy: /(spicy|hot|fire|super hot|extra spicy|spice)/i,
    mild: /(mild|not spicy|no spice|medium spice|little spice)/i,
    // Add fitness and high-calorie patterns
    'high-calorie': /(high.?calor(y|ie)|calorie dense|bulk(ing)?|gain weight|gain muscle|protein.?rich|post.?workout|after.?workout|after gym|post gym|energy dense|caloric|lots of calories)/i,
    'low-calorie': /(low.?calor(y|ie)|diet|weight.?loss|cutting|lean|slimming)/i,
    'high-protein': /(high.?protein|protein.?rich|muscle.?build|workout|gym|fitness|exercise|training)/i
  };
  
  // Check each pattern against the text
  for (const [preference, pattern] of Object.entries(dietaryPatterns)) {
    if (pattern.test(normalizedText)) {
      return preference;
    }
  }
  
  // Default fallback for other health/dietary mentions
  return 'special-diet';
}
