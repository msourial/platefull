import { storage } from '../storage';
import { log } from '../vite';
import { MenuItem } from '@shared/schema';

/**
 * Analyzes a user's order history to identify preferences and patterns
 * @param telegramUserId The Telegram user ID
 * @returns Analysis of user order history with favorite items and preferences
 */
export async function analyzeOrderHistory(telegramUserId: number): Promise<{
  favoriteItems: {
    menuItemId: number;
    name: string;
    orderCount: number;
    lastOrdered: Date;
  }[];
  frequentCategories: {
    categoryId: number;
    name: string;
    orderCount: number;
  }[];
  typicalOrderTime?: string;
  averageOrderSize: number;
  customizationPreferences: Record<string, string>;
  hasMealPatterns: boolean;
}> {
  try {
    log(`Analyzing order history for user ${telegramUserId}`, 'order-history');
    
    // Get all completed orders for the user
    const allOrders = await storage.getOrdersByTelegramUserId(telegramUserId);
    const completedOrders = allOrders.filter(order => 
      ['confirmed', 'delivered', 'completed'].includes(order.status)
    );
    
    if (completedOrders.length === 0) {
      log(`No completed orders found for user ${telegramUserId}`, 'order-history');
      return {
        favoriteItems: [],
        frequentCategories: [],
        averageOrderSize: 0,
        customizationPreferences: {},
        hasMealPatterns: false
      };
    }
    
    // Track item frequencies
    const itemFrequency: Record<number, { 
      count: number; 
      name: string; 
      lastOrdered: Date;
      categoryId: number;
    }> = {};
    
    // Track category frequencies
    const categoryFrequency: Record<number, {
      count: number;
      name: string;
    }> = {};
    
    // Track customization preferences
    const customizationChoices: Record<string, Record<string, number>> = {};
    
    // Track order times for pattern recognition
    const orderTimes: number[] = [];
    
    // Count total items ordered
    let totalItemsOrdered = 0;
    
    // Process each order
    for (const order of completedOrders) {
      // Add order time
      const orderDate = new Date(order.updatedAt);
      orderTimes.push(orderDate.getHours());
      
      // Process each item in the order
      for (const item of order.orderItems) {
        totalItemsOrdered++;
        
        // Track menu item frequency
        if (!itemFrequency[item.menuItemId]) {
          itemFrequency[item.menuItemId] = {
            count: 0,
            name: item.menuItem.name,
            lastOrdered: orderDate,
            categoryId: item.menuItem.categoryId
          };
        }
        
        itemFrequency[item.menuItemId].count++;
        
        // Update last ordered date if this is more recent
        if (orderDate > itemFrequency[item.menuItemId].lastOrdered) {
          itemFrequency[item.menuItemId].lastOrdered = orderDate;
        }
        
        // Track category frequency
        if (!categoryFrequency[item.menuItem.categoryId]) {
          const categoryName = item.menuItem.category?.name || "Unknown";
          categoryFrequency[item.menuItem.categoryId] = {
            count: 0,
            name: categoryName
          };
        }
        
        categoryFrequency[item.menuItem.categoryId].count++;
        
        // Track customization preferences if any
        if (item.customizations) {
          const customizations = item.customizations as Record<string, string>;
          
          for (const [option, choice] of Object.entries(customizations)) {
            if (!customizationChoices[option]) {
              customizationChoices[option] = {};
            }
            
            if (!customizationChoices[option][choice]) {
              customizationChoices[option][choice] = 0;
            }
            
            customizationChoices[option][choice]++;
          }
        }
      }
    }
    
    // Calculate favorite items (ordered by frequency)
    const favoriteItems = Object.entries(itemFrequency)
      .map(([menuItemId, data]) => ({
        menuItemId: parseInt(menuItemId),
        name: data.name,
        orderCount: data.count,
        lastOrdered: data.lastOrdered
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 3); // Top 3 favorite items
    
    // Calculate frequent categories
    const frequentCategories = Object.entries(categoryFrequency)
      .map(([categoryId, data]) => ({
        categoryId: parseInt(categoryId),
        name: data.name,
        orderCount: data.count
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 2); // Top 2 categories
    
    // Determine most common order time of day
    let typicalOrderTime: string | undefined;
    if (orderTimes.length > 0) {
      const hourCounts: Record<string, number> = {};
      const timePeriods = {
        'morning': [6, 7, 8, 9, 10, 11],
        'afternoon': [12, 13, 14, 15, 16, 17],
        'evening': [18, 19, 20, 21],
        'night': [22, 23, 0, 1, 2, 3, 4, 5]
      };
      
      for (const hour of orderTimes) {
        for (const [period, hours] of Object.entries(timePeriods)) {
          if (hours.includes(hour)) {
            if (!hourCounts[period]) hourCounts[period] = 0;
            hourCounts[period]++;
            break;
          }
        }
      }
      
      let maxCount = 0;
      for (const [period, count] of Object.entries(hourCounts)) {
        if (count > maxCount) {
          maxCount = count;
          typicalOrderTime = period;
        }
      }
    }
    
    // Calculate average order size
    const averageOrderSize = totalItemsOrdered / completedOrders.length;
    
    // Determine customization preferences (most frequent choice for each option)
    const customizationPreferences: Record<string, string> = {};
    for (const [option, choices] of Object.entries(customizationChoices)) {
      let maxCount = 0;
      let preferredChoice = '';
      
      for (const [choice, count] of Object.entries(choices)) {
        if (count > maxCount) {
          maxCount = count;
          preferredChoice = choice;
        }
      }
      
      customizationPreferences[option] = preferredChoice;
    }
    
    // Determine if user has regular meal patterns
    const hasMealPatterns = favoriteItems.length > 0 && 
                           favoriteItems[0].orderCount >= 2 && 
                           completedOrders.length >= 3;
    
    log(`Analysis completed for user ${telegramUserId}, found ${favoriteItems.length} favorite items`, 'order-history');
    
    return {
      favoriteItems,
      frequentCategories,
      typicalOrderTime,
      averageOrderSize,
      customizationPreferences,
      hasMealPatterns
    };
  } catch (error) {
    log(`Error analyzing order history: ${error}`, 'order-history-error');
    return {
      favoriteItems: [],
      frequentCategories: [],
      averageOrderSize: 0,
      customizationPreferences: {},
      hasMealPatterns: false
    };
  }
}

/**
 * Generates personalized recommendations based on order history
 * @param telegramUserId The Telegram user ID
 * @returns Recommended items and reason for recommendation
 */
export async function getPersonalizedRecommendations(telegramUserId: number): Promise<{
  recommendations: {
    menuItemId: number;
    name: string;
    reason: string;
  }[];
  suggestedCustomizations: Record<string, string>;
  message: string;
}> {
  try {
    // Analyze order history
    const analysis = await analyzeOrderHistory(telegramUserId);
    
    // Initialize recommendations array
    const recommendations: {
      menuItemId: number;
      name: string;
      reason: string;
    }[] = [];
    
    // Check if we have enough data for personalized recommendations
    if (analysis.favoriteItems.length === 0) {
      // Not enough order history, get popular items instead
      const popularItems = await storage.getPopularMenuItems(5);
      
      const recommendedItems = popularItems.slice(0, 3).map(item => ({
        menuItemId: Number(item.id),
        name: String(item.name),
        reason: "Popular choice among our customers"
      }));
      
      return {
        recommendations: recommendedItems,
        suggestedCustomizations: {},
        message: "Based on our most popular items, you might enjoy these dishes:"
      };
    }
    
    // Add favorite items with recency check (only if not ordered in the last 24 hours)
    const now = new Date();
    const recentFavorites = analysis.favoriteItems.filter(item => {
      const hoursSinceLastOrder = (now.getTime() - item.lastOrdered.getTime()) / (1000 * 60 * 60);
      return hoursSinceLastOrder > 24; // Only suggest if not ordered in the last 24 hours
    });
    
    if (recentFavorites.length > 0) {
      recommendations.push({
        menuItemId: recentFavorites[0].menuItemId,
        name: recentFavorites[0].name,
        reason: "One of your favorites"
      });
    }
    
    // Suggest items from favorite categories but not specifically ordered before
    const favoriteCategories = analysis.frequentCategories;
    if (favoriteCategories.length > 0) {
      // Get items from favorite category
      const categoryId = favoriteCategories[0].categoryId;
      const categoryItems = await storage.getMenuItemsForCategory(categoryId);
      
      // Filter out items already in favorites
      const newCategoryItems = categoryItems.filter(item => 
        !analysis.favoriteItems.some(fav => fav.menuItemId === item.id)
      );
      
      if (newCategoryItems.length > 0) {
        // Pick a random item from the category that they haven't tried yet
        const randomIndex = Math.floor(Math.random() * newCategoryItems.length);
        const newItem = newCategoryItems[randomIndex];
        
        recommendations.push({
          menuItemId: newItem.id,
          name: newItem.name,
          reason: `From your favorite category: ${favoriteCategories[0].name}`
        });
      }
    }
    
    // If we don't have enough recommendations yet, add a popular item they haven't tried
    if (recommendations.length < 2) {
      const popularItems = await storage.getPopularMenuItems(5);
      
      // Filter out items already recommended or in favorites
      const newPopularItems = popularItems.filter(item => 
        !recommendations.some(rec => rec.menuItemId === item.id) &&
        !analysis.favoriteItems.some(fav => fav.menuItemId === item.id)
      );
      
      if (newPopularItems.length > 0) {
        recommendations.push({
          menuItemId: Number(newPopularItems[0].id),
          name: String(newPopularItems[0].name),
          reason: "Popular with our customers"
        });
      }
    }
    
    // Generate a personalized message based on analysis
    let message: string;
    const userFirstName = (await storage.getTelegramUserById(telegramUserId))?.firstName || "there";
    
    if (analysis.hasMealPatterns) {
      message = `Welcome back, ${userFirstName}! Based on your previous orders, here are some recommendations just for you:`;
    } else if (analysis.favoriteItems.length > 0) {
      message = `Hey ${userFirstName}! We remember what you like. Here are some items you might enjoy:`;
    } else {
      message = `Hello ${userFirstName}! Here are some recommendations you might enjoy:`;
    }
    
    // Time-based greeting if we have that data
    if (analysis.typicalOrderTime) {
      const currentHour = new Date().getHours();
      const timePeriods = {
        'morning': [6, 7, 8, 9, 10, 11],
        'afternoon': [12, 13, 14, 15, 16, 17],
        'evening': [18, 19, 20, 21],
        'night': [22, 23, 0, 1, 2, 3, 4, 5]
      };
      
      // Determine current time period
      let currentPeriod = 'morning'; // default
      for (const [period, hours] of Object.entries(timePeriods)) {
        if (hours.includes(currentHour)) {
          currentPeriod = period;
          break;
        }
      }
      
      // If ordering at usual time, mention it
      if (currentPeriod === analysis.typicalOrderTime) {
        message = `Good ${currentPeriod}, ${userFirstName}! It's your usual ${analysis.typicalOrderTime} ordering time. Here are some recommendations:`;
      }
    }
    
    return {
      recommendations,
      suggestedCustomizations: analysis.customizationPreferences,
      message
    };
  } catch (error) {
    log(`Error generating personalized recommendations: ${error}`, 'order-history-error');
    return {
      recommendations: [],
      suggestedCustomizations: {},
      message: "Here are some items you might enjoy:"
    };
  }
}

/**
 * Checks if a user is starting a new order that's similar to a previous order
 * and offers to reorder their favorite items
 * @param telegramUserId The Telegram user ID
 * @returns Suggested reorder items if applicable
 */
export async function checkForReorderSuggestion(telegramUserId: number): Promise<{
  shouldSuggestReorder: boolean;
  lastOrder?: {
    orderId: number;
    items: {
      menuItemId: number;
      name: string;
      quantity: number;
      customizations?: Record<string, string>;
    }[];
    totalAmount: string;
    orderDate: Date;
  };
  message?: string;
}> {
  try {
    // Get user's previous orders
    const allOrders = await storage.getOrdersByTelegramUserId(telegramUserId);
    const completedOrders = allOrders.filter(order => 
      ['confirmed', 'delivered', 'completed'].includes(order.status)
    );
    
    if (completedOrders.length === 0) {
      return { shouldSuggestReorder: false };
    }
    
    // Get the most recent completed order
    const lastOrder = completedOrders[0];
    const orderDate = new Date(lastOrder.updatedAt);
    
    // Only suggest reordering if the order is from the last 30 days
    const daysSinceLastOrder = (new Date().getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastOrder > 30) {
      return { shouldSuggestReorder: false };
    }
    
    // Format the items in the last order
    const lastOrderItems = lastOrder.orderItems.map(item => ({
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      quantity: item.quantity,
      customizations: item.customizations as Record<string, string> | undefined
    }));
    
    // Generate a meaningful message
    const userFirstName = (await storage.getTelegramUserById(telegramUserId))?.firstName || "there";
    
    let timeframe: string;
    if (daysSinceLastOrder < 1) {
      timeframe = "earlier today";
    } else if (daysSinceLastOrder < 2) {
      timeframe = "yesterday";
    } else if (daysSinceLastOrder < 7) {
      timeframe = "earlier this week";
    } else if (daysSinceLastOrder < 14) {
      timeframe = "last week";
    } else {
      timeframe = "a few weeks ago";
    }
    
    const message = `Hey ${userFirstName}! Would you like to reorder what you had ${timeframe}? Here's your previous order:`;
    
    return {
      shouldSuggestReorder: true,
      lastOrder: {
        orderId: lastOrder.id,
        items: lastOrderItems,
        totalAmount: lastOrder.totalAmount,
        orderDate
      },
      message
    };
  } catch (error) {
    log(`Error checking for reorder suggestion: ${error}`, 'order-history-error');
    return {
      shouldSuggestReorder: false
    };
  }
}