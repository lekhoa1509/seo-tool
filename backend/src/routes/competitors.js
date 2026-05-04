import axios from 'axios';
import * as cheerio from 'cheerio';
import { Router } from 'express';
import { chatCompletion } from '../services/openai.js';

const router = Router();

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SEOProBot/1.0; +https://example.com/bot)',
  'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
};

const cleanText = (value = '') => String(value)
  .replace(/<[^>]*>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const truncateText = (value, max = 220) => {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
};

const foldText = (value = '') => cleanText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase();

const ensureUrl = (value) => {
  const input = cleanText(value);
  if (!input) return '';
  return input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
};

const normalizeDomainKey = (value = '') => {
  const input = cleanText(value);
  if (!input) return '';

  try {
    const url = new URL(ensureUrl(input));
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return input
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase();
  }
};

const normalizeList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const normalizeKeywords = (keywords) => (
  Array.isArray(keywords)
    ? keywords
      .filter((item) => item?.keyword)
      .map((item) => ({
        keyword: item.keyword,
        position: item.position ?? null,
        volume: item.volume ?? null,
        traffic: item.traffic ?? null,
      }))
    : []
);

const dedupeTexts = (items, max = 10, truncateAt = 220) => {
  const seen = new Set();
  const results = [];

  for (const item of items) {
    const text = truncateText(item, truncateAt);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    results.push(text);
    if (results.length >= max) break;
  }

  return results;
};

const BUSINESS_PATTERNS = [
  /cong ty/,
  /nha cung cap/,
  /chuyen/,
  /san xuat/,
  /gia cong/,
  /phan phoi/,
  /xuat nhap khau/,
  /thuong hieu/,
  /giai phap/,
  /giay ve sinh/,
  /khan giay/,
  /giay an/,
  /giay van phong/,
  /thiet bi ve sinh/,
  /tissue/,
  /paper/,
];

const getBusinessSignalScore = (text) => {
  const folded = foldText(text);
  return BUSINESS_PATTERNS.reduce((score, pattern) => score + (pattern.test(folded) ? 1 : 0), 0);
};

const prioritizeTexts = (items, max = 6) => (
  dedupeTexts(
    [...items].sort((left, right) => (
      getBusinessSignalScore(right) - getBusinessSignalScore(left)
      || left.length - right.length
    )),
    max,
  )
);

const flattenJsonLdNodes = (node) => {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenJsonLdNodes);
  if (typeof node !== 'object') return [];

  const graphNodes = Array.isArray(node['@graph']) ? flattenJsonLdNodes(node['@graph']) : [];
  return [node, ...graphNodes];
};

const parseJsonLd = ($) => {
  const nodes = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;

    try {
      nodes.push(...flattenJsonLdNodes(JSON.parse(raw)));
    } catch {}
  });

  return nodes;
};

const extractJsonLdSignals = ($) => {
  const rawSignals = [];

  for (const node of parseJsonLd($)) {
    for (const field of ['name', 'alternateName', 'headline', 'description', 'keywords']) {
      const value = node?.[field];
      if (Array.isArray(value)) {
        rawSignals.push(...value);
      } else if (value) {
        rawSignals.push(value);
      }
    }

    if (node?.about?.name) rawSignals.push(node.about.name);
    if (node?.publisher?.name) rawSignals.push(node.publisher.name);
  }

  return dedupeTexts(rawSignals, 8, 240);
};

const collectTexts = ($, selector, minLength = 0, maxLength = 240) => {
  const values = [];

  $(selector).each((_, element) => {
    const text = cleanText($(element).text());
    if (!text || text.length < minLength || text.length > maxLength) return;
    values.push(text);
  });

  return values;
};

