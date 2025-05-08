import OpenAI from "openai";
import { log } from "../vite";
import { storage } from "../storage";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface FoodRecommendationResponse {
  recommendations: {
    name: string;
    category: string;
    reasons: string[];
  }[];
  followUpQuestions: string[];
  responseMessage: string;
}

interface MenuItemWithCategory {
  id: number;
  name: string;
  description: string;
  price: string;
  category: {
    id: number;
    name: string;
  };
}

/**
 * Generate food recommendations based on user preferences
 * @param userMessage The user's message
 * @param conversationHistory Previous messages in the conversation
 * @returns Food recommendations with follow-up questions
 */
export async function getRecommendations(
  userMessage: string,
  telegramUserId: string
): Promise<FoodRecommendationResponse> {
  try {
    // Retrieve the full menu items with categories to provide to the AI
    const menuItems = await storage.getMenuItems();
    
    // Get previous order items for this user to understand preferences
    const orderHistory = await storage.getOrderHistoryByTelegramUserId(telegramUserId);
    
    // Get user data if available
    const user = await storage.getTelegramUserByTelegramId(telegramUserId);
    
    // Format menu items for the AI
    const formattedMenu = formatMenuForAI(menuItems);
    
    // Format order history for the AI
    const formattedOrderHistory = orderHistory?.map(order => {
      return {
        date: new Date(order.createdAt).toISOString().split('T')[0],
        items: order.items?.map(item => item.name) || []
      };
    }) || [];

    const systemPrompt = `You are a helpful assistant for Boustan, a Lebanese restaurant chain, specializing in helping customers find the perfect food options to order. 
You have access to the restaurant's menu and customer's order history.

Here's the restaurant's menu:
${formattedMenu}

The customer might express preferences, ask questions, or request recommendations. 
Your goal is to suggest appropriate menu items for them based on their preferences, questions, and order history.

When making recommendations:
1. Suggest 1-3 specific menu items that match their preferences
2. Explain briefly why each item might suit them
3. Ask 1-2 follow-up questions to help refine your recommendations further
4. Be conversational and friendly, but concise

Always structure your response in a way that can be easily parsed by the system, while maintaining a natural, conversational tone.

Response format (for internal processing):
{
  "recommendations": [
    {
      "name": "Menu item name exactly as it appears in the menu",
      "category": "Category name",
      "reasons": ["Reason 1", "Reason 2"]
    }
  ],
  "followUpQuestions": [
    "Question 1?", 
    "Question 2?"
  ],
  "responseMessage": "Your natural language response to the user that includes the recommendations and questions"
}`;

    // Create message arrays for the conversation
    const messages = [
      { role: "system", content: systemPrompt },
    ];
    
    // Add order history context if available
    if (formattedOrderHistory.length > 0) {
      messages.push({
        role: "system",
        content: `Customer's order history: ${JSON.stringify(formattedOrderHistory)}`
      });
    }
    
    // Add user data context if available
    if (user) {
      messages.push({
        role: "system",
        content: `Customer name: ${user.firstName || ''} ${user.lastName || ''}`
      });
    }
    
    // Add the user message
    messages.push({ role: "user", content: userMessage });

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: messages as any,
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Extract the response
    const responseContent = response.choices[0].message.content;
    
    if (!responseContent) {
      throw new Error("Empty response from OpenAI");
    }

    // Parse the JSON response
    const parsedResponse = JSON.parse(responseContent) as FoodRecommendationResponse;
    
    return parsedResponse;
  } catch (error) {
    log(`Error getting food recommendations: ${error}`, 'ai-service-error');
    // Return a graceful fallback response
    return {
      recommendations: [],
      followUpQuestions: ["Would you like to see our full menu?", "Do you have any specific preferences?"],
      responseMessage: "I'm sorry, I'm having trouble processing your request. Would you like to see our full menu or tell me more about what kind of food you're looking for today?"
    };
  }
}

/**
 * Get personalized order suggestions for a user
 * @param telegramUserId The Telegram user ID
 * @returns Personalized food suggestions
 */
