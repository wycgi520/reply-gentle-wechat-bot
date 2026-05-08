const WECHAT_API_BASE = "https://api.weixin.qq.com";

export class WechatApiError extends Error {}

export async function getAccessToken({ appId, appSecret }) {
  if (!appId || !appSecret) {
    throw new WechatApiError("缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET。");
  }

  const url = new URL("/cgi-bin/token", WECHAT_API_BASE);
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);

  const data = await getJson(url);
  if (!data.access_token) {
    throw new WechatApiError(data.errmsg || "获取 access_token 失败。");
  }

  return data.access_token;
}

export async function createMenu(accessToken, menu) {
  if (!accessToken) {
    throw new WechatApiError("缺少 access_token。");
  }

  const url = new URL("/cgi-bin/menu/create", WECHAT_API_BASE);
  url.searchParams.set("access_token", accessToken);

  const data = await postJson(url, menu);
  if (data.errcode && data.errcode !== 0) {
    throw new WechatApiError(data.errmsg || `创建菜单失败：${data.errcode}`);
  }

  return data;
}

export async function sendCustomerTextMessage(accessToken, openid, content) {
  if (!accessToken) {
    throw new WechatApiError("缺少 access_token。");
  }
  if (!openid) {
    throw new WechatApiError("缺少 openid，无法发送客服消息。");
  }

  const url = new URL("/cgi-bin/message/custom/send", WECHAT_API_BASE);
  url.searchParams.set("access_token", accessToken);

  const data = await postJson(url, {
    touser: openid,
    msgtype: "text",
    text: {
      content
    }
  });

  if (data.errcode && data.errcode !== 0) {
    throw new WechatApiError(data.errmsg || `发送客服消息失败：${data.errcode}`);
  }

  return data;
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new WechatApiError(data.errmsg || `微信 API 请求失败：${response.status}`);
  }
  return data;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new WechatApiError(data.errmsg || `微信 API 请求失败：${response.status}`);
  }
  return data;
}
