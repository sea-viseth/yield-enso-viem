const axios = require('axios');

// Base Enso API endpoint
const ENSO_BASE_URL = 'https://api.enso.build/api/v1';

async function fetchEUReGnosisViaEnso() {
  try {
    const response = await axios.get(`${ENSO_BASE_URL}/tokens`, {
      params: {
        project: 'aave',
        chainId: 100, // Gnosis
      },
    });

    const tokens = response.data.data;

    const eure = tokens.find(
      (t) =>
        t.address.toLowerCase() === '0xedbc7449a9b594ca4e053d9737ec5dc4cbccbfb2'
    );

    if (!eure) {
      throw new Error('EURe not found in Enso Aave Gnosis tokens');
    }

    return {
      name: eure.name,
      chainId: eure.chainId,
      address: eure.address,
      decimals: eure.decimals,
      type: eure.type,
      project: eure.project,
      protocol: eure.protocol,
      underlyingTokens: eure.underlyingTokens,
      primaryAddress: eure.primaryAddress,
      apy: eure.apy,
      apyBase: eure.apyBase,
      apyReward: eure.apyReward,
      tvl: eure.tvl,
    };
  } catch (error) {
    console.error('Enso error:', error.message);
    return null;
  }
}

module.exports = { fetchEUReGnosisViaEnso };
