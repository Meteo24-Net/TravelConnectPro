// =============================================================================
// Travel Connect Pro — Currency Adapter: Open Exchange Rates
// =============================================================================

export async function fetchOXR(apiKey: string, base: string = 'USD') {
  // Use the provided App ID: 9eaff9ffb9b9472091c8a84fd98445f3
  const key = apiKey || '9eaff9ffb9b9472091c8a84fd98445f3';
  const url = `https://openexchangerates.org/api/latest.json?app_id=${key}&base=${base}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OXR fetch failed: ${error}`);
  }

  const { timestamp, base: responseBase, rates } = await response.json();
  const date = new Date(timestamp * 1000).toISOString();
  
  return { date, base: responseBase, rates };
}
