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

    const systemPrompt = `You are a specialized AI assistant for Boustan, a Lebanese restaurant chain known for authentic Middle Eastern cuisine. Your expertise is in helping customers discover the perfect Lebanese dishes based on their tastes, dietary needs, and preferences. You have deep knowledge of Lebanese culinary traditions and flavors.

Here's the restaurant's menu:
${formattedMenu}

DETAILED CULINARY KNOWLEDGE:
- Lebanese cuisine is known for bold flavors using olive oil, lemon, garlic, herbs like mint, parsley, and za'atar
- Signature dishes include shawarma (marinated meat roasted on a vertical rotisserie), falafel (spiced chickpea fritters), and mezze platters (assortment of small dishes)
- Traditional preparation methods include charcoal grilling, slow-roasting, and unique spice blends
- Lebanese meals typically feature a balance of proteins, fresh vegetables, herbs, and grains

IMPORTANT DIETARY INFORMATION:
- Many Lebanese dishes contain garlic, onions, and various spices 
- Shawarma dishes contain meat (beef, chicken) unless specified as plant-based
- Falafel dishes are vegetarian and often vegan (made from chickpeas and herbs)
- Mezze options include many vegetarian/vegan choices like hummus, baba ghanouj, tabbouleh
- Most dishes can be made gluten-free upon request
- All meat is Halal-certified, prepared according to Islamic dietary guidelines
- Many dishes are dairy-free, but some feature yogurt or labneh
- Some dishes contain nuts, especially pine nuts in rice dishes and desserts

When making food recommendations:
1. Suggest 1-3 specific menu items that match their preferences, with authentic menu item names
2. Explain why each recommendation suits their needs with specific details about:
   - Flavor profiles (smoky, tangy, herbaceous, savory)
   - Key ingredients and their taste contributions
   - Preparation methods that influence flavor (marinating, grilling, slow-cooking)
   - How the dish represents authentic Lebanese culinary traditions
3. If mentioning spice levels, be specific about the types of spices used (not just "spicy")
4. Include 2-3 thoughtful follow-up questions to further personalize recommendations
5. Be conversational, enthusiastic, and knowledgeable like a Lebanese culinary expert

IMPORTANT: Your recommendations must be actual menu items from the Boustan menu provided above. Never make up menu items that don't exist.

Response format (for internal processing):
{
  "recommendations": [
    {
      "name": "Menu item name exactly as it appears in the menu",
      "category": "Category name",
      "reasons": ["Detailed flavor or ingredient reason", "Dietary consideration"]
    }
  ],
  "followUpQuestions": [
    "Question about spice preferences?", 
    "Question about dietary needs?"
  ],
  "responseMessage": "Your friendly, conversational response that highlights the menu items and why they might enjoy them"
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

    const systemPrompt = `You are a culinary AI expert for Boustan, a Lebanese restaurant known for authentic Middle Eastern cuisine. Your job is to analyze customer order history and provide personalized food recommendations.

RESTAURANT MENU:
${formattedMenu}

CUSTOMER'S ORDER HISTORY:
${JSON.stringify(formattedOrderHistory)}

RECOMMENDATION GUIDELINES:
1. Analyze flavor profiles, ingredients, and dishes they've ordered before
2. Suggest 3 menu items they haven't tried but would likely enjoy
3. If they've ordered the same items repeatedly, suggest:
   - Complementary dishes that pair well with their favorites
   - Variations with similar flavor profiles but different ingredients
   - Traditional Lebanese dishes that match their demonstrated preferences

CULINARY CONTEXT:
- If they order meat dishes, focus on our signature shawarma and kebab options
- If they prefer vegetarian items, highlight our falafel, hummus, and vegetable-based dishes
- If they order spicy foods, recommend dishes with similar heat levels
- Suggest balanced meals (protein + sides) if they typically order full platters

Response format (for internal processing):
{
  "suggestions": [
    {
      "name": "Menu item name exactly as in the menu",
      "category": "Category name",
      "reason": "Specific culinary reason referencing their order patterns and flavor preferences"
    }
  ],
  "message": "A personalized intro that acknowledges their previous orders and introduces your recommendations"
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

    const systemPrompt = `You are a Lebanese culinary expert and preferences analyst for Boustan, a Lebanese restaurant known for authentic Middle Eastern cuisine. You've spent years working in Lebanese restaurants and understand the nuances of traditional Lebanese flavors, ingredients, and dining customs. Analyze the conversation history to identify this customer's detailed food preferences.

ANALYSIS AREAS (Be specific to Lebanese cuisine):
1. FLAVOR PREFERENCES
   - Spice level (mild, medium, spicy) and specific spice preferences (za'atar, sumac, 7-spice, etc.)
   - Flavor profiles they enjoy (savory, tangy, garlicky, herbaceous, etc.)
   - Texture preferences (crispy like falafel, tender like slow-cooked meat, etc.)
   - Sauce preferences (tahini, garlic sauce, etc.)

2. DIETARY INFORMATION
   - Dietary restrictions (vegetarian, vegan, halal, etc.)
   - Allergies or ingredients they avoid (nuts, dairy, gluten, sesame, etc.)
   - Protein preferences (chicken shawarma, beef kofta, falafel, etc.)
   - Seasonal preferences (warm comfort foods vs. light refreshing options)

3. MEAL PREFERENCES
   - Portion size preferences (mezze-style small plates vs. hearty platters)
   - Meal composition (traditional wrap/pita, complete platter, mezze spread)
   - Side dish preferences (specific salads like tabbouleh/fattoush, rice, pickles, etc.)
   - Bread preferences (thin pita vs. thicker Lebanese bread)

INSTRUCTIONS:
- Be specific about Lebanese/Middle Eastern food items
- Identify patterns across multiple messages
- Note contradictions or changes in preferences
- Focus on both stated preferences ("I like...") and implied preferences (ordering patterns)

Response format (for internal processing):
{
  "preferences": {
    "likes": ["specific food items", "flavor profiles", "cuisines"],
    "dislikes": ["specific food items", "ingredients", "flavors"],
    "dietaryRestrictions": ["specific restrictions", "allergies", "avoided ingredients"]
  },
  "message": "A concise summary that captures their unique preferences in 1-2 sentences"
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