import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initBot } from "./telegram/bot";
import { initInstagramBot, processInstagramWebhook, verifyWebhook } from "./instagram/bot";
import { getRecentOrders, getOrdersByStatus, updateOrderStatus } from "./services/order";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize the Telegram bot when the server starts
  initBot();
  
  // Get all menu categories
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      return res.status(200).json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Get menu items (optionally by category)
  app.get('/api/menu-items', async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const menuItems = await storage.getMenuItems(categoryId);
      return res.status(200).json(menuItems);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      return res.status(500).json({ error: 'Failed to fetch menu items' });
    }
  });

  // Get a specific menu item
  app.get('/api/menu-items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const menuItem = await storage.getMenuItemById(id);
      
      if (!menuItem) {
        return res.status(404).json({ error: 'Menu item not found' });
      }
      
      return res.status(200).json(menuItem);
    } catch (error) {
      console.error('Error fetching menu item:', error);
      return res.status(500).json({ error: 'Failed to fetch menu item' });
    }
  });

  // Get all orders (admin only)
  app.get('/api/orders', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const result = status ? await getOrdersByStatus(status) : await getRecentOrders();
      return res.status(200).json(result.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // Get a specific order
  app.get('/api/orders/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrderById(id);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      return res.status(200).json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      return res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  // Update order status (admin only)
  app.patch('/api/orders/:id/status', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      const result = await updateOrderStatus(id, status);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error updating order status:', error);
      return res.status(500).json({ error: 'Failed to update order status' });
    }
  });
  
  // Order stats for dashboard
  app.get('/api/stats', async (req, res) => {
    try {
      const [
        pendingOrders,
        confirmedOrders,
        deliveringOrders,
        completedOrders
      ] = await Promise.all([
        storage.getAllOrders('pending'),
        storage.getAllOrders('confirmed'),
        storage.getAllOrders('delivering'),
        storage.getAllOrders('completed', 100)
      ]);
      
      const totalRevenue = completedOrders.reduce((sum, order) => {
        return sum + parseFloat(order.totalAmount.toString());
      }, 0);
      
      const stats = {
        pendingCount: pendingOrders.length,
        confirmedCount: confirmedOrders.length,
        deliveringCount: deliveringOrders.length,
        completedCount: completedOrders.length,
        totalRevenue: totalRevenue.toFixed(2),
        recentOrders: completedOrders.slice(0, 10)
      };
      
      return res.status(200).json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
