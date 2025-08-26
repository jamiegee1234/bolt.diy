import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { FigmaService } from '~/lib/services/figma';
import { request } from '~/lib/fetch';
import { uint8ToBase64 } from '~/utils/base64';

export const loader = async ({ request: req, context }: LoaderFunctionArgs) => {
  const url = new URL(req.url);
  const fileKey = url.searchParams.get('file');
  const ids = url.searchParams.get('ids');
  const format = (url.searchParams.get('format') as 'png' | 'jpg' | 'svg') || 'png';

  if (!fileKey || !ids) {
    return json({ error: 'Missing file or ids' }, { status: 400 });
  }

  const env = context.cloudflare?.env as unknown as Env | undefined;
  const apiKey = env?.FIGMA_API_KEY || process.env.FIGMA_API_KEY;
  if (!apiKey) {
    return json({ error: 'FIGMA_API_KEY not configured' }, { status: 500 });
  }

  try {
    const figma = new FigmaService(apiKey);
    const { images } = await figma.getImages(fileKey, ids.split(','), format);
    if (!images) return json({ error: 'No images returned' }, { status: 502 });

    // Download images and return as base64 map
    const entries = await Promise.all(
      Object.entries(images).map(async ([nodeId, imageUrl]) => {
        const res = await request(imageUrl);
        if (!res.ok) throw new Error(`Figma image fetch failed: ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        const base64 = uint8ToBase64(new Uint8Array(arrayBuf));
        return [nodeId, base64] as const;
      }),
    );

    return json({ images: Object.fromEntries(entries), format });
  } catch (err: any) {
    return json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
};

