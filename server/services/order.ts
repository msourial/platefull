import { storage } from "../storage";
import { log } from "../vite";

// Service functions for order-related operations

export async function createOrder(
  userData: {
    telegramUserId?: number;
    instagramUserId?: number;
    status?: string;
    totalAmount?: string;
    deliveryFee?: string;
    isDelivery?: boolean;
    paymentMethod?: string;
    paymentStatus?: string;
  }
) {
  try {
    // Check if user has a valid ID
    if (!userData.telegramUserId && !userData.instagramUserId) {
      throw new Error("Either telegramUserId or instagramUserId must be provided");
    }
    
    // Check if user already has an active order
    let existingOrder;
    
    if (userData.telegramUserId) {
      existingOrder = await storage.getActiveOrderByTelegramUserId(userData.telegramUserId);
    } else if (userData.instagramUserId) {
      existingOrder = await storage.getActiveOrderByInstagramUserId(userData.instagramUserId);
    }
    
    if (existingOrder) {
      return existingOrder;
    }
    
    // Set default values if not provided
    const orderData = {
      ...userData,
      status: userData.status || "pending",
      totalAmount: userData.totalAmount || "0",
      deliveryFee: userData.deliveryFee || "0",
      isDelivery: userData.isDelivery !== undefined ? userData.isDelivery : true,
      paymentMethod: userData.paymentMethod || "cash",
      paymentStatus: userData.paymentStatus || "pending"
    };
    
    // Create a new order
    const newOrder = await storage.createOrder(orderData);
    
    // Log the order creation with platform info
    const userType = userData.telegramUserId ? "telegram" : "instagram";
    const userId = userData.telegramUserId || userData.instagramUserId;
    
    log(`Created new order ${newOrder.id} for ${userType} user ${userId}`, "order");
    
    return newOrder;
  } catch (error) {
    log(`Error creating order: ${error}`, 'order-service-error');
    throw new Error(`Failed to create order: ${error}`);
  }
}

export async function addItemToOrder(
  orderId: number,
  menuItemId: number,
  quantity: number = 1,
  specialInstructions?: string
) {
  try {
    // Get the menu item to get its price
    const menuItem = await storage.getMenuItemById(menuItemId);
    
    if (!menuItem) {
      throw new Error(`Menu item with ID ${menuItemId} not found`);
    }
    
    // Create order item
    const orderItem = await storage.createOrderItem({
      orderId,
      menuItemId,
      quantity,
      price: menuItem.price.toString(),
      specialInstructions
    });
    
    // Update order total
    await updateOrderTotal(orderId);
    
    return orderItem;
  } catch (error) {
    log(`Error adding item to order: ${error}`, 'order-service-error');
    throw new Error(`Failed to add item to order: ${error}`);
  }
}

export async function updateOrderItem(
  orderItemId: number,
  quantity: number,
  customizations?: Record<string, string>,
  specialInstructions?: string
) {
  try {
    // Get the order item
    const orderItem = await storage.getOrderItemById(orderItemId);
    
    if (!orderItem) {
      throw new Error(`Order item with ID ${orderItemId} not found`);
    }
    
    // Update order item
    const updatedOrderItem = await storage.updateOrderItem(orderItemId, {
      quantity,
      customizations,
      specialInstructions
    });
    
    // Update order total
    await updateOrderTotal(orderItem.orderId);
    
    return updatedOrderItem;
  } catch (error) {
    log(`Error updating order item: ${error}`, 'order-service-error');
    throw new Error(`Failed to update order item: ${error}`);
  }
}

export async function removeItemFromOrder(orderItemId: number) {
  try {
    // Get the order item to get the order ID
    const orderItem = await storage.getOrderItemById(orderItemId);
    
    if (!orderItem) {
      throw new Error(`Order item with ID ${orderItemId} not found`);
    }
    
    const orderId = orderItem.orderId;
    
    // Delete the order item
    await storage.deleteOrderItem(orderItemId);
    
    // Update order total
    await updateOrderTotal(orderId);
    
    return { success: true };
  } catch (error) {
    log(`Error removing item from order: ${error}`, 'order-service-error');
    throw new Error(`Failed to remove item from order: ${error}`);
  }
}

export async function clearOrder(orderId: number) {
  try {
    // Get all order items
    const orderItems = await storage.getOrderItemsByOrderId(orderId);
    
    // Delete all order items
    for (const item of orderItems) {
      await storage.deleteOrderItem(item.id);
    }
    
    // Update order total
    await updateOrderTotal(orderId);
    
    return { success: true };
  } catch (error) {
    log(`Error clearing order: ${error}`, 'order-service-error');
    throw new Error(`Failed to clear order: ${error}`);
  }
}

export async function updateOrderTotal(orderId: number) {
  try {
    // Get all order items
    const orderItems = await storage.getOrderItemsByOrderId(orderId);
    
    // Calculate total
    let total = 0;
    for (const item of orderItems) {
      total += parseFloat(item.price.toString()) * item.quantity;
    }
    
    // Get order to check if delivery fee should be added
    const order = await storage.getOrderById(orderId);
    
    if (order?.isDelivery) {
      // Add delivery fee
      const deliveryFee = parseFloat(order.deliveryFee?.toString() || "0");
      total += deliveryFee;
    }
    
    // Update order total
    await storage.updateOrder(orderId, {
      totalAmount: total.toString()
    });
    
    return { success: true, total };
  } catch (error) {
    log(`Error updating order total: ${error}`, 'order-service-error');
    throw new Error(`Failed to update order total: ${error}`);
  }
}

export async function getOrderSummary(orderId: number) {
  try {
    const order = await storage.getOrderById(orderId);
    
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }
    
    return {
      success: true,
      order
    };
  } catch (error) {
    log(`Error getting order summary: ${error}`, 'order-service-error');
    throw new Error(`Failed to get order summary: ${error}`);
  }
}

export async function updateOrderStatus(orderId: number, status: string) {
  try {
    const order = await storage.getOrderById(orderId);
    
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }
    
    const updatedOrder = await storage.updateOrder(orderId, {
      status
    });
    
    return {
      success: true,
      order: updatedOrder
    };
  } catch (error) {
    log(`Error updating order status: ${error}`, 'order-service-error');
    throw new Error(`Failed to update order status: ${error}`);
  }
}

export async function getRecentOrders(limit: number = 10) {
  try {
    const orders = await storage.getAllOrders(undefined, limit);
    
    return {
      success: true,
      orders
    };
  } catch (error) {
    log(`Error getting recent orders: ${error}`, 'order-service-error');
    throw new Error(`Failed to get recent orders: ${error}`);
  }
}

export async function getOrdersByStatus(status: string, limit: number = 100) {
  try {
    const orders = await storage.getAllOrders(status, limit);
    
    return {
      success: true,
      orders
    };
  } catch (error) {
    log(`Error getting orders by status: ${error}`, 'order-service-error');
    throw new Error(`Failed to get orders by status: ${error}`);
  }
}
