import Anthropic from '@anthropic-ai/sdk';
import { log } from '../vite';
import { storage } from '../storage';
import { getPersonalizedRecommendations, checkForReorderSuggestion } from '../services/orderHistory';
import { createOrder, addItemToOrder } from '../services/order';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Handle incoming message from Instagram
 * @param senderId The Instagram sender ID
 * @param message The message text
 */
export async function handleIncomingMessage(senderId: string, message: string) {
  try {
    log(`Received message from Instagram user ${senderId}: ${message}`, 'instagram');
    
    // Get or create Instagram user
    const instagramUser = await getOrCreateInstagramUser(senderId);
    
    // Get or create conversation
    const conversation = await getOrCreateConversation(instagramUser.id);
    
    // Check if this is the first message
    if (conversation.state === 'new') {
      await sendWelcomeMessage(senderId, instagramUser);
      return;
    }
    
    // Process message based on current state
    await processMessage(senderId, message, instagramUser, conversation);
  } catch (error) {
    log(`Error handling Instagram message: ${error}`, 'instagram-error');
    
    // Send an error message to the user
    await sendInstagramMessage(
      senderId, 
      "I'm having trouble processing your request. Please try again in a moment."
    );
  }
}

/**
 * Get or create Instagram user
 * @param instagramId Instagram user ID
 * @returns Instagram user object
 */
async function getOrCreateInstagramUser(instagramId: string) {
  try {
    // Check if user exists
    let user = await storage.getInstagramUserByInstagramId(instagramId);
    
    if (!user) {
      // Create new user
      user = await storage.createInstagramUser({
        instagramId,
        firstName: 'Instagram User',
        lastName: '',
        username: '',
        profilePic: '',
        lastInteraction: new Date()
      });
      
      log(`Created new Instagram user: ${instagramId}`, 'instagram');
    } else {
      // Update last interaction
      await storage.updateInstagramUser(user.id, {
        lastInteraction: new Date()
      });
    }
    
    return user;
  } catch (error) {
    log(`Error getting/creating Instagram user: ${error}`, 'instagram-error');
    throw error;
  }
}

/**
 * Get or create conversation for Instagram user
 * @param instagramUserId Instagram user ID in our database
 * @returns Conversation object
 */
async function getOrCreateConversation(instagramUserId: number) {
  try {
    // Check if conversation exists
    let conversation = await storage.getInstagramConversationByUserId(instagramUserId);
    
    if (!conversation) {
      // Create new conversation
      conversation = await storage.createInstagramConversation({
        instagramUserId,
        state: 'new',
        context: {},
        updatedAt: new Date()
      });
      
      log(`Created new Instagram conversation for user ID ${instagramUserId}`, 'instagram');
    }
    
    return conversation;
  } catch (error) {
    log(`Error getting/creating Instagram conversation: ${error}`, 'instagram-error');
    throw error;
  }
}

/**
 * Send welcome message to Instagram user
 * @param instagramId Instagram ID
 * @param instagramUser Instagram user object
 */
