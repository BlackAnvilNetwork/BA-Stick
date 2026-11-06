import { z } from "zod";

export const CHAT_MAX_LEN = 140;
export const ChatChannelSchema = z.enum(["say", "party"]);
export type ChatChannel = z.infer<typeof ChatChannelSchema>;

/** Strip controls, collapse space, and cap length. Empty after trim is rejected. */
export function sanitizeChatText(raw: string, max = CHAT_MAX_LEN): string | null {
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

/** `/p` or `/party` → party; `/s` or `/say` or bare text → say. */
export function parseChatCommand(raw: string): { channel: ChatChannel; text: string } | null {
  const cleaned = sanitizeChatText(raw, CHAT_MAX_LEN + 16);
  if (!cleaned) return null;
  const party = cleaned.match(/^\/p(?:arty)?(?:\s+|$)(.*)$/i);
  if (party) {
    const text = sanitizeChatText(party[1] ?? "");
    return text ? { channel: "party", text } : null;
  }
  const say = cleaned.match(/^\/s(?:ay)?(?:\s+|$)(.*)$/i);
  if (say) {
    const text = sanitizeChatText(say[1] ?? "");
    return text ? { channel: "say", text } : null;
  }
  const text = sanitizeChatText(cleaned);
  return text ? { channel: "say", text } : null;
}
