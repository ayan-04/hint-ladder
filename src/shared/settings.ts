import { z } from "zod";

export const providerIdSchema = z.enum(["gemini", "openai", "anthropic"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const hintStyleSchema = z.enum(["socratic", "direct"]);
export type HintStyle = z.infer<typeof hintStyleSchema>;

export const cooldownSchema = z.enum(["off", "30s", "2min", "5min"]);
export type CooldownSetting = z.infer<typeof cooldownSchema>;

export const themeSchema = z.enum(["auto", "light", "dark"]);
export type ThemeSetting = z.infer<typeof themeSchema>;

export const settingsSchema = z.object({
  provider: providerIdSchema,
  model: z.string().max(120),
  apiKey: z.string().max(400),
  hintStyle: hintStyleSchema,
  cooldown: cooldownSchema,
  enableLevel5: z.boolean(),
  level5DelayMinutes: z.number().int().min(0).max(180),
  theme: themeSchema,
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  provider: "gemini",
  model: "",
  apiKey: "",
  hintStyle: "socratic",
  cooldown: "30s",
  enableLevel5: false,
  level5DelayMinutes: 10,
  theme: "auto",
};

export const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string> = {
  gemini: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
};

export function resolveModel(settings: Pick<Settings, "provider" | "model">): string {
  const trimmed = settings.model.trim();
  return trimmed || PROVIDER_DEFAULT_MODELS[settings.provider];
}

export function publicSettings(settings: Settings): Omit<Settings, "apiKey"> & { hasApiKey: boolean } {
  const { apiKey, ...rest } = settings;
  return { ...rest, hasApiKey: apiKey.trim().length > 0 };
}
