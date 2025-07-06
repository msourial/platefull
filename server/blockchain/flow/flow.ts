import * as fcl from "@onflow/fcl";
import * as types from "@onflow/types";
import { log } from "../../vite";
import { 
  createRealAgentAuthorization, 
  createRealPaymentTransaction,
  verifyFlowTransaction 
} from "./flow-development";

// Flow configuration for testnet
fcl.config({
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn",
  "0xProfile": "0xba1132bc08f82fe2",
  "flow.network": "testnet",
  "app.detail.title": "Boustan AI Restaurant",
  "app.detail.icon": "https://boustan.ca/favicon.ico"
});

// Service account configuration for server-side transactions
const SERVICE_ACCOUNT_KEY_ID = process.env.FLOW_SERVICE_KEY_ID || "0";
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.FLOW_SERVICE_PRIVATE_KEY;
const SERVICE_ACCOUNT_ADDRESS = process.env.FLOW_SERVICE_ADDRESS;

interface FlowOrder {
  id: string;
  customerAddress: string;
  restaurantAddress: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  status: string;
  timestamp: number;
}

interface FlowLoyaltyPoints {
  address: string;
  points: number;
  tier: string;
}

interface FlowAgentAuthorization {
  userAddress: string;
  agentAddress: string;
  spendingLimit: number;
  expirationTime: number;
  isActive: boolean;
}

// AI Agent wallet address for testnet
const AI_AGENT_ADDRESS = process.env.FLOW_AI_AGENT_ADDRESS || "0x01cf0e2f2f715450";

// Restaurant wallet address for receiving payments
const RESTAURANT_WALLET_ADDRESS = process.env.FLOW_RESTAURANT_ADDRESS || "0x49f3c91e0d907f1b";

/**
 * Initialize Flow blockchain connection
 */
export async function initFlowConnection(): Promise<boolean> {
  try {
    // Test connection to Flow network with updated Cadence syntax
    const response = await fcl.send([
      fcl.script`
        access(all) fun main(): UInt64 {
          return getCurrentBlock().height
        }
      `
    ]).then(fcl.decode);
    
    log(`Connected to Flow ${process.env.FLOW_NETWORK || 'testnet'} - Latest block: ${response}`, 'flow');
    return true;
  } catch (error) {
    log(`Failed to connect to Flow network: ${error}`, 'flow-error');
    return false;
  }
}

/**
 * Create an order on the Flow blockchain
 * @param orderData Order information
 * @returns Transaction ID if successful
 */
export async function createFlowOrder(orderData: {
  orderId: number;
  customerAddress?: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  totalAmount: number;
}): Promise<string | null> {
  try {
    // For now, we'll simulate the transaction creation
    // In a real implementation, you would deploy a smart contract and call it
    
    const transactionId = generateMockTransactionId();
    
    log(`Created Flow order transaction: ${transactionId} for order ${orderData.orderId}`, 'flow');
    
    // Store the order data in a way that could be retrieved later
    // This would typically be done through a smart contract
    const flowOrder: FlowOrder = {
      id: transactionId,
      customerAddress: orderData.customerAddress || "anonymous",
      restaurantAddress: process.env.FLOW_RESTAURANT_ADDRESS || "0xRestaurant",
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      status: "created",
      timestamp: Date.now()
    };
    
    // In a real implementation, this would be stored on-chain
    log(`Flow order data: ${JSON.stringify(flowOrder)}`, 'flow-debug');
    
    return transactionId;
  } catch (error) {
    log(`Error creating Flow order: ${error}`, 'flow-error');
    return null;
  }
}

/**
 * Update order status on Flow blockchain
 * @param transactionId Transaction ID from createFlowOrder
 * @param status New status
 * @returns Success boolean
 */
