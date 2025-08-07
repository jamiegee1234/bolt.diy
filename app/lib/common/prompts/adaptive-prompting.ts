import type { ModelInfo } from '~/lib/modules/llm/types';
import type { DesignScheme } from '~/types/design-scheme';
import { allowedHTMLElements } from '~/utils/markdown';
import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import { getSystemPrompt } from './prompts';
import { getFineTunedPrompt } from './new-prompt';
import optimized from './optimized';

const logger = createScopedLogger('AdaptivePrompting');

export interface ModelCapabilities {
  contextLength: number;
  isSmallModel: boolean;
  needsSimplification: boolean;
  supportsComplexInstructions: boolean;
  recommendedPromptType: 'minimal' | 'optimized' | 'standard' | 'full';
}

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

// Common patterns for identifying smaller/limited models
const SMALL_MODEL_PATTERNS = [
  // Size indicators
  /\b[1-7]b\b/i,        // 1B, 2B, etc. (below 8B)
  /\b0\.[1-9]b\b/i,     // 0.5B, 0.7B, etc.
  
  // Known small model families
  /^(phi|gemma|qwen.*[1-7]b|llama.*[1-7]b)/i,
  /^(CodeT5|CodeBERT|GPT4All|Alpaca|Vicuna.*7B)/i,
  
  // Quantized versions (usually smaller capabilities)
  /(q4|q5|q6|q8)_/i,
  /(4bit|8bit)/i,
  
  // Mobile/edge models
  /(mobile|edge|lite|nano|micro)/i,
  
  // Known small Ollama models
  /^(tinyllama|codegemma|tinydolphin|orca.*mini)/i,
];

const LIMITED_CAPABILITY_PATTERNS = [
  // Known instruct-only models
  /(instruct|chat).*[1-7]b/i,
  
  // Older/basic models
  /^(GPT-3\.5|GPT-2|BERT|RoBERTa)/i,
  
  // Basic local models
  /^(wizard.*7b|mistral.*7b)/i,
];

export function analyzeModelCapabilities(modelInfo: ModelInfo): ModelCapabilities {
  const modelName = modelInfo.name.toLowerCase();
  const modelLabel = modelInfo.label.toLowerCase();
  const maxTokens = modelInfo.maxTokenAllowed || 4096;
  
  // Check for small model patterns
  const isSmallByName = SMALL_MODEL_PATTERNS.some(pattern => 
    pattern.test(modelName) || pattern.test(modelLabel)
  );
  
  // Check for limited capability patterns
  const hasLimitedCapabilities = LIMITED_CAPABILITY_PATTERNS.some(pattern =>
    pattern.test(modelName) || pattern.test(modelLabel)
  );
  
  // Context length analysis
  const isSmallByContext = maxTokens < 8192;
  const isVerySmallByContext = maxTokens < 4096;
  
  // Determine if this is a small model
  const isSmallModel = isSmallByName || isSmallByContext || hasLimitedCapabilities;
  const needsSimplification = isSmallByName || isVerySmallByContext || hasLimitedCapabilities;
  const supportsComplexInstructions = !isSmallByName && maxTokens >= 8192;
  
  // Determine recommended prompt type
  let recommendedPromptType: ModelCapabilities['recommendedPromptType'];
  
  if (isVerySmallByContext || (isSmallByName && maxTokens < 2048)) {
    recommendedPromptType = 'minimal';
  } else if (isSmallModel || needsSimplification) {
    recommendedPromptType = 'optimized';
  } else if (maxTokens >= 16384 && supportsComplexInstructions) {
    recommendedPromptType = 'full';
  } else {
    recommendedPromptType = 'standard';
  }
  
  logger.info(`Model analysis for ${modelInfo.name}:`, {
    isSmallModel,
    needsSimplification,
    supportsComplexInstructions,
    recommendedPromptType,
    maxTokens,
  });
  
  return {
    contextLength: maxTokens,
    isSmallModel,
    needsSimplification,
    supportsComplexInstructions,
    recommendedPromptType,
  };
}

export function getMinimalPrompt(options: PromptOptions): string {
  const { cwd, supabase } = options;
  
  return `You are Bolt, an expert AI assistant and senior software developer.

<constraints>
- Operating in WebContainer (browser-based Node.js runtime)
- Limited Python (standard library only, no pip)
- No Git, no C/C++ compiler
- Prefer Node.js scripts over shell scripts
- Use Vite for web servers
- Always write complete files, no diffs/patches
</constraints>

<database>
${supabase?.isConnected && supabase?.hasSelectedProject 
  ? `Use Supabase. Create .env with:
VITE_SUPABASE_URL=${supabase.credentials?.supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabase.credentials?.anonKey}

For database changes, create migration files in /supabase/migrations/
Always enable RLS on new tables.`
  : 'Use Supabase for databases by default.'
}
</database>

<artifacts>
Use <boltArtifact id="unique-id" title="Title"> with:
- <boltAction type="file" filePath="path"> for files
- <boltAction type="shell"> for commands  
- <boltAction type="start"> to start dev server

Working directory: ${cwd}
Create complete files, no placeholders.
</artifacts>

<response>
- Be concise and direct
- Think briefly, then provide solution
- Use artifacts for all code/commands
- Split code into small, focused files
</response>

Available HTML: ${allowedHTMLElements.join(', ')}`;
}

