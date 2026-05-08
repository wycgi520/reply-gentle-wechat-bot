import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { formatSuggestions, parseSuggestions, stripJsonFence } from "../src/ai302.js";
import { parseAdjustment, parseProfileCommand } from "../src/dialogue.js";
import { buildTextReply, parseWechatXml, verifyWechatSignature } from "../src/wechat.js";

test("verifies WeChat SHA1 signature", () => {
  const token = "test-token";
  const timestamp = "1710000000";
  const nonce = "abc123";
  const signature = crypto
    .createHash("sha1")
    .update([token, timestamp, nonce].sort().join(""))
    .digest("hex");

  assert.equal(verifyWechatSignature({ token, timestamp, nonce, signature }), true);
  assert.equal(verifyWechatSignature({ token, timestamp, nonce, signature: "bad" }), false);
});

test("parses inbound XML and builds text reply", () => {
  const inbound = `
    <xml>
      <ToUserName><![CDATA[gh_test]]></ToUserName>
      <FromUserName><![CDATA[o_user]]></FromUserName>
      <CreateTime>1710000000</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[你好]]></Content>
    </xml>
  `;

  const message = parseWechatXml(inbound);
  assert.equal(message.ToUserName, "gh_test");
  assert.equal(message.FromUserName, "o_user");
  assert.equal(message.Content, "你好");

  const reply = buildTextReply(message, "收到啦");
  assert.match(reply, /<ToUserName><!\[CDATA\[o_user\]\]><\/ToUserName>/);
  assert.match(reply, /<FromUserName><!\[CDATA\[gh_test\]\]><\/FromUserName>/);
  assert.match(reply, /<Content><!\[CDATA\[收到啦\]\]><\/Content>/);
});

test("parses AI JSON suggestions and formats WeChat text", () => {
  const content = "```json\n{\"suggestions\":[{\"text\":\"我在的，你慢慢说。\",\"tone\":\"温柔\",\"rationale\":\"接住情绪。\"}]}\n```";
  assert.equal(stripJsonFence(content).startsWith("{"), true);

  const suggestions = parseSuggestions(content);
  assert.equal(suggestions[0].text, "我在的，你慢慢说。");

  const formatted = formatSuggestions(suggestions);
  assert.match(formatted, /给你 3 条/);
  assert.match(formatted, /更短 \/ 更暖 \/ 更像我/);
});

test("parses adjustment and profile commands", () => {
  assert.equal(parseAdjustment("更短"), "shorter");
  assert.equal(parseAdjustment("更暖"), "warmer");
  assert.equal(parseAdjustment("更像我"), "more_like_me");

  assert.deepEqual(parseProfileCommand("语气 自然一点，别太正式"), {
    tonePreference: "自然一点，别太正式"
  });
  assert.deepEqual(parseProfileCommand("长度 短"), {
    replyLength: "short"
  });
});