const collectInternalLinks = ($, pageUrl, predicate = () => true, limit = 12) => {
  const base = new URL(pageUrl);
  const items = [];
  const seen = new Set();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const text = truncateText($(element).text(), 120);
    if (!href || !text) return;

    try {
      const absoluteUrl = new URL(href, pageUrl);
      if (absoluteUrl.hostname !== base.hostname) return;

      const candidate = { text, url: absoluteUrl.toString(), href };
      if (!predicate(candidate)) return;

      const key = foldText(text);
      if (seen.has(key)) return;
      seen.add(key);
      items.push(candidate);
    } catch {}
  });

  return items.slice(0, limit);
};

const summarizePage = (pageUrl, html) => {
  const $ = cheerio.load(html);
  const title = truncateText($('title').text(), 140);
  const metaDescription = truncateText(
    $('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content')
    || $('meta[name="twitter:description"]').attr('content')
    || '',
    220,
  );
  const h1 = dedupeTexts(collectTexts($, 'h1', 2, 160), 4, 160);
  const h2 = dedupeTexts(collectTexts($, 'h2', 2, 160), 6, 160);
  const introParagraphs = prioritizeTexts(
    collectTexts(
      $,
      'main p, article p, .entry-content p, .page-content p, .post-item p, section p, .container p, .row p, li',
      35,
      260,
    ),
    5,
  );
  const navTopics = dedupeTexts(
    collectTexts($, 'header a, nav a, .menu a, .header-main a, .header-bottom a', 2, 90),
    12,
    90,
  );
  const productTopics = dedupeTexts(
    collectInternalLinks(
      $,
      pageUrl,
      (candidate) => /san-pham|danh-muc|product|shop|category|cua-hang|catalog/i.test(candidate.href)
        || /san pham|danh muc|product|shop|cua hang|catalog/i.test(foldText(candidate.text)),
      12,
    ).map((item) => item.text),
    12,
    100,
  );
  const jsonLdSignals = extractJsonLdSignals($);

  return {
    url: pageUrl,
    title,
    metaDescription,
    h1,
    h2,
    navTopics,
    productTopics,
    introParagraphs,
    jsonLdSignals,
    keySignals: dedupeTexts([
      title,
      metaDescription,
      ...jsonLdSignals,
      ...introParagraphs,
      ...h1,
      ...productTopics,
      ...navTopics,
    ], 8, 240),
  };
};

const fetchHtml = async (url) => {
  const response = await axios.get(url, {
    timeout: 15000,
    maxRedirects: 5,
    headers: REQUEST_HEADERS,
  });

  return {
    html: response.data,
    finalUrl: response.request?.res?.responseUrl || url,
  };
};

export async function fetchSiteSnapshot(domain) {
  const normalizedUrl = ensureUrl(domain);
  const domainKey = normalizeDomainKey(domain);

  try {
    const homepage = await fetchHtml(normalizedUrl);
    const homepageSummary = summarizePage(homepage.finalUrl, homepage.html);
    const $ = cheerio.load(homepage.html);

    const aboutLink = collectInternalLinks(
      $,
      homepage.finalUrl,
      (candidate) => {
        const text = foldText(candidate.text);
        const href = foldText(candidate.href);
        return /gioi thieu|gioi-thieu|ve chung toi|ve-chung-toi|about|company|introduce|who we are/.test(text)
          || /gioi-thieu|ve-chung-toi|about|company|introduce/.test(href);
      },
      1,
    )[0];

    let aboutSummary = null;
    const hasStrongHomepageSignals = homepageSummary.keySignals.some((signal) => getBusinessSignalScore(signal) >= 2);

    if (aboutLink && aboutLink.url !== homepage.finalUrl && !hasStrongHomepageSignals) {
      try {
        const aboutPage = await fetchHtml(aboutLink.url);
        aboutSummary = summarizePage(aboutPage.finalUrl, aboutPage.html);
      } catch {}
    }

    return {
      domain: domainKey,
      homepageUrl: normalizedUrl,
      finalUrl: homepage.finalUrl,
      title: homepageSummary.title,
      metaDescription: homepageSummary.metaDescription,
      h1: homepageSummary.h1,
      h2: homepageSummary.h2,
      navTopics: homepageSummary.navTopics,
      productTopics: homepageSummary.productTopics,
      aboutUrl: aboutSummary?.url || aboutLink?.url || null,
      aboutSignals: aboutSummary?.keySignals || [],
      keySignals: dedupeTexts([
        ...homepageSummary.keySignals,
        ...(aboutSummary?.keySignals || []),
      ], 10, 240),
      crawlStatus: 'ok',
    };
  } catch (error) {
    return {
      domain: domainKey,
      homepageUrl: normalizedUrl,
      finalUrl: normalizedUrl,
      title: '',
      metaDescription: '',
      h1: [],
      h2: [],
      navTopics: [],
      productTopics: [],
      aboutUrl: null,
      aboutSignals: [],
      keySignals: [],
      crawlStatus: `error: ${error.message}`,
    };
  }
}