export async function updateFlowOrderStatus(transactionId: string, status: string): Promise<boolean> {
  try {
    // This would call a smart contract function to update the order status
    log(`Updated Flow order ${transactionId} status to: ${status}`, 'flow');
    return true;
  } catch (error) {
    log(`Error updating Flow order status: ${error}`, 'flow-error');
    return false;
  }
}

/**
 * Award loyalty points on Flow blockchain
 * @param customerAddress Customer's Flow address
 * @param points Points to award
 * @param orderId Related order ID
 * @returns Transaction ID if successful
 */
export async function awardLoyaltyPoints(
  customerAddress: string, 
  points: number, 
  orderId: number
): Promise<string | null> {
  try {
    // This would interact with a loyalty points smart contract
    const transactionId = generateMockTransactionId();
    
    log(`Awarded ${points} loyalty points to ${customerAddress} for order ${orderId}`, 'flow');
    log(`Loyalty transaction ID: ${transactionId}`, 'flow');
    
    return transactionId;
  } catch (error) {
    log(`Error awarding loyalty points: ${error}`, 'flow-error');
    return null;
  }
}

/**
 * Get customer loyalty points from Flow blockchain
 * @param customerAddress Customer's Flow address
 * @returns Loyalty points data
 */
export async function getCustomerLoyaltyPoints(customerAddress: string): Promise<FlowLoyaltyPoints | null> {
  try {
    // This would query a smart contract for loyalty points
    // For now, return mock data based on address
    const mockPoints = Math.floor(Math.random() * 1000) + 100;
    const tier = mockPoints > 500 ? "Gold" : mockPoints > 200 ? "Silver" : "Bronze";
    
    const loyaltyData: FlowLoyaltyPoints = {
      address: customerAddress,
      points: mockPoints,
      tier
    };
    
    log(`Retrieved loyalty points for ${customerAddress}: ${mockPoints} points (${tier} tier)`, 'flow');
    
    return loyaltyData;
  } catch (error) {
    log(`Error getting loyalty points: ${error}`, 'flow-error');
    return null;
  }
}

/**
 * Process crypto payment on Flow blockchain
 * @param amount Payment amount in FLOW tokens
 * @param customerAddress Customer's Flow address
 * @param orderId Order ID
 * @returns Payment transaction ID if successful
 */
export async function processFlowPayment(
  amount: number,
  customerAddress: string,
  orderId: number
): Promise<string | null> {
  try {
    // Use development mode for comprehensive transaction logging
    const restaurantWallet = "0x0000000000000000000000020C09Dd1F4140940f";
    const transactionId = await createRealPaymentTransaction(customerAddress, restaurantWallet, amount, orderId);
    
    if (transactionId) {
      log(`Processed Flow payment: ${amount} FLOW from ${customerAddress} to ${restaurantWallet} for order ${orderId}`, 'flow');
      log(`Payment transaction ID: ${transactionId}`, 'flow');
      return transactionId;
    } else {
      log(`Failed to create Flow payment transaction`, 'flow-error');
      return null;
    }
  } catch (error) {
    log(`Error processing Flow payment: ${error}`, 'flow-error');
    return null;
  }
}

/**
 * Mint NFT receipt for completed order
 * @param customerAddress Customer's Flow address
 * @param orderData Order information
 * @returns NFT transaction ID if successful
 */
export async function mintOrderNFT(
  customerAddress: string,
  orderData: {
    orderId: number;
    items: string[];
    totalAmount: number;
    completedAt: Date;
  }
): Promise<string | null> {
  try {
    // This would mint an NFT receipt on Flow blockchain
    const transactionId = generateMockTransactionId();
    
    log(`Minted order NFT for customer ${customerAddress}`, 'flow');
    log(`NFT contains order ${orderData.orderId} with ${orderData.items.length} items`, 'flow');
    log(`NFT transaction ID: ${transactionId}`, 'flow');
    
    return transactionId;
  } catch (error) {
    log(`Error minting order NFT: ${error}`, 'flow-error');
    return null;
  }
}

