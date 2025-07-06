import { log } from '../../vite';

/**
 * Flow Loyalty Token Service
 * Implements fungible token-based loyalty rewards on Flow blockchain
 */

interface LoyaltyTokenBalance {
  address: string;
  balance: number;
  lastUpdated: Date;
}

interface LoyaltyTokenTransaction {
  txHash: string;
  from: string;
  to: string;
  amount: number;
  type: 'mint' | 'transfer' | 'burn';
  orderId?: number;
  timestamp: Date;
  blockHeight: number;
}

interface LoyaltyTokenReward {
  userAddress: string;
  amount: number;
  orderId: number;
  txHash: string;
  rewardType: 'order' | 'referral' | 'milestone' | 'birthday';
}

// Restaurant loyalty token contract details
const LOYALTY_TOKEN_CONTRACT = {
  address: '0x0000000000000000000000020C09Dd1F4140940f',
  name: 'BoustanPoints',
  symbol: 'BPTS',
  decimals: 8,
  totalSupply: 0 // Dynamic supply based on rewards
};

// Loyalty reward rates
const LOYALTY_RATES = {
  basePointsPerDollar: 10, // 10 BPTS per $1 spent
  bonusMultiplier: 1.5, // 1.5x on orders over $50
  referralBonus: 500, // 500 BPTS for successful referrals
  birthdayBonus: 1000, // 1000 BPTS on birthday
  milestoneRewards: {
    10: 200,    // 200 BPTS after 10 orders
    25: 500,    // 500 BPTS after 25 orders
    50: 1000,   // 1000 BPTS after 50 orders
    100: 2500   // 2500 BPTS after 100 orders
  }
};

// In-memory storage for development mode
const loyaltyBalances = new Map<string, LoyaltyTokenBalance>();
const loyaltyTransactions = new Map<string, LoyaltyTokenTransaction>();

/**
 * Get current Flow testnet block for transaction context
 */
async function getCurrentBlock(): Promise<{ height: number; id: string }> {
  try {
    const response = await fetch('https://rest-testnet.onflow.org/v1/blocks?height=latest');
    const data = await response.json();
    return {
      height: parseInt(data[0].height),
      id: data[0].id
    };
  } catch (error) {
    log(`Error fetching current block: ${error}`, 'flow-loyalty-error');
    return { height: 265472000 + Math.floor(Math.random() * 1000), id: 'dev-block' };
  }
}

/**
 * Generate Flow-compatible transaction ID
 */
function generateFlowTxId(blockHeight: number): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `${blockHeight.toString(16)}${timestamp}${random}`;
}

/**
 * Validate Flow wallet address format
 */
export function validateFlowAddress(address: string): boolean {
  const flowAddressRegex = /^0x[a-fA-F0-9]{16}$/;
  return flowAddressRegex.test(address);
}

/**
 * Calculate loyalty points for an order
 */
export function calculateLoyaltyPoints(orderAmount: number, isLargeOrder: boolean = false): number {
  let points = Math.floor(orderAmount * LOYALTY_RATES.basePointsPerDollar);
  
  // Apply bonus multiplier for large orders
  if (isLargeOrder && orderAmount >= 50) {
    points = Math.floor(points * LOYALTY_RATES.bonusMultiplier);
  }
  
  return points;
}

/**
 * Get loyalty token balance for a wallet address
 */
export async function getLoyaltyBalance(address: string): Promise<number> {
  try {
    if (!validateFlowAddress(address)) {
      throw new Error('Invalid Flow address format');
    }

    const balance = loyaltyBalances.get(address);
    
    if (!balance) {
      // Initialize new wallet with 0 balance
      loyaltyBalances.set(address, {
        address,
        balance: 0,
        lastUpdated: new Date()
      });
      return 0;
    }

    log(`Retrieved loyalty balance: ${balance.balance} BPTS for ${address}`, 'flow-loyalty');
    return balance.balance;
  } catch (error) {
    log(`Error getting loyalty balance: ${error}`, 'flow-loyalty-error');
    return 0;
  }
}

/**
 * Mint loyalty tokens as order rewards
 */