const prepareSnapshotForPrompt = (snapshot) => ({
  domain: snapshot.domain,
  finalUrl: snapshot.finalUrl,
  title: snapshot.title,
  metaDescription: snapshot.metaDescription,
  h1: snapshot.h1,
  h2: snapshot.h2.slice(0, 4),
  navTopics: snapshot.navTopics.slice(0, 10),
  productTopics: snapshot.productTopics.slice(0, 10),
  aboutSignals: snapshot.aboutSignals.slice(0, 4),
  keySignals: snapshot.keySignals.slice(0, 8),
  crawlStatus: snapshot.crawlStatus,
});

const attachSnapshot = (entity, siteProfilesByDomain) => {
  const snapshot = siteProfilesByDomain[normalizeDomainKey(entity?.domain)];
  return snapshot ? { ...entity, siteSnapshot: snapshot } : entity;
};

const normalizeCompetitorAnalysis = (analysis, siteProfilesByDomain = {}) => ({
  ...analysis,
  yourDomain: attachSnapshot({
    ...analysis.yourDomain,
    topKeywords: normalizeKeywords(analysis.yourDomain?.topKeywords),
  }, siteProfilesByDomain),
  competitors: Array.isArray(analysis.competitors)
    ? analysis.competitors.map((competitor) => attachSnapshot({
      ...competitor,
      topKeywords: normalizeKeywords(competitor.topKeywords),
      strengths: normalizeList(competitor.strengths),
      weaknesses: normalizeList(competitor.weaknesses),
      contentThemes: normalizeList(competitor.contentThemes),
      technicalHighlights: normalizeList(competitor.technicalHighlights),
      technicalRisks: normalizeList(competitor.technicalRisks),
    }, siteProfilesByDomain))
    : [],
  keywordGaps: normalizeList(analysis.keywordGaps),
  contentGaps: normalizeList(analysis.contentGaps),
  backlinkOpportunities: normalizeList(analysis.backlinkOpportunities),
  actionPlan: {
    immediate: normalizeList(analysis.actionPlan?.immediate),
    shortTerm: normalizeList(analysis.actionPlan?.shortTerm),
    longTerm: normalizeList(analysis.actionPlan?.longTerm),
  },
});

