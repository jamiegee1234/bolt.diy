import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { DalleService } from '~/lib/services/openai-dalle';

type Body = { prompt: string; size?: '256x256' | '512x512' | '1024x1024'; model?: string; response?: 'b64' | 'url' };

export const action = async ({ request, context }: ActionFunctionArgs) => {
  try {
    const { prompt, size, model, response } = (await request.json()) as Body;
    if (!prompt) return json({ error: 'Missing prompt' }, { status: 400 });

    const env = context.cloudflare?.env as unknown as Env | undefined;
    const apiKey = env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const service = new DalleService(apiKey);
    const result = response === 'url'
      ? await service.generateAndFetchBinary(prompt, { size, model })
      : await service.generateImage(prompt, { size, model });

    return json({ ...result });
  } catch (err: any) {
    return json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
};

