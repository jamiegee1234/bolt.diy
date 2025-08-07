import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class AzureOpenAIProvider extends BaseProvider {
  name = 'Azure OpenAI';
  getApiKeyLink = 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI';

  config = {
    baseUrlKey: 'AZURE_OPENAI_BASE_URL',
    apiTokenKey: 'AZURE_OPENAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'gpt-4o', label: 'GPT-4o', provider: 'Azure OpenAI', maxTokenAllowed: 128000 },
    { name: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'Azure OpenAI', maxTokenAllowed: 128000 },
    { name: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'Azure OpenAI', maxTokenAllowed: 128000 },
    { name: 'gpt-4', label: 'GPT-4', provider: 'Azure OpenAI', maxTokenAllowed: 32000 },
    { name: 'gpt-35-turbo', label: 'GPT-3.5 Turbo', provider: 'Azure OpenAI', maxTokenAllowed: 16385 },
    { name: 'gpt-35-turbo-16k', label: 'GPT-3.5 Turbo 16K', provider: 'Azure OpenAI', maxTokenAllowed: 16385 },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'AZURE_OPENAI_BASE_URL',
      defaultApiTokenKey: 'AZURE_OPENAI_API_KEY',
    });

    if (!apiKey || !baseUrl) {
      throw `Missing API key or base URL configuration for ${this.name} provider`;
    }

    try {
      // Azure OpenAI uses different endpoint structure
      // Base URL should be like: https://your-resource-name.openai.azure.com
      const modelsUrl = `${baseUrl.replace(/\/$/, '')}/openai/models?api-version=2024-02-01`;
      
      const response = await fetch(modelsUrl, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = await response.json() as any;
      const staticModelIds = this.staticModels.map((m) => m.name);

      // Azure OpenAI model naming is different (deployment names)
      const data = res.data?.filter(
        (model: any) => 
          model.object === 'model' &&
          (model.id.includes('gpt') || model.id.includes('turbo')) &&
          !staticModelIds.includes(model.id),
      ) || [];

      return data.map((m: any) => ({
        name: m.id,
        label: `${m.id} (Azure)`,
        provider: this.name,
        maxTokenAllowed: this.getMaxTokensForModel(m.id),
      }));
    } catch (error) {
      console.error(`Error fetching Azure OpenAI models:`, error);
      // Return empty array instead of throwing to allow static models to work
      return [];
    }
  }

  private getMaxTokensForModel(modelId: string): number {
    // Map Azure model IDs to appropriate token limits
    if (modelId.includes('gpt-4o')) return 128000;
    if (modelId.includes('gpt-4-turbo') || modelId.includes('gpt-4-1106')) return 128000;
    if (modelId.includes('gpt-4-32k')) return 32000;
    if (modelId.includes('gpt-4')) return 8000;
    if (modelId.includes('16k')) return 16385;
    if (modelId.includes('gpt-35-turbo') || modelId.includes('gpt-3.5-turbo')) return 4000;
    return 4000; // Default fallback
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'AZURE_OPENAI_BASE_URL',
      defaultApiTokenKey: 'AZURE_OPENAI_API_KEY',
    });

    if (!apiKey || !baseUrl) {
      throw new Error(`Missing API key or base URL for ${this.name} provider`);
    }

    // Azure OpenAI requires different configuration
    const azureOpenAI = createOpenAI({
      apiKey,
      baseURL: `${baseUrl.replace(/\/$/, '')}/openai/deployments/${model}`,
      defaultQuery: {
        'api-version': '2024-02-01',
      },
      defaultHeaders: {
        'api-key': apiKey,
      },
    });

    return azureOpenAI('gpt-35-turbo'); // Use the deployment name as model
  }

  // Override to provide Azure-specific configuration guidance
  getConfigurationInstructions(): string {
    return `
To configure Azure OpenAI:

1. **Azure Resource**: Create an Azure OpenAI resource in the Azure portal
2. **Base URL**: Set AZURE_OPENAI_BASE_URL to your resource endpoint 
   (e.g., https://your-resource-name.openai.azure.com)
3. **API Key**: Set AZURE_OPENAI_API_KEY to your resource's API key
4. **Deployments**: Create model deployments in your Azure OpenAI resource
   - Deployment names become the model names in bolt.diy
   - Supported models: GPT-4o, GPT-4 Turbo, GPT-4, GPT-3.5 Turbo

Note: Azure OpenAI uses deployment names instead of model names. 
Create deployments for the models you want to use.
    `.trim();
  }
}