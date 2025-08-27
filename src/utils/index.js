const { erc20Abi } = require("viem");

module.exports = {
  getTokenBalance: async function getTokenBalance(
    publicClient,
    tokenAddress,
    userAddress
  ) {
    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals"
    });

    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [userAddress]
    });

    return { balance, decimals };
  }
};
