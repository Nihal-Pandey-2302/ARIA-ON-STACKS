require('dotenv').config();

async function testWallet() {
  console.log('=== Wallet Derivation Test ===\n');

  const mnemonic = process.env.STACKS_OWNER_SECRET_KEY;
  
  if (!mnemonic) {
    console.error('❌ STACKS_OWNER_SECRET_KEY not found in .env');
    process.exit(1);
  }

  console.log(`✓ Mnemonic loaded (length: ${mnemonic.length} chars)`);
  console.log(`✓ Word count: ${mnemonic.split(' ').length} words\n`);

  // Test 1: Check @stacks/wallet-sdk version
  try {
    const pkg = require('@stacks/wallet-sdk/package.json');
    console.log(`✓ @stacks/wallet-sdk version: ${pkg.version}\n`);
  } catch (e) {
    console.log('⚠ Could not read @stacks/wallet-sdk version\n');
  }

  // Test 2: Try generateWallet
  console.log('Testing generateWallet()...');
  try {
    const { generateWallet } = require('@stacks/wallet-sdk');
    
    const wallet = await generateWallet({
      secretKey: mnemonic,
      password: '',
    });

    console.log('✓ generateWallet() succeeded');
    console.log(`  - Type: ${typeof wallet}`);
    console.log(`  - Keys: ${Object.keys(wallet || {}).join(', ')}`);
    
    if (wallet?.accounts) {
      console.log(`  - Accounts: ${wallet.accounts.length}`);
      if (wallet.accounts[0]) {
        console.log(`  - Account 0 keys: ${Object.keys(wallet.accounts[0]).join(', ')}`);
        if (wallet.accounts[0].stxPrivateKey) {
          console.log(`  - ✓ Private key found (length: ${wallet.accounts[0].stxPrivateKey.length})`);
          console.log(`  - STX Address: ${wallet.accounts[0].address || 'N/A'}`);
          return wallet.accounts[0].stxPrivateKey;
        } else {
          console.log(`  - ❌ stxPrivateKey not found in account`);
        }
      }
    } else {
      console.log(`  - ❌ No accounts array in wallet`);
    }
  } catch (e) {
    console.log(`❌ generateWallet() failed: ${e.message}`);
    console.log(`   Stack: ${e.stack}\n`);
  }

  // Test 3: Try Wallet class directly
  console.log('\nTesting Wallet class...');
  try {
    const { Wallet } = require('@stacks/wallet-sdk');
    
    const wallet = new Wallet({
      secretKey: mnemonic,
      password: '',
    });

    console.log('✓ Wallet class instantiated');
    console.log(`  - Type: ${typeof wallet}`);
    console.log(`  - Keys: ${Object.keys(wallet || {}).join(', ')}`);
    
    if (wallet?.accounts) {
      console.log(`  - Accounts: ${wallet.accounts.length}`);
      if (wallet.accounts[0]?.stxPrivateKey) {
        console.log(`  - ✓ Private key found (length: ${wallet.accounts[0].stxPrivateKey.length})`);
        console.log(`  - STX Address: ${wallet.accounts[0].address || 'N/A'}`);
        return wallet.accounts[0].stxPrivateKey;
      }
    }
  } catch (e) {
    console.log(`❌ Wallet class failed: ${e.message}\n`);
  }

  // Test 4: Try restoreWalletAccounts (older API)
  console.log('\nTesting restoreWalletAccounts()...');
  try {
    const { restoreWalletAccounts } = require('@stacks/wallet-sdk');
    
    const accounts = await restoreWalletAccounts({
      wallet: {
        salt: mnemonic,
        rootKey: mnemonic,
        encryptedSecretKey: mnemonic,
      },
      gaiaHubUrl: 'https://hub.blockstack.org',
    });

    console.log('✓ restoreWalletAccounts() succeeded');
    console.log(`  - Accounts: ${accounts?.length || 0}`);
  } catch (e) {
    console.log(`❌ restoreWalletAccounts() failed: ${e.message}\n`);
  }

  // Test 5: Manual derivation using BIP39
  console.log('\nTesting manual BIP39 derivation...');
  try {
    const bip39 = require('bip39');
    const { HDKey } = require('@scure/bip32');
    const { getAddressFromPrivateKey, TransactionVersion } = require('@stacks/transactions');
    
    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      console.log('❌ Invalid BIP39 mnemonic');
      return null;
    }
    
    console.log('✓ Valid BIP39 mnemonic');
    
    // Derive seed
    const seed = await bip39.mnemonicToSeed(mnemonic);
    console.log('✓ Seed derived');
    
    // Derive key using Stacks derivation path
    const masterKey = HDKey.fromMasterSeed(seed);
    const derivationPath = "m/44'/5757'/0'/0/0"; // Stacks path
    const child = masterKey.derive(derivationPath);
    
    if (!child.privateKey) {
      console.log('❌ No private key in derived child');
      return null;
    }
    
    const privateKey = child.privateKey.toString('hex');
    console.log(`✓ Private key derived (length: ${privateKey.length})`);
    
    // Derive address
    const address = getAddressFromPrivateKey(
      privateKey,
      TransactionVersion.Testnet
    );
    console.log(`✓ Testnet address: ${address}`);
    
    return privateKey;
    
  } catch (e) {
    console.log(`❌ Manual derivation failed: ${e.message}`);
  }

  return null;
}

testWallet()
  .then(key => {
    if (key) {
      console.log('\n✅ SUCCESS! Private key derived successfully');
      console.log(`Key (first 8 chars): ${key.substring(0, 8)}...`);
    } else {
      console.log('\n❌ FAILED to derive private key');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  });