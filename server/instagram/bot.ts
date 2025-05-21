import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { log } from '../vite';
import { storage } from '../storage';
import { processNaturalLanguage } from '../services/nlp';
import { checkForReorderSuggestion, getPersonalizedRecommendations } from '../services/orderHistory';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Instagram API configuration
const INSTAGRAM_GRAPH_API_VERSION = 'v19.0';
const INSTAGRAM_GRAPH_API_BASE_URL = `https://graph.facebook.com/${INSTAGRAM_GRAPH_API_VERSION}`;

// Store active conversations
const activeConversations = new Map<string, {
  instagramUserId: string;
  state: string;
  context: Record<string, any>;
  lastMessageId?: string;
}>();

/**
 * Initialize Instagram bot and webhook
 */
export async function initInstagramBot() {
  try {
    log('Instagram bot initialized successfully!', 'instagram');
    return true;
  } catch (error) {
    log(`Error initializing Instagram bot: ${error}`, 'instagram-error');
    return false;
  }
}

/**
 * Process Instagram webhook events
 * @param event The webhook event from Instagram
 */
export async function processInstagramWebhook(event: any) {
  try {
    if (event.object === 'instagram') {
      // Handle Instagram webhook events
      const entries = event.entry || [];
      
      for (const entry of entries) {
        const messaging = entry.messaging || [];
        
        for (const messagingEvent of messaging) {
          // Handle different types of Instagram messaging events
          if (messagingEvent.message) {
            await handleIncomingMessage(messagingEvent);
          }
        }
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    log(`Error processing Instagram webhook: ${error}`, 'instagram-error');
    return false;
  }
}

/**
 * Handle incoming Instagram message
 * @param event The messaging event
 */
async function handleIncomingMessage(event: any) {
  try {
    const senderId = event.sender.id;
    const message = event.message.text;
    
    log(`Received message from Instagram user ${senderId}: ${message}`, 'instagram');
    
    // Get or create Instagram user
    const instagramUser = await getOrCreateInstagramUser(senderId);
    
    // Get or create conversation
    const conversation = await getOrCreateConversation(senderId);
    
    // Check if this is the first message
    if (conversation.state === 'new') {
      await sendWelcomeMessage(senderId, instagramUser);
      return;
    }
    
    // Process the message with NLP
    await processNaturalLanguageInput(message, senderId, instagramUser, conversation);
  } catch (error) {
    log(`Error handling Instagram message: ${error}`, 'instagram-error');
  }
}

/**
 * Get or create an Instagram user
 * @param instagramId The Instagram user ID
 */
async function getOrCreateInstagramUser(instagramId: string) {
  try {
    // Check if user exists in our database
    let user = await storage.getInstagramUserByInstagramId(instagramId);
    
    if (!user) {
      // Try to get user info from Instagram API
      const userInfo = await getInstagramUserInfo(instagramId);
      
      // Create new user in our database
      user = await storage.createInstagramUser({
        instagramId,
        firstName: userInfo.firstName || 'Instagram User',
        lastName: userInfo.lastName || '',
        username: userInfo.username || '',
        profilePic: userInfo.profilePic || '',
        lastInteraction: new Date()
      });
      
      log(`Created new Instagram user: ${instagramId}`, 'instagram');
    } else {
      // Update last interaction time
      await storage.updateInstagramUser(user.id, {
        lastInteraction: new Date()
      });
    }
    
    return user;
  } catch (error) {
    log(`Error getting/creating Instagram user: ${error}`, 'instagram-error');
    
    // Return a minimal user object if we can't get or create the user
    return { 
      id: 0, 
      instagramId, 
      firstName: 'Instagram User',
      lastName: '',
      username: '',
      profilePic: '',
      lastInteraction: new Date()
    };
  }
}

/**
 * Get Instagram user information from Instagram Graph API
 * @param instagramId The Instagram user ID
 */
async function getInstagramUserInfo(instagramId: string) {
  try {
    // In a real application, you would make an API call to the Instagram Graph API
    // This is a placeholder to be implemented once you have Instagram API credentials
    
    // Placeholder user info
    return {
      firstName: 'Instagram',
      lastName: 'User',
      username: 'instagram_user',
      profilePic: ''
    };
  } catch (error) {
    log(`Error getting Instagram user info: ${error}`, 'instagram-error');
    return {
      firstName: 'Instagram',
      lastName: 'User',
      username: 'instagram_user',
      profilePic: ''
    };
  }
}

/**
 * Get or create a conversation for an Instagram user
 * @param instagramId The Instagram user ID
 */
async function getOrCreateConversation(instagramId: string) {
  // Check if we have an active conversation in memory
  if (activeConversations.has(instagramId)) {
    return activeConversations.get(instagramId)!;
  }
  
  try {
    // Check if user exists
    const user = await storage.getInstagramUserByInstagramId(instagramId);
    
    if (!user) {
      throw new Error(`Instagram user ${instagramId} not found`);
    }
    
    // Get or create conversation in database
    let conversation = await storage.getConversationByInstagramUserId(user.id);
    
    if (!conversation) {
      conversation = await storage.createConversation({
        instagramUserId: user.id,
        state: 'new',
        context: {},
        updatedAt: new Date()
      });
      
      log(`Created new conversation for Instagram user ${instagramId}`, 'instagram');
    }
    
    // Create active conversation in memory
    const activeConversation = {
      instagramUserId: instagramId,
      state: conversation.state,
      context: conversation.context || {},
      lastMessageId: conversation.lastMessageId?.toString()
    };
    
    activeConversations.set(instagramId, activeConversation);
    
    return activeConversation;
  } catch (error) {
    log(`Error getting/creating conversation: ${error}`, 'instagram-error');
    
    // Create a fallback conversation
    const fallbackConversation = {
      instagramUserId: instagramId,
      state: 'new',
      context: {},
    };
    
    activeConversations.set(instagramId, fallbackConversation);
    
    return fallbackConversation;
  }
}

/**
 * Send a welcome message to a new Instagram user
 * @param instagramId The Instagram user ID
 * @param instagramUser User information
 */
async function sendWelcomeMessage(instagramId: string, instagramUser: any) {
  try {
    // Default welcome message
    let welcomeText = "👋 *Welcome to Boustan Lebanese Restaurant!* I'm your AI assistant and I'm here to help you order delicious authentic Lebanese food.\n\nI can recommend dishes based on your preferences - just tell me what you're in the mood for!";
    
    // Get or create conversation
    const conversation = activeConversations.get(instagramId);
    if (!conversation) {
      throw new Error(`No active conversation for Instagram user ${instagramId}`);
    }
    
    // Check if user has order history for personalization
    if (instagramUser && instagramUser.id > 0) {
      try {
        // Check if there are any reorder suggestions
        const reorderSuggestion = await checkForReorderSuggestion(instagramUser.id);
        
        // Get personalized recommendations
        const personalRecommendations = await getPersonalizedRecommendations(instagramUser.id);
        
        // If user has order history, personalize welcome message
        if ((reorderSuggestion.shouldSuggestReorder && reorderSuggestion.lastOrder) || 
            personalRecommendations.recommendations.length > 0) {
          // Add welcome back message
          welcomeText = `👋 *Welcome back to Boustan, ${instagramUser.firstName || 'there'}!*\n\n`;
          
          // If there's a recent order we can suggest to reorder
          if (reorderSuggestion.shouldSuggestReorder && reorderSuggestion.lastOrder && 
              reorderSuggestion.lastOrder.items.length > 0) {
            welcomeText += `Last time you ordered:\n`;
            
            // Show up to 3 recent items
            const recentItems = reorderSuggestion.lastOrder.items.slice(0, 3);
            for (const item of recentItems) {
              welcomeText += `· ${item.name}\n`;
            }
            
            // Add option to reorder previous items
            welcomeText += `\nWould you like to reorder your favorites or try something new?`;
            
            // Tell user they can type "reorder" to reorder favorites
            welcomeText += `\n\nJust type *reorder* to order the same items again, or tell me what you're in the mood for!`;
          } 
          // If we have personalized recommendations based on order history
          else if (personalRecommendations.recommendations.length > 0) {
            welcomeText += `Based on your previous orders, you might enjoy:\n`;
            
            // Show up to 3 recommendations
            const topRecommendations = personalRecommendations.recommendations.slice(0, 3);
            for (const rec of topRecommendations) {
              welcomeText += `· ${rec.name} ${rec.reason ? `- ${rec.reason}` : ''}\n`;
            }
            
            welcomeText += `\nWhat would you like to try today?`;
          }
        }
      } catch (error) {
        log(`Error getting personalized welcome message: ${error}`, 'instagram');
        // Fall back to default welcome message
      }
    }
    
    // Update conversation state
    conversation.state = 'greeted';
    await updateConversation(instagramId, { state: 'greeted' });
    
    // Send the welcome message
    await sendInstagramMessage(instagramId, welcomeText);
    
    // Send menu options after a short delay
    setTimeout(async () => {
      await sendInstagramMessage(instagramId, "You can:\n\n📋 View our menu by typing *menu*\n👤 Get personalized recommendations by typing *recommend*\n🔍 Ask for specific items like \"*Do you have vegetarian options?*\"\n\nWhat would you like to do?");
    }, 1000);
  } catch (error) {
    log(`Error sending Instagram welcome message: ${error}`, 'instagram-error');
  }
}

/**
 * Process natural language input from Instagram
 * @param text The message text
 * @param instagramId The Instagram user ID
 * @param instagramUser User information
 * @param conversation The conversation object
 */
async function processNaturalLanguageInput(
  text: string,
  instagramId: string,
  instagramUser: any,
  conversation: any
) {
  try {
    // Log the user's request for debugging
    log(`Processing natural language input from Instagram: "${text}" from user ${instagramId}`, 'instagram-nlp');
    
    // Record the start time for performance tracking
    const startTime = Date.now();
    
    // Quick check if this is a dietary preference query for enhanced detection
    const lowercaseText = text.toLowerCase();
    
    // Handle common commands
    if (lowercaseText === 'menu' || lowercaseText === 'show menu') {
      await sendMenuCategories(instagramId);
      return;
    }
    
    if (lowercaseText === 'recommend' || lowercaseText === 'recommendations') {
      await sendPersonalRecommendations(instagramId, instagramUser.id);
      return;
    }
    
    if (lowercaseText === 'reorder' || lowercaseText === 'order again') {
      await handleReorderRequest(instagramId, instagramUser.id);
      return;
    }
    
    // Check for dietary preferences
    if (/keto|diet|vegetarian|vegan|gluten|halal/.test(lowercaseText)) {
      log(`Detected potential dietary preference keywords in: "${text}"`, 'instagram-nlp-debug');
      
      if (/keto/.test(lowercaseText)) {
        await sendInstagramMessage(instagramId, "For keto-friendly options, I'd recommend our Chicken Shawarma Salad or Beef Kafta with extra vegetables instead of rice. These options are high in protein and lower in carbs.");
        
        setTimeout(async () => {
          await sendInstagramMessage(instagramId, "Our Chicken Shawarma Salad features marinated chicken with fresh vegetables and no pita bread, making it a perfect low-carb option. Would you like to add that to your order? Just reply *yes* to add it.");
        }, 1000);
        
        // Update conversation context
        conversation.context.pendingAddItem = 'Chicken Shawarma Salad';
        await updateConversation(instagramId, {
          context: {
            ...conversation.context,
            pendingAddItem: 'Chicken Shawarma Salad',
            pendingItemId: 26
          }
        });
        
        return;
      }
      
      if (/vegan/.test(lowercaseText)) {
        await sendInstagramMessage(instagramId, "For vegan options, I'd recommend our Falafel Wrap or Vegetarian Platter. Our falafel is made from a blend of chickpeas and herbs - 100% plant-based and delicious!");
        
        setTimeout(async () => {
          await sendInstagramMessage(instagramId, "The Vegetarian Platter includes hummus, tabbouleh, grape leaves, and falafel - all completely vegan. Would you like to order that? Reply *yes* to add it to your order.");
        }, 1000);
        
        // Update conversation context
        conversation.context.pendingAddItem = 'Vegetarian Platter';
        await updateConversation(instagramId, {
          context: {
            ...conversation.context,
            pendingAddItem: 'Vegetarian Platter',
            pendingItemId: 15
          }
        });
        
        return;
      }
      
      // Handle other dietary preferences similarly...
    }
    
    // Process with Anthropic for more complex queries
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      system: `You are an AI assistant for a Lebanese restaurant named Boustan. 
      You help customers order food through Instagram chat. 
      Be friendly, helpful, and concise with your responses.
      
      Current user: ${instagramUser.firstName || 'Customer'}
      Current conversation state: ${conversation.state}
      
      The menu includes:
      - Wraps: Chicken Shawarma, Beef Shawarma, Falafel, Kafta
      - Platters: Chicken Platter, Beef Platter, Mixed Grill, Vegetarian Platter
      - Sides: Hummus, Baba Ghanoush, Tabbouleh, Fries
      - Beverages: Ayran, Soft Drinks, Water
      
      If the user wants to order something, extract the menu item and respond naturally, then ask if they want to add anything else.
      
      If the user asks about dietary restrictions (vegetarian, vegan, gluten-free), provide appropriate menu options.
      
      Keep responses short and conversational, as if texting with a friend.`,
      messages: [
        { role: "user", content: text }
      ]
    });
    
    // Extract the assistant's response
    const aiResponse = response.content[0].text;
    
    // Send the response to Instagram
    await sendInstagramMessage(instagramId, aiResponse);
    
    // Update conversation state based on context
    if (aiResponse.toLowerCase().includes('order') || 
        aiResponse.toLowerCase().includes('add to your cart')) {
      conversation.state = 'ordering';
      await updateConversation(instagramId, { state: 'ordering' });
    }
    
    // Log performance
    const endTime = Date.now();
    log(`Processed Instagram message in ${endTime - startTime}ms`, 'instagram-nlp');
  } catch (error) {
    log(`Error processing Instagram natural language input: ${error}`, 'instagram-nlp-error');
    await sendInstagramMessage(instagramId, "I'm having trouble understanding your request. Could you please try again or type 'menu' to see our options?");
  }
}

