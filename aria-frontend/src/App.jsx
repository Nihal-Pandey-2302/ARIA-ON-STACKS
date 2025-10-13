// src/App.jsx
import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container, VStack, Heading } from '@chakra-ui/react';

// Page Imports
import HomePage from './pages/HomePage';
import StakingPage from './pages/StakingPage';
import MarketplacePage from './pages/MarketplacePage';

// Component Imports
import Header from './components/Header';
import Navbar from './components/Navbar';

function App() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Leather Wallet authentication
  const authenticate = async () => {
    if (!window.LeatherProvider) {
      alert("Leather Wallet not detected. Please install the extension.");
      return;
    }

    try {
      setLoading(true);

      // Request addresses from Leather
      const response = await window.LeatherProvider.request('getAddresses');
      console.log("Leather response:", response);

      const stxAddrObj = response?.result?.addresses?.find(a => a.symbol === 'STX');
      if (!stxAddrObj) {
        throw new Error("No Stacks address returned from Leather Wallet");
      }

      const stxAddress = stxAddrObj.address;
      console.log("Connected Stacks address:", stxAddress);

      // Store in state similar to Stacks Connect
      setUserData({ profile: { stxAddress: { testnet: stxAddress } } });

    } catch (err) {
      console.error("Wallet connection error:", err.message);
      alert("Wallet connection failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    // Simply clear state; Leather Wallet does not have a session object
    setUserData(null);
  };

  const address = userData?.profile?.stxAddress?.testnet;

  return (
    <Container maxW="container.xl" py={4}>
      <VStack spacing={4} align="stretch">
        <Header address={address} loading={loading} onConnect={authenticate} onDisconnect={disconnect} />
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage address={address} />} />
          <Route
            path="/marketplace"
            element={
              address ? <MarketplacePage address={address} /> :
              <VStack><Heading size="md">Please connect your wallet to view the marketplace.</Heading></VStack>
            }
          />
          <Route
            path="/staking"
            element={
              address ? <StakingPage address={address} /> :
              <VStack><Heading size="md">Please connect your wallet to manage staking.</Heading></VStack>
            }
          />
        </Routes>
      </VStack>
    </Container>
  );
}

export default App;