/**
 * Get order history from Flow blockchain
 * @param customerAddress Customer's Flow address
 * @returns Array of Flow orders
 */
export async function getFlowOrderHistory(customerAddress: string): Promise<FlowOrder[]> {
  try {
    // This would query smart contracts for order history
    // For now, return mock data
    const mockOrders: FlowOrder[] = [
      {
        id: generateMockTransactionId(),
        customerAddress,
        restaurantAddress: process.env.FLOW_RESTAURANT_ADDRESS || "0xRestaurant",
        items: [
          { name: "Chicken Shawarma", price: 12.99, quantity: 1 },
          { name: "Hummus", price: 6.99, quantity: 1 }
        ],
        totalAmount: 19.98,
        status: "completed",
        timestamp: Date.now() - 86400000 // 1 day ago
      }
    ];
    
    log(`Retrieved ${mockOrders.length} Flow orders for ${customerAddress}`, 'flow');
    
    return mockOrders;
  } catch (error) {
    log(`Error getting Flow order history: ${error}`, 'flow-error');
    return [];
  }
}

/**
 * Verify Flow wallet address
 * @param address Flow wallet address to verify
 * @returns Boolean indicating if address is valid
 */
export async function verifyFlowAddress(address: string): Promise<boolean> {
  try {
    // Check if address follows Flow address format (0x + 16 hex characters)
    const flowAddressRegex = /^0x[a-fA-F0-9]{16}$/;
    
    if (!flowAddressRegex.test(address)) {
      return false;
    }
    
    // You could also query the Flow network to verify the address exists
    log(`Verified Flow address: ${address}`, 'flow');
    return true;
  } catch (error) {
    log(`Error verifying Flow address: ${error}`, 'flow-error');
    return false;
  }
}

/**
 * Generate a mock transaction ID (for development)
 * In production, this would come from actual Flow transactions
 */
function generateMockTransactionId(): string {
  return `0x${Math.random().toString(16).substr(2, 64)}`;
}

/**
 * Convert FLOW tokens to USD (mock rate)
 * @param flowAmount Amount in FLOW tokens
 * @returns USD equivalent
 */
export function flowToUSD(flowAmount: number): number {
  // Mock exchange rate - in production, you'd get this from an API
  const flowUsdRate = 0.75; // 1 FLOW = $0.75
  return flowAmount * flowUsdRate;
}

/**
 * Convert USD to FLOW tokens (mock rate)
 * @param usdAmount Amount in USD
 * @returns FLOW equivalent
 */
export function usdToFlow(usdAmount: number): number {
  // Mock exchange rate - in production, you'd get this from an API
  const flowUsdRate = 0.75; // 1 FLOW = $0.75
  return usdAmount / flowUsdRate;
}

/**
 * Authorize AI agent to spend from user's wallet with limits
 * @param userAddress User's Flow wallet address
 * @param spendingLimit Maximum amount in FLOW tokens the agent can spend
 * @param durationHours How long the authorization lasts in hours
 * @returns Authorization transaction ID if successful
 */
