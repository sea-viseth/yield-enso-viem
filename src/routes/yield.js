const express = require('express');
require('dotenv').config();
const { fetchEUReGnosisViaEnso } = require('../services/aaveService.js');
const {
  initEnsoClient,
  getDepositRoute,
} = require('../services/ensoService.js');
const {
  EURe_TOKEN_ADDRESS_GNOSIS,
  CHAIN_ID_GNOSIS,
  AEURE_TOKEN_ADDRESS_GNOSIS,
} = require('../config/constant.js');
const { createWalletClient, http, createPublicClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { gnosis } = require('viem/chains');
const { ethers } = require('ethers');

const router = express.Router();
const WALLET = process.env.WALLET_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const API_KEY = process.env.ENSO_API_KEY;
const AMOUNT = '1000000000000000000'; // 1 EURe in wei

initEnsoClient(API_KEY);

router.get('/deposit/enso', async (req, res) => {
  try {
    const route = await getDepositRoute(
      WALLET,
      EURe_TOKEN_ADDRESS_GNOSIS,
      AEURE_TOKEN_ADDRESS_GNOSIS,
      AMOUNT,
      CHAIN_ID_GNOSIS
    );

    if (!route) {
      return res.status(500).json({ error: 'Failed to fetch Enso route' });
    }

    const { tx } = route;
    const { to, data } = tx;

    if (!to || !data) {
      return res
        .status(500)
        .json({ error: 'Invalid transaction data from Enso' });
    }

    const provider = new ethers.JsonRpcProvider('https://rpc.gnosischain.com');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const ERC20_ABI = [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ];
    const token = new ethers.Contract(
      EURe_TOKEN_ADDRESS_GNOSIS,
      ERC20_ABI,
      signer
    );

    const realSpender = route.allowanceTarget || to;

    const currentAllowance = await token.allowance(WALLET, realSpender);

    if (currentAllowance < BigInt(AMOUNT)) {
      console.log('🔑 Approving token...');
      const approveTx = await token.approve(realSpender, AMOUNT);
      await approveTx.wait();
      console.log('✅ Approved!');
    } else {
      console.log('✅ Already approved');
    }

    // ✅ Setup wallet client for sending
    const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);

    const client = createWalletClient({
      account,
      chain: gnosis,
      transport: http('https://rpc.gnosischain.com'),
    });

    // ✅ Setup public client for gas estimation
    const publicClient = createPublicClient({
      chain: gnosis,
      transport: http('https://rpc.gnosischain.com'),
    });

    // ✅ Estimate safe gas
    const estimatedGas = await publicClient.estimateGas({
      account,
      to,
      data,
      value: 0n,
    });

    // ✅ Send transaction using safe gas
    const hash = await client.sendTransaction({
      account,
      to,
      data,
      value: 0n,
      gas: estimatedGas,
    });

    return res.json({ success: true, hash });
  } catch (error) {
    console.error('❌ Deposit error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Optional: Fetch token list
router.get('/enso', async (req, res) => {
  const data = await fetchEUReGnosisViaEnso();
  if (!data)
    return res.status(500).json({ error: 'Failed to fetch Enso data' });
  res.json(data);
});

// Optional: Withdraw route
router.get('/withdraw/enso', async (req, res) => {
  try {
    const route = await getDepositRoute(
      WALLET,
      AEURE_TOKEN_ADDRESS_GNOSIS,
      EURe_TOKEN_ADDRESS_GNOSIS,
      AMOUNT,
      CHAIN_ID_GNOSIS
    );

    if (!route) {
      return res.status(500).json({ error: 'Failed to fetch Enso route' });
    }

    const { tx } = route;
    const { to, data } = tx;

    if (!to || !data) {
      return res
        .status(500)
        .json({ error: 'Invalid transaction data from Enso' });
    }

    const provider = new ethers.JsonRpcProvider('https://rpc.gnosischain.com');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const ERC20_ABI = [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ];
    const token = new ethers.Contract(
      AEURE_TOKEN_ADDRESS_GNOSIS,
      ERC20_ABI,
      signer
    );

    const realSpender = route.allowanceTarget || to;

    const currentAllowance = await token.allowance(WALLET, realSpender);

    if (currentAllowance < BigInt(AMOUNT)) {
      console.log('🔑 Approving token...');
      const approveTx = await token.approve(realSpender, AMOUNT);
      await approveTx.wait();
      console.log('✅ Approved!');
    } else {
      console.log('✅ Already approved');
    }

    // ✅ Setup wallet client for sending
    const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);

    const client = createWalletClient({
      account,
      chain: gnosis,
      transport: http('https://rpc.gnosischain.com'),
    });

    // ✅ Setup public client for gas estimation
    const publicClient = createPublicClient({
      chain: gnosis,
      transport: http('https://rpc.gnosischain.com'),
    });

    // ✅ Estimate safe gas
    const estimatedGas = await publicClient.estimateGas({
      account,
      to,
      data,
      value: 0n,
    });

    // ✅ Send transaction using safe gas
    const hash = await client.sendTransaction({
      account,
      to,
      data,
      value: 0n,
      gas: estimatedGas,
    });

    return res.json({ success: true, hash });
  } catch (error) {
    console.error('❌ Deposit error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
