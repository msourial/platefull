import { storage } from "../storage";
import { log } from "../vite";

// Service functions for menu-related operations

export async function searchMenu(query: string) {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        message: "Search query is required",
        items: []
      };
    }

    const items = await storage.getMenuItemsByName(query);
    
    if (items.length === 0) {
      return {
        success: false,
        message: `No menu items found matching "${query}"`,
        items: []
      };
    }
    
    return {
      success: true,
      message: `Found ${items.length} item(s) matching "${query}"`,
      items
    };
  } catch (error) {
    log(`Error searching menu: ${error}`, 'menu-service-error');
    return {
      success: false,
      message: "An error occurred while searching the menu",
      items: []
    };
  }
}

export async function getMenuCategories() {
  try {
    const categories = await storage.getCategories();
    
    if (categories.length === 0) {
      return {
        success: false,
        message: "No menu categories found",
        categories: []
      };
    }
    
    return {
      success: true,
      message: `Found ${categories.length} categories`,
      categories
    };
  } catch (error) {
    log(`Error getting menu categories: ${error}`, 'menu-service-error');
    return {
      success: false,
      message: "An error occurred while retrieving menu categories",
      categories: []
    };
  }
}

export async function getMenuItemsForCategory(categoryId: number) {
  try {
    if (!categoryId) {
      return {
        success: false,
        message: "Category ID is required",
        items: []
      };
    }
    
    const category = await storage.getCategoryById(categoryId);
    
    if (!category) {
      return {
        success: false,
        message: `Category with ID ${categoryId} not found`,
        items: []
      };
    }
    
    const items = await storage.getMenuItems(categoryId);
    
    if (items.length === 0) {
      return {
        success: false,
        message: `No menu items found in category "${category.name}"`,
        items: []
      };
    }
    
    return {
      success: true,
      message: `Found ${items.length} item(s) in category "${category.name}"`,
      items,
      category
    };
  } catch (error) {
    log(`Error getting menu items for category: ${error}`, 'menu-service-error');
    return {
      success: false,
      message: "An error occurred while retrieving menu items",
      items: []
    };
  }
}

export async function getMenuItemDetails(menuItemId: number) {
  try {
    if (!menuItemId) {
      return {
        success: false,
        message: "Menu item ID is required",
        item: null
      };
    }
    
    const item = await storage.getMenuItemById(menuItemId);
    
    if (!item) {
      return {
        success: false,
        message: `Menu item with ID ${menuItemId} not found`,
        item: null
      };
    }
    
    return {
      success: true,
      message: `Found menu item "${item.name}"`,
      item
    };
  } catch (error) {
    log(`Error getting menu item details: ${error}`, 'menu-service-error');
    return {
      success: false,
      message: "An error occurred while retrieving menu item details",
      item: null
    };
  }
}
