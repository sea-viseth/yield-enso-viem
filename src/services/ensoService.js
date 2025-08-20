const { EnsoClient } = require('@ensofinance/sdk');

let ensoClient;

function initEnsoClient(apiKey) {
  ensoClient = new EnsoClient({ apiKey });
  return ensoClient;
}

async function getDepositRoute(
  fromAddress,
  tokenIn,
  tokenOut,
  amount,
  chainId
) {
  if (!ensoClient) throw new Error('Enso not initialized');
  try {
    const route = await ensoClient.getRouteData({
      fromAddress,
      chainId,
      amountIn: [amount],
      tokenIn: [tokenIn],
      tokenOut: [tokenOut],
      routingStrategy: 'router',
    });
    return route;
  } catch (err) {
    console.error('Enso error:', err.message);
    return null;
  }
}

module.exports = {
  initEnsoClient,
  getDepositRoute,
};