/**
 * Send menu categories to Instagram
 * @param instagramId The Instagram user ID
 */
async function sendMenuCategories(instagramId: string) {
  try {
    // Get all menu categories
    const categories = await storage.getCategories();
    
    if (categories.length === 0) {
      await sendInstagramMessage(instagramId, "I'm sorry, I couldn't retrieve our menu categories. Please try again later.");
      return;
    }
    
    // Format message with categories
    let message = "📋 *Menu Categories*\n\n";
    
    categories.forEach((category, index) => {
      message += `${index + 1}. ${category.name}\n`;
    });
    
    message += "\nTo view items in a category, reply with the category number or name.";
    
    // Send categories to user
    await sendInstagramMessage(instagramId, message);
    
    // Update conversation state
    const conversation = activeConversations.get(instagramId);
    if (conversation) {
      conversation.state = 'browsing_categories';
      conversation.context.categories = categories.map(cat => ({
        id: cat.id,
        name: cat.name
      }));
      
      await updateConversation(instagramId, {
        state: 'browsing_categories',
        context: {
          ...conversation.context,
          categories: categories.map(cat => ({
            id: cat.id,
            name: cat.name
          }))
        }
      });
    }
  } catch (error) {
    log(`Error sending menu categories to Instagram: ${error}`, 'instagram-error');
    await sendInstagramMessage(instagramId, "I'm sorry, I couldn't retrieve our menu categories. Please try again later.");
  }
}

