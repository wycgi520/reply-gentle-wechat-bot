import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ quiet: true });

const rootDir = process.cwd();

export const config = {
  port: Number(process.env.PORT || 80),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  dataDir: path.resolve(rootDir, process.env.DATA_DIR || "./data"),
  wechat: {
    token: process.env.WECHAT_TOKEN || "",
    appId: process.env.WECHAT_APP_ID || "",
    appSecret: process.env.WECHAT_APP_SECRET || ""
  },
  ai302: {
    apiKey: process.env.AI302_API_KEY || "",
    model: process.env.AI302_MODEL || "deepseek-chat",
    apiUrl: "https://api.302.ai/v1/chat/completions",
    timeoutMs: Number(process.env.AI302_TIMEOUT_MS || 4200),
    mock: ["1", "true", "yes", "on"].includes(String(process.env.AI302_MOCK || "").toLowerCase())
  }
};