export async function getPersonalizedSuggestions(telegramUserId: string): Promise<{
  suggestions: {
    name: string;
    category: string;
    reason: string;
  }[];
  message: string;
}> {
  try {
    // Get order history
    const orderHistory = await storage.getOrderHistoryByTelegramUserId(telegramUserId);
    
    // Get available menu items
    const menuItems = await storage.getMenuItems();
    
    // Format data for AI
    const formattedMenu = formatMenuForAI(menuItems);
    
    const formattedOrderHistory = orderHistory?.map(order => {
      return {
        date: new Date(order.createdAt).toISOString().split('T')[0],
        items: order.items?.map(item => item.name) || []
      };
    }) || [];

    // If no order history, return popular items
    if (formattedOrderHistory.length === 0) {
      return {
        suggestions: [
          { name: "Chicken Shawarma Pita", category: "Pitas & Wraps", reason: "Our most popular item" },
          { name: "Beef Shawarma Platter", category: "Platters", reason: "Perfect for a satisfying meal" },
          { name: "Falafel Wrap", category: "Pitas & Wraps", reason: "Great vegetarian option" }
        ],
        message: "Here are some of our most popular options that customers love:"
      };
    }

    const systemPrompt = `You are a helpful food recommendation system for Boustan, a Lebanese restaurant. 
Based on the customer's order history, suggest 3 items they might enjoy.

Here's the restaurant's menu:
${formattedMenu}

Here's the customer's order history:
${JSON.stringify(formattedOrderHistory)}

Analyze their previous orders and suggest items they might like but haven't tried yet.
If they've only ordered the same items, suggest complementary items.

Response format (for internal processing):
{
  "suggestions": [
    {
      "name": "Menu item name exactly as in the menu",
      "category": "Category name",
      "reason": "Brief explanation why this would appeal to them"
    }
  ],
  "message": "A friendly, brief intro to your suggestions"
}`;

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Parse and return the response
    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(responseContent);
  } catch (error) {
    log(`Error getting personalized suggestions: ${error}`, 'ai-service-error');
    // Fallback response
    return {
      suggestions: [
        { name: "Chicken Shawarma Pita", category: "Pitas & Wraps", reason: "Our signature dish" },
        { name: "Falafel Wrap", category: "Pitas & Wraps", reason: "A delicious vegetarian option" },
        { name: "Beef Shawarma Platter", category: "Platters", reason: "A complete meal with our famous shawarma" }
      ],
      message: "I think you might enjoy these popular items from our menu:"
    };
  }
}

/**
 * Analyze a user's preferences and dietary needs from conversation history
 * @param telegramUserId The Telegram user ID
 * @returns Analysis of user preferences and dietary needs
 */
export async function analyzeUserPreferences(telegramUserId: string): Promise<{
  preferences: {
    likes: string[];
    dislikes: string[];
    dietaryRestrictions: string[];
  };
  message: string;
}> {
  try {
    // Get conversation history
    const conversation = await storage.getConversationByTelegramUserId(Number(telegramUserId));
    
    // Get messages directly using the storage method if relationship-based query didn't work
    const messages = conversation ? 
      await storage.getConversationMessages(conversation.id) : 
      [];
    
    if (!conversation || messages.length === 0) {
      return {
        preferences: {
          likes: [],
          dislikes: [],
          dietaryRestrictions: []
        },
        message: "Not enough information to determine preferences yet."
      };
    }

    const systemPrompt = `You are an AI assistant for a Lebanese restaurant called Boustan.
Based on the conversation history with this customer, identify:
1. Foods they seem to like
2. Foods they dislike or avoid
3. Any dietary restrictions or preferences (vegetarian, vegan, gluten-free, halal, etc.)

Response format (for internal processing):
{
  "preferences": {
    "likes": ["food item 1", "food item 2"],
    "dislikes": ["food item 1"],
    "dietaryRestrictions": ["restriction 1"]
  },
  "message": "A very brief summary of their preferences"
}`;

    // Format conversation history
    const conversationHistory = messages.map((msg) => {
      return {
        role: msg.isFromUser ? "user" : "assistant",
        content: msg.text
      };
    });

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory as any
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    // Parse and return the response
    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(responseContent);
  } catch (error) {
    log(`Error analyzing user preferences: ${error}`, 'ai-service-error');
    // Fallback response
    return {
      preferences: {
        likes: [],
        dislikes: [],
        dietaryRestrictions: []
      },
      message: "I don't have enough information about your preferences yet. Feel free to tell me more about what you like!"
    };
  }
}

/**
 * Helper function to format menu items for AI prompts
 * @param menuItems Array of menu items with categories
 * @returns Formatted menu string
 */
function formatMenuForAI(menuItems: MenuItemWithCategory[]): string {
  const categorizedItems: Record<string, any[]> = {};
  
  // Group items by category
  menuItems.forEach(item => {
    const categoryName = item.category.name;
    if (!categorizedItems[categoryName]) {
      categorizedItems[categoryName] = [];
    }
    categorizedItems[categoryName].push({
      name: item.name,
      description: item.description,
      price: item.price
    });
  });
  
  // Format as string
  let menuText = "";
  
  for (const [category, items] of Object.entries(categorizedItems)) {
    menuText += `## ${category}\n`;
    
    items.forEach(item => {
      menuText += `- ${item.name} ($${item.price}): ${item.description}\n`;
    });
    
    menuText += "\n";
  }
  
  return menuText;
}