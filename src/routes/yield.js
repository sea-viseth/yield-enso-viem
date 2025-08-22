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

// deposit aave eure from polygon to gnosis via enso
router.get("/deposit/enso/pol", async (req, res) => {
  try {
    const client = initEnsoClient(API_KEY);
    const route = await client.getRouteData({
      chainId: 137,
      destinationChainId: 100,
      tokenIn: [EURe_TOKEN_ADDRESS_POL_V1],
      tokenOut: ["0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2"],
      amountIn: [AMOUNT],
      fromAddress: "0x284A59C7aE7A48f2dF94AF9b296c6E212Ea1c843",
      receiver: "0x284A59C7aE7A48f2dF94AF9b296c6E212Ea1c843",
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

// Optional: Fetch token list
router.get("/enso", async (req, res) => {
  const data = await fetchEUReGnosisViaEnso();
  if (!data)
    return res.status(500).json({ error: "Failed to fetch Enso data" });
  res.json(data);
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

module.exports = router;
