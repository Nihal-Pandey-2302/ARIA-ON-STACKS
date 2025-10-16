// src/constants.js
import { STACKS_TESTNET } from '@stacks/network';

// --- Stacks Network Configuration ---
export const STACKS_NETWORK = STACKS_TESTNET;

// --- Backend API URL ---
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5001';
// https://aria-on-stacks.onrender.com
// --- Deployed Contract Information ---
// This is your correct, funded deployer address.
export const DEPLOYER_ADDRESS = 'ST16W5DG0N8VP85W6DK1ZB4ME3BK3WN2750H78FNX';

// Names of your Clarity contracts (matching your deployment)
export const RWA_NFT_CONTRACT_NAME = 'rwa-nft-contract-v4';
export const MARKETPLACE_CONTRACT_NAME = 'marketplace-contract-v6';
export const STAKING_CONTRACT_NAME = 'staking-contract-v7';
export const ARIA_TOKEN_CONTRACT_NAME = 'aria-token-v2';

// --- Helper for constructing full contract identifiers ---
// These will now correctly resolve to the addresses you deployed.
export const RWA_NFT_CONTRACT_ID = `${DEPLOYER_ADDRESS}.${RWA_NFT_CONTRACT_NAME}`;
export const MARKETPLACE_CONTRACT_ID = `${DEPLOYER_ADDRESS}.${MARKETPLACE_CONTRACT_NAME}`;
export const STAKING_CONTRACT_ID = `${DEPLOYER_ADDRESS}.${STAKING_CONTRACT_NAME}`;
export const ARIA_TOKEN_CONTRACT_ID = `${DEPLOYER_ADDRESS}.${ARIA_TOKEN_CONTRACT_NAME}`;

// --- Other Constants ---
export const STACKS_EXPLORER_URL = 'https://explorer.stacks.co';
export const DENOM_DISPLAY = 'STX';
export const TOKEN_DISPLAY = 'ARIA';
export const DENOM_DECIMALS = 6;