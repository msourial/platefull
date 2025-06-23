import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initBot } from "./telegram/bot";
import { initInstagramBot, processInstagramWebhook, verifyWebhook } from "./instagram/bot";
import { getRecentOrders, getOrdersByStatus, updateOrderStatus } from "./services/order";
import { initFlowConnection, verifyFlowAddress, getCustomerLoyaltyPoints, flowToUSD, usdToFlow } from "./services/flow";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize the Telegram bot when the server starts
  initBot();
  
  // Initialize the Instagram bot
  initInstagramBot();
  
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
  
  // Instagram webhook verification endpoint
  app.get('/api/instagram/webhook', (req, res) => {
    try {
      // Get the query parameters sent by Instagram
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;
      
      // Verify the webhook subscription
      const result = verifyWebhook(mode, token, challenge);
      
      if (result.success) {
        // If verification succeeds, return the challenge
        log('Instagram webhook verification successful', 'instagram');
        return res.status(200).send(result.challenge);
      } else {
        // If verification fails, return 403 Forbidden
        log('Instagram webhook verification failed', 'instagram-error');
        return res.sendStatus(403);
      }
    } catch (error) {
      log(`Error verifying Instagram webhook: ${error}`, 'instagram-error');
      return res.sendStatus(500);
    }
  });
  
  // Instagram webhook endpoint to receive messages
  app.post('/api/instagram/webhook', async (req, res) => {
    try {
      // Process the webhook event
      await processInstagramWebhook(req.body);
      
      // Always return a 200 OK to acknowledge receipt
      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      log(`Error processing Instagram webhook: ${error}`, 'instagram-error');
      
      // Still return 200 even on error to prevent Instagram from retrying
      return res.status(200).send('EVENT_RECEIVED');
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

  // Flow blockchain API routes
  app.post("/api/flow/verify-address", async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }
      
      const isValid = await verifyFlowAddress(address);
      res.json({ valid: isValid, address });
    } catch (error) {
      log(`Error verifying Flow address: ${error}`, "flow-error");
      res.status(500).json({ error: "Failed to verify address" });
    }
  });

  app.get("/api/flow/loyalty/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }
      
      const loyaltyData = await getCustomerLoyaltyPoints(address);
      
      if (!loyaltyData) {
        return res.status(404).json({ error: "No loyalty data found" });
      }
      
      res.json(loyaltyData);
    } catch (error) {
      log(`Error getting loyalty points: ${error}`, "flow-error");
      res.status(500).json({ error: "Failed to get loyalty points" });
    }
  });

  app.post("/api/flow/convert", async (req, res) => {
    try {
      const { amount, from, to } = req.body;
      
      if (!amount || !from || !to) {
        return res.status(400).json({ error: "Amount, from, and to currencies are required" });
      }
      
      let converted;
      if (from === "USD" && to === "FLOW") {
        converted = usdToFlow(amount);
      } else if (from === "FLOW" && to === "USD") {
        converted = flowToUSD(amount);
      } else {
        return res.status(400).json({ error: "Unsupported currency conversion" });
      }
      
      res.json({ 
        original: amount, 
        converted, 
        from, 
        to,
        rate: from === "USD" ? 1/0.75 : 0.75
      });
    } catch (error) {
      log(`Error converting currency: ${error}`, "flow-error");
      res.status(500).json({ error: "Failed to convert currency" });
    }
  });

  const httpServer = createServer(app);

  // Initialize bots and Flow connection
  initBot();
  initInstagramBot();
  initFlowConnection();

  return httpServer;
}