async function sendWelcomeMessage(instagramId: string, instagramUser: any) {
  try {
    // Default welcome message
    let welcomeText = "👋 *Welcome to Boustan Lebanese Restaurant!* I'm your AI assistant and I'm here to help you order delicious authentic Lebanese food.\n\nI can recommend dishes based on your preferences - just tell me what you're in the mood for!";
    
    // Get the conversation
    const conversation = await storage.getInstagramConversationByUserId(instagramUser.id);
    
    if (!conversation) {
      throw new Error(`No conversation found for Instagram user ${instagramUser.id}`);
    }
    
    // Check if user has order history for personalization
    try {
      // Check for reorder suggestions
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
    
    // Update conversation state
    await storage.updateInstagramConversation(conversation.id, {
      state: 'greeted',
      updatedAt: new Date()
    });
    
    // Send welcome message
    await sendInstagramMessage(instagramId, welcomeText);
    
    // Send menu options after a short delay
    setTimeout(async () => {
      await sendInstagramMessage(instagramId, "You can:\n\n📋 View our menu by typing *menu*\n👤 Get personalized recommendations by typing *recommend*\n🔍 Ask for specific items like \"*Do you have vegetarian options?*\"\n\nWhat would you like to do?");
    }, 1000);
  } catch (error) {
    log(`Error sending Instagram welcome message: ${error}`, 'instagram-error');
    throw error;
  }
}

/**
 * Process message based on content and conversation state
 * @param instagramId Instagram ID
 * @param message Message text
 * @param instagramUser Instagram user object
 * @param conversation Conversation object
 */
async function processMessage(
  instagramId: string,
  message: string,
  instagramUser: any,
  conversation: any
) {
  try {
    // Store the message in the conversation history
    await storage.createInstagramConversationMessage(conversation.id, {
      text: message,
      isFromUser: true,
      timestamp: new Date()
    });
    
    // Handle simple commands
    const lowercaseMessage = message.toLowerCase().trim();
    
    // Handle menu command
    if (lowercaseMessage === 'menu' || lowercaseMessage === 'show menu') {
      await sendMenuCategories(instagramId, conversation);
      return;
    }
    
    // Handle recommendations command
    if (lowercaseMessage === 'recommend' || lowercaseMessage === 'recommendations') {
      await sendPersonalRecommendations(instagramId, instagramUser.id, conversation);
      return;
    }
    
    // Handle reorder command
    if (lowercaseMessage === 'reorder' || lowercaseMessage === 'order again') {
      await handleReorderRequest(instagramId, instagramUser.id, conversation);
      return;
    }
    
    // Handle confirmation (yes) based on conversation state
    if (lowercaseMessage === 'yes' || lowercaseMessage === 'sure' || lowercaseMessage === 'ok') {
      if (await handleConfirmation(instagramId, instagramUser, conversation)) {
        return;
      }
    }
    
    // Handle denial (no) based on conversation state
    if (lowercaseMessage === 'no' || lowercaseMessage === 'nope') {
      if (await handleDenial(instagramId, instagramUser, conversation)) {
        return;
      }
    }
    
    // Process with Anthropic for more complex queries
    await processWithAnthropic(instagramId, message, instagramUser, conversation);
  } catch (error) {
    log(`Error processing Instagram message: ${error}`, 'instagram-error');
    
    // Send an error message
    await sendInstagramMessage(
      instagramId, 
      "I'm having trouble understanding. Please try again or type 'menu' to see our options."
    );
  }
}

/**
 * Process message with Anthropic Claude
 * @param instagramId Instagram ID
 * @param message Message text
 * @param instagramUser Instagram user object
 * @param conversation Conversation object
 */
async function processWithAnthropic(
  instagramId: string,
  message: string,
  instagramUser: any,
  conversation: any
) {
  try {
    // Start timing
    const startTime = Date.now();
    
    // Get conversation history for context (last 10 messages)
    const conversationHistory = await storage.getInstagramConversationMessages(conversation.id, 10);
    
    // Format conversation history for Claude
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.isFromUser ? 'user' : 'assistant',
      content: msg.text
    }));
    
    // Add the current message if not already in history
    if (formattedHistory.length === 0 || 
        formattedHistory[formattedHistory.length - 1].content !== message) {
      formattedHistory.push({
        role: 'user',
        content: message
      });
    }
    
    // Process with Claude
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
      
      Keep responses short and conversational, as if texting with a friend.
      
      Use emojis to make your responses more engaging.`,
      messages: formattedHistory
    });
    
    // Extract the assistant's response
    let aiResponse = "";
    
    if (response.content && response.content.length > 0) {
      // Process content parts
      for (const content of response.content) {
        if (content.type === 'text') {
          aiResponse += content.text;
        }
      }
    }
    
    // Send the response
    await sendInstagramMessage(instagramId, aiResponse);
    
    // Track AI response in conversation history
    await storage.createInstagramConversationMessage(conversation.id, {
      text: aiResponse,
      isFromUser: false,
      timestamp: new Date()
    });
    
    // Check if the response indicates an order intent
    const lowerResponse = aiResponse.toLowerCase();
    if (lowerResponse.includes('add to your order') || 
        lowerResponse.includes('would you like to order') ||
        lowerResponse.includes('add that to your cart')) {
      // Update conversation state to ordering
      await storage.updateInstagramConversation(conversation.id, {
        state: 'ordering',
        updatedAt: new Date()
      });
    }
    
    // Log performance
    const endTime = Date.now();
    log(`Processed Instagram message with Anthropic in ${endTime - startTime}ms`, 'instagram-anthropic');
  } catch (error) {
    log(`Error processing with Anthropic: ${error}`, 'instagram-error');
    
    // Send fallback message
    await sendInstagramMessage(
      instagramId, 
      "I'm sorry, I'm having trouble understanding your request right now. You can type 'menu' to browse our options or try asking in a different way."
    );
  }
}

/**
 * Handle user confirmation (yes responses)
 * @param instagramId Instagram ID
 * @param instagramUser Instagram user object
 * @param conversation Conversation object
 * @returns True if confirmation was handled, false otherwise
 */
async function handleConfirmation(
  instagramId: string,
  instagramUser: any,
  conversation: any
): Promise<boolean> {
  try {
    const context = conversation.context || {};
    
    // Handle pending item addition
    if (context.pendingAddItem && context.pendingItemId) {
      // Get or create an order
      let order = await storage.getActiveOrderByInstagramUserId(instagramUser.id);
      
      if (!order) {
        // Create a new order
        order = await createOrder({
          instagramUserId: instagramUser.id,
          status: "pending",
          totalAmount: "0.00",
          deliveryFee: "0.00",
          isDelivery: true,
          paymentMethod: "cash",
          paymentStatus: "pending"
        });
      }
      
      // Add the item to the order
      await addItemToOrder(order.id, context.pendingItemId, 1, {});
      
      // Send confirmation message
      await sendInstagramMessage(
        instagramId, 
        `Great! I've added ${context.pendingAddItem} to your order. Would you like to add anything else?`
      );
      
      // Update conversation state
      await storage.updateInstagramConversation(conversation.id, {
        state: 'ordering',
        context: {
          ...context,
          pendingAddItem: null,
          pendingItemId: null,
          lastOrderId: order.id
        },
        updatedAt: new Date()
      });
      
      // Suggest adding sides or drinks
      setTimeout(async () => {
        await sendInstagramMessage(
          instagramId, 
          "Would you like to add some sides or drinks to complete your meal? You can type 'menu' to browse options or just tell me what you'd like."
        );
      }, 1000);
      
      return true;
    }
    
    // Handle reorder confirmation
    if (conversation.state === 'confirming_reorder' && context.reorderItems && context.lastOrderId) {
      // Create a new order
      const newOrder = await createOrder({
        instagramUserId: instagramUser.id,
        status: "pending",
        totalAmount: "0.00",
        deliveryFee: "0.00",
        isDelivery: true,
        paymentMethod: "cash",
        paymentStatus: "pending"
      });
      
      // Add all items from the previous order
      for (const item of context.reorderItems) {
        await addItemToOrder(
          newOrder.id,
          item.menuItemId,
          item.quantity,
          item.customizations || {}
        );
      }
      
      // Send confirmation message
      await sendInstagramMessage(
        instagramId, 
        "Perfect! I've recreated your previous order. Would you like to add anything else or proceed to checkout?"
      );
      
      // Update conversation state
      await storage.updateInstagramConversation(conversation.id, {
        state: 'ordering',
        context: {
          ...context,
          reorderItems: null,
          lastOrderId: newOrder.id
        },
        updatedAt: new Date()
      });
      
      return true;
    }
    
    // No specific confirmation handler matched
    return false;
  } catch (error) {
    log(`Error handling confirmation: ${error}`, 'instagram-error');
    return false;
  }
}

