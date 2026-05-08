import crypto from "node:crypto";
import { config } from "../src/config.js";

const baseUrl = process.env.LOCAL_BASE_URL || `http://127.0.0.1:${config.port}`;
const token = config.wechat.token;
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = Math.random().toString(36).slice(2, 10);
const signature = crypto
  .createHash("sha1")
  .update([token, timestamp, nonce].sort().join(""))
  .digest("hex");

const content = process.argv.slice(2).join(" ") || "朋友说：我今天有点低落，也不是想让你解决，就是想有人听我讲几句。";
const xml = [
  "<xml>",
  "<ToUserName><![CDATA[gh_local_test]]></ToUserName>",
  "<FromUserName><![CDATA[o_local_user]]></FromUserName>",
  `<CreateTime>${timestamp}</CreateTime>`,
  "<MsgType><![CDATA[text]]></MsgType>",
  `<Content><![CDATA[${content.replaceAll("]]>", "]]]]><![CDATA[>")}]]></Content>`,
  "<MsgId>1000000000000000001</MsgId>",
  "</xml>"
].join("");

const url = new URL("/wechat", baseUrl);
url.searchParams.set("signature", signature);
url.searchParams.set("timestamp", timestamp);
url.searchParams.set("nonce", nonce);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/xml"
  },
  body: xml
});

console.log("POST", url.toString());
console.log("Status:", response.status);
console.log(await response.text());
