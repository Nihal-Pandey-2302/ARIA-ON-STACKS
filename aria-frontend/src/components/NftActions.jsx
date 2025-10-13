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
  useToast
} from '@chakra-ui/react';
import {
  uintCV,
  cvToHex,
  createAsset // ✅ valid in @stacks/transactions@7.2.0
} from '@stacks/transactions';
import {
  STACKS_EXPLORER_URL,
  DENOM_DISPLAY,
  DENOM_DECIMALS,
  MARKETPLACE_CONTRACT_ID,
  RWA_NFT_CONTRACT_ID,
  STACKS_NETWORK
} from '../constants';

const NftActions = ({ txId, address, tokenId }) => {
  const [listPrice, setListPrice] = useState('');
  const [listingLoading, setListingLoading] = useState(false);
  const toast = useToast();

  const explorerLink = `${STACKS_EXPLORER_URL}/txid/${txId}?chain=testnet`;

  const handleList = async () => {
    if (!tokenId) {
      return toast({ title: 'NFT not confirmed yet', status: 'warning' });
    }

    const priceInMicroSTX = Math.floor(parseFloat(listPrice) * 10 ** DENOM_DECIMALS);
    if (isNaN(priceInMicroSTX) || priceInMicroSTX <= 0) {
      return toast({ title: 'Invalid Price', status: 'warning' });
    }

    setListingLoading(true);

    try {
      const [marketplaceAddress, marketplaceName] = MARKETPLACE_CONTRACT_ID.split('.');
      const [nftAddress, nftName] = RWA_NFT_CONTRACT_ID.split('.');

      // ✅ Create asset info (works in 7.2.0)
      const assetInfo = createAsset(nftAddress, nftName, 'rwa-nft');

      // ✅ Manually define the post-condition (JSON-safe)
      const postCondition = {
        type: 4, // NonFungiblePostCondition
        conditionCode: 4, // Sends
        principal: address,
        assetInfo,
        // Convert BigInt to string for safe JSON serialization
        assetName: { type: 'uint', value: String(Number(tokenId)) }
      };

      const functionArgs = [
        cvToHex(uintCV(Number(tokenId))),       // ✅ serialized clarity uint
        cvToHex(uintCV(priceInMicroSTX))        // ✅ serialized clarity uint
      ];

      const networkMode = STACKS_NETWORK.client.baseUrl.includes('mainnet')
        ? 'mainnet'
        : 'testnet';

      console.log('Calling Leather with:', {
        contract: `${marketplaceAddress}.${marketplaceName}`,
        functionName: 'list-asset',
        functionArgs,
        postConditions: [postCondition],
        network: networkMode
      });

      // ✅ JSON-safe payload for Leather
      await window.LeatherProvider.request('stx_callContract', {
        contract: `${marketplaceAddress}.${marketplaceName}`,
        functionName: 'list-asset',
        functionArgs,
        postConditions: [postCondition],
        network: networkMode
      });

      toast({
        title: 'Listing Submitted!',
        description: 'NFT listing is being processed',
        status: 'success'
      });
    } catch (e) {
      console.error('Listing error:', e);
      toast({
        title: 'Listing Error',
        description: e.error?.message || e.message || 'Failed to list NFT',
        status: 'error',
        duration: 10000
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
