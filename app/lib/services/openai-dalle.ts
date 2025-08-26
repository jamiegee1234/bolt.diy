import { request } from '~/lib/fetch';
import { uint8ToBase64 } from '~/utils/base64';

type Size = '256x256' | '512x512' | '1024x1024';

export interface DalleImageResult {
  base64: string;
  mimeType: string;
}

export class DalleService {
  constructor(private apiKey?: string, private baseURL: string = 'https://api.openai.com/v1') {}

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    } as const;
  }

  async generateImage(prompt: string, options?: { size?: Size; model?: string }) {
    const model = options?.model || 'gpt-image-1';
    const size = options?.size || '1024x1024';

    const res = await request(`${this.baseURL}/images/generations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, prompt, size, response_format: 'b64_json' }),
    });
    if (!res.ok) throw new Error(`OpenAI images.generate failed: ${res.status}`);
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image returned from OpenAI');
    return { base64: b64, mimeType: 'image/png' } satisfies DalleImageResult;
  }

  async generateAndFetchBinary(prompt: string, options?: { size?: Size; model?: string }) {
    const model = options?.model || 'gpt-image-1';
    const size = options?.size || '1024x1024';
    const res = await request(`${this.baseURL}/images/generations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, prompt, size, response_format: 'url' }),
    });
    if (!res.ok) throw new Error(`OpenAI images.generate failed: ${res.status}`);
    const json = (await res.json()) as { data?: { url?: string }[] };
    const url = json.data?.[0]?.url;
    if (!url) throw new Error('No image URL returned from OpenAI');
    const imgRes = await request(url);
    if (!imgRes.ok) throw new Error(`OpenAI image download failed: ${imgRes.status}`);
    const buf = await imgRes.arrayBuffer();
    return { base64: uint8ToBase64(new Uint8Array(buf)), mimeType: imgRes.headers.get('content-type') || 'image/png' };
  }
}

