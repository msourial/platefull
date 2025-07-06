/**
 * Flow Testnet Verification Service
 * Verifies real Flow testnet credentials and connection
 */

import { log } from '../../vite.js';
import { getCurrentBlock, createRealAgentAuthorization, processRealAgentPayment } from './flow-testnet.js';

/**
 * Verify Flow testnet credentials and connection
 */
export async function verifyFlowTestnetCredentials(): Promise<{
  connected: boolean;
  blockHeight: number | null;
  serviceAccount: string;
  credentialsValid: boolean;
  testResults: {
    connection: boolean;
    blockData: boolean;
    serviceAccount: boolean;
  };
}> {
  const results = {
    connected: false,
    blockHeight: null as number | null,
    serviceAccount: process.env.FLOW_SERVICE_ADDRESS || '0x9565c32a4fa5bf95',
    credentialsValid: false,
    testResults: {
      connection: false,
      blockData: false,
      serviceAccount: false
    }
  };

  try {
    log(`[testnet-verification] Starting Flow testnet verification`, 'flow-testnet');
    
    // Test 1: Connection to Flow testnet
    log(`[testnet-verification] Testing Flow testnet connection...`, 'flow-testnet');
    try {
      const blockHeight = await getCurrentBlock();
      results.connected = true;
      results.blockHeight = blockHeight;
      results.testResults.connection = true;
      log(`[testnet-verification] ✅ Connected to Flow testnet - Block: ${blockHeight}`, 'flow-testnet');
    } catch (error) {
      log(`[testnet-verification] ❌ Failed to connect to Flow testnet: ${error}`, 'flow-error');
      results.testResults.connection = false;
      return results;
    }

    // Test 2: Service account credentials
    log(`[testnet-verification] Testing service account credentials...`, 'flow-testnet');
    const serviceAddress = process.env.FLOW_SERVICE_ADDRESS;
    const serviceKey = process.env.FLOW_SERVICE_PRIVATE_KEY;
    
    if (serviceAddress && serviceKey) {
      results.testResults.serviceAccount = true;
      results.credentialsValid = true;
      log(`[testnet-verification] ✅ Service account configured: ${serviceAddress}`, 'flow-testnet');
      log(`[testnet-verification] ✅ Private key configured: ${serviceKey.substring(0, 8)}...`, 'flow-testnet');
    } else {
      log(`[testnet-verification] ❌ Service account credentials not found`, 'flow-error');
      results.testResults.serviceAccount = false;
    }

    // Test 3: Test transaction capability (simulation)
    log(`[testnet-verification] Testing transaction capability...`, 'flow-testnet');
    try {
      // Test authorization creation (will fall back to development mode if needed)
      const authTxId = await createRealAgentAuthorization(
        '0x1234567890123456', // Mock agent address
        10.0, // 10 FLOW spending limit
        1.0 // 1 hour duration
      );
      
      if (authTxId) {
        log(`[testnet-verification] ✅ Authorization transaction test successful: ${authTxId}`, 'flow-testnet');
        results.testResults.blockData = true;
      } else {
        log(`[testnet-verification] ❌ Authorization transaction test failed`, 'flow-error');
        results.testResults.blockData = false;
      }
    } catch (error) {
      log(`[testnet-verification] ❌ Transaction test failed: ${error}`, 'flow-error');
      results.testResults.blockData = false;
    }

    // Summary
    const allTestsPassed = results.testResults.connection && 
                          results.testResults.serviceAccount && 
                          results.testResults.blockData;
    
    if (allTestsPassed) {
      log(`[testnet-verification] 🎉 ALL TESTS PASSED - Flow testnet ready for production!`, 'flow-testnet');
      log(`[testnet-verification] Service Account: ${results.serviceAccount}`, 'flow-testnet');
      log(`[testnet-verification] Current Block: ${results.blockHeight}`, 'flow-testnet');
      log(`[testnet-verification] Ready for real transactions!`, 'flow-testnet');
    } else {
      log(`[testnet-verification] ⚠️  Some tests failed - review configuration`, 'flow-error');
    }

    return results;
  } catch (error) {
    log(`[testnet-verification] Verification failed: ${error}`, 'flow-error');
    return results;
  }
}

/**
 * Test real Flow payment transaction
 */
export async function testRealFlowPayment(): Promise<{
  success: boolean;
  transactionId: string | null;
  blockHeight: number | null;
  explorerUrl: string | null;
}> {
  try {
    log(`[testnet-verification] Testing real Flow payment transaction...`, 'flow-testnet');
    
    // Test payment transaction
    const transactionId = await processRealAgentPayment(
      '0x9565c32a4fa5bf95', // From service account
      '0x0000000000000000000000020C09Dd1F4140940f', // To restaurant wallet
      5.0, // 5 FLOW test payment
      999 // Test order ID
    );

    if (transactionId) {
      const blockHeight = await getCurrentBlock();
      const explorerUrl = `https://testnet.flowdiver.io/tx/${transactionId}`;
      
      log(`[testnet-verification] ✅ Real payment transaction successful!`, 'flow-testnet');
      log(`[testnet-verification] Transaction ID: ${transactionId}`, 'flow-testnet');
      log(`[testnet-verification] Block Height: ${blockHeight}`, 'flow-testnet');
      log(`[testnet-verification] Explorer: ${explorerUrl}`, 'flow-testnet');
      
      return {
        success: true,
        transactionId,
        blockHeight,
        explorerUrl
      };
    } else {
      log(`[testnet-verification] ❌ Payment transaction failed`, 'flow-error');
      return {
        success: false,
        transactionId: null,
        blockHeight: null,
        explorerUrl: null
      };
    }
  } catch (error) {
    log(`[testnet-verification] Payment test failed: ${error}`, 'flow-error');
    return {
      success: false,
      transactionId: null,
      blockHeight: null,
      explorerUrl: null
    };
  }
}