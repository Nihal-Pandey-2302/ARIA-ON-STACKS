// src/pages/StakingPage.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Heading, Text, VStack, Button, Input, InputGroup, InputRightAddon,
  Spinner, Stat, StatLabel, StatNumber, useToast, SimpleGrid, Divider, HStack
} from '@chakra-ui/react';
import {
  cvToHex, uintCV, standardPrincipalCV
} from '@stacks/transactions';
import {
  STACKS_NETWORK, STAKING_CONTRACT_ID, ARIA_TOKEN_CONTRACT_ID,
  TOKEN_DISPLAY, DENOM_DECIMALS
} from '../constants';

const ENDPOINT_FALLBACKS = [
  STACKS_NETWORK.client?.baseUrl,
  'https://stacks-node-api.testnet.stacks.co',
  'https://stacks-node-api.blockstack.org'
].filter(Boolean);

const MAX_ENDPOINT_RETRIES = 3;
const PER_ENDPOINT_TIMEOUT = 7000; // ms

const StakingPage = ({ address }) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [balances, setBalances] = useState({ aria: 0n, staked: 0n, rewards: 0n });
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [lastError, setLastError] = useState(null);
  const toast = useToast();

  // -------------------------
  // Robust unwrap for Clarity values → BigInt
  // -------------------------
  const unwrapClarityValue = (val) => {
    if (!val) return 0n;
    let r = val;

    // unwrap ok
    while (r && r.type === 'ok') r = r.value;
    // unwrap optional
    while (r && r.type === 'optional') {
      if (!r.value) return 0n;
      r = r.value;
    }

    if (typeof r === 'string') {
      const cleaned = r.startsWith('u') ? r.slice(1) : r;
      try { return BigInt(cleaned); } catch { return 0n; }
    }

    if (r && r.type === 'uint') {
      try { return BigInt(r.value); } catch { return 0n; }
    }

    if (r && r.type === 'tuple' && r.data) {
      for (const k of Object.keys(r.data)) {
        const cand = r.data[k];
        if (cand?.type === 'uint') {
          try { return BigInt(cand.value); } catch { return 0n; }
        }
      }
    }

    return 0n;
  };

  // -------------------------
  // Fetch with timeout
  // -------------------------
  const fetchWithTimeout = (url, opts = {}, timeout = PER_ENDPOINT_TIMEOUT) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), timeout);
      fetch(url, opts)
        .then(res => { clearTimeout(timer); resolve(res); })
        .catch(err => { clearTimeout(timer); reject(err); });
    });

  // -------------------------
  // callReadOnly (retry + fallback)
  // -------------------------
  const callReadOnly = async (contractId, functionName, functionArgs = []) => {
    if (!address) return 0n;

    const body = JSON.stringify({
      sender: address,
      arguments: functionArgs.map(cvToHex)
    });

    let lastErr = null;
    for (const endpoint of ENDPOINT_FALLBACKS) {
      for (let attempt = 1; attempt <= MAX_ENDPOINT_RETRIES; attempt++) {
        try {
          const [contractAddress, contractName] = contractId.split('.');
          const url = `${endpoint.replace(/\/$/, '')}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;
          const res = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
          }, PER_ENDPOINT_TIMEOUT);

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          const parsed = unwrapClarityValue(data.result);
          return parsed;
        } catch (err) {
          lastErr = err;
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
    }

    console.error('callReadOnly failed for', contractId, functionName, lastErr);
    return 0n;
  };

  // -------------------------
  // Fetch balances
  // -------------------------
  const fetchBalances = useCallback(async () => {
    if (!address) {
      setBalances({ aria: 0n, staked: 0n, rewards: 0n });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [ariaBal, stakedBal, rewardsBal] = await Promise.all([
        callReadOnly(ARIA_TOKEN_CONTRACT_ID, 'get-balance', [standardPrincipalCV(address)]),
        callReadOnly(STAKING_CONTRACT_ID, 'get-staked-balance-for', [standardPrincipalCV(address)]),
        callReadOnly(STAKING_CONTRACT_ID, 'get-claimable-rewards-for', [standardPrincipalCV(address)])
      ]);

      console.log('Balances fetched (raw BigInt):', {
        ariaBal: ariaBal.toString(),
        stakedBal: stakedBal.toString(),
        rewardsBal: rewardsBal.toString()
      });

      setBalances({ aria: ariaBal, staked: stakedBal, rewards: rewardsBal });
    } catch (err) {
      console.error('fetchBalances error:', err);
      setLastError(err.message || String(err));
      toast({ title: 'Error', description: 'Failed to fetch balances', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [address, toast]);

  useEffect(() => { if (address) fetchBalances(); }, [address, fetchBalances]);

  // -------------------------
  // Leather contract calls
  // -------------------------
  const callContract = async (fnName, fnArgs = []) => {
    if (!address) return toast({ title: 'Connect wallet', status: 'warning' });

    setActionLoading(true);
    try {
      const [contractAddr, contractName] = STAKING_CONTRACT_ID.split('.');
      const networkMode = STACKS_NETWORK.client.baseUrl.includes('mainnet') ? 'mainnet' : 'testnet';

      await window.LeatherProvider.request('stx_callContract', {
        contract: `${contractAddr}.${contractName}`,
        functionName: fnName,
        functionArgs: fnArgs.map(a => cvToHex(a)),
        network: networkMode,
      });

      toast({ title: `${fnName} submitted`, status: 'success' });
      await new Promise(r => setTimeout(r, 3500));
      await fetchBalances();
    } catch (err) {
      console.error(`${fnName} error`, err);
      toast({ title: `${fnName} error`, description: err?.message || String(err), status: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // -------------------------
  // Handlers
  // -------------------------
  const handleStake = async () => {
    const amount = Math.floor(parseFloat(stakeAmount || '0') * (10 ** DENOM_DECIMALS));
    if (!amount || amount <= 0) return toast({ title: 'Invalid amount', status: 'warning' });
    await callContract('stake', [uintCV(amount)]);
    setStakeAmount('');
  };

  const handleUnstake = async () => {
    const amount = Math.floor(parseFloat(unstakeAmount || '0') * (10 ** DENOM_DECIMALS));
    if (!amount || amount <= 0) return toast({ title: 'Invalid amount', status: 'warning' });
    await callContract('unstake', [uintCV(amount)]);
    setUnstakeAmount('');
  };

  const handleClaim = async () => {
    if (!balances.rewards || balances.rewards === 0n)
      return toast({ title: 'No rewards', status: 'info' });
    await callContract('claim-rewards', []);
  };

  // -------------------------
  // Formatting
  // -------------------------
  const formatBalance = (val) => {
    try {
      const scaled = Number(val) / (10 ** DENOM_DECIMALS);
      return scaled.toLocaleString(undefined, { maximumFractionDigits: 6 });
    } catch {
      return '0';
    }
  };

  return (
    <Box p={6} shadow="lg" borderWidth="1px" borderRadius="xl" width="100%" bg="gray.800">
      <Heading as="h2" size="lg" mb={4} textAlign="center">ARIA Staking & Rewards</Heading>

      <HStack spacing={3} mb={4}>
        <Button size="sm" onClick={fetchBalances}>Refresh</Button>
        <Text fontSize="sm" color="gray.300">{address ? `Connected: ${address}` : 'Not connected'}</Text>
        {lastError && <Text color="orange.300" fontSize="sm">Error: {lastError}</Text>}
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} textAlign="center">
        <Stat><StatLabel>Your ARIA Balance</StatLabel><StatNumber>{formatBalance(balances.aria)}</StatNumber></Stat>
        <Stat><StatLabel>Staked ARIA</StatLabel><StatNumber>{formatBalance(balances.staked)}</StatNumber></Stat>
        <Stat><StatLabel>Claimable STX Rewards</StatLabel><StatNumber>{formatBalance(balances.rewards)}</StatNumber></Stat>
      </SimpleGrid>

      <Divider my={6} />

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
        <VStack spacing={4}>
          <Heading size="md">Stake Your ARIA</Heading>
          <InputGroup>
            <Input placeholder="Amount to Stake" type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} />
            <InputRightAddon>{TOKEN_DISPLAY}</InputRightAddon>
          </InputGroup>
          <Button colorScheme="purple" onClick={handleStake} isLoading={actionLoading} isDisabled={!stakeAmount || parseFloat(stakeAmount) <= 0} width="100%">Stake</Button>
        </VStack>

        <VStack spacing={4}>
          <Heading size="md">Unstake Your ARIA</Heading>
          <InputGroup>
            <Input placeholder="Amount to Unstake" type="number" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} />
            <InputRightAddon>{TOKEN_DISPLAY}</InputRightAddon>
          </InputGroup>
          <Button colorScheme="orange" onClick={handleUnstake} isLoading={actionLoading} isDisabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0} width="100%">Unstake</Button>
        </VStack>
      </SimpleGrid>

      <VStack mt={6}>
        <Button colorScheme="green" size="lg" onClick={handleClaim} isLoading={actionLoading} isDisabled={balances.rewards === 0n} width={{ base: '100%', md: 'auto' }}>
          Claim {formatBalance(balances.rewards)} STX Rewards
        </Button>
      </VStack>

      {loading && (
        <VStack mt={4}><Spinner /><Text>Fetching balances…</Text></VStack>
      )}
    </Box>
  );
};

export default StakingPage;
