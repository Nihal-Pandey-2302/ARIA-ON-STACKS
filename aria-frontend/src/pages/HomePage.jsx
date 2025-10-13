// src/pages/HomePage.jsx
import { useState, useCallback } from 'react';
import { VStack, Alert, AlertIcon, Heading, useToast, Box, Spinner, Text } from '@chakra-ui/react';
import FileUpload from '../components/FileUpload';
import LiveWorkflowVisualizer from '../components/LiveWorkflowVisualizer';
import AIReportCard from '../components/AIReportCard';
import NftActions from '../components/NftActions';
import { BACKEND_URL } from '../constants';

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function HomePage({ address }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [apiResult, setApiResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState('idle');
  const [isConfirming, setIsConfirming] = useState(false);
  const toast = useToast();

  // This function polls the API to get the confirmed tokenId
  const waitForTxConfirmation = async (txId) => {
    setIsConfirming(true);
    setWorkflowStatus('confirming');
    
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`https://api.testnet.hiro.so/extended/v1/tx/${txId}`);
        
        if (!response.ok) {
          console.log(`Attempt ${attempts + 1}: Transaction not found yet`);
          attempts++;
          await wait(5000);
          continue;
        }
        
        const txData = await response.json();
        console.log('Transaction data:', txData);
        console.log('Transaction status:', txData.tx_status);
        
        if (txData.tx_status === 'success') {
          console.log('Transaction events:', txData.events);
          
          // Find the NFT mint event - try multiple approaches
          const mintEvent = txData.events?.find(e => 
            e.event_type === 'non_fungible_token_asset' || 
            e.event_type === 'nft_mint_event' ||
            (e.event_type === 'smart_contract_log' && e.contract_log?.value?.repr?.includes('mint'))
          );
          
          console.log('Mint event found:', mintEvent);
          
          if (mintEvent) {
            let tokenId;
            
            // Try different ways to extract token ID based on event structure
            if (mintEvent.asset?.value?.repr) {
              // Format: u1, u2, etc.
              tokenId = parseInt(mintEvent.asset.value.repr.replace('u', ''));
            } else if (mintEvent.nft_asset_event?.value?.repr) {
              tokenId = parseInt(mintEvent.nft_asset_event.value.repr.replace('u', ''));
            } else if (mintEvent.contract_log?.value?.repr) {
              // Try to extract from contract log
              const match = mintEvent.contract_log.value.repr.match(/u(\d+)/);
              if (match) tokenId = parseInt(match[1]);
            }
            
            console.log('Extracted token ID:', tokenId);
            
            if (tokenId) {
              setApiResult(prev => ({ ...prev, confirmedTokenId: tokenId }));
              setIsConfirming(false);
              setWorkflowStatus('minted');
              toast({ 
                title: "Mint Confirmed!", 
                description: `Your NFT (ID: ${tokenId}) is now on-chain.`, 
                status: "success",
                duration: 5000,
              });
              return;
            }
          }
          
          // If we can't find the token ID but tx is successful, still update UI
          console.warn('Transaction successful but could not extract token ID');
          setIsConfirming(false);
          setWorkflowStatus('minted');
          toast({ 
            title: "Mint Confirmed!", 
            description: "Your NFT is now on-chain. Check the transaction on the explorer.", 
            status: "success",
            duration: 5000,
          });
          return;
        }
        
        if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
          setIsConfirming(false);
          setWorkflowStatus('idle');
          setError('Transaction failed: ' + txData.tx_status);
          toast({ 
            title: "Transaction Failed", 
            description: txData.tx_status, 
            status: "error" 
          });
          return;
        }
        
        // Transaction is still pending
        console.log(`Attempt ${attempts + 1}: Transaction pending...`);
        
      } catch (e) {
        console.error("Polling error:", e);
      }
      
      attempts++;
      await wait(5000); // Wait 5 seconds before trying again
    }
    
    // Timeout reached
    setIsConfirming(false);
    toast({ 
      title: "Confirmation Timeout", 
      description: "Transaction is taking longer than expected. Check the explorer for status.", 
      status: "warning",
      duration: 10000,
    });
  };

  const handleAnalyzeAndMint = useCallback(async () => {
    if (!selectedFile) {
      toast({ title: "No file selected", status: "warning" });
      return;
    }
    
    if (!address) {
      toast({ title: "Please connect your wallet", status: "warning" });
      return;
    }
    
    setLoading(true);
    setError(null);
    setApiResult(null);
    setWorkflowStatus('analyzing');

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('owner_address', address);

      const response = await fetch(`${BACKEND_URL}/analyze_and_mint`, { 
        method: 'POST', 
        body: formData 
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze and mint');
      }
      
      console.log('Backend result:', result);
      setApiResult(result);
      
      toast({ 
        title: "Mint Transaction Sent!", 
        description: "Waiting for blockchain confirmation...", 
        status: "info", 
        duration: 10000 
      });
      
      // Start polling for confirmation
      waitForTxConfirmation(result.txId);

    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      setWorkflowStatus('idle');
      toast({ 
        title: "Error", 
        description: err.message, 
        status: "error" 
      });
    } finally {
      setLoading(false);
    }
  }, [selectedFile, address, toast]);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setApiResult(null);
    setError(null);
    setWorkflowStatus('idle');
    setIsConfirming(false);
  };

  return (
    <VStack spacing={8} align="stretch">
      <Box p={6} shadow="lg" borderWidth="1px" borderRadius="xl" width="100%" bg="gray.800">
        <Heading as="h2" size="lg" mb={6} textAlign="center">
          Step 1: Mint your RWA NFT
        </Heading>
        
        <FileUpload
          selectedFile={selectedFile}
          setSelectedFile={handleFileSelect} 
          onAnalyzeAndMint={handleAnalyzeAndMint}
          isLoading={loading}
          isMinted={!!apiResult}
        />

        {(loading || apiResult) && <LiveWorkflowVisualizer status={workflowStatus} />}
        
        {isConfirming && (
          <VStack mt={4} spacing={2}>
            <Spinner size="lg" color="blue.500" />
            <Text>Waiting for transaction confirmation...</Text>
            <Text fontSize="sm" color="gray.400">
              This may take 1-2 minutes on testnet
            </Text>
          </VStack>
        )}
        
        {error && (
          <Alert status="error" mt={4} borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {apiResult && (
          <>
            <AIReportCard 
              report={apiResult.ai_report_display} 
              ipfsLink={apiResult.ipfs_link} 
            />
            <NftActions 
              txId={apiResult.txId} 
              address={address} 
              tokenId={apiResult.confirmedTokenId}
            />
          </>
        )}
      </Box>
    </VStack>
  );
}