export async function mintLoyaltyTokens(
  customerAddress: string,
  amount: number,
  orderId: number,
  rewardType: 'order' | 'referral' | 'milestone' | 'birthday' = 'order'
): Promise<string> {
  try {
    if (!validateFlowAddress(customerAddress)) {
      throw new Error('Invalid Flow address format');
    }

    const block = await getCurrentBlock();
    const txHash = generateFlowTxId(block.height);

    // Update balance
    const currentBalance = await getLoyaltyBalance(customerAddress);
    const newBalance = currentBalance + amount;
    
    loyaltyBalances.set(customerAddress, {
      address: customerAddress,
      balance: newBalance,
      lastUpdated: new Date()
    });

    // Record transaction
    const transaction: LoyaltyTokenTransaction = {
      txHash,
      from: LOYALTY_TOKEN_CONTRACT.address,
      to: customerAddress,
      amount,
      type: 'mint',
      orderId,
      timestamp: new Date(),
      blockHeight: block.height
    };
    
    loyaltyTransactions.set(txHash, transaction);

    // Record reward details
    const reward: LoyaltyTokenReward = {
      userAddress: customerAddress,
      amount,
      orderId,
      txHash,
      rewardType
    };

    log(
      `[DEVELOPMENT MODE] Minted ${amount} BPTS to ${customerAddress}\n` +
      `Transaction: ${txHash}\n` +
      `Block Height: ${block.height}\n` +
      `New Balance: ${newBalance} BPTS\n` +
      `Reward Type: ${rewardType}\n` +
      `Order ID: ${orderId}`,
      'flow-loyalty'
    );

    return txHash;
  } catch (error) {
    log(`Error minting loyalty tokens: ${error}`, 'flow-loyalty-error');
    throw error;
  }
}

/**
 * Transfer loyalty tokens between addresses
 */
export async function transferLoyaltyTokens(
  fromAddress: string,
  toAddress: string,
  amount: number
): Promise<string> {
  try {
    if (!validateFlowAddress(fromAddress) || !validateFlowAddress(toAddress)) {
      throw new Error('Invalid Flow address format');
    }

    const fromBalance = await getLoyaltyBalance(fromAddress);
    
    if (fromBalance < amount) {
      throw new Error('Insufficient BPTS balance');
    }

    const block = await getCurrentBlock();
    const txHash = generateFlowTxId(block.height);

    // Update balances
    const toBalance = await getLoyaltyBalance(toAddress);
    
    loyaltyBalances.set(fromAddress, {
      address: fromAddress,
      balance: fromBalance - amount,
      lastUpdated: new Date()
    });
    
    loyaltyBalances.set(toAddress, {
      address: toAddress,
      balance: toBalance + amount,
      lastUpdated: new Date()
    });

    // Record transaction
    const transaction: LoyaltyTokenTransaction = {
      txHash,
      from: fromAddress,
      to: toAddress,
      amount,
      type: 'transfer',
      timestamp: new Date(),
      blockHeight: block.height
    };
    
    loyaltyTransactions.set(txHash, transaction);

    log(
      `[DEVELOPMENT MODE] Transferred ${amount} BPTS from ${fromAddress} to ${toAddress}\n` +
      `Transaction: ${txHash}\n` +
      `Block Height: ${block.height}`,
      'flow-loyalty'
    );

    return txHash;
  } catch (error) {
    log(`Error transferring loyalty tokens: ${error}`, 'flow-loyalty-error');
    throw error;
  }
}

/**
 * Redeem loyalty tokens for rewards (burns tokens)
 */
export async function redeemLoyaltyTokens(
  userAddress: string,
  amount: number,
  rewardDescription: string
): Promise<string> {
  try {
    if (!validateFlowAddress(userAddress)) {
      throw new Error('Invalid Flow address format');
    }

    const currentBalance = await getLoyaltyBalance(userAddress);
    
    if (currentBalance < amount) {
      throw new Error('Insufficient BPTS balance for redemption');
    }

    const block = await getCurrentBlock();
    const txHash = generateFlowTxId(block.height);

    // Update balance (burn tokens)
    loyaltyBalances.set(userAddress, {
      address: userAddress,
      balance: currentBalance - amount,
      lastUpdated: new Date()
    });

    // Record transaction
    const transaction: LoyaltyTokenTransaction = {
      txHash,
      from: userAddress,
      to: LOYALTY_TOKEN_CONTRACT.address,
      amount,
      type: 'burn',
      timestamp: new Date(),
      blockHeight: block.height
    };
    
    loyaltyTransactions.set(txHash, transaction);

    log(
      `[DEVELOPMENT MODE] Redeemed ${amount} BPTS from ${userAddress}\n` +
      `Reward: ${rewardDescription}\n` +
      `Transaction: ${txHash}\n` +
      `Block Height: ${block.height}\n` +
      `Remaining Balance: ${currentBalance - amount} BPTS`,
      'flow-loyalty'
    );

    return txHash;
  } catch (error) {
    log(`Error redeeming loyalty tokens: ${error}`, 'flow-loyalty-error');
    throw error;
  }
}

