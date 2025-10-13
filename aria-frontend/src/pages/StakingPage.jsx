// src/pages/StakingPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Box, Heading, Text, VStack, Button, Input, InputGroup, InputRightAddon, 
  Spinner, Stat, StatLabel, StatNumber, useToast, SimpleGrid, Divider 
} from '@chakra-ui/react';
import { 
  cvToJSON, uintCV, standardPrincipalCV, cvToHex, Pc,
} from '@stacks/transactions';
import { 
  STACKS_NETWORK, STAKING_CONTRACT_ID, ARIA_TOKEN_CONTRACT_ID, 
  TOKEN_DISPLAY, DENOM_DECIMALS 
} from '../constants';


const StakingPage = ({ address }) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [balances, setBalances] = useState({ aria: 0, staked: 0, rewards: 0 });
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const toast = useToast();


  // -------------------------
  // 📡 Read-only helper
  // -------------------------
  const callReadOnly = async (contractId, functionName, functionArgs) => {
    const [contractAddress, contractName] = contractId.split('.');
    const response = await fetch(
      `${STACKS_NETWORK.client.baseUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: address, arguments: functionArgs.map(cvToHex) }),
      }
    );
    if (!response.ok) throw new Error(`Read-only call failed: ${functionName}`);
    const data = await response.json();
    if (!data.okay) throw new Error(`Read-only call failed: ${data.cause}`);
    return cvToJSON(data.result);
  };


  // -------------------------
  // 💰 Fetch balances
  // -------------------------
  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const [ariaBal, stakedBal, rewards] = await Promise.all([
        callReadOnly(ARIA_TOKEN_CONTRACT_ID, 'get-balance', [standardPrincipalCV(address)]),
        callReadOnly(STAKING_CONTRACT_ID, 'get-staked-balance-for', [standardPrincipalCV(address)]),
        callReadOnly(STAKING_CONTRACT_ID, 'get-claimable-rewards-for', [standardPrincipalCV(address)]),
      ]);


      setBalances({
        aria: parseInt(ariaBal.value) || 0,
        staked: parseInt(stakedBal.value) || 0,
        rewards: parseInt(rewards.value) || 0,
      });
    } catch (e) {
      console.error('Error fetching staking balances:', e);
      toast({ title: 'Error', description: 'Could not fetch staking data.', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [address, toast]);


  useEffect(() => {
    if (address) fetchBalances();
  }, [fetchBalances, address]);


  // -------------------------
  // 🟣 Handle Stake
  // -------------------------
  const handleStake = async () => {
    const amount = Math.floor(parseFloat(stakeAmount) * (10 ** DENOM_DECIMALS));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid Amount', status: 'warning' });
      return;
    }


    setActionLoading(true);
    try {
      const [stakingAddress, stakingName] = STAKING_CONTRACT_ID.split('.');
      const [tokenAddress, tokenName] = ARIA_TOKEN_CONTRACT_ID.split('.');


      // ✅ v7 post-condition: origin will send ARIA tokens
      const ftAsset = createAsset(tokenAddress, tokenName, 'aria');
      const postCondition = Pc.origin(address).willSendAsset(ftAsset).equalTo(BigInt(amount));


      const networkMode = STACKS_NETWORK.client.baseUrl.includes('mainnet') ? 'mainnet' : 'testnet';
      await window.LeatherProvider.request('stx_callContract', {
        contract: `${stakingAddress}.${stakingName}`,
        functionName: 'stake',
        functionArgs: [cvToHex(uintCV(amount))],
        postConditions: [postCondition],
        network: networkMode,
      });


      toast({ title: 'Stake Submitted!', status: 'success' });
      setTimeout(fetchBalances, 3000);
    } catch (e) {
      console.error('Stake error:', e);
      const errorMsg = e.error?.message || e.message || 'Failed to stake';
      toast({ title: 'Stake Error', description: errorMsg, status: 'error' });
    } finally {
      setActionLoading(false);
      setStakeAmount('');
    }
  };


  // -------------------------
  // 🟠 Handle Unstake
  // -------------------------
  const handleUnstake = async () => {
    const amount = Math.floor(parseFloat(unstakeAmount) * (10 ** DENOM_DECIMALS));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid Amount', status: 'warning' });
      return;
    }


    setActionLoading(true);
    try {
      const [stakingAddress, stakingName] = STAKING_CONTRACT_ID.split('.');
      const [tokenAddress, tokenName] = ARIA_TOKEN_CONTRACT_ID.split('.');


      // ✅ v7 post-condition: user (origin) will receive ARIA (so we use .willReceiveAsset)
      const ftAsset = createAsset(tokenAddress, tokenName, 'aria');
      const postCondition = Pc.origin(address).willReceiveAsset(ftAsset).equalTo(BigInt(amount));


      const networkMode = STACKS_NETWORK.client.baseUrl.includes('mainnet') ? 'mainnet' : 'testnet';
      await window.LeatherProvider.request('stx_callContract', {
        contract: `${stakingAddress}.${stakingName}`,
        functionName: 'unstake',
        functionArgs: [cvToHex(uintCV(amount))],
        postConditions: [postCondition],
        network: networkMode,
      });


      toast({ title: 'Unstake Submitted!', status: 'success' });
      setTimeout(fetchBalances, 3000);
    } catch (e) {
      console.error('Unstake error:', e);
      const errorMsg = e.error?.message || e.message || 'Failed to unstake';
      toast({ title: 'Unstake Error', description: errorMsg, status: 'error' });
    } finally {
      setActionLoading(false);
      setUnstakeAmount('');
    }
  };


  // -------------------------
  // 🟢 Handle Claim Rewards
  // -------------------------
  const handleClaim = async () => {
    if (balances.rewards <= 0) {
      toast({ title: 'No rewards to claim', status: 'info' });
      return;
    }


    setActionLoading(true);
    try {
      const [stakingAddress, stakingName] = STAKING_CONTRACT_ID.split('.');


      // ✅ Rewards are STX, so use willReceiveSTX
      const postCondition = Pc.origin(address).willReceiveSTX().equalTo(BigInt(balances.rewards));


      const networkMode = STACKS_NETWORK.client.baseUrl.includes('mainnet') ? 'mainnet' : 'testnet';
      await window.LeatherProvider.request('stx_callContract', {
        contract: `${stakingAddress}.${stakingName}`,
        functionName: 'claim-rewards',
        functionArgs: [],
        postConditions: [postCondition],
        network: networkMode,
      });


      toast({ title: 'Claim Submitted!', status: 'success' });
      setTimeout(fetchBalances, 3000);
    } catch (e) {
      console.error('Claim error:', e);
      const errorMsg = e.error?.message || e.message || 'Failed to claim rewards';
      toast({ title: 'Claim Error', description: errorMsg, status: 'error' });
    } finally {
      setActionLoading(false);
    }
  };


  // -------------------------
  // 🧮 UI Helpers
  // -------------------------
  const formatBalance = (val) =>
    (val / (10 ** DENOM_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 6 });


  if (loading)
    return (
      <VStack py={10}>
        <Spinner size="xl" />
        <Text>Loading staking data...</Text>
      </VStack>
    );


  // -------------------------
  // 🎨 UI
  // -------------------------
  return (
    <Box p={6} shadow="lg" borderWidth="1px" borderRadius="xl" width="100%" bg="gray.800">
      <Heading as="h2" size="lg" mb={6} textAlign="center">
        ARIA Staking & Rewards
      </Heading>


      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} textAlign="center">
        <Stat><StatLabel>Your ARIA Balance</StatLabel><StatNumber>{formatBalance(balances.aria)}</StatNumber></Stat>
        <Stat><StatLabel>Staked ARIA</StatLabel><StatNumber>{formatBalance(balances.staked)}</StatNumber></Stat>
        <Stat><StatLabel>Claimable STX Rewards</StatLabel><StatNumber>{formatBalance(balances.rewards)}</StatNumber></Stat>
      </SimpleGrid>


      <Divider my={8} />


      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
        <VStack spacing={4}>
          <Heading size="md">Stake Your ARIA</Heading>
          <InputGroup>
            <Input
              placeholder="Amount to Stake"
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
            />
            <InputRightAddon>{TOKEN_DISPLAY}</InputRightAddon>
          </InputGroup>
          <Button
            colorScheme="purple"
            onClick={handleStake}
            isLoading={actionLoading}
            isDisabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
            width="100%"
          >
            Stake
          </Button>
        </VStack>


        <VStack spacing={4}>
          <Heading size="md">Unstake Your ARIA</Heading>
          <InputGroup>
            <Input
              placeholder="Amount to Unstake"
              type="number"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
            />
            <InputRightAddon>{TOKEN_DISPLAY}</InputRightAddon>
          </InputGroup>
          <Button
            colorScheme="orange"
            onClick={handleUnstake}
            isLoading={actionLoading}
            isDisabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0}
            width="100%"
          >
            Unstake
          </Button>
        </VStack>
      </SimpleGrid>


      <VStack mt={10}>
        <Button
          colorScheme="green"
          size="lg"
          onClick={handleClaim}
          isLoading={actionLoading}
          isDisabled={balances.rewards === 0}
          width={{ base: '100%', md: 'auto' }}
        >
          Claim {formatBalance(balances.rewards)} STX Rewards
        </Button>
      </VStack>
    </Box>
  );
};


export default StakingPage;