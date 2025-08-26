import { request } from '~/lib/fetch';

export interface FigmaImageResponse {
  err?: string;
  images?: Record<string, string>;
}

export class FigmaService {
  constructor(private apiKey: string) {}

  private headers() {
    return {
      'X-Figma-Token': this.apiKey,
    } as const;
  }

  async getFile(fileKey: string) {
    const res = await request(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Figma getFile failed: ${res.status}`);
    return res.json();
  }

  async getImages(fileKey: string, nodeIds: string[], format: 'png' | 'jpg' | 'svg' = 'png') {
    const params = new URLSearchParams();
    params.set('ids', nodeIds.join(','));
    params.set('format', format);
    const res = await request(`https://api.figma.com/v1/images/${fileKey}?${params.toString()}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Figma getImages failed: ${res.status}`);
    return (await res.json()) as FigmaImageResponse;
  }
}

