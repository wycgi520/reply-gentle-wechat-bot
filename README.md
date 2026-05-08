# Reply Gentle WeChat Bot

微信公众号“帮我回复”MVP。用户把聊天记录多选转发或粘贴给公众号，后端调用 302.AI 返回 3 条回复建议。

## 功能

- 微信服务器接入校验：`GET /wechat`
- 接收公众号消息：`POST /wechat`
- 支持文本消息生成回复建议
- 支持菜单点击事件：帮我回复、我的语气、使用说明
- 支持用户回复“更短”“更暖”“更像我”重写上一轮
- 按 openid 本地保存最近上下文、语气偏好和采纳摘要
- 自定义菜单创建脚本：`npm run create-menu`

## 本地运行

```powershell
cd E:\Projects\Codex\reply-gentle-wechat-bot
npm install
Copy-Item .env.example .env
npm run dev
```

编辑 `.env`，填入：

- `WECHAT_TOKEN`：微信公众号后台“服务器配置”里的 Token
- `WECHAT_APP_ID` / `WECHAT_APP_SECRET`：公众号开发信息
- `AI302_API_KEY`：302.AI API Key
- `PUBLIC_BASE_URL`：部署后的公网 HTTPS 域名

如果只是先验证微信链路，可以临时设置：

```text
AI302_MOCK=true
```

这样公众号会直接返回测试建议，不会调用 302.AI。

微信公众号后台服务器地址填：

```text
https://your-domain.example.com/wechat
```

消息加解密方式先选择“明文模式”。如果要调用创建菜单接口，公众号后台可能还需要把服务器出口 IP 加到 IP 白名单。

## 放置微信域名校验文件

在公众号后台配置 JS 接口安全域名、业务域名或网页授权域名时，微信会让你下载一个类似下面的文件：

```text
MP_verify_xxxxxxxxxxxxxxxx.txt
```

把这个文件放到项目的 `public` 目录：

```text
public/MP_verify_xxxxxxxxxxxxxxxx.txt
```

启动服务后，确认浏览器可以访问：

```text
https://your-domain.example.com/MP_verify_xxxxxxxxxxxxxxxx.txt
```

如果能看到文件内容，再回微信后台点“确定”。

## 创建菜单

服务部署并配置好 `.env` 后执行：

```powershell
npm run create-menu
```

菜单结构：

- 帮我回复
- 我的语气
- 使用说明

## 部署建议

## 部署到微信云托管

当前项目已经包含微信云托管需要的 `Dockerfile` 和 `container.config.json`，可以直接作为 Express.js 服务部署。

推荐流程：

1. 把本项目推到 GitHub/Gitee/GitLab 仓库，不要提交 `.env`。
2. 在微信云托管里使用 Express.js 模板创建服务，或把已创建的模板服务绑定到这个仓库。
3. 构建方式选择项目里的 `Dockerfile`。
4. 容器端口使用 `80`。
5. 在云托管控制台配置环境变量：

```text
WECHAT_TOKEN=和公众号后台服务器配置 Token 一致
WECHAT_APP_ID=公众号 AppID
WECHAT_APP_SECRET=公众号 AppSecret
AI302_API_KEY=你的 302.AI API Key
AI302_MODEL=deepseek-chat
AI302_TIMEOUT_MS=4200
AI302_MOCK=false
DATA_DIR=./data
```

部署成功后先访问：

```text
https://云托管域名/health
```

确认返回：

```json
{"ok":true}
```

然后把公众号后台的服务器地址改为：

```text
https://云托管域名/wechat
```

消息加解密方式先选择“明文模式”，数据格式选择 XML。

## 校验

```powershell
npm test
```

本地模拟一条微信文本消息：

```powershell
npm run simulate -- "朋友说：我今天有点低落，也不是想让你解决，就是想有人听我讲几句。"
```

如果 `npm run dev` 的窗口里能看到 `wechat message parsed` 和 `wechat reply ready`，说明后端链路是通的。
