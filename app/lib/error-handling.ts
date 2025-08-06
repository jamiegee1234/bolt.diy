import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('error-handling');

export interface ErrorDetails {
  code: string;
  message: string;
  details?: string;
  userMessage: string;
  suggestion?: string;
}

export class BoltError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly suggestion?: string;
  public readonly details?: string;

  constructor(code: string, message: string, userMessage: string, suggestion?: string, details?: string) {
    super(message);
    this.name = 'BoltError';
    this.code = code;
    this.userMessage = userMessage;
    this.suggestion = suggestion;
    this.details = details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      suggestion: this.suggestion,
      details: this.details,
    };
  }
}

export function createApiError(error: unknown): Response {
  let errorDetails: ErrorDetails;

  if (error instanceof BoltError) {
    errorDetails = error.toJSON();
  } else if (error instanceof Error) {
    errorDetails = categorizeError(error);
  } else {
    errorDetails = {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      userMessage: 'An unexpected error occurred. Please try again.',
      details: String(error)
    };
  }

  logger.error('API Error:', errorDetails);

  return new Response(JSON.stringify(errorDetails), {
    status: getStatusCode(errorDetails.code),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function categorizeError(error: Error): ErrorDetails {
  const message = error.message.toLowerCase();

  // API Key errors
  if (message.includes('api key') || message.includes('unauthorized') || message.includes('invalid key')) {
    return {
      code: 'INVALID_API_KEY',
      message: error.message,
      userMessage: 'Invalid or missing API key.',
      suggestion: 'Please check your API key configuration in Settings.',
      details: error.stack
    };
  }

  // Rate limit errors
  if (message.includes('rate limit') || message.includes('quota exceeded') || message.includes('too many requests')) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message: error.message,
      userMessage: 'Rate limit exceeded.',
      suggestion: 'Please wait a moment before trying again, or check your API usage.',
      details: error.stack
    };
  }

  // Context length errors
  if (message.includes('context length') || message.includes('token limit') || message.includes('maximum context')) {
    return {
      code: 'CONTEXT_LENGTH_EXCEEDED',
      message: error.message,
      userMessage: 'The conversation is too long for this model.',
      suggestion: 'Try starting a new conversation or enable context optimization in settings.',
      details: error.stack
    };
  }

  // Network errors
  if (message.includes('fetch failed') || message.includes('network') || message.includes('connection')) {
    return {
      code: 'NETWORK_ERROR',
      message: error.message,
      userMessage: 'Network connection error.',
      suggestion: 'Please check your internet connection and try again.',
      details: error.stack
    };
  }

  // Model not found errors
  if (message.includes('model not found') || message.includes('model not available')) {
    return {
      code: 'MODEL_NOT_FOUND',
      message: error.message,
      userMessage: 'The selected model is not available.',
      suggestion: 'Please select a different model or check your provider configuration.',
      details: error.stack
    };
  }

  // File system errors
  if (message.includes('enoent') || message.includes('file not found')) {
    return {
      code: 'FILE_NOT_FOUND',
      message: error.message,
      userMessage: 'File not found.',
      suggestion: 'The requested file may have been moved or deleted.',
      details: error.stack
    };
  }

  // Permission errors
  if (message.includes('permission denied') || message.includes('forbidden') || message.includes('eacces')) {
    return {
      code: 'PERMISSION_DENIED',
      message: error.message,
      userMessage: 'Permission denied.',
      suggestion: 'Check file permissions or authentication credentials.',
      details: error.stack
    };
  }

  // Generic server errors
  return {
    code: 'SERVER_ERROR',
    message: error.message,
    userMessage: 'An internal server error occurred.',
    suggestion: 'Please try again. If the problem persists, check the console for more details.',
    details: error.stack
  };
}

function getStatusCode(errorCode: string): number {
  switch (errorCode) {
    case 'INVALID_API_KEY':
    case 'PERMISSION_DENIED':
      return 401;
    case 'RATE_LIMIT_EXCEEDED':
      return 429;
    case 'CONTEXT_LENGTH_EXCEEDED':
    case 'MODEL_NOT_FOUND':
    case 'FILE_NOT_FOUND':
      return 400;
    case 'NETWORK_ERROR':
      return 502;
    default:
      return 500;
  }
}

export function handleChatError(error: unknown): string {
  if (error instanceof BoltError) {
    return error.userMessage + (error.suggestion ? `\n\n${error.suggestion}` : '');
  }

  if (error instanceof Error) {
    const errorDetails = categorizeError(error);
    return errorDetails.userMessage + (errorDetails.suggestion ? `\n\n${errorDetails.suggestion}` : '');
  }

  return 'An unexpected error occurred. Please try again.';
}

// Create common errors
export const createContextLengthError = (modelName: string, tokenCount: number, maxTokens: number) =>
  new BoltError(
    'CONTEXT_LENGTH_EXCEEDED',
    `Token limit exceeded for ${modelName}: ${tokenCount}/${maxTokens}`,
    `The conversation is too long for the ${modelName} model.`,
    'Try starting a new conversation, enable context optimization, or switch to a model with a larger context window.',
    `Current: ${tokenCount} tokens, Maximum: ${maxTokens} tokens`
  );

export const createApiKeyError = (provider: string) =>
  new BoltError(
    'INVALID_API_KEY',
    `Invalid API key for ${provider}`,
    `Invalid or missing API key for ${provider}.`,
    `Please add a valid API key for ${provider} in Settings > Connections.`
  );

export const createRateLimitError = (provider: string) =>
  new BoltError(
    'RATE_LIMIT_EXCEEDED',
    `Rate limit exceeded for ${provider}`,
    `Rate limit exceeded for ${provider}.`,
    'Please wait a moment before trying again, or check your API usage limits.'
  );

export const createModelNotFoundError = (modelName: string, provider: string) =>
  new BoltError(
    'MODEL_NOT_FOUND',
    `Model ${modelName} not found for provider ${provider}`,
    `The model "${modelName}" is not available.`,
    `Please select a different model or check your ${provider} configuration.`
  );