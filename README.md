# AppleBar（Apple-like 个人导航站）

Cloudflare Pages + Pages Functions + Workers KV + 环境变量 `PASSWORD` 的“CloudNav-abcd”同款部署思路：构建输出 `dist`，Functions 放在项目根目录 `/functions`，数据存 KV（单 key：`cloudnav:data`）。

## 技术栈

- Vite + React + TypeScript（输出：`dist`）
- TailwindCSS（glass / vibrancy + 深色模式）
- Framer Motion（克制动效 + 尊重 `prefers-reduced-motion`）
- Cloudflare Pages Functions（`/functions`）
- Workers KV（`CLOUDNAV_KV`）

## 本地开发

```bash
npm i
npm run dev
```

> `npm run dev` 只跑前端（Vite）。要在本地同时跑 Functions：
```bash
npm run build
npx wrangler pages dev dist
```

`.dev.vars`（不提交）：
```ini
PASSWORD=admin
SESSION_SECRET=your_long_random_secret
```

如果 `.dev.vars` 未生效，可显式注入（示例）：
```bash
npx wrangler pages dev dist -b PASSWORD=admin -b SESSION_SECRET=your_long_random_secret
```

## Cloudflare Pages 部署（必须按这个做）

1. Cloudflare Pages 连接 Git 仓库
2. Build settings：
   - Framework preset：**None**
   - Build command：`npm run build`
   - Output directory：`dist`
3. 创建 Workers KV：
   - 控制台 -> Workers & Pages -> KV -> Create namespace
   - 命名空间名：`CLOUDNAV_DB`
4. Pages 绑定 KV：
   - Pages 项目 -> Settings -> Bindings -> Add binding -> KV namespace
   - Variable name：`CLOUDNAV_KV`
   - KV namespace：选择 `CLOUDNAV_DB`
5. Pages 配置环境变量：
   - `PASSWORD`（管理密码，必填）
   - `SESSION_SECRET`（推荐：随机长串；不配则从 `PASSWORD` 派生）

## API

- `GET /api/links`（公开，可缓存）：返回 `{ settings?, groups, links }`
- `GET /api/me`：`{ authed: boolean }`
- `POST /api/login`：`{ password }`，成功写入 HttpOnly cookie（默认 7 天）
- `POST /api/logout`：清 cookie
- 管理端（必须登录，否则 401）：
  - `POST /api/admin/groups`
  - `PUT /api/admin/groups/:id`
  - `DELETE /api/admin/groups/:id`
  - `POST /api/admin/links`
  - `PUT /api/admin/links/:id`
  - `DELETE /api/admin/links/:id`
  - `POST /api/admin/reorder`
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings`
- 兼容旧接口（不推荐）：`POST /api/admin/save`

## KV 数据结构

- KV key：`cloudnav:data`
- 根结构：
```json
{
  "settings": {
    "siteTitle": "AppleBar",
    "siteSubtitle": "个人导航",
    "siteIconDataUrl": "",
    "faviconDataUrl": ""
  },
  "groups": [{ "id": "g1", "name": "开发", "order": 0, "enabled": true }],
  "links": [
    {
      "id": "l1",
      "groupId": "g1",
      "title": "Cloudflare",
      "url": "https://developers.cloudflare.com/",
      "icon": "https://developers.cloudflare.com/favicon.ico",
      "description": "Pages / Functions / Workers KV 官方文档",
      "order": 0
    }
  ]
}
```

## Branding（站点外观）

管理页底部可以配置：站点标题/副标题/顶部图标/Tab favicon/右上角按钮文案；保存后写入 KV 的 `settings` 字段，刷新后仍生效。

## 说明

- `PASSWORD` 只存在于服务端环境变量，不会出现在前端代码里。
- Session 使用 WebCrypto `HMAC-SHA256` 对 payload 签名；推荐设置 `SESSION_SECRET`，避免改 `PASSWORD` 导致全部 session 失效。
- 调试：本地可访问 `GET /api/debug/env` 查看变量是否注入（生产环境禁用）。
- favicon 自动获取：可选环境变量 `USE_FAVICON_SERVICE=true`，服务端会用 Google favicon service 作为默认 `icon` 填充（更稳）；默认用 `${origin}/favicon.ico`。
