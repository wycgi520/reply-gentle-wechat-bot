import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true
});

export function verifyWechatSignature({ token, signature, timestamp, nonce }) {
  if (!token || !signature || !timestamp || !nonce) {
    return false;
  }

  const expected = crypto
    .createHash("sha1")
    .update([token, timestamp, nonce].sort().join(""))
    .digest("hex");

  return safeEqual(expected, signature);
}

export function parseWechatXml(xmlText) {
  const parsed = parser.parse(xmlText || "");
  return parsed?.xml || {};
}

export function buildTextReply(incoming, content) {
  return [
    "<xml>",
    `<ToUserName>${cdata(incoming.FromUserName || "")}</ToUserName>`,
    `<FromUserName>${cdata(incoming.ToUserName || "")}</FromUserName>`,
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>`,
    "<MsgType><![CDATA[text]]></MsgType>",
    `<Content>${cdata(content)}</Content>`,
    "</xml>"
  ].join("");
}

export function buildSuccessReply() {
  return "success";
}

function cdata(value) {
  return `<![CDATA[${String(value ?? "").replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

