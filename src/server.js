import express from "express";
import path from "node:path";
import { config } from "./config.js";
import { UserStore } from "./store.js";
import {
  buildSuccessReply,
  buildTextReply,
  parseWechatXml,
  verifyWechatSignature
} from "./wechat.js";
import { handleIncomingMessage } from "./dialogue.js";

const app = express();
const store = new UserStore(config.dataDir);
const publicDir = path.resolve(process.cwd(), "public");

app.use(express.static(publicDir, {
  dotfiles: "ignore",
  index: false,
  maxAge: "5m"
}));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

app.use("/wechat", express.text({
  type: ["text/*", "application/xml", "application/octet-stream"],
  limit: "256kb"
}));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.type("text/plain").send("Reply Gentle WeChat Bot is running.");
});

app.get("/wechat", (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;

  if (!signature && !timestamp && !nonce && !echostr) {
    res.type("text/plain").send("WeChat message endpoint is ready.");
    return;
  }

  const verified = verifyWechatSignature({
    token: config.wechat.token,
    signature,
    timestamp,
    nonce
  });

  console.log("wechat verify", {
    verified,
    hasSignature: Boolean(signature),
    hasTimestamp: Boolean(timestamp),
    hasNonce: Boolean(nonce),
    hasEcho: Boolean(echostr)
  });

  if (!verified) {
    res.status(403).send("invalid signature");
    return;
  }

  res.type("text/plain").send(String(echostr || ""));
});

app.post("/wechat", async (req, res) => {
  if (isCloudPathCheck(req.body)) {
    console.log("wechat cloud path check");
    res.type("text/plain").send(buildSuccessReply());
    return;
  }

  const { signature, timestamp, nonce } = req.query;
  const hasWechatSignature = Boolean(signature || timestamp || nonce);
  const verified = hasWechatSignature
    ? verifyWechatSignature({
      token: config.wechat.token,
      signature,
      timestamp,
      nonce
    })
    : isWechatCloudRequest(req);

  console.log("wechat message signature", {
    verified,
    hasWechatSignature,
    hasCloudHeader: isWechatCloudRequest(req),
    bodyLength: String(req.body || "").length
  });

  if (!verified) {
    res.status(403).send("invalid signature");
    return;
  }

  let message;
  try {
    message = parseWechatXml(req.body);
    console.log("wechat message parsed", {
      from: maskOpenid(message.FromUserName),
      type: message.MsgType,
      event: message.Event,
      eventKey: message.EventKey,
      contentPreview: preview(message.Content)
    });
  } catch (error) {
    console.error("Failed to parse WeChat XML:", error);
    res.type("text/plain").send(buildSuccessReply());
    return;
  }

  try {
    const startedAt = Date.now();
    const replyText = await handleIncomingMessage(message, store);
    console.log("wechat reply ready", {
      from: maskOpenid(message.FromUserName),
      replyLength: replyText.length,
      elapsedMs: Date.now() - startedAt
    });
    res.type("application/xml").send(buildTextReply(message, replyText));
  } catch (error) {
    console.error("Failed to handle WeChat message:", error);
    res
      .type("application/xml")
      .send(buildTextReply(message, "刚刚生成失败了，可以稍后再试一次。"));
  }
});

app.listen(config.port, () => {
  console.log(`Reply Gentle WeChat Bot listening on http://localhost:${config.port}`);
  console.log("runtime config", {
    hasWechatToken: Boolean(config.wechat.token),
    wechatTokenLength: config.wechat.token.length,
    has302Key: Boolean(config.ai302.apiKey),
    ai302Model: config.ai302.model,
    ai302TimeoutMs: config.ai302.timeoutMs,
    ai302Mock: config.ai302.mock,
    dataDir: config.dataDir
  });
});

function preview(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

function maskOpenid(openid) {
  const text = String(openid || "");
  if (text.length <= 8) {
    return text;
  }
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function isCloudPathCheck(body) {
  return /<action>\s*CheckContainerPath\s*<\/action>/i.test(String(body || ""))
    || /"action"\s*:\s*"CheckContainerPath"/i.test(String(body || ""));
}

function isWechatCloudRequest(req) {
  return Boolean(
    req.get("x-wx-source")
    || req.get("x-wx-sources")
    || req.get("x-wx-openid")
    || req.get("x-wx-from-openid")
  );
}