/**
 * Send menu items for a category to Instagram
 * @param instagramId The Instagram user ID
 * @param categoryId The category ID
 */
async function sendMenuItems(instagramId: string, categoryId: number) {
  try {
    // Get category name
    const category = await storage.getCategoryById(categoryId);
    
    if (!category) {
      await sendInstagramMessage(instagramId, "I couldn't find that category. Please try again.");
      return;
    }
    
    // Get menu items for the category
    const menuItems = await storage.getMenuItemsForCategory(categoryId);
    
    if (menuItems.length === 0) {
      await sendInstagramMessage(instagramId, `There are no items available in the ${category.name} category right now.`);
      return;
    }
    
    // Format message with menu items
    let message = `🍽️ *${category.name}*\n\n`;
    
    menuItems.forEach((item, index) => {
      const price = parseFloat(item.price.toString()).toFixed(2);
      message += `${index + 1}. ${item.name} - $${price}\n`;
      if (item.description) {
        message += `   ${item.description}\n`;
      }
      message += '\n';
    });
    
    message += "To add an item to your order, reply with the item number or name.";
    
    // Split long messages if needed (Instagram has a character limit)
    if (message.length > 2000) {
      const chunks = [];
      let currentChunk = '';
      
      message.split('\n\n').forEach(paragraph => {
        if ((currentChunk + paragraph + '\n\n').length > 1900) {
          chunks.push(currentChunk);
          currentChunk = paragraph + '\n\n';
        } else {
          currentChunk += paragraph + '\n\n';
        }
      });
      
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // Send each chunk
      for (const chunk of chunks) {
        await sendInstagramMessage(instagramId, chunk);
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay to avoid rate limits
      }
    } else {
      await sendInstagramMessage(instagramId, message);
    }
    
    // Update conversation state
    const conversation = activeConversations.get(instagramId);
    if (conversation) {
      conversation.state = 'browsing_items';
      conversation.context.currentCategory = categoryId;
      conversation.context.menuItems = menuItems.map(item => ({
        id: item.id,
        name: item.name
      }));
      
      await updateConversation(instagramId, {
        state: 'browsing_items',
        context: {
          ...conversation.context,
          currentCategory: categoryId,
          menuItems: menuItems.map(item => ({
            id: item.id,
            name: item.name
          }))
        }
      });
    }
  } catch (error) {
    log(`Error sending menu items to Instagram: ${error}`, 'instagram-error');
    await sendInstagramMessage(instagramId, "I'm sorry, I couldn't retrieve the menu items. Please try again later.");
  }
}

