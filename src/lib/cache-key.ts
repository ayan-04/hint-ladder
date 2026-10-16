export interface CacheKeyInput {
  slug: string;
  level: number;
  provider: string;
  model: string;
  style: string;
}

export function hintCacheKey(input: CacheKeyInput): string {
  return [input.slug, String(input.level), input.provider, input.model, input.style].join("|");
}
