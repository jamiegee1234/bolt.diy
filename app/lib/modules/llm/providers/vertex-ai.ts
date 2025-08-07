import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export default class VertexAIProvider extends BaseProvider {
  name = 'Vertex AI';
  getApiKeyLink = 'https://console.cloud.google.com/vertex-ai';

  config = {
    baseUrlKey: 'VERTEX_AI_BASE_URL',
    apiTokenKey: 'VERTEX_AI_API_KEY',
    projectIdKey: 'VERTEX_AI_PROJECT_ID',
    locationKey: 'VERTEX_AI_LOCATION',
  };

  staticModels: ModelInfo[] = [
    { name: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Vertex AI', maxTokenAllowed: 2000000 },
    { name: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'Vertex AI', maxTokenAllowed: 1000000 },
    { name: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro', provider: 'Vertex AI', maxTokenAllowed: 32000 },
    { name: 'text-bison@001', label: 'PaLM 2 Text Bison', provider: 'Vertex AI', maxTokenAllowed: 8192 },
    { name: 'text-bison@002', label: 'PaLM 2 Text Bison (Latest)', provider: 'Vertex AI', maxTokenAllowed: 8192 },
    { name: 'chat-bison@001', label: 'PaLM 2 Chat Bison', provider: 'Vertex AI', maxTokenAllowed: 8192 },
    { name: 'chat-bison@002', label: 'PaLM 2 Chat Bison (Latest)', provider: 'Vertex AI', maxTokenAllowed: 8192 },
    { name: 'code-bison@001', label: 'PaLM 2 Code Bison', provider: 'Vertex AI', maxTokenAllowed: 8192 },
    { name: 'code-bison@002', label: 'PaLM 2 Code Bison (Latest)', provider: 'Vertex AI', maxTokenAllowed: 8192 },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const config = this.getVertexAIConfig(apiKeys, settings, serverEnv);
    
    if (!config.apiKey || !config.projectId || !config.location) {
      throw `Missing configuration for ${this.name} provider. Required: API key, project ID, and location`;
    }

    try {
      // Vertex AI models endpoint
      const modelsUrl = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/models`;
      
      const response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = await response.json() as any;
      const staticModelIds = this.staticModels.map((m) => m.name);

      // Filter for supported models
      const data = res.models?.filter(
        (model: any) => 
          (model.name.includes('gemini') || 
           model.name.includes('bison') || 
           model.name.includes('text') ||
           model.name.includes('chat') ||
           model.name.includes('code')) &&
          !staticModelIds.includes(model.displayName),
      ) || [];

      return data.map((m: any) => ({
        name: m.displayName || m.name.split('/').pop(),
        label: `${m.displayName || m.name.split('/').pop()} (Vertex)`,
        provider: this.name,
        maxTokenAllowed: this.getMaxTokensForModel(m.displayName || m.name),
      }));
    } catch (error) {
      console.error(`Error fetching Vertex AI models:`, error);
      // Return empty array to allow static models to work
      return [];
    }
  }

  private getVertexAIConfig(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>
  ) {
    return {
      apiKey: apiKeys?.['VERTEX_AI_API_KEY'] || 
              serverEnv?.['VERTEX_AI_API_KEY'] || 
              settings?.['apiKey'],
      projectId: apiKeys?.['VERTEX_AI_PROJECT_ID'] || 
                 serverEnv?.['VERTEX_AI_PROJECT_ID'],
      location: apiKeys?.['VERTEX_AI_LOCATION'] || 
                serverEnv?.['VERTEX_AI_LOCATION'] || 
                'us-central1', // Default location
      baseUrl: settings?.baseUrl || 
               apiKeys?.['VERTEX_AI_BASE_URL'] || 
               serverEnv?.['VERTEX_AI_BASE_URL'],
    };
  }

  private getMaxTokensForModel(modelName: string): number {
    // Map Vertex AI model names to appropriate token limits
    if (modelName.includes('gemini-1.5-pro')) return 2000000;
    if (modelName.includes('gemini-1.5-flash')) return 1000000;
    if (modelName.includes('gemini-1.0-pro')) return 32000;
    if (modelName.includes('gemini')) return 32000;
    if (modelName.includes('bison') || modelName.includes('text') || modelName.includes('chat') || modelName.includes('code')) return 8192;
    return 8192; // Default fallback
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    const config = this.getVertexAIConfig(apiKeys, providerSettings?.[this.name], serverEnv as any);

    if (!config.apiKey || !config.projectId || !config.location) {
      throw new Error(`Missing configuration for ${this.name} provider. Required: API key, project ID, and location`);
    }

    // For Gemini models, use Google AI SDK
    if (model.includes('gemini')) {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models`,
      });

      return google(model);
    }

    // For other Vertex AI models (PaLM, etc.), use custom implementation
    // This would require a more complex setup with the Vertex AI SDK
    throw new Error(`Model ${model} is not yet supported. Use Gemini models for now.`);
  }

  // Override to provide Vertex AI-specific configuration guidance
  getConfigurationInstructions(): string {
    return `
To configure Google Vertex AI:

1. **Google Cloud Project**: Create or select a Google Cloud project
2. **Enable APIs**: Enable the Vertex AI API in your project
3. **Authentication**: Set up authentication using one of these methods:
   
   **Option A: Service Account Key**
   - Create a service account with Vertex AI permissions
   - Download the JSON key file
   - Set VERTEX_AI_API_KEY to the service account key (JSON content or file path)
   
   **Option B: Application Default Credentials**
   - Run \`gcloud auth application-default login\`
   - The SDK will automatically use your credentials

4. **Configuration**:
   - VERTEX_AI_PROJECT_ID: Your Google Cloud project ID
   - VERTEX_AI_LOCATION: Region (e.g., us-central1, europe-west1)
   - VERTEX_AI_API_KEY: Service account key or access token

5. **Supported Models**:
   - Gemini 1.5 Pro (2M context)
   - Gemini 1.5 Flash (1M context) 
   - Gemini 1.0 Pro (32K context)
   - PaLM 2 models (Text, Chat, Code Bison)

Note: Vertex AI provides enterprise-grade AI with enhanced security,
compliance, and data governance features.
    `.trim();
  }
}