/**
 * Send personalized recommendations to Instagram
 * @param instagramId The Instagram user ID
 * @param userId The user ID in our database
 */
async function sendPersonalRecommendations(instagramId: string, userId: number) {
  try {
    // Get personalized recommendations
    const recommendations = await getPersonalizedRecommendations(userId);
    
    if (recommendations.recommendations.length === 0) {
      await sendInstagramMessage(instagramId, "I don't have enough data to make personalized recommendations yet. Here are some of our popular items instead.");
      
      // Send popular items instead
      const popularItems = await storage.getPopularMenuItems(3);
      
      let message = "📈 *Popular Items*\n\n";
      
      popularItems.forEach((item, index) => {
        const price = parseFloat(item.price.toString()).toFixed(2);
        message += `${index + 1}. ${item.name} - $${price}\n`;
        if (item.description) {
          message += `   ${item.description}\n`;
        }
        message += '\n';
      });
      
      await sendInstagramMessage(instagramId, message);
      return;
    }
    
    // Send personalized greeting
    await sendInstagramMessage(instagramId, recommendations.message || "Based on your previous orders, here are some items you might enjoy:");
    
    // Send each recommendation
    for (const recommendation of recommendations.recommendations) {
      // Get full menu item details
      const menuItem = await storage.getMenuItemById(recommendation.menuItemId);
      
      if (menuItem) {
        // Format price for display
        const price = parseFloat(menuItem.price.toString()).toFixed(2);
        
        let message = `*${menuItem.name}* - $${price}\n`;
        if (menuItem.description) {
          message += `${menuItem.description}\n`;
        }
        message += `\n*Why we recommend it:* ${recommendation.reason}\n`;
        message += "\nReply with *yes* if you'd like to add this to your order.";
        
        await sendInstagramMessage(instagramId, message);
        
        // Update conversation context with pending item
        const conversation = activeConversations.get(instagramId);
        if (conversation) {
          conversation.context.pendingAddItem = menuItem.name;
          conversation.context.pendingItemId = menuItem.id;
          
          await updateConversation(instagramId, {
            context: {
              ...conversation.context,
              pendingAddItem: menuItem.name,
              pendingItemId: menuItem.id
            }
          });
        }
        
        // Only send the first recommendation initially
        break;
      }
    }
  } catch (error) {
    log(`Error sending personalized recommendations to Instagram: ${error}`, 'instagram-error');
    await sendInstagramMessage(instagramId, "I'm sorry, I couldn't generate recommendations for you right now. Please try again later.");
  }
}

