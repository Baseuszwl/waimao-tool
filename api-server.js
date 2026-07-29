/**
 * TradeSeeker API Server - Vercel Serverless Functions
 * 外贸选品&1688货源匹配工具 后端代理API
 */

const https = require('https');
const http = require('http');

// ============ 请求频率限制与缓存 ============
const rateLimitMap = new Map();
const cacheMap = new Map();

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const CACHE_TTL = 10 * 60 * 1000;  // 图片缓存 10 分钟

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
  if (!entry || Date.now() > entry.expireAt) { cacheMap.delete(key); return null; }
  return entry.data;
}

function setCache(key, data) {
  cacheMap.set(key, { data, expireAt: Date.now() + CACHE_TTL });
  if (cacheMap.size > 500) {
    const now = Date.now();
    for (const [k, v] of cacheMap) { if (now > v.expireAt) cacheMap.delete(k); }
  }
}

// ============ CORS ============
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function jsonResponse(res, data, status = 200) {
  setCORSHeaders(res);
  res.status(status).json(data);
}

function errorResponse(res, message, status = 400) {
  setCORSHeaders(res);
  res.status(status).json({ error: message, success: false });
}

// ============ HTTP 请求工具 ============
function fetchHTML(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers
      },
      timeout: 8000
    }, (resp) => {
      // 处理重定向
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        fetchHTML(resp.headers.location.startsWith('http') ? resp.headers.location : new URL(resp.headers.location, url).href, headers)
          .then(resolve).catch(reject);
        return;
      }
      if (resp.statusCode !== 200) {
        reject(new Error(`HTTP ${resp.statusCode}`));
        return;
      }
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ============ 图片抓取: 多源策略 ============
// 从 HTML 中提取所有可能的商品图片 URL
function extractImageURLs(html) {
  const urls = new Set();
  // 匹配 src 属性中的图片 URL
  const srcRegex = /src=["']([^"']*(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let match;
  while ((match = srcRegex.exec(html)) !== null) {
    let url = match[1];
    // 过滤掉太小/无效的图片
    if (url.includes('data:') || url.includes('sprite') || url.includes('icon') || url.includes('logo')) continue;
    // 补全协议
    if (url.startsWith('//')) url = 'https:' + url;
    if (url.startsWith('http')) urls.add(url);
  }
  return Array.from(urls);
}

// 按优先级排序：取尺寸较大的图片
function rankImages(urls) {
  return urls.filter(u => {
    // 过滤明显的占位图/图标
    const lower = u.toLowerCase();
    if (lower.includes('placeholder') || lower.includes('1x1') || lower.includes('pixel')) return false;
    if (lower.includes('icon') || lower.includes('avatar') || lower.includes('logo')) return false;
    if (lower.includes('sprite') || lower.includes('transparent')) return false;
    return true;
  }).sort((a, b) => {
    // 优先保留可能的大图 (URL中含数字尺寸标记)
    const aHasSize = /\d{3,4}x\d{3,4}/.test(a) || /_[A-Z]{2,4}\d{2,3}_/.test(a);
    const bHasSize = /\d{3,4}x\d{3,4}/.test(b) || /_[A-Z]{2,3}\d{2,3}_/.test(b);
    return (bHasSize ? 1 : 0) - (aHasSize ? 1 : 0);
  });
}

// 源1: Amazon 搜索
async function searchAmazon(query) {
  try {
    const q = encodeURIComponent(query);
    const html = await fetchHTML(`https://www.amazon.com/s?k=${q}`);
    const urls = extractImageURLs(html);
    // Amazon 商品图特征: 包含 /images/I/ 路径
    const amazonImgs = urls.filter(u => u.includes('/images/I/') || u.includes('media-amazon'));
    if (amazonImgs.length > 0) return amazonImgs.slice(0, 6);
    // 否则取通用图片
    return rankImages(urls).slice(0, 6);
  } catch (e) {
    console.error('Amazon search failed:', e.message);
    return null;
  }
}

// 源2: Walmart 搜索
async function searchWalmart(query) {
  try {
    const q = encodeURIComponent(query);
    const html = await fetchHTML(`https://www.walmart.com/search?q=${q}`);
    const urls = extractImageURLs(html);
    const ranked = rankImages(urls);
    return ranked.slice(0, 6);
  } catch (e) {
    console.error('Walmart search failed:', e.message);
    return null;
  }
}

// 源3: eBay 搜索
async function searchEbay(query) {
  try {
    const q = encodeURIComponent(query);
    const html = await fetchHTML(`https://www.ebay.com/sch/i.html?_nkw=${q}`);
    const urls = extractImageURLs(html);
    const ranked = rankImages(urls);
    return ranked.slice(0, 6);
  } catch (e) {
    console.error('eBay search failed:', e.message);
    return null;
  }
}

// ============ API: 商品图片搜索 ============
// GET /api/product-image?q=search+query&asin=optional
async function handleProductImage(req, res) {
  const { q, asin } = req.query;

  if (!q || q.trim().length === 0) {
    return errorResponse(res, '请提供搜索关键词 (q)', 400);
  }

  const query = q.trim();
  const cacheKey = `img:${query}`;

  const cached = getCache(cacheKey);
  if (cached) {
    return jsonResponse(res, { ...cached, cached: true });
  }

  // 如果有 ASIN，先尝试 ASIN 直链
  let images = [];
  if (asin && asin.trim()) {
    // Amazon 商品图片可能有多种尺寸变体
    // 但 ASIN 是虚构的，跳过 ASIN 直链，直接用标题搜索
  }

  // 多源并发搜索
  const results = await Promise.allSettled([
    searchAmazon(query),
    searchWalmart(query),
    searchEbay(query)
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.length > 0) {
      images = r.value;
      break;
    }
  }

  const response = {
    success: true,
    query,
    images: images.slice(0, 8),
    total: images.length,
    timestamp: new Date().toISOString(),
  };

  if (images.length > 0) setCache(cacheKey, response);
  jsonResponse(res, response);
}

// ============ 模拟数据（保持兼容） ============
const mockProducts = [
  { id: 9001, platform: 'amazon', title: 'Wireless Bluetooth Earbuds Pro ANC IPX7 36H', price: 49.99, currency: 'USD', sales: 12580, rating: 4.7, category: '电子产品', weight: '轻小件', asin: 'B0C9XK81P2' },
  { id: 9002, platform: 'amazon', title: 'Stainless Steel Water Bottle 32oz Vacuum Insulated', price: 24.99, currency: 'USD', sales: 9870, rating: 4.5, category: '家居厨房', weight: '中等', asin: 'B0D2LM94Q7' },
  { id: 9003, platform: 'amazon', title: 'Posture Corrector Back Brace Support Breathable', price: 19.99, currency: 'USD', sales: 8540, rating: 4.3, category: '运动户外', weight: '轻小件', asin: 'B0A7NP63T9' },
  { id: 9004, platform: 'temu', title: 'Silicone Kitchen Utensil Set 12-Piece Heat Resistant', price: 12.99, currency: 'USD', sales: 25600, rating: 4.6, category: '家居厨房', weight: '轻小件', asin: '' },
  { id: 9005, platform: 'temu', title: 'Universal Car Phone Mount 360° Rotation Strong Suction', price: 6.99, currency: 'USD', sales: 19800, rating: 4.4, category: '电子产品', weight: '轻小件', asin: '' },
];

const mockSources = [
  { id: 8001, title: '蓝牙耳机源头工厂 TWS降噪跨境专供 OEM/ODM现货', price: 18.50, priceRange: '¥16.80-22.00', moq: 10, supplier: '深圳华强电子科技', location: '深圳', dropShipping: true, custom: true, badge: '实力商家', sales: 8500 },
  { id: 8002, title: '不锈钢保温杯32oz大容量 跨境爆款 一件代发现货', price: 22.00, priceRange: '¥20.00-28.00', moq: 5, supplier: '永康不锈钢制品有限公司', location: '永康', dropShipping: true, custom: true, badge: '实力商家', sales: 12000 },
];

// ============ API: 商品搜索 ============
async function handleSearch(req, res) {
  const { keyword, platform } = req.query;
  if (!keyword || keyword.trim().length === 0) {
    return errorResponse(res, '请提供搜索关键词 (keyword)', 400);
  }
  const searchTerm = keyword.trim().toLowerCase();
  const cacheKey = `search:${searchTerm}:${platform || 'all'}`;
  const cached = getCache(cacheKey);
  if (cached) return jsonResponse(res, { ...cached, cached: true });

  let results = mockProducts.filter(p =>
    p.title.toLowerCase().includes(searchTerm) || (p.category && p.category.includes(searchTerm))
  );
  if (platform && platform !== 'all') results = results.filter(p => p.platform === platform);

  const response = { success: true, keyword: searchTerm, platform: platform || 'all', total: results.length, products: results, timestamp: new Date().toISOString() };
  setCache(cacheKey, response);
  jsonResponse(res, response);
}

// ============ API: 1688货源搜索 ============
async function handleSource(req, res) {
  const { keyword } = req.query;
  if (!keyword || keyword.trim().length === 0) {
    return errorResponse(res, '请提供搜索关键词 (keyword)', 400);
  }
  const searchTerm = keyword.trim().toLowerCase();
  const cacheKey = `source:${searchTerm}`;
  const cached = getCache(cacheKey);
  if (cached) return jsonResponse(res, { ...cached, cached: true });

  let results = mockSources.filter(s =>
    s.title.toLowerCase().includes(searchTerm) || (s.supplier && s.supplier.includes(searchTerm))
  );
  if (results.length === 0) results = mockSources.slice(0, 5);

  const response = { success: true, keyword: searchTerm, total: results.length, sources: results, timestamp: new Date().toISOString() };
  setCache(cacheKey, response);
  jsonResponse(res, response);
}

// ============ Vercel Serverless Handler ============
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return errorResponse(res, '仅支持 GET 请求', 405);
  }

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return errorResponse(res, '请求过于频繁，请稍后再试', 429);
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (pathname === '/api/search') {
      return await handleSearch(req, res);
    } else if (pathname === '/api/source') {
      return await handleSource(req, res);
    } else if (pathname === '/api/product-image') {
      return await handleProductImage(req, res);
    } else {
      return errorResponse(res, `未知接口: ${pathname}`, 404);
    }
  } catch (err) {
    console.error('API Error:', err);
    return errorResponse(res, '服务器内部错误', 500);
  }
};
