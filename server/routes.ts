import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initBot } from "./telegram/bot";
import { initInstagramBot, processInstagramWebhook, verifyWebhook } from "./instagram/bot";
import { getRecentOrders, getOrdersByStatus, updateOrderStatus } from "./services/order";
import { initFlowConnection, verifyFlowAddress, getCustomerLoyaltyPoints, flowToUSD, usdToFlow } from "./blockchain/flow/flow";
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

  // Flow test endpoint
  app.post("/api/flow/test-minimal", async (req, res) => {
    try {
      const { testMinimalFlowTransaction } = await import('./services/flow-minimal-test');
      await testMinimalFlowTransaction();
      res.json({ success: true, message: "Flow transaction test completed - check logs" });
    } catch (error) {
      log(`Flow test error: ${error}`, 'flow-error');
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Flow AI agent authorization endpoints
  app.post("/api/flow/authorize-agent", async (req, res) => {
    try {
      const { userAddress, spendingLimit, durationHours } = req.body;
      
      if (!userAddress || !spendingLimit) {
        return res.status(400).json({ error: "User address and spending limit are required" });
      }

      const { authorizeAgentSpending } = await import('./blockchain/flow/flow');
      const authTxId = await authorizeAgentSpending(userAddress, spendingLimit, durationHours || 24);
      
      if (authTxId) {
        res.json({ 
          success: true, 
          authorizationId: authTxId,
          spendingLimit,
          durationHours: durationHours || 24,
          message: `AI agent authorized to spend up to ${spendingLimit} FLOW from your wallet`
        });
      } else {
        res.status(500).json({ error: "Failed to authorize agent spending" });
      }
    } catch (error) {
      log(`Error authorizing agent spending: ${error}`, "flow-error");
      res.status(500).json({ error: "Failed to authorize agent spending" });
    }
  });

  app.post("/api/flow/revoke-agent", async (req, res) => {
    try {
      const { userAddress } = req.body;
      
      if (!userAddress) {
        return res.status(400).json({ error: "User address is required" });
      }

      const { revokeAgentAuthorization } = await import('./blockchain/flow/flow');
      const success = await revokeAgentAuthorization(userAddress);
      
      if (success) {
        res.json({ 
          success: true,
          message: "AI agent spending authorization revoked"
        });
      } else {
        res.status(500).json({ error: "Failed to revoke agent authorization" });
      }
    } catch (error) {
      log(`Error revoking agent authorization: ${error}`, "flow-error");
      res.status(500).json({ error: "Failed to revoke agent authorization" });
    }
  });

  app.post("/api/flow/agent-payment", async (req, res) => {
    try {
      const { userAddress, amount, orderId } = req.body;
      
      if (!userAddress || !amount || !orderId) {
        return res.status(400).json({ error: "User address, amount, and order ID are required" });
      }

      const { processAuthorizedAgentPayment } = await import('./blockchain/flow/flow');
      const paymentTxId = await processAuthorizedAgentPayment(userAddress, amount, orderId);
      
      if (paymentTxId) {
        res.json({ 
          success: true,
          transactionId: paymentTxId,
          amount,
          message: `Payment of ${amount} FLOW processed automatically`
        });
      } else {
        res.status(400).json({ error: "Agent not authorized or payment failed" });
      }
    } catch (error) {
      log(`Error processing agent payment: ${error}`, "flow-error");
      res.status(500).json({ error: "Failed to process agent payment" });
    }
  });

  // PYUSD payment endpoints
  app.post("/api/pyusd/process-payment", async (req, res) => {
    try {
      const { userAddress, amount, orderId } = req.body;
      
      if (!userAddress || !amount || !orderId) {
        return res.status(400).json({ error: "User address, amount, and order ID are required" });
      }

      const { processPyusdPayment, createPyusdOrder, awardPyusdLoyalty } = await import('./services/pyusd');
      
      // Process PYUSD payment
      const paymentTxId = await processPyusdPayment(amount, userAddress, orderId);
      
      if (paymentTxId) {
        // Create order record
        const orderTxId = await createPyusdOrder({
          orderId,
          customerAddress: userAddress,
          items: [],
          totalAmount: amount
        });
        
        // Award loyalty rewards (1% in PYUSD)
        const loyaltyAmount = amount * 0.01;
        await awardPyusdLoyalty(userAddress, loyaltyAmount, orderId);
        
        res.json({ 
          success: true,
          paymentTxId,
          orderTxId,
          amount,
          loyaltyReward: loyaltyAmount,
          message: `Payment of ${amount} PYUSD processed successfully`
        });
      } else {
        res.status(500).json({ error: "Failed to process PYUSD payment" });
      }
    } catch (error) {
      log(`Error processing PYUSD payment: ${error}`, "pyusd-error");
      res.status(500).json({ error: "Failed to process PYUSD payment" });
    }
  });

  app.get("/api/pyusd/balance/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      const { verifyPyusdAddress, getPyusdBalance } = await import('./services/pyusd');
      
      const isValidAddress = await verifyPyusdAddress(address);
      if (!isValidAddress) {
        return res.status(400).json({ error: "Invalid PYUSD wallet address" });
      }
      
      const balance = await getPyusdBalance(address);
      
      res.json({ 
        address,
        balance,
        currency: "PYUSD"
      });
    } catch (error) {
      log(`Error getting PYUSD balance: ${error}`, "pyusd-error");
      res.status(500).json({ error: "Failed to get PYUSD balance" });
    }
  });

  app.get("/api/pyusd/transactions/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      const { verifyPyusdAddress, getPyusdTransactions } = await import('./services/pyusd');
      
      const isValidAddress = await verifyPyusdAddress(address);
      if (!isValidAddress) {
        return res.status(400).json({ error: "Invalid PYUSD wallet address" });
      }
      
      const transactions = await getPyusdTransactions(address);
      
      res.json({ 
        address,
        transactions
      });
    } catch (error) {
      log(`Error getting PYUSD transactions: ${error}`, "pyusd-error");
      res.status(500).json({ error: "Failed to get PYUSD transactions" });
    }
  });

  // Flow wallet browser extension connection endpoint
  app.get("/api/flow/connect", async (req, res) => {
    try {
      const { session, telegram_id, chat_id } = req.query;
      
      if (!session || !telegram_id || !chat_id) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Create HTML page for Flow wallet connection
      const walletConnectionPage = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Connect Flow Wallet - Boustan</title>
          <script src="https://cdn.jsdelivr.net/npm/@onflow/fcl@1.4.0/dist/fcl.min.js"></script>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
            }
            .container {
              background: rgba(255, 255, 255, 0.1);
              padding: 30px;
              border-radius: 20px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
            .logo { font-size: 2.5em; margin-bottom: 20px; }
            button { 
              background: #00d4aa; 
              color: white; 
              border: none; 
              padding: 15px 30px; 
              font-size: 18px; 
              border-radius: 10px; 
              cursor: pointer;
              margin: 10px;
              transition: all 0.3s ease;
            }
            button:hover { 
              background: #00b894; 
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(0, 212, 170, 0.4);
            }
            button:disabled { 
              background: #ccc; 
              cursor: not-allowed; 
              transform: none;
              box-shadow: none;
            }
            .status { 
              margin: 20px 0; 
              padding: 15px; 
              border-radius: 10px; 
              font-weight: bold;
            }
            .success { background: rgba(0, 255, 0, 0.2); }
            .error { background: rgba(255, 0, 0, 0.2); }
            .info { background: rgba(0, 212, 170, 0.2); }
            .wallet-info {
              background: rgba(255, 255, 255, 0.1);
              padding: 15px;
              border-radius: 10px;
              margin: 20px 0;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🌊 Flow Wallet Connection</div>
            <h2>Connect Your Flow Wallet to Complete Payment</h2>
            <p>Session: ${session}</p>
            
            <div id="status" class="status info">Ready to connect your Flow wallet</div>
            
            <button id="connectBtn" onclick="connectWallet()">
              Connect Flow Wallet
            </button>
            
            <div id="walletInfo" class="wallet-info" style="display: none;">
              <strong>Connected Wallet:</strong>
              <div id="walletAddress"></div>
            </div>
            
            <button id="confirmBtn" onclick="confirmPayment()" style="display: none;">
              Confirm Payment
            </button>
            
            <div style="margin-top: 30px;">
              <p><small>This will open your Flow wallet browser extension</small></p>
              <p><small>Make sure you have a Flow wallet extension installed</small></p>
            </div>
          </div>

          <script>
            // Configure FCL for testnet
            fcl.config({
              "accessNode.api": "https://rest-testnet.onflow.org",
              "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn"
            });

            let userAddress = null;

            async function connectWallet() {
              try {
                document.getElementById('status').textContent = 'Connecting to Flow wallet...';
                document.getElementById('status').className = 'status info';
                document.getElementById('connectBtn').disabled = true;

                // Authenticate with Flow wallet
                const user = await fcl.authenticate();
                
                if (user && user.addr) {
                  userAddress = user.addr;
                  document.getElementById('status').textContent = 'Wallet connected successfully!';
                  document.getElementById('status').className = 'status success';
                  document.getElementById('walletAddress').textContent = userAddress;
                  document.getElementById('walletInfo').style.display = 'block';
                  document.getElementById('confirmBtn').style.display = 'inline-block';
                  document.getElementById('connectBtn').style.display = 'none';
                } else {
                  throw new Error('Failed to get wallet address');
                }
              } catch (error) {
                console.error('Wallet connection error:', error);
                document.getElementById('status').textContent = 'Failed to connect wallet: ' + error.message;
                document.getElementById('status').className = 'status error';
                document.getElementById('connectBtn').disabled = false;
              }
            }

            async function confirmPayment() {
              if (!userAddress) {
                alert('Please connect your wallet first');
                return;
              }

              try {
                document.getElementById('status').textContent = 'Confirming payment...';
                document.getElementById('status').className = 'status info';
                document.getElementById('confirmBtn').disabled = true;

                // Send wallet address back to Telegram bot
                const response = await fetch('/api/flow/wallet-connected', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    session: '${session}',
                    telegram_id: '${telegram_id}',
                    chat_id: '${chat_id}',
                    wallet_address: userAddress
                  })
                });

                if (response.ok) {
                  document.getElementById('status').textContent = 'Payment confirmed! You can close this window and return to Telegram.';
                  document.getElementById('status').className = 'status success';
                  
                  // Auto-close after 3 seconds
                  setTimeout(() => {
                    window.close();
                  }, 3000);
                } else {
                  throw new Error('Failed to confirm payment');
                }
              } catch (error) {
                console.error('Payment confirmation error:', error);
                document.getElementById('status').textContent = 'Failed to confirm payment: ' + error.message;
                document.getElementById('status').className = 'status error';
                document.getElementById('confirmBtn').disabled = false;
              }
            }

            // Auto-connect if wallet is already authenticated
            window.addEventListener('load', async () => {
              try {
                const user = await fcl.currentUser.snapshot();
                if (user && user.loggedIn && user.addr) {
                  userAddress = user.addr;
                  document.getElementById('status').textContent = 'Wallet already connected!';
                  document.getElementById('status').className = 'status success';
                  document.getElementById('walletAddress').textContent = userAddress;
                  document.getElementById('walletInfo').style.display = 'block';
                  document.getElementById('confirmBtn').style.display = 'inline-block';
                  document.getElementById('connectBtn').style.display = 'none';
                }
              } catch (error) {
                console.log('No existing wallet connection');
              }
            });
          </script>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(walletConnectionPage);

    } catch (error) {
      log(`Error serving wallet connection page: ${error}`, "flow-error");
      res.status(500).json({ error: "Failed to load wallet connection page" });
    }
  });

  // Endpoint to handle wallet connection confirmation from browser
  app.post("/api/flow/wallet-connected", async (req, res) => {
    try {
      const { session, telegram_id, chat_id, wallet_address } = req.body;
      
      if (!session || !telegram_id || !chat_id || !wallet_address) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      // Verify the wallet address format
      const { verifyFlowAddress } = await import('./blockchain/flow/flow');
      const isValidAddress = await verifyFlowAddress(wallet_address);
      
      if (!isValidAddress) {
        return res.status(400).json({ error: "Invalid Flow wallet address" });
      }

      // Get the Telegram bot instance
      const { getBot } = await import('./telegram/bot');
      const bot = getBot();

      // Send confirmation message to Telegram
      await bot.sendMessage(
        parseInt(chat_id),
        `✅ *Wallet Connected Successfully!*\n\n` +
        `🌊 **Address:** ${wallet_address.slice(0, 8)}...${wallet_address.slice(-6)}\n\n` +
        `Your Flow wallet is now connected and ready for payment. Processing your order...`,
        { parse_mode: 'Markdown' }
      );

      // Get user and conversation data
      const telegramUser = await storage.getTelegramUserByTelegramId(telegram_id);
      if (telegramUser) {
        const conversation = await storage.getConversationByTelegramUserId(telegramUser.id);
        
        if (conversation) {
          // Update conversation context with wallet address
          await storage.updateConversation(conversation.id, {
            context: {
              ...(conversation.context || {}),
              walletAddress: wallet_address,
              paymentMethod: 'flow'
            }
          });
        }
      }

      res.json({ success: true, message: "Wallet connected successfully" });

    } catch (error) {
      log(`Error processing wallet connection: ${error}`, "flow-error");
      res.status(500).json({ error: "Failed to process wallet connection" });
    }
  });

  // BPTS Loyalty Token endpoints
  app.get('/api/loyalty/balance/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const { getLoyaltyBalance, validateFlowAddress } = await import('./services/flow-loyalty-token');
      
      if (!validateFlowAddress(address)) {
        return res.status(400).json({ error: 'Invalid Flow address format' });
      }
      
      const balance = await getLoyaltyBalance(address);
      res.json({ address, balance, token: 'BPTS' });
    } catch (error: any) {
      log(`Error getting BPTS balance: ${error.message}`, 'api-error');
      res.status(500).json({ error: 'Failed to get BPTS balance' });
    }
  });

  app.get('/api/loyalty/transactions/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const { getLoyaltyTransactionHistory, validateFlowAddress } = await import('./services/flow-loyalty-token');
      
      if (!validateFlowAddress(address)) {
        return res.status(400).json({ error: 'Invalid Flow address format' });
      }
      
      const transactions = await getLoyaltyTransactionHistory(address);
      res.json({ address, transactions });
    } catch (error: any) {
      log(`Error getting BPTS transactions: ${error.message}`, 'api-error');
      res.status(500).json({ error: 'Failed to get BPTS transactions' });
    }
  });

  app.get('/api/loyalty/info', async (req, res) => {
    try {
      const { getLoyaltyTokenInfo } = await import('./services/flow-loyalty-token');
      const tokenInfo = getLoyaltyTokenInfo();
      res.json(tokenInfo);
    } catch (error: any) {
      log(`Error getting BPTS info: ${error.message}`, 'api-error');
      res.status(500).json({ error: 'Failed to get BPTS info' });
    }
  });

  app.post('/api/loyalty/transfer', async (req, res) => {
    try {
      const { fromAddress, toAddress, amount } = req.body;
      const { transferLoyaltyTokens, validateFlowAddress } = await import('./services/flow-loyalty-token');
      
      if (!validateFlowAddress(fromAddress) || !validateFlowAddress(toAddress)) {
        return res.status(400).json({ error: 'Invalid Flow address format' });
      }
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      const txHash = await transferLoyaltyTokens(fromAddress, toAddress, amount);
      res.json({ success: true, txHash, amount, fromAddress, toAddress });
    } catch (error: any) {
      log(`Error transferring BPTS: ${error.message}`, 'api-error');
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/loyalty/redeem', async (req, res) => {
    try {
      const { userAddress, amount, rewardDescription } = req.body;
      const { redeemLoyaltyTokens, validateFlowAddress } = await import('./services/flow-loyalty-token');
      
      if (!validateFlowAddress(userAddress)) {
        return res.status(400).json({ error: 'Invalid Flow address format' });
      }
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      if (!rewardDescription) {
        return res.status(400).json({ error: 'Reward description is required' });
      }
      
      const txHash = await redeemLoyaltyTokens(userAddress, amount, rewardDescription);
      res.json({ success: true, txHash, amount, rewardDescription });
    } catch (error: any) {
      log(`Error redeeming BPTS: ${error.message}`, 'api-error');
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  // Initialize bots and Flow connection
  initBot();
  initInstagramBot();
  initFlowConnection();

  return httpServer;
}
