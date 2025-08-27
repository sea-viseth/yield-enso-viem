const express = require("express");
require("dotenv").config();
const { fetchEUReGnosisViaEnso } = require("../services/aaveService.js");
const {
  initEnsoClient,
  getDepositRoute
} = require("../services/ensoService.js");
const {
  EURe_TOKEN_ADDRESS_GNOSIS,
  CHAIN_ID_GNOSIS,
  AEURE_TOKEN_ADDRESS_GNOSIS,
  EURe_TOKEN_ADDRESS_POL_V1
} = require("../config/constant.js");
const {
  createWalletClient,
  http,
  createPublicClient,
  encodeFunctionData
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { getTokenBalance } = require("../utils/index.js");
const { gnosis, polygon } = require("viem/chains");
const { erc20Abi } = require("viem");
const { ethers } = require("ethers");
const router = express.Router();
const WALLET = process.env.WALLET_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const API_KEY = process.env.ENSO_API_KEY;
const AMOUNT = "1000000000000000000"; // 1 EURe in wei

initEnsoClient(API_KEY);

// deposit aave eure from gnosis to gnosis via enso
router.get("/deposit/enso", async (req, res) => {
  try {
    const route = await getDepositRoute(
      WALLET,
      EURe_TOKEN_ADDRESS_GNOSIS,
      AEURE_TOKEN_ADDRESS_GNOSIS,
      AMOUNT,
      CHAIN_ID_GNOSIS
    );

    if (!route) {
      return res.status(500).json({ error: "Failed to fetch Enso route" });
    }

    const { tx } = route;
    const { to, data } = tx;

    if (!to || !data) {
      return res
        .status(500)
        .json({ error: "Invalid transaction data from Enso" });
    }

    const provider = new ethers.JsonRpcProvider("https://rpc.gnosischain.com");
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const ERC20_ABI = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ];
    const token = new ethers.Contract(
      EURe_TOKEN_ADDRESS_GNOSIS,
      ERC20_ABI,
      signer
    );

    const realSpender = route.allowanceTarget || to;

    const currentAllowance = await token.allowance(WALLET, realSpender);

    if (currentAllowance < BigInt(AMOUNT)) {
      console.log("🔑 Approving token...");
      const approveTx = await token.approve(realSpender, AMOUNT);
      await approveTx.wait();
      console.log("✅ Approved!");
    } else {
      console.log("✅ Already approved");
    }

    // ✅ Setup wallet client for sending
    const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
    const client = createWalletClient({
      account,
      chain: gnosis,
      transport: http("https://rpc.gnosischain.com")
    });

    // ✅ Setup public client for gas estimation
    const publicClient = createPublicClient({
      chain: gnosis,
      transport: http("https://rpc.gnosischain.com")
    });

    // ✅ Estimate safe gas
    const estimatedGas = await publicClient.estimateGas({
      account,
      to,
      data,
      value: 0n
    });

    // ✅ Send transaction using safe gas
    const hash = await client.sendTransaction({
      account,
      to,
      data,
      value: 0n,
      gas: estimatedGas
    });

    return res.json({ success: true, hash });
  } catch (error) {
    console.error("❌ Deposit error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Optional: Withdraw route
router.get("/withdraw/enso", async (req, res) => {
  try {
    const route = await getDepositRoute(
      WALLET,
      AEURE_TOKEN_ADDRESS_GNOSIS,
      EURe_TOKEN_ADDRESS_GNOSIS,
      AMOUNT,
      CHAIN_ID_GNOSIS
    );

    if (!route) {
      return res.status(500).json({ error: "Failed to fetch Enso route" });
    }

    const { tx } = route;
    const { to, data } = tx;

    if (!to || !data) {
      return res
        .status(500)
        .json({ error: "Invalid transaction data from Enso" });
    }

    const provider = new ethers.JsonRpcProvider("https://rpc.gnosischain.com");
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const ERC20_ABI = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ];
    const token = new ethers.Contract(
      AEURE_TOKEN_ADDRESS_GNOSIS,
      ERC20_ABI,
      signer
    );

    const realSpender = route.allowanceTarget || to;

    const currentAllowance = await token.allowance(WALLET, realSpender);

    if (currentAllowance < BigInt(AMOUNT)) {
      console.log("🔑 Approving token...");
      const approveTx = await token.approve(realSpender, AMOUNT);
      await approveTx.wait();
      console.log("✅ Approved!");
    } else {
      console.log("✅ Already approved");
    }

    // ✅ Setup wallet client for sending
    const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);

    const client = createWalletClient({
      account,
      chain: gnosis,
      transport: http("https://rpc.gnosischain.com")
    });

    // ✅ Setup public client for gas estimation
    const publicClient = createPublicClient({
      chain: gnosis,
      transport: http("https://rpc.gnosischain.com")
    });

    // ✅ Estimate safe gas
    const estimatedGas = await publicClient.estimateGas({
      account,
      to,
      data,
      value: 0n
    });

    // ✅ Send transaction using safe gas
    const hash = await client.sendTransaction({
      account,
      to,
      data,
      value: 0n,
      gas: estimatedGas
    });

    return res.json({ success: true, hash });
  } catch (error) {
    console.error("❌ Deposit error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// deposit aave eure from polygon to gnosis via enso
router.get("/deposit/enso/pol", async (req, res) => {
  try {
    const client = initEnsoClient(API_KEY);
    const route = await client.getRouteData({
      chainId: 137,
      destinationChainId: 100,
      tokenIn: [EURe_TOKEN_ADDRESS_POL_V1],
      tokenOut: [AEURE_TOKEN_ADDRESS_GNOSIS],
      amountIn: [AMOUNT],
      fromAddress: WALLET,
      receiver: WALLET,
      routingStrategy: "router"
    });
    console.log("route data", JSON.stringify(route, null, 2));

    // 1. Prepare your account
    const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http("https://polygon-rpc.com")
    });

    const publicClient = createPublicClient({
      chain: polygon,
      transport: http("https://polygon-rpc.com")
    });

    // --- Check Allowance ---
    const realSpender = route.tx.to;
    const allowance = await publicClient.readContract({
      address: EURe_TOKEN_ADDRESS_POL_V1, // EURe token on POL
      abi: erc20Abi,
      functionName: "allowance",
      args: [WALLET, realSpender]
    });
    console.log("Current allowance:", allowance);

    if (allowance < AMOUNT) {
      console.log("🔑 Approving token...");
      // Build data for approve
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [realSpender, AMOUNT]
      });
      console.log("approveData", approveData);
      // Send approve tx
      const approveTxHash = await walletClient.sendTransaction({
        account,
        to: EURe_TOKEN_ADDRESS_POL_V1,
        data: approveData,
        value: 0n
      });
      // Wait for mining
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      console.log("✅ Approved!");
    } else {
      console.log("✅ Already approved");
    }

    // 4. Estimate gas
    const ensoTx = {
      to: route.tx.to,
      data: route.tx.data,
      value: 0n
      // value: route.tx.value ? BigInt(route.tx.value) : 0n
    };
    console.log("ensoTx", ensoTx);
    // 4. Estimate gas
    const estimatedGas = await publicClient.estimateGas({
      account,
      to: ensoTx.to,
      data: ensoTx.data,
      value: ensoTx.value
    });
    console.log("estimatedGas", estimatedGas);

    // 5. Send the transaction
    const txHash = await walletClient.sendTransaction({
      account,
      to: ensoTx.to,
      data: ensoTx.data,
      value: ensoTx.value,
      gas: estimatedGas
    });

    console.log("Enso multicall route tx sent:", txHash);

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Deposit error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/withdraw/enso/pol", async (req, res) => {
  try {
    const client = initEnsoClient(API_KEY);
    const route = await client.getRouteData({
      chainId: 100,
      destinationChainId: 137,
      tokenOut: [EURe_TOKEN_ADDRESS_POL_V1],
      tokenIn: [AEURE_TOKEN_ADDRESS_GNOSIS],
      amountIn: [AMOUNT],
      fromAddress: WALLET,
      receiver: WALLET,
      routingStrategy: "router"
    });
    console.log("route data", JSON.stringify(route, null, 2));

    // 1. Prepare your account
    const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http("https://rpc.gnosischain.com")
    });

    const publicClient = createPublicClient({
      chain: polygon,
      transport: http("https://rpc.gnosischain.com")
    });

    // --- Check Allowance ---
    const realSpender = route.tx.to;
    const allowance = await publicClient.readContract({
      address: AEURE_TOKEN_ADDRESS_GNOSIS, // AEURe token on gnosis
      abi: erc20Abi,
      functionName: "allowance",
      args: [WALLET, realSpender]
    });
    console.log("Current allowance:", allowance);
    // return;
    if (allowance < AMOUNT) {
      console.log("🔑 Approving token...");
      // Build data for approve
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [realSpender, AMOUNT]
      });
      console.log("approveData", approveData);
      // Send approve tx
      const approveTxHash = await walletClient.sendTransaction({
        account,
        to: AEURE_TOKEN_ADDRESS_GNOSIS,
        data: approveData,
        value: 0n
      });
      // Wait for mining
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      console.log("✅ Approved!");
    } else {
      console.log("✅ Already approved");
    }

    // 4. Estimate gas
    const ensoTx = {
      to: route.tx.to,
      data: route.tx.data,
      value: route.tx.value ? BigInt(route.tx.value) : 0n
    };

    // 4. Estimate gas
    const estimatedGas = await publicClient.estimateGas({
      account,
      to: ensoTx.to,
      data: ensoTx.data,
      value: BigInt(ensoTx.value || 0)
    });
    console.log("estimatedGas", estimatedGas);

    // 5. Send the transaction
    const txHash = await walletClient.sendTransaction({
      account,
      to: ensoTx.to,
      data: ensoTx.data,
      value: BigInt(ensoTx.value || 0),
      gas: estimatedGas
    });

    console.log("Enso multicall route tx sent:", txHash);

    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Deposit error:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/calculate-gas", async (req, res) => {
  try {
    // 2. Get current gas price from network
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http("https://polygon-rpc.com")
    });
    const estimatedGas = 1220582n;
    const gasPrice = await publicClient.getGasPrice();
    // 3. Calculate total fee: gas units × gas price
    const feeInWei = estimatedGas * gasPrice;
    // 4. Convert to readable format (18 decimals for POL/ETH)
    const feeInNativeToken = Number(feeInWei) / Math.pow(10, 18);
    console.log({
      estimatedGas, // e.g., 1220582n
      gasPrice, // e.g., 278500000000n (278.5 gwei in wei)
      feeInWei, // e.g., 340020000000000000n (total fee in wei)
      feeInNativeToken, // e.g., 0.34002 (readable POL amount)
      gasPriceInGwei: Number(gasPrice) / Math.pow(10, 9) // e.g., 278.5 (readable gwei)
    });

    const fees = await publicClient.estimateFeesPerGas();
    const maxFeePerGas = fees.maxFeePerGas; // BigInt (wei)
    const maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
    const estGas = 1220582n * maxFeePerGas;
    const toPOL = (x) => Number(x) / 1e18;

    console.log(toPOL(estGas));
    res.json({ message: "success" });
  } catch (error) {
    console.log("❌ Calculate gas error:", error);
    return res.status(400).json({ error: error.message });
  }
});

// Optional: Fetch token list
router.get("/enso", async (req, res) => {
  const data = await fetchEUReGnosisViaEnso();
  if (!data)
    return res.status(500).json({ error: "Failed to fetch Enso data" });
  res.json(data);
});

// Optional: Withdraw route
router.get("/check-balance", async (req, res) => {
  try {
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http("https://polygon-rpc.com")
    });

    const data = await getTokenBalance(
      publicClient,
      EURe_TOKEN_ADDRESS_POL_V1,
      WALLET
    );
    console.log("Token balance data:", data);
    return res.json({ success: true });
  } catch (error) {
    console.error("❌ Deposit error:", error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
