import { useState, useEffect, useCallback } from 'react';
import { Box, Button, Heading, Text, VStack, Spinner, SimpleGrid, Image, useToast, Badge } from '@chakra-ui/react';
import { cvToJSON, uintCV, cvToHex, Pc, deserializeCV } from '@stacks/transactions';

import { STACKS_NETWORK, RWA_NFT_CONTRACT_ID, MARKETPLACE_CONTRACT_ID, DENOM_DISPLAY, DENOM_DECIMALS } from '../constants';

const MarketplacePage = ({ address }) => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingNft, setBuyingNft] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const toast = useToast();

  const callReadOnly = async (contractId, functionName, functionArgs) => {
    try {
      const [contractAddress, contractName] = contractId.split('.');
      const url = `${STACKS_NETWORK.client.baseUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;
      
      console.log('📡 Calling read-only:', { contractId, functionName, url });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sender: address, 
          arguments: functionArgs.map(cvToHex) 
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Read-only call failed:', errorText);
        throw new Error(`Failed to call ${functionName}: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Read-only result RAW:', { functionName, rawData: data });
      console.log('✅ Result structure:', JSON.stringify(data, null, 2));
      
      if (!data.okay) {
        console.error('❌ Contract returned not okay:', data);
        throw new Error(`Read-only call failed: ${data.cause}`);
      }
      
      const clarityValue = deserializeCV(data.result);
      console.log('✅ Deserialized Clarity Value:', clarityValue);
      
      const parsedResult = cvToJSON(clarityValue);
      console.log('✅ Parsed CV result:', parsedResult);
      
      return parsedResult;
    } catch (error) {
      console.error('❌ callReadOnly error:', error);
      throw error;
    }
  };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const debug = { step: '', error: null, lastTokenId: 0, listings: [] };

    try {
      // ───────────────────────────────────────────────
      // STEP 1: Fetch total NFTs minted
      // ───────────────────────────────────────────────
      debug.step = 'Fetching last token ID';
      console.log('🔍 Step 1: Getting last token ID from', RWA_NFT_CONTRACT_ID);

      const lastTokenIdResult = await callReadOnly(
        RWA_NFT_CONTRACT_ID,
        'get-last-token-id',
        []
      );
      console.log('📊 Last token ID result RAW:', lastTokenIdResult);
      console.log('📊 Full result structure:', JSON.stringify(lastTokenIdResult, null, 2));

      let lastTokenId = 0;

      if (
        (lastTokenIdResult.type === 'ok' || lastTokenIdResult.success === true) &&
        lastTokenIdResult.value
      ) {
        const innerValue = lastTokenIdResult.value;
        if (innerValue.type === 'uint' || innerValue.type === 'int') {
          lastTokenId = Number(innerValue.value);
        } else if (typeof innerValue === 'string' || typeof innerValue === 'number') {
          lastTokenId = parseInt(innerValue);
        }
      } else if (lastTokenIdResult.success !== undefined) {
        lastTokenId = parseInt(lastTokenIdResult.value || 0);
      } else if (lastTokenIdResult.value !== undefined) {
        lastTokenId = parseInt(lastTokenIdResult.value);
      }

      debug.lastTokenId = lastTokenId;
      console.log('🎯 Parsed last token ID:', lastTokenId);

      if (lastTokenId === 0) {
        console.log('ℹ️ No NFTs minted yet (or transactions still pending)');
        setListings([]);
        setDebugInfo({
          ...debug,
          step: 'No NFTs found. If you just minted, wait 30-60 seconds and refresh.',
        });
        return;
      }

      // ───────────────────────────────────────────────
      // STEP 2: Check listings for each token
      // ───────────────────────────────────────────────
      debug.step = `Checking ${lastTokenId} tokens for listings`;
      console.log(`🔍 Step 2: Checking tokens 1–${lastTokenId} for listings`);

      const listingPromises = [];

      for (let i = 1; i <= lastTokenId; i++) {
        listingPromises.push(
          (async () => {
            try {
              console.log(`🔍 Checking listing for token #${i}`);
              const listingResult = await callReadOnly(
                MARKETPLACE_CONTRACT_ID,
                'get-listing',
                [uintCV(i)]
              );

              console.log(`🧩 Listing result (raw JSON) for token #${i}:`, JSON.stringify(listingResult, null, 2));

              if (!listingResult || listingResult.type === 'none' || !listingResult.value) {
                console.log(`⏭️ Token #${i} is not listed`);
                return null;
              }

              if (
                listingResult.type === 'some' ||
                listingResult.type?.startsWith('(optional') ||
                listingResult.value?.price
              ) {
                // Extract the tuple value from the optional wrapper
                const listingData = listingResult.value?.value || listingResult.value;
                console.log(`📋 Token #${i} listing data:`, listingData);

                // Handle nested price/seller structure
                const priceCV = listingData.price?.value !== undefined ? listingData.price.value : listingData.price;
                const sellerCV = listingData.seller?.value !== undefined ? listingData.seller.value : listingData.seller;

                // ───────────────────────────────
                // Fetch metadata from NFT contract
                // ───────────────────────────────
                console.log(`📝 Fetching metadata for token #${i}`);
                const metadataUriResult = await callReadOnly(
                  RWA_NFT_CONTRACT_ID,
                  'get-token-uri',
                  [uintCV(i)]
                );
                console.log(`🗂️ Token #${i} metadata URI result:`, metadataUriResult);

                let ipfsHash = null;
                const resp = metadataUriResult.value;

                if (!resp) {
                  console.warn(`⚠️ No response found for token #${i}`, metadataUriResult);
                  return null;
                }

                if (resp.value && resp.value.value) {
                  ipfsHash = resp.value.value;
                } else if (resp.value && typeof resp.value === 'string') {
                  ipfsHash = resp.value;
                }

                if (!ipfsHash || typeof ipfsHash !== 'string') {
                  console.warn(`⚠️ No valid IPFS hash found for token #${i}`, metadataUriResult);
                  return null;
                }

                console.log(`🌐 Fetching IPFS metadata for token #${i} from ${ipfsHash}`);
                const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

                try {
                  const metadataResponse = await fetch(metadataUrl);
                  if (!metadataResponse.ok) throw new Error(`HTTP ${metadataResponse.status}`);

                  const metadata = await metadataResponse.json();
                  console.log(`✅ Got metadata for token #${i}:`, metadata);

                  const numPrice = Number(priceCV);
                  console.log(`💰 Token #${i} price parsed as:`, numPrice, 'from:', priceCV);
                  
                  return {
                    tokenId: i,
                    price: numPrice,
                    seller: sellerCV,
                    metadata,
                  };
                } catch (err) {
                  console.error(`❌ Failed to fetch IPFS metadata for token #${i}:`, err);
                  return null;
                }
              }

              console.warn(`⚠️ Unexpected listing result type for token #${i}:`, listingResult.type);
              return null;
            } catch (err) {
              console.error(`❌ Error fetching token #${i}:`, err);
              return null;
            }
          })()
        );
      }

      const results = await Promise.all(listingPromises);
      const validListings = results.filter((r) => r !== null);

      console.log('✅ Final listings:', validListings);
      debug.step = 'Complete';

      setListings(validListings);
      setDebugInfo(debug);
      setLastRefresh(new Date());

      if (validListings.length === 0) {
        toast({
          title: 'No Listings Found',
          description: `${lastTokenId} NFT(s) minted, but none are listed for sale.`,
          status: 'info',
        });
      }
    } catch (e) {
      console.error('❌ Error fetching listings:', e);
      debug.error = e.message;
      debug.step = 'Failed: ' + debug.step;
      setDebugInfo(debug);

      toast({
        title: 'Error',
        description: `Could not fetch marketplace listings: ${e.message}`,
        status: 'error',
        duration: 8000,
      });
    } finally {
      setLoading(false);
    }
  }, [address, toast]);

  useEffect(() => { 
    if (address) {
      fetchListings(); 
    }
  }, [fetchListings, address]);

  const handleBuy = async (listing) => {
    setBuyingNft(listing.tokenId);

    try {
      const [marketplaceAddress, marketplaceName] = MARKETPLACE_CONTRACT_ID.split('.');

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
        {debugInfo && (
          <Text fontSize="sm" color="gray.500">
            {debugInfo.step}
          </Text>
        )}
      </VStack>
    );
  }

  return (
    <Box mt={2} p={6} shadow="lg" borderWidth="1px" borderRadius="xl" width="100%" bg="gray.800">
      <VStack spacing={4} mb={6}>
        <Heading as="h2" size="lg" textAlign="center">RWA Marketplace</Heading>
        
        <Button 
          onClick={fetchListings} 
          colorScheme="blue" 
          size="sm"
          leftIcon={<span>🔄</span>}
        >
          Refresh Marketplace
        </Button>
        
        {lastRefresh && (
          <Text fontSize="xs" color="gray.500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Text>
        )}
      </VStack>
      
      {debugInfo && (
        <Box mb={4} p={4} bg="gray.700" borderRadius="md" fontSize="sm" borderWidth="1px" borderColor="blue.500">
          <VStack align="stretch" spacing={2}>
            <Text><strong>🔍 Status:</strong> {debugInfo.step}</Text>
            <Text><strong>📊 Total NFTs Minted:</strong> {debugInfo.lastTokenId}</Text>
            <Text><strong>🏪 Listed for Sale:</strong> {debugInfo.listings.length}</Text>
            {debugInfo.error && (
              <Text color="red.300"><strong>❌ Error:</strong> {debugInfo.error}</Text>
            )}
            {debugInfo.lastTokenId > 0 && listings.length === 0 && (
              <Text color="yellow.300">
                ⚠️ NFTs exist but none are listed. Make sure you clicked "List on Marketplace" after minting!
              </Text>
            )}
          </VStack>
        </Box>
      )}
      
      {listings.length === 0 ? (
        <VStack spacing={4} py={8}>
          <Text textAlign="center" fontSize="lg">No RWA NFTs are currently listed for sale.</Text>
          {debugInfo && debugInfo.lastTokenId > 0 && (
            <VStack spacing={3}>
              <Badge colorScheme="blue" p={3} fontSize="md">
                📦 {debugInfo.lastTokenId} NFT(s) exist but are not listed
              </Badge>
              <Text fontSize="sm" color="gray.400" maxW="md" textAlign="center">
                If you just minted and listed an NFT, it may take 30-60 seconds to appear. 
                Click "Refresh Marketplace" above to check again.
              </Text>
            </VStack>
          )}
          {(!debugInfo || debugInfo.lastTokenId === 0) && (
            <Text fontSize="sm" color="gray.400">
              💡 Mint your first RWA NFT on the Home page to get started!
            </Text>
          )}
        </VStack>
      ) : (
        <>
          <Text textAlign="center" mb={4} color="gray.400">
            {listings.length} listing(s) available
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {listings.map((listing) => (
              <Box key={listing.tokenId} p={5} shadow="md" borderWidth="1px" borderRadius="md" bg="gray.700">
                <VStack spacing={4}>
                  <Badge colorScheme="purple">NFT #{listing.tokenId}</Badge>
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
        </>
      )}
    </Box>
  );
};

export default MarketplacePage;