/**
 * Handle user denial (no responses)
 * @param instagramId Instagram ID
 * @param instagramUser Instagram user object
 * @param conversation Conversation object
 * @returns True if denial was handled, false otherwise
 */
async function handleDenial(
  instagramId: string,
  instagramUser: any,
  conversation: any
): Promise<boolean> {
  try {
    const context = conversation.context || {};
    
    // Handle pending item denial
    if (context.pendingAddItem && context.pendingItemId) {
      // Send response
      await sendInstagramMessage(
        instagramId, 
        `No problem! Is there something else you'd like to try instead? You can type 'menu' to see our options.`
      );
      
      // Update conversation context
      await storage.updateInstagramConversation(conversation.id, {
        context: {
          ...context,
          pendingAddItem: null,
          pendingItemId: null
        },
        updatedAt: new Date()
      });
      
      return true;
    }
    
    // Handle reorder denial
    if (conversation.state === 'confirming_reorder' && (context.reorderItems || context.lastOrderId)) {
      // Send response
      await sendInstagramMessage(
        instagramId, 
        "No problem! What would you like to order today? You can type 'menu' to browse our options or just tell me what you're in the mood for."
      );
      
      // Update conversation context
      await storage.updateInstagramConversation(conversation.id, {
        state: 'initial',
        context: {
          ...context,
          reorderItems: null,
          lastOrderId: null
        },
        updatedAt: new Date()
      });
      
      return true;
    }
    
    // No specific denial handler matched
    return false;
  } catch (error) {
    log(`Error handling denial: ${error}`, 'instagram-error');
    return false;
  }
}

