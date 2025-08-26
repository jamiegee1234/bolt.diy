type CommonRequest = Omit<RequestInit, 'body'> & { body?: BodyInit | null };

export async function request(url: string, init?: CommonRequest) {
  if (import.meta.env.DEV) {
    const nodeFetch = await import('node-fetch');
    const https = await import('node:https');

    const agent = url.startsWith('https') ? new https.Agent({ rejectUnauthorized: false }) : undefined;

    // Cast to any to bridge Node vs Workers RequestInit differences
    return nodeFetch.default(url as any, { ...(init as any), agent } as any);
  }

  return fetch(url, init);
}
