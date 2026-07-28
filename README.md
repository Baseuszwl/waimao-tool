---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 45fe27739d549c210c3916f437c842f7_7263d51e8a5b11f1a093525400287e28
    ReservedCode1: JBnh9RI10ETnrx5Yw+ISSRGhNTXH9Wr7A/J8ieWlkud7HgyQi7KZt4JPJKplWqvq7HUhvpinpL2zWVqZq/GvUGVoGIhY9eHQCbT1fTvibenNrA+FUb8+H7OWLI0dFvrZBkcW9sCVJs+LhdAacQzfOZWahbxXVGn+o9k98rAtbg8O7csR16qYx8cMQFY=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 45fe27739d549c210c3916f437c842f7_7263d51e8a5b11f1a093525400287e28
    ReservedCode2: JBnh9RI10ETnrx5Yw+ISSRGhNTXH9Wr7A/J8ieWlkud7HgyQi7KZt4JPJKplWqvq7HUhvpinpL2zWVqZq/GvUGVoGIhY9eHQCbT1fTvibenNrA+FUb8+H7OWLI0dFvrZBkcW9sCVJs+LhdAacQzfOZWahbxXVGn+o9k98rAtbg8O7csR16qYx8cMQFY=
---

# TradeSeeker - 外贸选品 & 1688货源匹配工具

> 一秒查海外爆款，一键匹配1688货源，傻瓜式做外贸选品

## 项目结构

```
output/
├── index.html          # 前端单文件应用（纯 HTML/CSS/JS，可直接打开）
├── api-server.js       # 后端 API 脚本（Vercel Serverless Function）
├── vercel.json         # Vercel 部署配置
├── api/                # Vercel API 目录（部署时使用）
│   ├── api-server.js   # API 入口（复制自根目录的 api-server.js）
│   └── health.js       # 健康检查端点
└── README.md           # 本文件
```

## 快速开始

### 方式一：本地直接使用（无需部署）

双击 `index.html` 即可在浏览器中打开使用。所有功能均可正常使用，搜索和货源匹配使用内置 Mock 数据。

### 方式二：GitHub Pages 部署前端

1. 将 `output/` 目录内容推送到 GitHub 仓库（推荐使用 `gh-pages` 分支）
2. 在仓库 Settings → Pages 中启用 GitHub Pages，选择分支并保存
3. 访问 `https://<你的用户名>.github.io/<仓库名>/`

> 提示：GitHub Pages 部署的前端默认使用内置 Mock 数据。如需启用后端 API，请同时部署 Vercel API 并修改 `index.html` 中的 `apiBaseUrl`。

### 方式三：Vercel 一键部署（前端 + API）

