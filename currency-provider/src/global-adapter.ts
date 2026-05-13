import axios from 'axios';

const OXR_API_KEY = 'your_api_key_here';
const OXR_URL = 'https://openexchangerates.org/api/latest.json';

export async function fetchRates(base: string) {
  const response = await axios.get(`${OXR_URL}?app_id=${OXR_API_KEY}&base=${base}`);
  const { timestamp, base: responseBase, rates } = response.data;
  const date = new Date(timestamp * 1000).toISOString().split('T')[0];
  return { date, base: responseBase, rates };
}

export async function globalAdapter(baseCurrency = 'USD'): Promise<{ date: string, base: string, rates: Record<string, number> }> {
  return await fetchRates(baseCurrency);
}
