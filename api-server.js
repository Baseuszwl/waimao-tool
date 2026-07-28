/**
 * TradeSeeker API Server - Vercel Serverless Functions
 * 外贸选品&1688货源匹配工具 后端代理API
 *
 * 部署方式：Vercel (零配置，自动识别 /api 目录下的文件为 Serverless Function)
 * 只需将整个项目目录推送到 GitHub，然后在 Vercel 中导入该仓库即可。
 *
 * 接口列表：
 *   GET /api/search?keyword=xxx&platform=xxx  - 商品搜索
 *   GET /api/source?keyword=xxx                - 1688货源搜索
 */

// ============ 请求频率限制与缓存 ============
const rateLimitMap = new Map(); // IP -> { count, resetTime }
const cacheMap = new Map();     // key -> { data, expireAt }

const RATE_LIMIT_WINDOW = 60 * 1000; // 1分钟窗口
const RATE_LIMIT_MAX = 30;           // 每分钟最多30次请求
const CACHE_TTL = 5 * 60 * 1000;     // 缓存5分钟

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress
    || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function getCache(key) {
  const entry = cacheMap.get(key);
  if (!entry || Date.now() > entry.expireAt) {
    cacheMap.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cacheMap.set(key, { data, expireAt: Date.now() + CACHE_TTL });
  // 定期清理过期缓存
  if (cacheMap.size > 200) {
    const now = Date.now();
    for (const [k, v] of cacheMap) { if (now > v.expireAt) cacheMap.delete(k); }
  }
}

// ============ CORS 中间件 ============
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ============ 帮助函数 ============
function jsonResponse(res, data, status = 200) {
  setCORSHeaders(res);
  res.status(status).json(data);
}

function errorResponse(res, message, status = 400) {
  setCORSHeaders(res);
  res.status(status).json({ error: message, success: false });
}

// ============ 模拟数据（作为 API 返回的样例，实际可对接真实数据源） ============
const mockProducts = [
  { id: 9001, platform: 'amazon', title: 'Wireless Bluetooth Earbuds Pro ANC IPX7 36H', price: 49.99, currency: 'USD', sales: 12580, rating: 4.7, category: '电子产品', weight: '轻小件', asin: 'B0C9XK81P2', image: 'https://loremflickr.com/400/300/electronics,gadget?random=9001' },
  { id: 9002, platform: 'amazon', title: 'Stainless Steel Water Bottle 32oz Vacuum Insulated', price: 24.99, currency: 'USD', sales: 9870, rating: 4.5, category: '家居厨房', weight: '中等', asin: 'B0D2LM94Q7', image: 'https://loremflickr.com/400/300/kitchen,home?random=9002' },
  { id: 9003, platform: 'amazon', title: 'Posture Corrector Back Brace Support Breathable', price: 19.99, currency: 'USD', sales: 8540, rating: 4.3, category: '运动户外', weight: '轻小件', asin: 'B0A7NP63T9', image: 'https://loremflickr.com/400/300/sports,outdoor?random=9003' },
  { id: 9004, platform: 'temu', title: 'Silicone Kitchen Utensil Set 12-Piece Heat Resistant', price: 12.99, currency: 'USD', sales: 25600, rating: 4.6, category: '家居厨房', weight: '轻小件', asin: '', image: 'https://loremflickr.com/400/300/kitchen,home?random=9004' },
  { id: 9005, platform: 'temu', title: 'Universal Car Phone Mount 360° Rotation Strong Suction', price: 6.99, currency: 'USD', sales: 19800, rating: 4.4, category: '电子产品', weight: '轻小件', asin: '', image: 'https://loremflickr.com/400/300/electronics,gadget?random=9005' },
  { id: 9006, platform: 'shopee', title: 'Korean Canvas Tote Bag Large Capacity Minimalist', price: 8.50, currency: 'USD', sales: 15800, rating: 4.7, category: '服装配饰', weight: '轻小件', asin: '', image: 'https://loremflickr.com/400/300/fashion,accessories?random=9006' },
  { id: 9007, platform: 'tiktok', title: 'Viral LED Strip Lights 50ft Music Sync App Control', price: 15.99, currency: 'USD', sales: 34500, rating: 4.3, category: '家居厨房', weight: '轻小件', asin: '', image: 'https://loremflickr.com/400/300/kitchen,home?random=9007' },
  { id: 9008, platform: 'amazon', title: 'Mini Portable Projector 4K WiFi 6 200" Display', price: 89.99, currency: 'USD', sales: 4520, rating: 4.2, category: '电子产品', weight: '中等', asin: 'B0P5KR91W2', image: 'https://loremflickr.com/400/300/electronics,gadget?random=9008' },
  { id: 9009, platform: 'amazon', title: 'Smart Pet Feeder Camera App Control 6L Capacity', price: 59.99, currency: 'USD', sales: 3210, rating: 4.5, category: '宠物用品', weight: '中等', asin: 'B0R8DV57Y3', image: 'https://loremflickr.com/400/300/pet,products?random=9009' },
  { id: 9010, platform: 'amazon', title: 'Magnetic Wireless Power Bank 10000mAh 20W Slim', price: 39.99, currency: 'USD', sales: 2100, rating: 4.8, category: '电子产品', weight: '轻小件', asin: 'B0U9KP36W8', image: 'https://loremflickr.com/400/300/electronics,gadget?random=9010' },
];

const mockSources = [
  { id: 8001, title: '蓝牙耳机源头工厂 TWS降噪跨境专供 OEM/ODM现货', price: 18.50, priceRange: '¥16.80-22.00', moq: 10, supplier: '深圳华强电子科技', location: '深圳', dropShipping: true, custom: true, badge: '实力商家', sales: 8500, image: 'https://loremflickr.com/300/300/factory,product?random=8001' },
  { id: 8002, title: '不锈钢保温杯32oz大容量 跨境爆款 一件代发现货', price: 22.00, priceRange: '¥20.00-28.00', moq: 5, supplier: '永康不锈钢制品有限公司', location: '永康', dropShipping: true, custom: true, badge: '实力商家', sales: 12000, image: 'https://loremflickr.com/300/300/factory,product?random=8002' },
  { id: 8003, title: 'LED触控台灯USB充电 学生办公跨境爆款 可定制logo', price: 28.00, priceRange: '¥25.00-35.00', moq: 10, supplier: '中山古镇灯饰源头厂', location: '中山', dropShipping: true, custom: true, badge: '实力商家', sales: 7200, image: 'https://loremflickr.com/300/300/factory,product?random=8003' },
  { id: 8004, title: '瑜伽垫TPE环保防滑跨境专供 可定制颜色厚度logo', price: 35.00, priceRange: '¥32.00-45.00', moq: 20, supplier: '广州恒达体育用品', location: '广州', dropShipping: false, custom: true, badge: '', sales: 3400, image: 'https://loremflickr.com/300/300/factory,product?random=8004' },
  { id: 8005, title: '智能宠物喂食器APP控制6L 跨境定制 支持代发', price: 85.00, priceRange: '¥78.00-98.00', moq: 5, supplier: '宁波宠乐科技', location: '宁波', dropShipping: true, custom: true, badge: '深度验厂', sales: 2800, image: 'https://loremflickr.com/300/300/factory,product?random=8005' },
];

// ============ API: 商品搜索 ============
// GET /api/search?keyword=xxx&platform=xxx
async function handleSearch(req, res) {
  const { keyword, platform } = req.query;

  if (!keyword || keyword.trim().length === 0) {
    return errorResponse(res, '请提供搜索关键词 (keyword)', 400);
  }

  const searchTerm = keyword.trim().toLowerCase();
  const cacheKey = `search:${searchTerm}:${platform || 'all'}`;

  // 检查缓存
  const cached = getCache(cacheKey);
  if (cached) {
    return jsonResponse(res, { ...cached, cached: true });
  }

  // 在实际部署中，这里可以：
  // 1. 调用第三方跨境数据 API（如 Keepa、Jungle Scout 等合规 API）
  // 2. 调用 1688 开放平台 API
  // 3. 使用 cheerio 进行合规的公开数据采集
  //
  // 当前使用模拟数据作为演示

  let results = mockProducts.filter(p =>
    p.title.toLowerCase().includes(searchTerm)
    || (p.category && p.category.includes(searchTerm))
  );

  if (platform && platform !== 'all') {
    results = results.filter(p => p.platform === platform);
  }

  const response = {
    success: true,
    keyword: searchTerm,
    platform: platform || 'all',
    total: results.length,
    products: results,
    timestamp: new Date().toISOString(),
  };

  setCache(cacheKey, response);
  jsonResponse(res, response);
}

// ============ API: 1688货源搜索 ============
// GET /api/source?keyword=xxx
async function handleSource(req, res) {
  const { keyword } = req.query;

  if (!keyword || keyword.trim().length === 0) {
    return errorResponse(res, '请提供搜索关键词 (keyword)', 400);
  }

  const searchTerm = keyword.trim().toLowerCase();
  const cacheKey = `source:${searchTerm}`;

  const cached = getCache(cacheKey);
  if (cached) {
    return jsonResponse(res, { ...cached, cached: true });
  }

  // 在实际部署中，这里可以：
  // 1. 调用 1688 开放平台 API（文搜接口 / 图搜拍立淘接口）
  // 2. 需要申请 1688 开放平台的 AppKey 和 AppSecret
  //
  // 当前使用模拟数据作为演示

  let results = mockSources.filter(s =>
    s.title.toLowerCase().includes(searchTerm)
    || (s.supplier && s.supplier.includes(searchTerm))
  );

  if (results.length === 0) {
    // 如果没有精确匹配，返回全部模拟数据作为兜底
    results = mockSources.slice(0, 5);
  }

  const response = {
    success: true,
    keyword: searchTerm,
    total: results.length,
    sources: results,
    timestamp: new Date().toISOString(),
  };

  setCache(cacheKey, response);
  jsonResponse(res, response);
}

// ============ Vercel Serverless Handler ============
module.exports = async function handler(req, res) {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    return res.status(200).end();
  }

  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return errorResponse(res, '仅支持 GET 请求', 405);
  }

  // 频率限制
  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return errorResponse(res, '请求过于频繁，请稍后再试', 429);
  }

  // 路由分发
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (pathname === '/api/search') {
      return await handleSearch(req, res);
    } else if (pathname === '/api/source') {
      return await handleSource(req, res);
    } else {
      return errorResponse(res, `未知接口: ${pathname}`, 404);
    }
  } catch (err) {
    console.error('API Error:', err);
    return errorResponse(res, '服务器内部错误', 500);
  }
};

// ============ 本地开发说明 ============
// 如需本地测试，可以使用以下命令启动：
//   npx vercel dev
// 或在项目根目录执行：
//   node -e "const express=require('express');const app=express();app.use(require('./api/api-server'));app.listen(3000)"
//
// 注意：Vercel Serverless Functions 会自动识别 /api/ 目录下的 .js 文件作为 API 端点，
// 文件名决定路由路径。例如 api/api-server.js → /api/api-server
// 如需简洁路由（/api/search 而非 /api/api-server），建议使用 Vercel 路由重写配置。