/**
 * Send menu categories to Instagram user
 * @param instagramId Instagram ID
 * @param conversation Conversation object
 */
async function sendMenuCategories(instagramId: string, conversation: any) {
  try {
    // Get categories
    const categories = await storage.getCategories();
    
    if (!categories || categories.length === 0) {
      await sendInstagramMessage(
        instagramId, 
        "I'm sorry, I couldn't retrieve our menu categories right now. Please try again later."
      );
      return;
    }
    
    // Format message
    let message = "📋 *Menu Categories*\n\n";
    
    categories.forEach((category, index) => {
      message += `${index + 1}. ${category.name}\n`;
    });
    
    message += "\nTo browse items in a category, reply with the category number or name.";
    
    // Send categories
    await sendInstagramMessage(instagramId, message);
    
    // Update conversation state
    await storage.updateInstagramConversation(conversation.id, {
      state: 'browsing_categories',
      context: {
        ...conversation.context,
        categories: categories.map(cat => ({
          id: cat.id,
          name: cat.name
        }))
      },
      updatedAt: new Date()
    });
  } catch (error) {
    log(`Error sending menu categories to Instagram: ${error}`, 'instagram-error');
    
    // Send error message
    await sendInstagramMessage(
      instagramId, 
      "I'm sorry, I couldn't retrieve our menu categories right now. Please try again later."
    );
  }
}

/**
 * Send personalized recommendations to Instagram user
 * @param instagramId Instagram ID
 * @param userId User ID in our database
 * @param conversation Conversation object
 */
