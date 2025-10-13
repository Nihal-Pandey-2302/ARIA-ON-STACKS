const { generateWallet, getStxAddress } = require('@stacks/wallet-sdk');
const { STACKS_TESTNET, STACKS_MAINNET } = require('@stacks/network');

const mnemonic = 'recipe admit toy nothing victory magnet clean when horror immense tired ridge mouse valley wolf gate actress own chief empty music say art buffalo';
const accountIndex = 2;

async function deriveAccount() {
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: '',
    accountIndexes: [accountIndex], // explicitly derive the account you want
  });

  const account = wallet.accounts[0]; // the first (and only) account is index 2
  const testnetAddress = getStxAddress({ account, network: STACKS_TESTNET });
  const mainnetAddress = getStxAddress({ account, network: STACKS_MAINNET });

  console.log('STX Private Key:', account.stxPrivateKey);
  console.log('Testnet Address:', testnetAddress);
  console.log('Mainnet Address:', mainnetAddress);
}

deriveAccount().catch(console.error);