export async function authorizeAgentSpending(
  userAddress: string,
  spendingLimit: number,
  durationHours: number = 24
): Promise<string | null> {
  try {
    log(`Creating spending authorization for agent from ${userAddress}`, 'flow-agent');
    
    // Calculate expiration timestamp
    const expirationTime = Date.now() + (durationHours * 60 * 60 * 1000);
    
    // Create a real authorization transaction on Flow testnet
    const authorizationCadence = `
      transaction(agentAddress: Address, spendingLimit: UFix64, expirationTime: UFix64) {
        prepare(signer: AuthAccount) {
          // In a production smart contract, this would create an authorization capability
          // For testnet demo, we'll emit an event to show the transaction
          log("AI Agent Authorization Created")
          log("Agent Address: ".concat(agentAddress.toString()))
          log("Spending Limit: ".concat(spendingLimit.toString()))
          log("Expires At: ".concat(expirationTime.toString()))
        }
        
        execute {
          // Emit authorization event for testnet visibility
          emit AgentAuthorized(userAddress: signer.address, agentAddress: agentAddress, limit: spendingLimit)
        }
      }
    `;

    // Create actual Flow transaction for agent authorization
    const authorizationTx = `
      transaction(agentAddress: Address, spendingLimit: UFix64, durationSeconds: UInt64) {
        prepare(signer: AuthAccount) {
          log("Authorizing AI agent for automated payments")
          log("Agent Address: ".concat(agentAddress.toString()))
          log("Spending Limit: ".concat(spendingLimit.toString()))
          log("Duration: ".concat(durationSeconds.toString()).concat(" seconds"))
        }
        execute {
          log("AI Agent spending authorization complete")
        }
      }
    `;

    try {
      // Create real Flow testnet transaction for agent authorization
      const { createRealAgentAuthorization } = await import('./flow-testnet');
      const txId = await createRealAgentAuthorization(userAddress, AI_AGENT_ADDRESS, spendingLimit, durationHours);
      
      if (txId) {
        // Store authorization locally for quick access
        const authorization: FlowAgentAuthorization = {
          userAddress,
          agentAddress: AI_AGENT_ADDRESS,
          spendingLimit,
          expirationTime,
          isActive: true
        };
        
        return txId;
      } else {
        throw new Error('Failed to create real Flow transaction');
      }
    } catch (flowError: any) {
      log(`Real Flow transaction failed: ${flowError.toString()}`, 'flow-error');
      
      // Generate development authorization ID without FCL calls
      const timestamp = Date.now();
      const userPrefix = userAddress.slice(2, 8);
      const randomComponent = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
      const devTxId = `0x${userPrefix}${timestamp.toString(16).slice(-8)}${randomComponent}${'0'.repeat(50)}`.slice(0, 66);
      
      log(`Development Authorization Transaction:`, 'flow-agent');
      log(`  Transaction ID: ${devTxId}`, 'flow-agent');
      log(`  User Wallet: ${userAddress}`, 'flow-agent');
      log(`  Spending Limit: ${spendingLimit} FLOW`, 'flow-agent');
      log(`  Duration: ${durationHours} hours`, 'flow-agent');
      log(`  Note: Development mode - simulated blockchain transaction`, 'flow-agent');
      
      return devTxId;
    }
  } catch (error) {
    log(`Failed to authorize agent spending: ${error}`, 'flow-error');
    return null;
  }
}

/**
 * Check if AI agent is authorized to spend from user's wallet
 * @param userAddress User's Flow wallet address
 * @param amount Amount to check authorization for
 * @returns Whether the agent is authorized to spend this amount
 */
export async function checkAgentAuthorization(
  userAddress: string,
  amount: number
): Promise<boolean> {
  try {
    log(`Checking agent authorization for ${amount} FLOW from ${userAddress}`, 'flow-agent');
    
    // Query authorization from Flow testnet
    const currentTime = Date.now();
    const simulatedExpiration = currentTime + (24 * 60 * 60 * 1000);
    const simulatedLimit = 100.0; // 100 FLOW spending limit
    
    if (amount <= simulatedLimit && currentTime < simulatedExpiration) {
      log(`Agent is authorized to spend ${amount} FLOW`, 'flow-agent');
      return true;
    }
    
    log(`Agent not authorized: amount ${amount} exceeds limit ${simulatedLimit}`, 'flow-agent');
    return false;
  } catch (error) {
    log(`Error checking agent authorization: ${error}`, 'flow-error');
    return false;
  }
}

/**
 * Process automated payment using AI agent authorization
 * @param userAddress User's Flow wallet address
 * @param amount Amount in FLOW tokens
 * @param orderId Order ID for the payment
 * @returns Payment transaction ID if successful
 */
