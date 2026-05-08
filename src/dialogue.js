import { config } from "./config.js";
import { generateReplySuggestions, formatSuggestions } from "./ai302.js";

export const GUIDE_TEXT = [
  "把你想回复的聊天记录多选转发给我，或直接粘贴一段对话。",
  "",
  "我会给你 3 条回复建议：自然一点、温柔一点、轻松一点。",
  "",
  "生成后可以继续回复：更短 / 更暖 / 更像我"
].join("\n");

export const STYLE_TEXT = [
  "可以这样告诉我你的表达习惯：",
  "",
  "语气 自然一点，别太正式",
  "称呼 姐妹",
  "避免 哈哈哈、亲爱的、过度道歉",
  "长度 短",
  "",
  "之后我会尽量按这个风格给建议。"
].join("\n");

export const USAGE_TEXT = [
  "使用方式：",
  "1. 在聊天里长按消息，多选几条。",
  "2. 转发或复制粘贴给公众号。",
  "3. 收到 3 条建议后，复制一条回原聊天窗口。",
  "",
  "隐私边界：你主动发给公众号的内容才会被处理；我不会读取你的微信聊天。"
].join("\n");

export async function handleIncomingMessage(message, store) {
  const openid = message.FromUserName || "";
  const msgType = String(message.MsgType || "").toLowerCase();

  if (!openid) {
    return "没有识别到用户 openid。";
  }

  if (msgType === "event") {
    return handleEvent(message);
  }

  if (msgType !== "text") {
    return "目前先支持文本内容。可以把聊天记录复制粘贴给我，我来帮你想回复。";
  }

  const text = String(message.Content || "").trim();
  if (!text) {
    return GUIDE_TEXT;
  }

  const profileUpdate = parseProfileCommand(text);
  if (profileUpdate) {
    const user = await store.getUser(openid);
    await store.updateUser(openid, {
      profile: {
        ...user.profile,
        ...profileUpdate
      },
      updatedAt: new Date().toISOString()
    });
    return "已记住。下次生成回复时我会按这个习惯来。";
  }

  const adjustment = parseAdjustment(text);
  if (adjustment) {
    return regenerateFromLastContext(openid, adjustment, store);
  }

  return generateFromText(openid, text, "default", store);
}

function handleEvent(message) {
  const event = String(message.Event || "").toLowerCase();
  const key = String(message.EventKey || "");

  if (event === "subscribe") {
    return `欢迎来找我帮你想回复。\n\n${GUIDE_TEXT}`;
  }

  if (event !== "click") {
    return GUIDE_TEXT;
  }

  if (key === "HELP_REPLY") {
    return GUIDE_TEXT;
  }
  if (key === "STYLE_SETTINGS") {
    return STYLE_TEXT;
  }
  if (key === "USAGE_HELP") {
    return USAGE_TEXT;
  }

  return GUIDE_TEXT;
}

async function regenerateFromLastContext(openid, adjustment, store) {
  const user = await store.getUser(openid);
  if (!user.lastContextInput?.selectedText && !user.lastContextInput?.draftText) {
    return "我还没有上一段聊天上下文。先把聊天记录转发或粘贴给我吧。";
  }

  return generateWithContext(openid, user.lastContextInput, adjustment, store);
}

async function generateFromText(openid, text, adjustment, store) {
  const contextInput = {
    selectedText: text,
    draftText: "",
    pageTitle: "微信公众号聊天",
    platform: "wechat-official-account"
  };
  return generateWithContext(openid, contextInput, adjustment, store);
}

async function generateWithContext(openid, contextInput, adjustment, store) {
  const user = await store.getUser(openid);
  const suggestions = await generateReplySuggestions({
    ...config.ai302,
    contextInput,
    profile: user.profile,
    adjustment
  });

  await store.updateUser(openid, {
    lastContextInput: contextInput,
    lastSuggestions: suggestions,
    updatedAt: new Date().toISOString()
  });

  return formatSuggestions(suggestions);
}

export function parseAdjustment(text) {
  const normalized = String(text || "").trim().replace(/\s+/g, "");
  if (["更短", "短一点", "简短", "太长了"].includes(normalized)) {
    return "shorter";
  }
  if (["更暖", "暖一点", "温柔点", "温柔一点"].includes(normalized)) {
    return "warmer";
  }
  if (["更像我", "像我一点", "别太ai", "别太AI", "自然点", "自然一点"].includes(normalized)) {
    return "more_like_me";
  }
  return "";
}

export function parseProfileCommand(text) {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(/^(语气|称呼|避免|长度)\s*[:：]?\s*(.+)$/);
  if (!match) {
    return null;
  }

  const [, command, value] = match;
  const content = value.trim();
  if (!content) {
    return null;
  }

  if (command === "语气") {
    return { tonePreference: content };
  }
  if (command === "称呼") {
    return { commonAddress: content };
  }
  if (command === "避免") {
    return { avoidPhrases: content };
  }
  if (command === "长度") {
    const length = parseLength(content);
    return length ? { replyLength: length } : null;
  }

  return null;
}

function parseLength(value) {
  const normalized = String(value || "").trim();
  if (/^(短|短一点|short)$/i.test(normalized)) {
    return "short";
  }
  if (/^(正常|中等|medium)$/i.test(normalized)) {
    return "medium";
  }
  if (/^(长|多说一点|long)$/i.test(normalized)) {
    return "long";
  }
  return "";
}

