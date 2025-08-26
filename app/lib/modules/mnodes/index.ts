// Minimal mnodes adapter to demonstrate processing pipeline.

export interface MNodeInput {
  id: string;
  data: string; // base64-encoded content (e.g., image or JSON)
  type: 'image' | 'json' | 'text';
}

export interface MNodeOutput {
  id: string;
  result: string; // base64-encoded output or text
  meta?: Record<string, unknown>;
}

export class MNodes {
  constructor(private config: { mode?: 'pass-through' | 'enhance' } = {}) {}

  async process(nodes: MNodeInput[]): Promise<MNodeOutput[]> {
    // Placeholder processing: echo/enhance metadata, pass-through data
    return nodes.map((n) => ({ id: n.id, result: n.data, meta: { type: n.type, mode: this.config.mode || 'pass-through' } }));
  }
}