/**
 * Handle reorder request from Instagram
 * @param instagramId The Instagram user ID
 * @param userId The user ID in our database
 */
async function handleReorderRequest(instagramId: string, userId: number) {
  try {
    // Check if there's a recent order to reorder
    const reorderSuggestion = await checkForReorderSuggestion(userId);
    
    if (!reorderSuggestion.shouldSuggestReorder || !reorderSuggestion.lastOrder) {
      await sendInstagramMessage(instagramId, "I couldn't find a recent order to reorder. Would you like to see our menu instead?");
      return;
    }
    
    // Send message about the reorder
    await sendInstagramMessage(instagramId, reorderSuggestion.message || "Here's your last order:");
    
    // List the items from the last order
    let message = "*Your previous order:*\n\n";
    
    reorderSuggestion.lastOrder.items.forEach(item => {
      message += `· ${item.name} (Quantity: ${item.quantity})\n`;
      if (item.customizations && Object.keys(item.customizations).length > 0) {
        message += "  Customizations: ";
        
        const customizations = Object.entries(item.customizations)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        
        message += customizations + '\n';
      }
    });
    
    message += `\nTotal: $${parseFloat(reorderSuggestion.lastOrder.totalAmount).toFixed(2)}`;
    message += "\n\nWould you like to reorder these items? Reply with *yes* to confirm or *no* to start a new order.";
    
    await sendInstagramMessage(instagramId, message);
    
    // Update conversation state
    const conversation = activeConversations.get(instagramId);
    if (conversation) {
      conversation.state = 'confirming_reorder';
      conversation.context.reorderItems = reorderSuggestion.lastOrder.items;
      conversation.context.lastOrderId = reorderSuggestion.lastOrder.orderId;
      
      await updateConversation(instagramId, {
        state: 'confirming_reorder',
        context: {
          ...conversation.context,
          reorderItems: reorderSuggestion.lastOrder.items,
          lastOrderId: reorderSuggestion.lastOrder.orderId
        }
      });
    }
  } catch (error) {
    log(`Error handling reorder request on Instagram: ${error}`, 'instagram-error');
    await sendInstagramMessage(instagramId, "I'm sorry, I couldn't process your reorder request. Please try again later.");
  }
}

