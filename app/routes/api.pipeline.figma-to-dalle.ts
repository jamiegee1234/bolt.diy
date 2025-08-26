import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { FigmaService } from '~/lib/services/figma';
import { DalleService } from '~/lib/services/openai-dalle';
import { MNodes, type MNodeInput } from '~/lib/modules/mnodes';

type Body = { file: string; ids: string[]; promptTemplate?: string };

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = context.cloudflare?.env as unknown as Env | undefined;

  try {
    const { file, ids, promptTemplate } = (await request.json()) as Body;
    if (!file || !Array.isArray(ids) || ids.length === 0) {
      return json({ error: 'Missing file or ids[]' }, { status: 400 });
    }

    const figmaKey = env?.FIGMA_API_KEY || process.env.FIGMA_API_KEY;
    const openaiKey = env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!figmaKey) return json({ error: 'FIGMA_API_KEY not configured' }, { status: 500 });
    if (!openaiKey) return json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    // 1) Figma fetch
    const figma = new FigmaService(figmaKey);
    const { images } = await figma.getImages(file, ids);
    if (!images) return json({ error: 'No images returned' }, { status: 502 });

    // 2) mNodes processing
    const m = new MNodes({ mode: 'pass-through' });
    const inputs: MNodeInput[] = Object.entries(images).map(([id, b64]) => ({ id, data: b64, type: 'image' }));
    const processed = await m.process(inputs);

    // 3) DALL-E generation (use promptTemplate per node)
    const dalle = new DalleService(openaiKey);
    const outputs = await Promise.all(
      processed.map(async (p) => {
        const prompt = (promptTemplate || 'Generate a refined version of the design element: {{id}}').replace('{{id}}', p.id);
        const img = await dalle.generateImage(prompt, { size: '1024x1024' });
        return { id: p.id, ...img };
      }),
    );

    return json({ outputs });
  } catch (e: any) {
    return json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
};

