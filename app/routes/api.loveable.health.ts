import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { LoveableService } from '~/lib/services/loveable';

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const env = context.cloudflare?.env as unknown as Env | undefined;
  const baseURL = env?.LOVEABLE_API_BASE_URL || process.env.LOVEABLE_API_BASE_URL;
  const apiKey = env?.LOVEABLE_API_KEY || process.env.LOVEABLE_API_KEY;
  if (!baseURL || !apiKey) return json({ error: 'Loveable not configured' }, { status: 500 });

  try {
    const svc = new LoveableService(baseURL, apiKey);
    const res = await svc.health();
    return json({ ok: true, res });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'Unknown error' }, { status: 502 });
  }
};