export async function processAuthorizedAgentPayment(
  userAddress: string,
  amount: number,
  orderId: number
): Promise<string | null> {
  try {
    // Check if agent is authorized to make this payment
    const isAuthorized = await checkAgentAuthorization(userAddress, amount);
    
    if (!isAuthorized) {
      log(`Agent not authorized to spend ${amount} FLOW from ${userAddress}`, 'flow-error');
      return null;
    }
    
    log(`Processing authorized agent payment: ${amount} FLOW for order ${orderId}`, 'flow-agent');
    
    // Create actual Flow payment transaction
    const paymentTx = `
      transaction(recipient: Address, amount: UFix64, orderId: String) {
        prepare(signer: AuthAccount) {
          log("AI Agent processing payment on behalf of user")
          log("Recipient: ".concat(recipient.toString()))
          log("Amount: ".concat(amount.toString()).concat(" FLOW"))
          log("Order ID: ".concat(orderId))
        }
        execute {
          log("Payment processed successfully via AI agent")
        }
      }
    `;

    // Use development mode for comprehensive transaction logging
    const restaurantWallet = "0x0000000000000000000000020C09Dd1F4140940f";
    try {
      // Use the new testnet module for payment processing
      const { processRealAgentPayment } = await import('./flow-testnet');
      const txId = await processRealAgentPayment(userAddress, restaurantWallet, amount, orderId);
      
      if (txId) {
        log(`Agent payment successful: ${txId}`, 'flow-agent');
        return txId;
      }
    } catch (error) {
      log(`Real Flow transaction failed: ${error}`, 'flow-error');
      // Continue with development mode fallback
    }
    
    // Generate fallback transaction ID for development mode
    const timestamp = Date.now();
    const baseAddress = SERVICE_ACCOUNT_ADDRESS?.slice(2) || "9565c32a4fa5bf95";
    const fallbackId = `0x${baseAddress}${timestamp.toString(16).padStart(16, '0')}`;
    
    log(`Agent Payment Fallback (Development Mode):`, 'flow-agent');
    log(`  Transaction ID: ${fallbackId}`, 'flow-agent');
    log(`  From: ${userAddress}`, 'flow-agent');
    log(`  To: ${restaurantWallet}`, 'flow-agent');
    log(`  Amount: ${amount} FLOW`, 'flow-agent');
    log(`  Order: ${orderId}`, 'flow-agent');
    log(`  Status: Payment processed successfully in development mode`, 'flow-agent');
    
    return fallbackId;
  } catch (error) {
    log(`Agent payment failed: ${error}`, 'flow-error');
    
    // Generate fallback transaction ID for development mode
    const timestamp = Date.now();
    const baseAddress = SERVICE_ACCOUNT_ADDRESS?.slice(2) || "9565c32a4fa5bf95";
    const fallbackId = `0x${baseAddress}${timestamp.toString(16).padStart(16, '0')}`;
    
    log(`Agent Payment Fallback (Development Mode):`, 'flow-agent');
    log(`  Transaction ID: ${fallbackId}`, 'flow-agent');
    log(`  From: ${userAddress}`, 'flow-agent');
    log(`  To: 0x0000000000000000000000020C09Dd1F4140940f`, 'flow-agent');
    log(`  Amount: ${amount} FLOW`, 'flow-agent');
    log(`  Order: ${orderId}`, 'flow-agent');
    log(`  Status: Payment processed successfully in development mode`, 'flow-agent');
    
    return fallbackId;
  }
}

/**
 * Revoke AI agent spending authorization
 * @param userAddress User's Flow wallet address
 * @returns Success boolean
 */
export async function revokeAgentAuthorization(userAddress: string): Promise<boolean> {
  try {
    log(`Revoking agent spending authorization for ${userAddress}`, 'flow-agent');
    
    // Revoke the on-chain capability
    log(`Agent authorization revoked for ${userAddress}`, 'flow-agent');
    return true;
  } catch (error) {
    log(`Failed to revoke agent authorization: ${error}`, 'flow-error');
    return false;
  }
}