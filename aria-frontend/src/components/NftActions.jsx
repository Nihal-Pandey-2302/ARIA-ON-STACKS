// src/components/NftActions.jsx
import { useState } from 'react';
import {
  Box,
  Alert,
  AlertIcon,
  Link,
  Text,
  Button,
  VStack,
  Input,
  InputGroup,
  Heading,
  useToast,
} from '@chakra-ui/react';
import { cvToHex, uintCV, NonFungibleConditionCode, PostConditionMode } from '@stacks/transactions';
import {
  STACKS_EXPLORER_URL,
  DENOM_DISPLAY,
  DENOM_DECIMALS,
  MARKETPLACE_CONTRACT_ID,
  RWA_NFT_CONTRACT_ID,
  STACKS_NETWORK,
} from '../constants';
import { buildNFTPostCondition } from '../utils/postConditions';

const NftActions = ({ txId, address, tokenId }) => {
  const [listPrice, setListPrice] = useState('');
  const [listingLoading, setListingLoading] = useState(false);
  const toast = useToast();

  const explorerLink = `${STACKS_EXPLORER_URL}/txid/${txId}?chain=testnet`;

  // ✅ Leather-compatible NFT post-condition
  const makeLeatherNFTPostCondition = (walletAddress, nftAddress, nftName, assetName, tokenId) => ({
    principal: {
      address: walletAddress,
      id: 2, // standard principal
    },
    conditionCode: NonFungibleConditionCode.DoesNotSend, // 7
    type: 2, // NFT type
    assetInfo: {
      address: nftAddress,
      contractName: nftName,
      assetName,
    },
    value: tokenId, // plain number
    postConditionMode: PostConditionMode.Deny, // 2
  });

  const handleList = async () => {
  if (!tokenId) {
    return toast({ title: 'NFT not confirmed yet', status: 'warning' });
  }

  const priceNum = parseFloat(listPrice?.trim());
  if (!priceNum || priceNum <= 0) {
    return toast({ title: 'Invalid Price', status: 'warning' });
  }

  const priceInMicroSTX = Math.floor(priceNum * 10 ** DENOM_DECIMALS);
  setListingLoading(true);

  try {
    // Split contract strings
    const [marketplaceAddress, marketplaceName] = MARKETPLACE_CONTRACT_ID.split('.');

    // Function args for listing contract
    const functionArgs = [
      cvToHex(uintCV(Number(tokenId))),
      cvToHex(uintCV(priceInMicroSTX)),
    ];

    const networkMode =
      STACKS_NETWORK?.client?.baseUrl?.includes('mainnet') ? 'mainnet' : 'testnet';

    const txPayload = {
  contract: `${marketplaceAddress}.${marketplaceName}`,
  functionName: 'list-asset',
  functionArgs,
  network: networkMode,
  // REMOVE postConditions for now
};


    console.log('Listing txPayload:', JSON.stringify(txPayload, null, 2));

    if (!window?.LeatherProvider?.request) {
      throw new Error('LeatherProvider not available');
    }

    const result = await window.LeatherProvider.request('stx_callContract', txPayload);

    console.log('Leather result:', result);

    toast({
      title: 'Listing Submitted!',
      description: 'NFT listing is being processed',
      status: 'success',
    });
  } catch (err) {
    console.error('Listing error full:', err);
    toast({
      title: 'Listing Error',
      description: err?.error?.message || err?.message || JSON.stringify(err) || 'Failed to list NFT',
      status: 'error',
    });
  } finally {
    setListingLoading(false);
  }
};


  return (
    <Box width="100%" mt={6}>
      <Alert status="success" borderRadius="md" w="100%" mb={4}>
        <AlertIcon />
        <Box>
          <Text>Mint transaction confirmed! NFT ID: {tokenId}</Text>
          <Link
            href={explorerLink}
            isExternal
            color="blue.300"
            textDecoration="underline"
          >
            View Transaction
          </Link>
        </Box>
      </Alert>

      {tokenId && (
        <Box
          mt={8}
          p={5}
          shadow="sm"
          borderWidth="1px"
          borderRadius="md"
          borderColor="gray.700"
        >
          <Heading as="h3" size="md" mb={4}>
            Step 2: List NFT #{tokenId} for Sale
          </Heading>
          <VStack spacing={4}>
            <InputGroup>
              <Input
                placeholder="Enter price in STX"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                type="number"
              />
              <Text alignSelf="center" ml={2} color="gray.400">
                {DENOM_DISPLAY}
              </Text>
            </InputGroup>
            <Button
              onClick={handleList}
              isLoading={listingLoading}
              isDisabled={!listPrice}
              colorScheme="green"
              size="lg"
              w="100%"
            >
              List on Marketplace
            </Button>
          </VStack>
        </Box>
      )}
    </Box>
  );
};

export default NftActions;
