import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { LoveableService } from '~/lib/services/loveable';

type Body = { path: string; payload: Record<string, unknown> };

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = context.cloudflare?.env as unknown as Env | undefined;
  const baseURL = env?.LOVEABLE_API_BASE_URL || process.env.LOVEABLE_API_BASE_URL;
  const apiKey = env?.LOVEABLE_API_KEY || process.env.LOVEABLE_API_KEY;
  if (!baseURL || !apiKey) return json({ error: 'Loveable not configured' }, { status: 500 });

  try {
    const { path, payload } = (await request.json()) as Body;
    if (!path || typeof payload !== 'object') return json({ error: 'Missing path or payload' }, { status: 400 });
    const svc = new LoveableService(baseURL, apiKey);
    const res = await svc.invoke(path, payload);
    return json({ ok: true, res });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
};