/**
 * Send a message to an Instagram user
 * @param instagramId The Instagram user ID
 * @param message The message to send
 */
async function sendInstagramMessage(instagramId: string, message: string) {
  try {
    // In a real application, you would make an API call to the Instagram Graph API
    // This is a placeholder to be implemented once you have Instagram API credentials
    
    log(`[MOCK] Sending message to Instagram user ${instagramId}: ${message}`, 'instagram');
    
    // Track the message in our database for context
    const user = await storage.getInstagramUserByInstagramId(instagramId);
    
    if (user) {
      const conversation = await storage.getConversationByInstagramUserId(user.id);
      
      if (conversation) {
        await storage.createConversationMessage(conversation.id, {
          text: message,
          isFromUser: false
        });
      }
    }
    
    return true;
  } catch (error) {
    log(`Error sending Instagram message: ${error}`, 'instagram-error');
    return false;
  }
}

/**
 * Update conversation in database and memory
 * @param instagramId The Instagram user ID
 * @param data The data to update
 */
async function updateConversation(instagramId: string, data: any) {
  try {
    // Update in memory
    const conversation = activeConversations.get(instagramId);
    
    if (conversation) {
      // Update state
      if (data.state) {
        conversation.state = data.state;
      }
      
      // Update context
      if (data.context) {
        conversation.context = {
          ...conversation.context,
          ...data.context
        };
      }
      
      // Update in database
      const user = await storage.getInstagramUserByInstagramId(instagramId);
      
      if (user) {
        const dbConversation = await storage.getConversationByInstagramUserId(user.id);
        
        if (dbConversation) {
          await storage.updateConversation(dbConversation.id, {
            state: conversation.state,
            context: conversation.context,
            updatedAt: new Date()
          });
        }
      }
    }
  } catch (error) {
    log(`Error updating Instagram conversation: ${error}`, 'instagram-error');
  }
}