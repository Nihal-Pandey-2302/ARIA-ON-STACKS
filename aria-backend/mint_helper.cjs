#!/usr/bin/env node

/**
 * mint_helper.cjs
 * Stacks.js v7.2+ minting helper for Testnet
 * CommonJS version for Node.js
 */

const dotenv = require('dotenv');
dotenv.config();

const {
  makeContractCall,
  broadcastTransaction,
  principalCV,
  stringAsciiCV,
  AnchorMode
} = require('@stacks/transactions');

const { STACKS_TESTNET } = require('@stacks/network');
const { generateWallet } = require('@stacks/wallet-sdk');

// Polyfill fetch for older Node versions
const fetch = globalThis.fetch || require('node-fetch');

// --- Hardcoded contract details (update these if needed) ---
const DEPLOYER_ADDRESS = 'ST16W5DG0N8VP85W6DK1ZB4ME3BK3WN2750H78FNX';
const CONTRACT_NAME = 'rwa-nft-contract-v4';

// --- CLI arguments ---
const recipient = process.argv[2];
const ipfsHash = process.argv[3];

if (!recipient || !ipfsHash) {
  console.error('Usage: node mint_helper.cjs <recipient_address> <ipfs_hash>');
  process.exit(1);
}

// --- Load private key or mnemonic from .env ---
let privateKey = process.env.STACKS_OWNER_SECRET_KEY;
if (!privateKey) {
  console.error('ERROR: STACKS_OWNER_SECRET_KEY missing in .env');
  process.exit(1);
}

// --- Main async function ---
(async () => {
  try {
    // Derive private key if mnemonic (not a 64-char hex string)
    if (!privateKey.match(/^[0-9a-fA-F]{64}$/)) {
      console.error('[INFO] Mnemonic detected, deriving private key...');
      const wallet = await generateWallet({ secretKey: privateKey, password: '' });
      privateKey = wallet.accounts[0].stxPrivateKey;
      console.error('[INFO] Private key derived from mnemonic');
      console.error(`[DEBUG] Raw private key length: ${privateKey.length}`);
    }

    // The private key from wallet-sdk is 66 chars and includes compression flag
    // We should NOT remove it - Stacks expects this format
    // Just remove 0x prefix if present
    privateKey = privateKey.replace(/^0x/, '');
    
    console.error(`[DEBUG] Private key length after cleanup: ${privateKey.length}`);
    console.error(`[DEBUG] Recipient: ${recipient}`);
    console.error(`[DEBUG] IPFS Hash: ${ipfsHash}`);
    console.error(`[DEBUG] Contract: ${DEPLOYER_ADDRESS}.${CONTRACT_NAME}`);

    // Build Clarity values
    const recipientCV = principalCV(recipient);
    const ipfsHashCV = stringAsciiCV(ipfsHash);

    console.error('[DEBUG] Clarity values created successfully');

    // Transaction options
    const txOptions = {
      contractAddress: DEPLOYER_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'mint-rwa',
      functionArgs: [recipientCV, ipfsHashCV],
      senderKey: privateKey,
      network: STACKS_TESTNET,
      anchorMode: AnchorMode.Any,
      fee: 2000n,
      validateWithAbi: false,
    };

    console.error('[DEBUG] Creating transaction...');
    const tx = await makeContractCall(txOptions);
    
    // Validate transaction object
    if (!tx) {
      throw new Error('makeContractCall returned undefined');
    }
    
    console.error('[DEBUG] Transaction created successfully');
    console.error(`[DEBUG] Transaction has serialize: ${typeof tx.serialize === 'function'}`);
    
    // Serialize the transaction
    const serializedTx = tx.serialize();
    console.error(`[DEBUG] Transaction serialized (${serializedTx.length} bytes)`);
    console.error(`[DEBUG] First 10 bytes: ${Array.from(serializedTx.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Convert to hex string - check if it's already a string or Uint8Array
    let txHex;
    if (typeof serializedTx === 'string') {
      txHex = serializedTx;
      console.error('[DEBUG] Transaction already a hex string');
    } else {
      // Convert Uint8Array/Buffer to hex without '0x' prefix
      txHex = Array.from(serializedTx)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.error(`[DEBUG] Converted to hex string`);
    }
    
    console.error(`[DEBUG] Transaction hex length: ${txHex.length}`);
    console.error(`[DEBUG] Transaction hex start: ${txHex.substring(0, 20)}...`);
    
    // Manual broadcast using fetch (more reliable than broadcastTransaction in v7.2.0)
    console.error('[DEBUG] Broadcasting transaction via fetch...');
    
    // STACKS_TESTNET uses different property names in v7.2.0
    const apiUrl = STACKS_TESTNET.coreApiUrl || STACKS_TESTNET.broadcastEndpoint || 'https://api.testnet.hiro.so';
    const broadcastUrl = `${apiUrl}/v2/transactions`;
    
    console.error(`[DEBUG] Broadcast URL: ${broadcastUrl}`);
    
    // The API expects JSON with a hex-encoded tx field (as seen in fetch.js)
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tx: txHex }),
    });
    
    console.error(`[DEBUG] Broadcast response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ERROR] Broadcast failed: ${errorText}`);
      throw new Error(`Broadcast failed with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.text();
    console.error(`[DEBUG] Broadcast result: ${result}`);
    
    // Parse the transaction ID (result is already a JSON string)
    let txId;
    try {
      // The result is a JSON-encoded string, parse it to remove quotes
      txId = JSON.parse(result);
    } catch {
      // If parsing fails, use as-is
      txId = result;
    }
    
    // Remove any quotes that might remain
    txId = txId.replace(/^["']|["']$/g, '');
    
    // Ensure 0x prefix
    if (!txId.startsWith('0x')) {
      txId = `0x${txId}`;
    }

    console.error(`[DEBUG] Final txId: ${txId}`);

    // Output success JSON to stdout (Python will parse this)
    // This is the ONLY thing that should go to stdout
    console.log(JSON.stringify({ txId }));
    
    process.exit(0);

  } catch (err) {
    console.error(`[ERROR] Minting failed: ${err.message}`);
    console.error(`[ERROR] Stack: ${err.stack}`);
    console.log(JSON.stringify({ error: `Script failed: ${err.message}` }));
    process.exit(1);
  }
})();