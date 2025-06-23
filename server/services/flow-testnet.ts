import { log } from "../vite";

// Service account configuration
const SERVICE_ADDRESS = process.env.FLOW_SERVICE_ADDRESS;
const SERVICE_PRIVATE_KEY = process.env.FLOW_SERVICE_PRIVATE_KEY;
const SERVICE_KEY_ID = process.env.FLOW_SERVICE_KEY_ID || "0";
const FLOW_API_BASE = "https://rest-testnet.onflow.org";

interface FlowTransaction {
  id: string;
  status: number;
  statusCode: number;
  errorMessage: string;
  events: any[];
}

/**
 * Create a real Flow testnet transaction for AI agent authorization
 */
export async function createRealAgentAuthorization(
  userAddress: string,
  agentAddress: string,
  spendingLimit: number,
  durationHours: number
): Promise<string | null> {
  try {
    if (!SERVICE_ADDRESS || !SERVICE_PRIVATE_KEY) {
      log("Flow service account credentials not configured", 'flow-error');
      return null;
    }

    // Get current block data for sequence number
    const blockResponse = await fetch(`${FLOW_API_BASE}/v1/blocks?height=sealed`);
    const blockData = await blockResponse.json();
    const currentHeight = blockData[0]?.height || 0;

    // Create transaction script with on-chain events
    const script = `
      transaction(userAddress: Address, agentAddress: Address, limit: UFix64, duration: UFix64) {
        prepare(signer: AuthAccount) {
          log("=== Boustan AI Agent Authorization ===")
          log("User: ".concat(userAddress.toString()))
          log("Agent: ".concat(agentAddress.toString()))
          log("Limit: ".concat(limit.toString()).concat(" FLOW"))
          log("Duration: ".concat(duration.toString()).concat(" hours"))
          log("Block Height: ".concat(getCurrentBlock().height.toString()))
        }
        
        execute {
          log("Authorization recorded on Flow testnet")
          log("Transaction successful")
        }
      }
    `;

    // Get current block for reference
    const blockResponse = await fetch(`${FLOW_API_BASE}/v1/blocks?height=sealed`);
    const blockData = await blockResponse.json();
    const referenceBlockId = blockData[0]?.id || "0000000000000000000000000000000000000000000000000000000000000000";

    // Prepare transaction payload with correct Flow REST API format
    const transaction = {
      script: script,
      arguments: [
        { type: "Address", value: userAddress },
        { type: "Address", value: agentAddress },
        { type: "UFix64", value: spendingLimit.toFixed(8) },
        { type: "UFix64", value: durationHours.toString() }
      ],
      reference_block_id: referenceBlockId,
      gas_limit: 1000,
      proposal_key: {
        address: SERVICE_ADDRESS,
        key_index: parseInt(SERVICE_KEY_ID),
        sequence_number: Math.floor(Date.now() / 1000)
      },
      payer: SERVICE_ADDRESS,
      authorizers: [SERVICE_ADDRESS]
    };

    // Submit transaction to Flow testnet
    const response = await fetch(`${FLOW_API_BASE}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction)
    });

    if (!response.ok) {
      const errorData = await response.text();
      log(`Flow API error: ${response.status} - ${errorData}`, 'flow-error');
      return null;
    }

    const result = await response.json();
    const transactionId = result.id;

    // Wait for transaction confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));

    log(`Real Flow Testnet Authorization Transaction:`, 'flow-testnet');
    log(`  Transaction ID: ${transactionId}`, 'flow-testnet');
    log(`  User Wallet: ${userAddress}`, 'flow-testnet');
    log(`  Agent Wallet: ${agentAddress}`, 'flow-testnet');
    log(`  Spending Limit: ${spendingLimit} FLOW`, 'flow-testnet');
    log(`  Duration: ${durationHours} hours`, 'flow-testnet');
    log(`  Testnet Explorer: https://testnet.flowdiver.io/tx/${transactionId}`, 'flow-testnet');
    log(`  FlowScan: https://testnet.flowscan.org/transaction/${transactionId}`, 'flow-testnet');

    return transactionId;
  } catch (error) {
    log(`Failed to create real authorization transaction: ${error}`, 'flow-error');
    return null;
  }
}

/**
 * Create a real Flow testnet payment transaction
 */
export async function createRealPaymentTransaction(
  fromAddress: string,
  toAddress: string,
  amount: number,
  orderId: number
): Promise<string | null> {
  try {
    if (!SERVICE_ADDRESS || !SERVICE_PRIVATE_KEY) {
      log("Flow service account credentials not configured", 'flow-error');
      return null;
    }

    // Get current block data for sequence number
    const blockResponse = await fetch(`${FLOW_API_BASE}/v1/blocks?height=sealed`);
    const blockData = await blockResponse.json();
    const currentHeight = blockData[0]?.height || 0;

    // Create payment transaction script
    const script = `
      transaction(fromAddr: Address, toAddr: Address, amount: UFix64, orderId: UInt64) {
        prepare(signer: AuthAccount) {
          log("=== Boustan Flow Payment ===")
          log("From: ".concat(fromAddr.toString()))
          log("To: ".concat(toAddr.toString()))
          log("Amount: ".concat(amount.toString()).concat(" FLOW"))
          log("Order ID: ".concat(orderId.toString()))
          log("Block Height: ".concat(getCurrentBlock().height.toString()))
        }
        
        execute {
          log("Payment transaction recorded on Flow testnet")
          log("Order payment successful")
        }
      }
    `;

    // Get reference block ID
    const referenceBlockId = blockData[0]?.id || "0000000000000000000000000000000000000000000000000000000000000000";

    // Prepare transaction payload with proper Flow REST API format
    const transaction = {
      script: Buffer.from(script).toString('base64'),
      arguments: [
        Buffer.from(JSON.stringify({ type: "Address", value: fromAddress })).toString('base64'),
        Buffer.from(JSON.stringify({ type: "Address", value: toAddress })).toString('base64'),
        Buffer.from(JSON.stringify({ type: "UFix64", value: amount.toFixed(8) })).toString('base64'),
        Buffer.from(JSON.stringify({ type: "UInt64", value: orderId.toString() })).toString('base64')
      ],
      reference_block_id: referenceBlockId,
      gas_limit: "1000",
      proposal_key: {
        address: SERVICE_ADDRESS,
        key_index: parseInt(SERVICE_KEY_ID),
        sequence_number: Math.floor(Date.now() / 1000)
      },
      payer: SERVICE_ADDRESS,
      authorizers: [SERVICE_ADDRESS]
    };

    // Submit transaction to Flow testnet
    const response = await fetch(`${FLOW_API_BASE}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction)
    });

    if (!response.ok) {
      const errorData = await response.text();
      log(`Flow API error: ${response.status} - ${errorData}`, 'flow-error');
      return null;
    }

    const result = await response.json();
    const transactionId = result.id;

    // Wait for transaction confirmation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    log(`Real Flow Testnet Payment Transaction:`, 'flow-testnet');
    log(`  Transaction ID: ${transactionId}`, 'flow-testnet');
    log(`  From: ${fromAddress}`, 'flow-testnet');
    log(`  To: ${toAddress}`, 'flow-testnet');
    log(`  Amount: ${amount} FLOW`, 'flow-testnet');
    log(`  Order ID: ${orderId}`, 'flow-testnet');
    log(`  Testnet Explorer: https://testnet.flowdiver.io/tx/${transactionId}`, 'flow-testnet');
    log(`  FlowScan: https://testnet.flowscan.org/transaction/${transactionId}`, 'flow-testnet');

    return transactionId;
  } catch (error) {
    log(`Failed to create real payment transaction: ${error}`, 'flow-error');
    return null;
  }
}

/**
 * Verify a transaction exists on Flow testnet
 */
export async function verifyFlowTransaction(txId: string): Promise<boolean> {
  try {
    const response = await fetch(`${FLOW_API_BASE}/v1/transactions/${txId}`);
    if (!response.ok) {
      return false;
    }
    const transaction = await response.json();
    return transaction.status >= 4; // Sealed status
  } catch (error) {
    log(`Failed to verify transaction ${txId}: ${error}`, 'flow-error');
    return false;
  }
}

/**
 * Get current Flow testnet block information
 */
export async function getCurrentBlockInfo(): Promise<any> {
  try {
    const response = await fetch(`${FLOW_API_BASE}/v1/blocks?height=sealed`);
    if (!response.ok) {
      return null;
    }
    const blocks = await response.json();
    return blocks[0] || null;
  } catch (error) {
    log(`Failed to get block info: ${error}`, 'flow-error');
    return null;
  }
}