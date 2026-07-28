---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 45fe27739d549c210c3916f437c842f7_a3b175da8a6611f1a093525400287e28
    ReservedCode1: /9tSWoxv/urs5my4WKD+8DamarsXmIsqkUGoAv4fiB9p7ICta4hcPkYbBiutoTxS3SUxuSPdkeByAIx6YOFiemWj/gQHbDqqV43gtT4g6syV2TTHyMr5rxBuZ8YyyMBtoIYvqD3aD4nkM54ZfOKR1bVY8+xXRE7jsixjppXmw8wTB3rhA+KAcBTXUFs=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 45fe27739d549c210c3916f437c842f7_a3b175da8a6611f1a093525400287e28
    ReservedCode2: /9tSWoxv/urs5my4WKD+8DamarsXmIsqkUGoAv4fiB9p7ICta4hcPkYbBiutoTxS3SUxuSPdkeByAIx6YOFiemWj/gQHbDqqV43gtT4g6syV2TTHyMr5rxBuZ8YyyMBtoIYvqD3aD4nkM54ZfOKR1bVY8+xXRE7jsixjppXmw8wTB3rhA+KAcBTXUFs=
---

# TradeSeeker API 接入指南

## 概述

TradeSeeker 前端默认使用本地 Mock 数据运行（`apiBaseUrl = ''`）。接入真实电商 API 后，可获取实时商品价格、图片、销量等数据。

## 方案一：Amazon Product Advertising API (PA-API)

### 申请流程

1. 注册 [Amazon Associates](https://affiliate-program.amazon.com/) 账号
2. 在 Associates Central 申请 Product Advertising API 访问权限
3. 获取以下凭据：
   - `Access Key ID`
   - `Secret Access Key`
   - `Associate Tag (Tracking ID)`

### 区域说明

不同 Amazon 站点需分别申请：
- 美国站：`webservices.amazon.com`
- 日本站：`webservices.amazon.co.jp`
- 欧洲站：`webservices.amazon.co.uk/de/fr/it/es`

### 接入方式

PA-API 需要签名认证，建议通过后端代理调用。参考 `api-server.js` 中的 `/api/search` 端点实现。

```
GET /api/search?keyword=bluetooth+earbuds&platform=amazon
```

---

## 方案二：Rainforest API（推荐，有免费额度）

### 优势

- **无需 Amazon Associates 账号**
- 每月 100 次免费请求
- 支持 Amazon、Walmart 等平台
- 返回真实商品图片 URL（`main_image.link`）

### 申请流程

1. 访问 [Rainforest API](https://www.rainforestapi.com/) 注册
2. 在 Dashboard 获取 `API Key`
3. 免费额度：100 次/月，超出后按量付费

### API 调用示例

```bash
curl -X GET 'https://api.rainforestapi.com/request?api_key=YOUR_API_KEY&type=search&amazon_domain=amazon.com&search_term=bluetooth+speaker'
```

### 返回关键字段

```json
{
  "search_results": [
    {
      "title": "JBL Flip 6 Portable Bluetooth Speaker",
      "price": {"value": 129.95, "currency": "USD"},
      "rating": 4.7,
      "ratings_total": 23456,
      "main_image": {"link": "https://m.media-amazon.com/images/I/..."},
      "link": "https://www.amazon.com/dp/B09HCGRLWN"
    }
  ]
}
```

---

## 方案三：SerpAPI

### 申请流程

1. 注册 [SerpAPI](https://serpapi.com/)
2. 获取 API Key
3. 免费额度：100 次/月

### 调用示例

```bash
curl 'https://serpapi.com/search?engine=amazon&keyword=wireless+earbuds&api_key=YOUR_KEY'
```

---

## 前端配置

配置 `apiBaseUrl` 指向你的后端地址：

```javascript
// 在 index.html 中修改
const apiBaseUrl = 'https://your-api-server.com'; // 替换为你的API地址
```

### 后端参考实现（Node.js + Express）

```javascript
// api-server.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(require('cors')());

app.get('/api/search', async (req, res) => {
  const { keyword, platform } = req.query;
  
  // 调用 Rainforest API
  const response = await axios.get('https://api.rainforestapi.com/request', {
    params: {
      api_key: process.env.RAINFOREST_API_KEY,
      type: 'search',
      amazon_domain: 'amazon.com',
      search_term: keyword
    }
  });
  
  // 转换为前端格式
  const products = response.data.search_results.map(item => ({
    title: item.title,
    price: parseFloat(item.price?.value || 0),
    rating: item.rating || 0,
    reviews: item.ratings_total || 0,
    realImage: item.main_image?.link || '',
    asin: item.asin || '',
    sales: item.ratings_total || 0,
    category: item.categories?.[0]?.name || 'Other',
    platform: 'amazon',
    list: 'hot'
  }));
  
  res.json({ success: true, products });
});

app.listen(3000);
```

---

## 注意事项

1. **CORS 问题**：第三方 API 通常不支持前端直接调用，必须通过后端代理
2. **频率限制**：注意各 API 的调用频率限制，建议在后端加缓存
3. **图片版权**：使用电商平台的商品图片需遵守其使用条款
4. **数据合规**：遵守各平台的 robots.txt 和 API 使用协议
5. **本地开发**：将 `apiBaseUrl` 设为空字符串 `''` 可跳过 API 直接使用本地数据
*（内容由AI生成，仅供参考）*