router.post('/analyze', async (req, res) => {
  try {
    const { yourDomain, competitors, targetKeyword, industry } = req.body;

    if (!yourDomain || !competitors || competitors.length === 0) {
      return res.status(400).json({ error: 'Cần nhập tên miền của bạn và ít nhất một tên miền đối thủ' });
    }

    const requestedDomains = [yourDomain, ...competitors];
    const siteProfiles = await Promise.all(requestedDomains.map((domain) => fetchSiteSnapshot(domain)));
    const siteProfilesByDomain = Object.fromEntries(
      siteProfiles.map((profile) => [normalizeDomainKey(profile.domain || profile.homepageUrl), profile]),
    );

    const groundedContext = {
      yourDomain: prepareSnapshotForPrompt(siteProfilesByDomain[normalizeDomainKey(yourDomain)]),
      competitors: competitors.map((domain) => prepareSnapshotForPrompt(siteProfilesByDomain[normalizeDomainKey(domain)])),
    };

    const systemPrompt = `Bạn là chuyên gia phân tích SEO cạnh tranh như SEMrush. Chỉ trả về JSON hợp lệ. Dữ liệu phải thực tế, cụ thể và có thể hành động. Tất cả nội dung hiển thị cho người dùng phải viết bằng tiếng Việt tự nhiên. Giữ nguyên JSON keys bằng tiếng Anh. Giữ các trường enum opportunity là high|medium|low và difficulty là easy|medium|hard để frontend xử lý. Dữ liệu crawl website bên dưới là nguồn sự thật ưu tiên cao nhất. Nếu tín hiệu website cho thấy doanh nghiệp thuộc ngành giấy tiêu dùng, giấy vệ sinh, khăn giấy hoặc thiết bị vệ sinh thì tuyệt đối không được mô tả là thời trang, giày dép hay ngành khác. Khi dữ liệu website còn hạn chế, hãy nói "chưa đủ dữ liệu" thay vì suy đoán.`;

    const userPrompt = `Hãy thực hiện phân tích SEO cạnh tranh toàn diện:
- Tên miền của bạn: ${yourDomain}
- Đối thủ: ${competitors.join(', ')}
- Từ khóa/ngách mục tiêu: ${targetKeyword || 'tổng quát'}
- Ngành: ${industry || 'Tổng quát'}

Dữ liệu website đã crawl tự động để làm căn cứ phân tích:
${JSON.stringify(groundedContext, null, 2)}

Yêu cầu quan trọng:
- Toàn bộ nội dung văn bản trả về cho người dùng phải bằng tiếng Việt.
- Chỉ JSON keys giữ bằng tiếng Anh.
- Các domain trong output phải giữ đúng theo danh sách domain đầu vào, không được tự đổi sang domain khác.
- Mọi nhận định về ngành hàng, nhóm sản phẩm, định vị thương hiệu, chiến lược nội dung và chiến lược liên kết phải bám sát dữ liệu website đã crawl.
- Không được bịa ngách sản phẩm hoặc chủ đề nội dung không xuất hiện trong dữ liệu website.
- Nếu một đối thủ là nhà cung cấp giấy vệ sinh/khăn giấy/giấy tiêu dùng thì phải mô tả đúng theo ngữ cảnh đó.
- Ưu tiên mô tả "tín hiệu đang thấy trên website" hơn là tưởng tượng chiến lược quá sâu.

Trả về JSON chi tiết:
{
  "summary": "Tóm tắt điều hành về bối cảnh cạnh tranh",
  "yourDomain": {
    "domain": "${yourDomain}",
    "domainAuthority": 42,
    "organicTraffic": 15000,
    "organicKeywords": 850,
    "backlinks": 3200,
    "topKeywords": [
      { "keyword": "từ khóa", "position": 5, "volume": 2400, "traffic": 380 }
    ],
    "contentScore": 65,
    "technicalScore": 72
  },
  "competitors": [
    {
      "domain": "competitor.com",
      "domainAuthority": 68,
      "organicTraffic": 45000,
      "organicKeywords": 2800,
      "backlinks": 18500,
      "topKeywords": [
        { "keyword": "từ khóa", "position": 2, "volume": 5400, "traffic": 2160 }
      ],
      "contentScore": 82,
      "technicalScore": 88,
      "strengths": ["3-4 điểm mạnh cụ thể, có căn cứ từ website hoặc chỉ số"],
      "weaknesses": ["3-4 điểm yếu cụ thể, không suy đoán quá đà"],
      "contentStrategy": "Mô tả 2-3 câu về cách họ triển khai nội dung dựa trên website",
      "linkProfile": "Mô tả 2-3 câu về cách họ xây dựng liên kết, chỉ nêu điều hợp lý từ dữ liệu",
      "marketPosition": "Cách thương hiệu này định vị trong SEO/thị trường dựa trên tín hiệu website",
      "publishingCadence": "Tần suất xuất bản nội dung ước tính hoặc nói chưa đủ dữ liệu",
      "contentThemes": ["2-4 cụm chủ đề thực sự xuất hiện hoặc có dấu hiệu rõ trên website"],
      "technicalHighlights": ["2-3 lợi thế SEO kỹ thuật nổi bật"],
      "technicalRisks": ["2-3 rủi ro hoặc điểm yếu về kỹ thuật/nội dung"]
    }
  ],
  "keywordGaps": [
    {
      "keyword": "từ khóa đối thủ có thứ hạng còn bạn thì chưa",
      "competitorPosition": 3,
      "yourPosition": null,
      "volume": 3200,
      "difficulty": 45,
      "opportunity": "high|medium|low",
      "contentIdea": "Ý tưởng nội dung để nhắm vào từ khóa này"
    }
  ],
  "contentGaps": [
    {
      "topic": "Chủ đề họ đang phủ mà bạn chưa có",
      "competitorUrl": "https://competitor.com/article",
      "estimatedTraffic": 1200,
      "contentType": "blog|guide|tool|comparison",
      "recommendation": "Gợi ý cách làm nội dung tốt hơn"
    }
  ],
  "backlinkOpportunities": [
    {
      "type": "guest post|resource page|broken link|directory",
      "description": "Mô tả cơ hội backlink",
      "potentialDomains": ["domain1.com", "domain2.com"],
      "difficulty": "easy|medium|hard",
      "impact": "high|medium|low"
    }
  ],
  "actionPlan": {
    "immediate": ["Việc làm nhanh 1 (1-2 tuần)", "Việc làm nhanh 2"],
    "shortTerm": ["Hành động trong 1-3 tháng", "Hành động 2"],
    "longTerm": ["Sáng kiến chiến lược 3-12 tháng", "Sáng kiến 2"]
  },
  "overallAnalysis": "Phân tích tổng thể 3-4 đoạn về vị thế cạnh tranh"
}`;

    const result = await chatCompletion(systemPrompt, userPrompt, {
      json: true,
      max_tokens: 6500,
      temperature: 0.2,
    });

    const parsed = JSON.parse(result);
    res.json(normalizeCompetitorAnalysis(parsed, siteProfilesByDomain));
  } catch (err) {
    console.error('Competitor analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/backlinks', async (req, res) => {
  try {
    const { domain, competitor } = req.body;

    if (!domain) return res.status(400).json({ error: 'Cần nhập tên miền để phân tích backlink' });

    const systemPrompt = `Bạn là chuyên gia phân tích backlink. Chỉ trả về JSON hợp lệ. Tất cả nội dung hiển thị cho người dùng phải bằng tiếng Việt tự nhiên, nhưng giữ nguyên JSON keys bằng tiếng Anh.`;

    const userPrompt = `Hãy phân tích hồ sơ backlink cho ${domain}${competitor ? ` so với ${competitor}` : ''}.

Trả về JSON:
{
  "domain": "${domain}",
  "totalBacklinks": 5200,
  "referringDomains": 420,
  "domainAuthority": 45,
  "linkProfile": {
    "dofollow": 78,
    "nofollow": 22,
    "topAnchorTexts": [
      { "text": "anchor text", "count": 145, "percentage": 12 }
    ],
    "topReferringDomains": [
      { "domain": "referring-site.com", "authority": 65, "links": 12, "type": "editorial" }
    ],
    "linkTypes": {
      "editorial": 45,
      "guestPost": 25,
      "directory": 15,
      "forum": 10,
      "other": 5
    }
  },
  "toxicLinks": [
    { "domain": "spammy-site.com", "toxicScore": 85, "reason": "trang spam", "recommendation": "từ chối liên kết" }
  ],
  "linkBuildingOpportunities": [
    {
      "type": "Guest Post",
      "sites": ["site1.com", "site2.com"],
      "difficulty": "medium",
      "potentialDA": 55
    }
  ]
}`;

    const result = await chatCompletion(systemPrompt, userPrompt, { json: true });
    res.json(JSON.parse(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
