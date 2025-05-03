import { storage } from "../storage";

export async function getOrderItemById(orderItemId: number) {
  try {
    // Fetch all order items for the given order
    const allOrderItems = await storage.getOrderItemsByOrderId(orderItemId);
    
    // Find the specific order item
    const orderItem = allOrderItems.find(item => item.id === orderItemId);
    
    if (!orderItem) {
      throw new Error(`Order item with ID ${orderItemId} not found`);
    }
    
    return orderItem;
  } catch (error) {
    console.error(`Error getting order item: ${error}`);
    throw new Error(`Failed to get order item: ${error}`);
  }
}
