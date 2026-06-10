import type { AIProvider } from "./types";
import { MockAIProvider } from "./mock.provider";

// ─── Supported Provider Keys ───────────────────────────────────────────────────

export type ProviderKey = "mock" | "openai" | "anthropic" | "azure_openai" | "gemini";

// ─── Provider Registry ─────────────────────────────────────────────────────────
// To add a new provider:
//   1. Create /lib/ai/<name>.provider.ts  implementing AIProvider
//   2. Import it here
//   3. Register it in PROVIDER_REGISTRY below
//
// Zero route changes required.

type ProviderFactory = () => AIProvider;

const PROVIDER_REGISTRY: Record<string, ProviderFactory> = {
  mock: () => new MockAIProvider(),

  // Uncomment and implement when ready:
  // openai: () => {
  //   const { OpenAIProvider } = require("./openai.provider");
  //   return new OpenAIProvider(process.env.OPENAI_API_KEY!);
  // },
  // anthropic: () => {
  //   const { AnthropicProvider } = require("./anthropic.provider");
  //   return new AnthropicProvider(process.env.ANTHROPIC_API_KEY!);
  // },
  // azure_openai: () => {
  //   const { AzureOpenAIProvider } = require("./azure-openai.provider");
  //   return new AzureOpenAIProvider({
  //     apiKey: process.env.AZURE_OPENAI_API_KEY!,
  //     endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  //     deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT!,
  //   });
  // },
  // gemini: () => {
  //   const { GeminiProvider } = require("./gemini.provider");
  //   return new GeminiProvider(process.env.GEMINI_API_KEY!);
  // },
};

// ─── Singleton Cache ───────────────────────────────────────────────────────────

let _cachedProvider: AIProvider | null = null;

// ─── Factory ───────────────────────────────────────────────────────────────────

export function getAIProvider(): AIProvider {
  if (_cachedProvider) return _cachedProvider;

  const key = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  const factory = PROVIDER_REGISTRY[key];

  if (!factory) {
    const available = Object.keys(PROVIDER_REGISTRY).join(", ");
    throw new Error(
      `Unknown AI provider "${key}". Available providers: ${available}. ` +
        `Set the AI_PROVIDER environment variable to one of the above.`
    );
  }

  _cachedProvider = factory();
  console.log(`[AI] Provider initialized: ${_cachedProvider.name} (${_cachedProvider.model})`);
  return _cachedProvider;
}

/**
 * Force-reinitialize the provider (useful for testing or hot-reload scenarios).
 */
export function resetAIProvider(): void {
  _cachedProvider = null;
}

/**
 * Register a custom provider at runtime.
 * Useful for plugins or dynamic provider loading.
 */
export function registerAIProvider(key: string, factory: ProviderFactory): void {
  PROVIDER_REGISTRY[key] = factory;
  console.log(`[AI] Custom provider registered: ${key}`);
}

export default getAIProvider;