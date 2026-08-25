const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function requestWithTimeout(url, options = {}, config = {}) {
  const {
    timeoutMs = 60000,
    retries = 0,
    backoffMs = 1000,
    fetchImpl = fetch,
    sleep = delay
  } = config;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    try {
      return await fetchImpl(url, { ...options, signal:globalThis.AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastError = new Error(`${options.method || 'GET'} request failed after ${Date.now() - started}ms: ${error.name}: ${error.message}`, { cause:error });
      if (attempt < retries) await sleep(backoffMs * (attempt + 1));
    }
  }
  throw lastError;
}