1. 将项目目录推送到 GitHub 仓库
2. 登录 [Vercel](https://vercel.com) → 点击 "New Project" → 导入你的 GitHub 仓库
3. Vercel 会自动识别 `vercel.json` 配置，无需手动设置
4. 部署完成后，你会获得一个 `https://xxx.vercel.app` 的域名
5. 修改 `index.html` 第 5 行附近的 `apiBaseUrl` 变量为你的 Vercel 域名：
   ```javascript
   const apiBaseUrl = 'https://你的项目名.vercel.app';
   ```

### 方式四：仅部署 API 到 Vercel

如果你已经通过 GitHub Pages 部署了前端，只想部署后端 API：

1. 在项目根目录创建以下目录结构：
   ```
   project-root/
   ├── api/
   │   └── api-server.js   # 将 api-server.js 复制到此
   ├── vercel.json
   └── package.json        # 可选
   ```

2. 推送到 GitHub，在 Vercel 中导入仓库
3. 将前端 `index.html` 中的 `apiBaseUrl` 指向 Vercel 部署域名

## API 接口说明

### GET /api/search
搜索海外爆款商品。

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| platform | string | 否 | 平台过滤（amazon/temu/shopee/lazada/tiktok），不传则搜索全部 |

**示例：**
```
GET /api/search?keyword=蓝牙耳机&platform=amazon
```

**响应：**
```json
{
  "success": true,
  "keyword": "蓝牙耳机",
  "platform": "amazon",
  "total": 3,
  "products": [
    {
      "id": 9001,
      "platform": "amazon",
      "title": "Wireless Bluetooth Earbuds Pro ANC IPX7 36H",
      "price": 49.99,
      "currency": "USD",
      "sales": 12580,
      "rating": 4.7,
      "category": "电子产品",
      "weight": "轻小件",
      "asin": "B0C9XK81P2",
      "image": "https://loremflickr.com/400/300/electronics,gadget?random=9001"
    }
  ],
  "timestamp": "2026-07-28T10:00:00.000Z"
}
```

### GET /api/source
搜索 1688 货源。

**参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词（商品标题或描述） |

**示例：**
```
GET /api/source?keyword=蓝牙耳机
```

**响应：**
```json
{
  "success": true,
  "keyword": "蓝牙耳机",
  "total": 2,
  "sources": [
    {
      "id": 8001,
      "title": "蓝牙耳机源头工厂 TWS降噪跨境专供 OEM/ODM现货",
      "price": 18.50,
      "priceRange": "¥16.80-22.00",
      "moq": 10,
      "supplier": "深圳华强电子科技",
      "location": "深圳",
      "dropShipping": true,
      "custom": true,
      "badge": "实力商家",
      "sales": 8500,
      "image": "https://loremflickr.com/300/300/factory,product?random=8001"
    }
  ],
  "timestamp": "2026-07-28T10:00:00.000Z"
}
```

## 升级到真实数据源

当前 API 使用模拟数据。要对接真实数据源，请修改 `api-server.js` 中的以下函数：

### 对接第三方跨境数据 API

在 `handleSearch` 函数中替换模拟数据逻辑：

```javascript
// 示例：调用 Keepa / Jungle Scout / DataHawk 等合规 API
const response = await fetch(`https://api.keepa.com/product?key=${API_KEY}&asin=${asin}`);
const data = await response.json();
// 将返回数据映射为 products 格式
```

### 对接 1688 开放平台 API

在 `handleSource` 函数中替换模拟数据逻辑：

```javascript
// 示例：调用 1688 开放平台 API
const response = await fetch(`https://gw.open.1688.com/openapi/param2/1/...`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const data = await response.json();
// 将返回数据映射为 sources 格式
```

## 技术架构

- **前端**：原生 HTML/CSS/JS，无框架依赖，响应式设计 (PC + 移动端)
- **图片服务**：LoremFlickr（免费，无需 API Key）
- **图表**：Chart.js CDN
- **图标**：Font Awesome CDN
- **后端 API**：Node.js Serverless Function (Vercel)
- **频率限制**：内存级 IP 限流（每分钟 30 次）
- **缓存**：内存缓存（5 分钟 TTL）

## 功能清单

- [x] 海外多平台热销榜单（Amazon / Temu / Shopee / Lazada / TikTok Shop）
- [x] 三种榜单类型（热销榜 BSR / 飙升榜 / 新品榜）
- [x] 组合筛选（类目 / 价格 / 评分 / 销量）
- [x] 商品详情页（90天价格走势图 / 竞争度 / ASIN）
- [x] 1688 货源智能匹配（文字搜同款 / 图片搜同款）
- [x] 智能利润测算（实时计算净利润 / 毛利率 / 净利率 / 盈利评级）
- [x] 三级权限体系（游客 5次/天 / 注册 20次/天 / 会员无限次）
- [x] 收藏管理（商品 + 货源）
- [x] 搜索历史记录
- [x] 会员套餐展示
- [x] 合规免责声明
- [x] API 优先搜索（失败自动 Fallback 本地数据）
- [x] 搜索框 X 按钮清空
- [x] Loading 状态提示

## 许可证

本项目仅用于学习和演示目的。所有商品数据来源于模拟数据，实际使用时需对接合规的第三方商业 API。
*（内容由AI生成，仅供参考）*