/**
 * Get loyalty token transaction history for an address
 */
export async function getLoyaltyTransactionHistory(address: string): Promise<LoyaltyTokenTransaction[]> {
  try {
    if (!validateFlowAddress(address)) {
      throw new Error('Invalid Flow address format');
    }

    const userTransactions = Array.from(loyaltyTransactions.values())
      .filter(tx => tx.from === address || tx.to === address)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return userTransactions;
  } catch (error) {
    log(`Error getting loyalty transaction history: ${error}`, 'flow-loyalty-error');
    return [];
  }
}

/**
 * Award milestone loyalty bonuses
 */
export async function awardMilestoneBonus(
  customerAddress: string,
  orderCount: number,
  orderId: number
): Promise<string | null> {
  try {
    const milestoneReward = LOYALTY_RATES.milestoneRewards[orderCount as keyof typeof LOYALTY_RATES.milestoneRewards];
    
    if (milestoneReward) {
      const txHash = await mintLoyaltyTokens(customerAddress, milestoneReward, orderId, 'milestone');
      
      log(
        `Milestone achieved! ${orderCount} orders completed.\n` +
        `Awarded ${milestoneReward} BPTS to ${customerAddress}`,
        'flow-loyalty'
      );
      
      return txHash;
    }
    
    return null;
  } catch (error) {
    log(`Error awarding milestone bonus: ${error}`, 'flow-loyalty-error');
    return null;
  }
}

/**
 * Award referral loyalty bonus
 */
export async function awardReferralBonus(
  referrerAddress: string,
  orderId: number
): Promise<string> {
  try {
    const txHash = await mintLoyaltyTokens(
      referrerAddress, 
      LOYALTY_RATES.referralBonus, 
      orderId, 
      'referral'
    );
    
    log(
      `Referral bonus awarded!\n` +
      `${LOYALTY_RATES.referralBonus} BPTS to ${referrerAddress}`,
      'flow-loyalty'
    );
    
    return txHash;
  } catch (error) {
    log(`Error awarding referral bonus: ${error}`, 'flow-loyalty-error');
    throw error;
  }
}

/**
 * Award birthday loyalty bonus
 */
export async function awardBirthdayBonus(
  customerAddress: string,
  orderId: number
): Promise<string> {
  try {
    const txHash = await mintLoyaltyTokens(
      customerAddress, 
      LOYALTY_RATES.birthdayBonus, 
      orderId, 
      'birthday'
    );
    
    log(
      `Birthday bonus awarded!\n` +
      `${LOYALTY_RATES.birthdayBonus} BPTS to ${customerAddress}`,
      'flow-loyalty'
    );
    
    return txHash;
  } catch (error) {
    log(`Error awarding birthday bonus: ${error}`, 'flow-loyalty-error');
    throw error;
  }
}

/**
 * Get loyalty token contract information
 */
export function getLoyaltyTokenInfo() {
  return {
    ...LOYALTY_TOKEN_CONTRACT,
    rates: LOYALTY_RATES,
    network: 'Flow Testnet',
    developmentMode: true
  };
}

/**
 * Convert BPTS to USD value (for display purposes)
 */
export function bptsToUSD(bptsAmount: number): number {
  // 1 BPTS = $0.01 USD (100 BPTS = $1)
  return bptsAmount / 100;
}

/**
 * Convert USD to BPTS value
 */
export function usdToBPTS(usdAmount: number): number {
  // $1 USD = 100 BPTS
  return Math.floor(usdAmount * 100);
}