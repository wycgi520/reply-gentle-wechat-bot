import { config } from "../src/config.js";
import { createMenu, getAccessToken } from "../src/wechat-api.js";

const menu = {
  button: [
    {
      type: "click",
      name: "帮我回复",
      key: "HELP_REPLY"
    },
    {
      type: "click",
      name: "我的语气",
      key: "STYLE_SETTINGS"
    },
    {
      type: "click",
      name: "使用说明",
      key: "USAGE_HELP"
    }
  ]
};

async function main() {
  const accessToken = await getAccessToken(config.wechat);
  const result = await createMenu(accessToken, menu);
  console.log("Menu created:", result);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

