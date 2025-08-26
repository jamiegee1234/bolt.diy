import { request } from '~/lib/fetch';

export class LoveableService {
  constructor(private baseURL: string, private apiKey: string) {}

  private authHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    } as const;
  }

  async health() {
    const res = await request(`${this.baseURL}/health`, { headers: this.authHeaders() });
    if (!res.ok) throw new Error(`Loveable health failed: ${res.status}`);
    return res.json();
  }

  async invoke<TReq extends object, TRes = unknown>(path: string, body: TReq) {
    const res = await request(`${this.baseURL}${path}`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Loveable request failed: ${res.status}`);
    return (await res.json()) as TRes;
  }
}

