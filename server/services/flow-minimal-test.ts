import { log } from "../vite";

const FLOW_API_BASE = "https://rest-testnet.onflow.org";
const SERVICE_ADDRESS = process.env.FLOW_SERVICE_ADDRESS;

/**
 * Test minimal Flow transaction format to identify the correct API specification
 */
export async function testMinimalFlowTransaction(): Promise<void> {
  try {
    log(`Testing minimal Flow transaction format...`, 'flow-test');
    
    // Get current block
    const blockResponse = await fetch(`${FLOW_API_BASE}/v1/blocks?height=sealed`);
    const blockData = await blockResponse.json();
    const referenceBlockId = blockData[0]?.id;

    // Get account info
    const accountResponse = await fetch(`${FLOW_API_BASE}/v1/accounts/${SERVICE_ADDRESS}?expand=keys`);
    const accountData = await accountResponse.json();
    
    log(`Account data: ${JSON.stringify(accountData, null, 2)}`, 'flow-test');

    // Test minimal transaction payload
    const minimalTransaction = {
      script: Buffer.from(`
        transaction() {
          prepare(signer: AuthAccount) {
            log("Test transaction")
          }
        }
      `, 'utf8').toString('base64'),
      arguments: [],
      reference_block_id: referenceBlockId,
      gas_limit: "100",
      proposal_key: {
        address: SERVICE_ADDRESS,
        key_index: 0,  // Try as integer first
        sequence_number: 1
      },
      payer: SERVICE_ADDRESS,
      authorizers: [SERVICE_ADDRESS]
    };

    log(`Minimal transaction payload: ${JSON.stringify(minimalTransaction, null, 2)}`, 'flow-test');

    // Submit transaction
    const response = await fetch(`${FLOW_API_BASE}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimalTransaction)
    });

    const responseText = await response.text();
    log(`Response status: ${response.status}`, 'flow-test');
    log(`Response body: ${responseText}`, 'flow-test');

    if (!response.ok) {
      // Try with string values
      const stringTransaction = {
        ...minimalTransaction,
        proposal_key: {
          address: SERVICE_ADDRESS,
          key_index: "0",  // Try as string
          sequence_number: "1"
        }
      };

      log(`Trying with string values...`, 'flow-test');
      const stringResponse = await fetch(`${FLOW_API_BASE}/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stringTransaction)
      });

      const stringResponseText = await stringResponse.text();
      log(`String response status: ${stringResponse.status}`, 'flow-test');
      log(`String response body: ${stringResponseText}`, 'flow-test');
    }

  } catch (error) {
    log(`Minimal transaction test failed: ${error}`, 'flow-error');
  }
}