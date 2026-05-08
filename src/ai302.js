export const DEFAULT_PROFILE = {
  tonePreference: "自然、真诚、不夸张，像普通朋友聊天",
  commonAddress: "",
  replyLength: "medium",
  avoidPhrases: "",
  recentAdoptionSummary: ""
};

export const ADJUSTMENTS = {
  default: "生成 3 条不同语气的可直接复制回复。",
  more_like_me: "更贴近用户过往风格，减少模板感。",
  shorter: "明显更短，优先一句话，保留温度。",
  warmer: "更暖一些，但不要过度热情或施压。"
};

export class Ai302Error extends Error {}

export async function generateReplySuggestions({
  apiKey,
  apiUrl,
  model,
  timeoutMs = 4200,
  mock = false,
  contextInput,
  profile,
  adjustment = "default"
}) {
  if (mock) {
    return buildMockSuggestions(contextInput, adjustment);
  }

  if (!apiKey) {
    throw new Ai302Error("服务还没有配置 302.AI API Key。");
  }

  let response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(profile, adjustment)
          },
          {
            role: "user",
            content: buildUserPayload(contextInput, profile, adjustment)
          }
        ],
        temperature: 0.7,
        max_tokens: 900
      })
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Ai302Error("302.AI 请求超时了。微信被动回复时间很短，可以先开启 AI302_MOCK=true 测链路。");
    }
    throw new Ai302Error(`302.AI 网络请求失败：${error.message}`);
  }

  const data = await readJsonSafely(response);

  if (!response.ok) {
    throw new Ai302Error(data?.error?.message || `302.AI API 请求失败：${response.status}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Ai302Error("模型没有返回可解析的回复建议。");
  }

  return parseSuggestions(content);
}

function buildMockSuggestions(contextInput, adjustment) {
  const prefix = adjustment === "shorter"
    ? "短版"
    : adjustment === "warmer"
      ? "暖一点"
      : adjustment === "more_like_me"
        ? "更像你"
        : "测试";
  const excerpt = String(contextInput?.selectedText || "").slice(0, 18);

  return [
    {
      tone: "自然",
      text: `${prefix}：我看到了，感觉你现在确实不太容易，我在这儿听你说。`,
      rationale: excerpt ? `基于“${excerpt}...”轻量接住对方。` : "轻量接住对话。"
    },
    {
      tone: "温柔",
      text: `${prefix}：别急着一个人扛着，你可以慢慢说，我愿意听。`,
      rationale: "适合对方情绪比较低的时候。"
    },
    {
      tone: "轻松",
      text: `${prefix}：懂你，这种时候真的会卡住。先缓一缓，我们一点点来。`,
      rationale: "让语气不沉重，也不敷衍。"
    }
  ];
}

export function buildSystemPrompt(profile = DEFAULT_PROFILE, adjustment = "default") {
  const lengthGuide = {
    short: "尽量 1 句话，少于 35 个中文字。",
    medium: "通常 1-2 句话，保持自然口语。",
    long: "可以 2-3 句话，但不要变成小作文。"
  };

  return [
    "你是一个帮助表达困难者起草朋友日常聊天回复的助手。",
    "目标是帮用户跨过不知道怎么回复的卡点，而不是替用户经营关系。",
    "生成 3 条可直接复制的回复建议，语气分别偏自然、温柔、轻松。",
    "不要编造用户没有提供的事实、承诺、情绪或经历。",
    "不要操纵对方、施压、阴阳怪气、过度讨好或过度暧昧。",
    "如果上下文不足，给安全、轻量、能继续对话的回复。",
    "默认跟随上下文语言；中文上下文使用简体中文。",
    "只输出 JSON，不要输出 Markdown、代码块或额外解释。",
    "JSON 格式必须是：{\"suggestions\":[{\"text\":\"...\",\"tone\":\"自然\",\"rationale\":\"...\"}]}",
    `用户语气偏好：${profile.tonePreference || DEFAULT_PROFILE.tonePreference}`,
    `常用称呼：${profile.commonAddress || "无"}`,
    `长度偏好：${lengthGuide[profile.replyLength] || lengthGuide.medium}`,
    `避免使用：${profile.avoidPhrases || "无"}`,
    `近期采纳摘要：${profile.recentAdoptionSummary || "暂无"}`,
    `本次调整：${ADJUSTMENTS[adjustment] || ADJUSTMENTS.default}`,
    "每条 rationale 简短说明适用感觉，不要超过一句话。"
  ].join("\n");
}

export function buildUserPayload(contextInput, profile = DEFAULT_PROFILE, adjustment = "default") {
  return JSON.stringify({
    contextInput: {
      selectedText: limitText(contextInput?.selectedText || "", 4200),
      draftText: limitText(contextInput?.draftText || "", 1200),
      pageTitle: limitText(contextInput?.pageTitle || "微信公众号聊天", 180),
      platform: limitText(contextInput?.platform || "wechat-official-account", 120)
    },
    userStyleProfile: profile,
    adjustment: ADJUSTMENTS[adjustment] || ADJUSTMENTS.default
  }, null, 2);
}

export function parseSuggestions(content) {
  const text = stripJsonFence(content);
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Ai302Error("模型返回格式不是有效 JSON。");
  }

  const fallbackTones = ["自然", "温柔", "轻松"];
  const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

  const normalized = suggestions
    .slice(0, 3)
    .map((item, index) => ({
      text: cleanInlineText(item?.text),
      tone: cleanInlineText(item?.tone) || fallbackTones[index],
      rationale: cleanInlineText(item?.rationale) || "适合轻量自然地接住对话。"
    }))
    .filter((item) => item.text);

  if (normalized.length === 0) {
    throw new Ai302Error("没有生成可用回复。");
  }

  return normalized;
}

export function formatSuggestions(suggestions) {
  return [
    "给你 3 条可以复制的回复：",
    "",
    ...suggestions.flatMap((item, index) => [
      `${index + 1}. ${item.tone}`,
      item.text,
      `适合：${item.rationale}`,
      ""
    ]),
    "想调整可以回复：更短 / 更暖 / 更像我"
  ].join("\n").trim();
}

export function stripJsonFence(content) {
  return String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function cleanInlineText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function limitText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { error: { message: text } };
  }
}
