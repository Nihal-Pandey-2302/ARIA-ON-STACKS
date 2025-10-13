import { useState, useEffect, useCallback } from 'react';
import { Box, Button, Heading, Text, VStack, Spinner, SimpleGrid, Image, useToast } from '@chakra-ui/react';
import { cvToJSON, uintCV, cvToHex, Pc } from '@stacks/transactions';

import { STACKS_NETWORK, RWA_NFT_CONTRACT_ID, MARKETPLACE_CONTRACT_ID, DENOM_DISPLAY, DENOM_DECIMALS } from '../constants';

const MarketplacePage = ({ address }) => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingNft, setBuyingNft] = useState(null);
  const toast = useToast();

  const callReadOnly = async (contractId, functionName, functionArgs) => {
    const [contractAddress, contractName] = contractId.split('.');
    const response = await fetch(`${STACKS_NETWORK.client.baseUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: address, arguments: functionArgs.map(cvToHex) }),
    });
    if (!response.ok) throw new Error(`Failed to call read-only function ${functionName}`);
    const data = await response.json();
    if (!data.okay) throw new Error(`Read-only call failed: ${data.cause}`);
    return cvToJSON(data.result);
  };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const lastTokenIdResult = await callReadOnly(RWA_NFT_CONTRACT_ID, 'get-last-token-id', []);
      const lastTokenId = parseInt(lastTokenIdResult.value);
      if (lastTokenId === 0) {
        setListings([]);
        return;
      }

      const listingPromises = [];
      for (let i = 1; i <= lastTokenId; i++) {
        listingPromises.push(
          callReadOnly(MARKETPLACE_CONTRACT_ID, 'get-listing', [uintCV(i)])
            .then(async (listingResult) => {
              if (listingResult.value) {
                const metadataUriResult = await callReadOnly(RWA_NFT_CONTRACT_ID, 'get-token-uri', [uintCV(i)]);
                const ipfsHash = metadataUriResult.value.value;
                const metadataResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
                const metadata = await metadataResponse.json();
                return { tokenId: i, price: parseInt(listingResult.value.price.value), seller: listingResult.value.seller.value, metadata };
              }
              return null;
            })
        );
      }
      const results = await Promise.all(listingPromises);
      setListings(results.filter(r => r !== null));
    } catch (e) {
      console.error("Error fetching listings:", e);
      toast({ title: "Error", description: "Could not fetch marketplace listings.", status: "error" });
    } finally {
      setLoading(false);
    }
  }, [address, toast]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleBuy = async (listing) => {
    setBuyingNft(listing.tokenId);

    try {
      const [marketplaceAddress, marketplaceName] = MARKETPLACE_CONTRACT_ID.split('.');

      // ✅ v7 post-condition: Buyer sends STX equal to the price
      const postCondition = Pc.origin(address).willSendSTX().equalTo(BigInt(listing.price));

      const networkMode = STACKS_NETWORK.client.baseUrl.includes('mainnet') ? 'mainnet' : 'testnet';

      await window.LeatherProvider.request('stx_callContract', {
        contract: `${marketplaceAddress}.${marketplaceName}`,
        functionName: 'purchase-asset',
        functionArgs: [cvToHex(uintCV(listing.tokenId))],
        postConditions: [postCondition],
        network: networkMode,
      });

      toast({
        title: "Purchase Submitted!",
        description: "Your purchase is being processed",
        status: "success"
      });

      setTimeout(fetchListings, 3000);

    } catch (e) {
      console.error("Purchase error:", e);
      const errorMsg = e.error?.message || e.message || "Failed to purchase NFT";
      toast({
        title: "Purchase Error",
        description: errorMsg,
        status: "error",
        duration: 8000
      });
    } finally {
      setBuyingNft(null);
    }
  };

  if (loading) {
    return (
      <VStack py={10}>
        <Spinner size="xl" />
        <Text>Loading marketplace...</Text>
      </VStack>
    );
  }

  return (
    <Box mt={2} p={6} shadow="lg" borderWidth="1px" borderRadius="xl" width="100%" bg="gray.800">
      <Heading as="h2" size="lg" mb={6} textAlign="center">RWA Marketplace</Heading>
      {listings.length === 0 ? (
        <Text textAlign="center">No RWA NFTs are for sale.</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {listings.map((listing) => (
            <Box key={listing.tokenId} p={5} shadow="md" borderWidth="1px" borderRadius="md" bg="gray.700">
              <VStack spacing={4}>
                <Image
                  src={listing.metadata.image}
                  alt={listing.metadata.name}
                  borderRadius="md"
                  boxSize="200px"
                  objectFit="cover"
                  fallbackSrc="https://via.placeholder.com/200"
                />
                <Heading size="md" noOfLines={1}>{listing.metadata.name}</Heading>
                <Text fontWeight="bold" fontSize="lg" color="purple.300">
                  {listing.price / (10 ** DENOM_DECIMALS)} {DENOM_DISPLAY}
                </Text>
                <Button
                  colorScheme="purple"
                  width="100%"
                  onClick={() => handleBuy(listing)}
                  isLoading={buyingNft === listing.tokenId}
                  isDisabled={address === listing.seller}
                >
                  {address === listing.seller ? "You are the seller" : "Buy Now"}
                </Button>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
};

export default MarketplacePage;