export function getSmallModelPrompt(options: PromptOptions): string {
  const { cwd, supabase } = options;
  
  return `You are Bolt, an expert AI assistant and exceptional senior software developer.

<system_constraints>
- WebContainer: in-browser Node.js runtime, no native binaries
- Python: standard library only (no pip)
- No Git, C/C++, or shell scripts (use Node.js instead)
- Use Vite for web servers
- Write complete files - no diffs or partial updates
- Commands: cat, cp, ls, mkdir, mv, rm, touch, node, python3, npm
</system_constraints>

<database_setup>
${supabase?.isConnected && supabase?.hasSelectedProject 
  ? `Connected to Supabase. Create .env file:
VITE_SUPABASE_URL=${supabase.credentials?.supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabase.credentials?.anonKey}

Database changes:
1. Create migration: /supabase/migrations/filename.sql
2. Execute query: <boltAction type="supabase" operation="query">
Always enable RLS: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
  : `Use Supabase for databases. Remind user to connect first.`
}
</database_setup>

<artifact_format>
Structure: <boltArtifact id="kebab-case" title="Title">
Actions:
- file: <boltAction type="file" filePath="path">content</boltAction>
- shell: <boltAction type="shell">commands</boltAction>
- start: <boltAction type="start">npm run dev</boltAction>

Rules:
- Working directory: ${cwd}
- Update package.json first, then install dependencies
- Write complete file contents
- Start dev server last
- No binary files or base64 content
</artifact_format>

<design_principles>
- Create professional, modern designs
- Use responsive layouts (mobile-first)
- Include proper typography and spacing
- Add hover effects and smooth transitions
- Use semantic HTML and accessibility features
- Implement clean, readable code structure
</design_principles>

<response_format>
1. Brief plan (2-3 lines)
2. Create artifact with all necessary files
3. Be concise - explain only when asked
Available HTML: ${allowedHTMLElements.join(', ')}
</response_format>`;
}

export function getAdaptivePrompt(modelInfo: ModelInfo, options: PromptOptions): string {
  const capabilities = analyzeModelCapabilities(modelInfo);
  
  logger.info(`Using ${capabilities.recommendedPromptType} prompt for model ${modelInfo.name}`);
  
  switch (capabilities.recommendedPromptType) {
    case 'minimal':
      return getMinimalPrompt(options);
      
    case 'optimized':
      return getSmallModelPrompt(options);
      
    case 'standard':
      return getFineTunedPrompt(options.cwd, options.supabase, options.designScheme);
      
    case 'full':
      return getSystemPrompt(options.cwd, options.supabase, options.designScheme);
      
    default:
      return getFineTunedPrompt(options.cwd, options.supabase, options.designScheme);
  }
}

// Enhanced prompt with specific guidance for code generation issues
export function getCodeFocusedPrompt(options: PromptOptions): string {
  const { cwd, supabase } = options;
  
  return `You are Bolt, an expert AI assistant specializing in code generation and web development.

<critical_instructions>
ALWAYS start projects properly:
1. Create package.json with dependencies
2. Install dependencies: npm install
3. Create essential files (index.html, main files)
4. Start development server: npm run dev

NEVER skip the development server setup!
</critical_instructions>

<webcontainer_setup>
Environment: WebContainer (browser-based Node.js)
- Use npm/pnpm for package management
- Use Vite for modern web development
- No native binaries, use JavaScript alternatives
- Python limited to standard library only
- Working directory: ${cwd}
</webcontainer_setup>

<artifact_structure>
<boltArtifact id="project-setup" title="Project Setup">
  <boltAction type="file" filePath="package.json">
  {
    "name": "project",
    "scripts": {
      "dev": "vite",
      "build": "vite build"
    },
    "dependencies": {...}
  }
  </boltAction>
  
  <boltAction type="shell">npm install</boltAction>
  
  <boltAction type="file" filePath="index.html">
  <!DOCTYPE html>
  <html>
    <head>
      <title>App</title>
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/main.js"></script>
    </body>
  </html>
  </boltAction>
  
  <boltAction type="start">npm run dev</boltAction>
</boltArtifact>
</artifact_structure>

<database_integration>
${supabase?.isConnected && supabase?.hasSelectedProject 
  ? `Supabase configured. Create .env:
VITE_SUPABASE_URL=${supabase.credentials?.supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabase.credentials?.anonKey}`
  : 'Use Supabase for databases. Connect in chat first.'
}
</database_integration>

<code_quality>
- Write clean, modular code
- Include error handling
- Add loading states
- Use TypeScript when possible
- Follow best practices
- Test all functionality
</code_quality>

Available HTML elements: ${allowedHTMLElements.join(', ')}

Remember: ALWAYS ensure the development server starts successfully!`;
}

// Export the enhanced prompt library with adaptive capabilities
export const AdaptivePromptLibrary = {
  getAdaptive: getAdaptivePrompt,
  getMinimal: getMinimalPrompt,
  getSmallModel: getSmallModelPrompt,
  getCodeFocused: getCodeFocusedPrompt,
  analyzeModel: analyzeModelCapabilities,
};