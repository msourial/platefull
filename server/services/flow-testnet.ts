import * as fcl from "@onflow/fcl";
import * as t from "@onflow/types";
import { log } from "../vite";

// Configure FCL for Flow testnet
fcl.config({
  "accessNode.api": "https://rest-testnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/testnet/authn",
  "0xFungibleToken": "0x9a0766d93b6608b7",
  "0xFlowToken": "0x7e60df042a9c0868"
});

// Service account configuration
const SERVICE_ADDRESS = process.env.FLOW_SERVICE_ADDRESS;
const SERVICE_PRIVATE_KEY = process.env.FLOW_SERVICE_PRIVATE_KEY;

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

    // Simple transaction script that creates an on-chain log
    const authorizationScript = `
      transaction(userAddress: Address, agentAddress: Address, limit: UFix64, duration: UFix64) {
        prepare(signer: AuthAccount) {
          log("Boustan AI Agent Authorization")
          log("User: ".concat(userAddress.toString()))
          log("Agent: ".concat(agentAddress.toString()))
          log("Limit: ".concat(limit.toString()).concat(" FLOW"))
          log("Duration: ".concat(duration.toString()).concat(" hours"))
          log("Timestamp: ".concat(getCurrentBlock().timestamp.toString()))
        }
        
        execute {
          // Record authorization on blockchain
          log("Authorization recorded on Flow testnet")
        }
      }
    `;

    // Submit transaction via REST API
    const transactionPayload = {
      script: Buffer.from(authorizationScript).toString('base64'),
      arguments: [
        { type: "Address", value: userAddress },
        { type: "Address", value: agentAddress },
        { type: "UFix64", value: spendingLimit.toFixed(8) },
        { type: "UFix64", value: durationHours.toString() }
      ],
      proposalKey: {
        address: SERVICE_ADDRESS,
        keyIndex: 0,
        sequenceNumber: Math.floor(Date.now() / 1000)
      },
      payer: SERVICE_ADDRESS,
      authorizers: [SERVICE_ADDRESS],
      gasLimit: "1000"
    };

    const response = await fetch("https://rest-testnet.onflow.org/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(transactionPayload)
    });

    if (!response.ok) {
      log(`Flow API error: ${response.status} ${response.statusText}`, 'flow-error');
      return null;
    }

    const result = await response.json();
    const transactionId = result.id;
    
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
    const serviceAccountPrivateKey = process.env.FLOW_SERVICE_PRIVATE_KEY;
    if (!serviceAccountPrivateKey) {
      log("FLOW_SERVICE_PRIVATE_KEY not configured", 'flow-error');
      return null;
    }

    // Create payment transaction
    const paymentScript = `
      import FlowToken from 0xFlowToken
      import FungibleToken from 0xFungibleToken

      transaction(recipient: Address, amount: UFix64, orderId: UInt64) {
        let tokenAdmin: &FlowToken.Administrator
        let tokenReceiver: &{FungibleToken.Receiver}

        prepare(signer: AuthAccount) {
          self.tokenAdmin = signer
            .borrow<&FlowToken.Administrator>(from: /storage/flowTokenAdmin)
            ?? panic("Signer is not the token admin")

          self.tokenReceiver = getAccount(recipient)
            .getCapability(/public/flowTokenReceiver)!
            .borrow<&{FungibleToken.Receiver}>()
            ?? panic("Unable to borrow receiver reference")
        }

        execute {
          let minter <- self.tokenAdmin.createNewMinter(allowedAmount: amount)
          let mintedVault <- minter.mintTokens(amount: amount)

          self.tokenReceiver.deposit(from: <-mintedVault)
          destroy minter

          log("Payment processed for order: ".concat(orderId.toString()))
          log("Amount: ".concat(amount.toString()).concat(" FLOW"))
          log("To: ".concat(recipient.toString()))
        }
      }
    `;

    const response = await fcl.mutate({
      cadence: paymentScript,
      args: (arg: any, t: any) => [
        arg(toAddress, t.Address),
        arg(amount.toFixed(8), t.UFix64),
        arg(orderId.toString(), t.UInt64)
      ],
      proposer: fcl.authz,
      payer: fcl.authz,
      authorizations: [fcl.authz],
      limit: 1000
    });

    const transaction = await fcl.tx(response).onceSealed();
    
    log(`Real Flow Testnet Payment Transaction:`, 'flow-testnet');
    log(`  Transaction ID: ${transaction.id}`, 'flow-testnet');
    log(`  Status: ${transaction.status}`, 'flow-testnet');
    log(`  From: ${fromAddress}`, 'flow-testnet');
    log(`  To: ${toAddress}`, 'flow-testnet');
    log(`  Amount: ${amount} FLOW`, 'flow-testnet');
    log(`  Order ID: ${orderId}`, 'flow-testnet');
    log(`  Testnet Explorer: https://testnet.flowdiver.io/tx/${transaction.id}`, 'flow-testnet');
    log(`  FlowScan: https://testnet.flowscan.org/transaction/${transaction.id}`, 'flow-testnet');

    return transaction.id;
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
    const transaction = await fcl.tx(txId).snapshot();
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
    const block = await fcl.send([fcl.getBlock(true)]).then(fcl.decode);
    return block;
  } catch (error) {
    log(`Failed to get block info: ${error}`, 'flow-error');
    return null;
  }
}