async function sendPersonalRecommendations(instagramId: string, userId: number, conversation: any) {
  try {
    // Get recommendations
    const recommendations = await getPersonalizedRecommendations(userId);
    
    if (!recommendations || recommendations.recommendations.length === 0) {
      // No personalized recommendations, show popular items instead
      await sendInstagramMessage(
        instagramId, 
        "I don't have enough information to make personalized recommendations yet. Here are some of our popular items instead:"
      );
      
      // Get popular items
      const popularItems = await storage.getPopularMenuItems(3);
      
      // Format message
      let message = "📈 *Popular Items*\n\n";
      
      popularItems.forEach((item, index) => {
        const price = typeof item.price === 'number' 
          ? item.price.toFixed(2) 
          : parseFloat(item.price.toString()).toFixed(2);
          
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
    await sendInstagramMessage(
      instagramId, 
      recommendations.message || "Based on your previous orders, here are some items you might enjoy:"
    );
    
    // Send recommendation
    const firstRec = recommendations.recommendations[0];
    const menuItem = await storage.getMenuItemById(firstRec.menuItemId);
    
    if (menuItem) {
      // Format price for display
      const price = typeof menuItem.price === 'number' 
        ? menuItem.price.toFixed(2) 
        : parseFloat(menuItem.price.toString()).toFixed(2);
      
      let message = `*${menuItem.name}* - $${price}\n`;
      
      if (menuItem.description) {
        message += `${menuItem.description}\n`;
      }
      
      message += `\n*Why we recommend it:* ${firstRec.reason}\n`;
      message += "\nWould you like to add this to your order? Reply with *yes* if you'd like to order it.";
      
      await sendInstagramMessage(instagramId, message);
      
      // Update conversation context
      await storage.updateInstagramConversation(conversation.id, {
        context: {
          ...conversation.context,
          pendingAddItem: menuItem.name,
          pendingItemId: menuItem.id
        },
        updatedAt: new Date()
      });
    }
  } catch (error) {
    log(`Error sending personalized recommendations to Instagram: ${error}`, 'instagram-error');
    
    // Send error message
    await sendInstagramMessage(
      instagramId, 
      "I'm sorry, I couldn't generate recommendations right now. You can browse our menu by typing 'menu'."
    );
  }
}

/**
 * Handle reorder request
 * @param instagramId Instagram ID
 * @param userId User ID in our database
 * @param conversation Conversation object
 */
async function handleReorderRequest(instagramId: string, userId: number, conversation: any) {
  try {
    // Get reorder suggestion
    const reorderSuggestion = await checkForReorderSuggestion(userId);
    
    if (!reorderSuggestion.shouldSuggestReorder || !reorderSuggestion.lastOrder) {
      await sendInstagramMessage(
        instagramId, 
        "I couldn't find a recent order to reorder. Would you like to see our menu instead?"
      );
      return;
    }
    
    // Send message about the reorder
    await sendInstagramMessage(
      instagramId, 
      reorderSuggestion.message || "Here's your last order:"
    );
    
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
    await storage.updateInstagramConversation(conversation.id, {
      state: 'confirming_reorder',
      context: {
        ...conversation.context,
        reorderItems: reorderSuggestion.lastOrder.items,
        lastOrderId: reorderSuggestion.lastOrder.orderId
      },
      updatedAt: new Date()
    });
  } catch (error) {
    log(`Error handling reorder request on Instagram: ${error}`, 'instagram-error');
    
    // Send error message
    await sendInstagramMessage(
      instagramId, 
      "I'm sorry, I couldn't process your reorder request. Please try browsing our menu by typing 'menu'."
    );
  }
}

/**
 * Send message to Instagram user
 * @param instagramId Instagram ID
 * @param message Message text
 */
export async function sendInstagramMessage(instagramId: string, message: string): Promise<boolean> {
  try {
    // In a real application, you would make an API call to the Instagram Graph API
    // This is a placeholder to be implemented once you have Instagram API credentials
    
    log(`[MOCK] Sending message to Instagram user ${instagramId}: ${message}`, 'instagram');
    
    // Get user and conversation for tracking
    const user = await storage.getInstagramUserByInstagramId(instagramId);
    
    if (user) {
      const conversation = await storage.getInstagramConversationByUserId(user.id);
      
      if (conversation) {
        // Track message in database
        await storage.createInstagramConversationMessage(conversation.id, {
          text: message,
          isFromUser: false,
          timestamp: new Date()
        });
      }
    }
    
    return true;
  } catch (error) {
    log(`Error sending Instagram message: ${error}`, 'instagram-error');
    return false;
  }
}