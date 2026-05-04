import { Router } from 'express';
import { chatCompletion } from '../services/openai.js';

const router = Router();

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

const normalizeCompetitorAnalysis = (analysis) => ({
  ...analysis,
  yourDomain: {
    ...analysis.yourDomain,
    topKeywords: normalizeKeywords(analysis.yourDomain?.topKeywords),
  },
  competitors: Array.isArray(analysis.competitors)
    ? analysis.competitors.map((competitor) => ({
      ...competitor,
      topKeywords: normalizeKeywords(competitor.topKeywords),
      strengths: normalizeList(competitor.strengths),
      weaknesses: normalizeList(competitor.weaknesses),
      contentThemes: normalizeList(competitor.contentThemes),
      technicalHighlights: normalizeList(competitor.technicalHighlights),
      technicalRisks: normalizeList(competitor.technicalRisks),
    }))
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

    const systemPrompt = `Bạn là chuyên gia phân tích SEO cạnh tranh như SEMrush. Chỉ trả về JSON hợp lệ. Dữ liệu phải thực tế, cụ thể và có thể hành động. Tránh các nhận xét chung chung như "SEO tốt" hoặc "nội dung mạnh". Tất cả nội dung hiển thị cho người dùng phải viết bằng tiếng Việt tự nhiên. Giữ nguyên JSON keys bằng tiếng Anh. Giữ các trường enum opportunity là high|medium|low và difficulty là easy|medium|hard để frontend xử lý.`;

    const userPrompt = `Hãy thực hiện phân tích SEO cạnh tranh toàn diện:
- Tên miền của bạn: ${yourDomain}
- Đối thủ: ${competitors.join(', ')}
- Từ khóa/ngách mục tiêu: ${targetKeyword || 'tổng quát'}
- Ngành: ${industry || 'Tổng quát'}

Yêu cầu quan trọng:
- Toàn bộ nội dung văn bản trả về cho người dùng phải bằng tiếng Việt.
- Các trường như summary, strengths, weaknesses, contentStrategy, linkProfile, marketPosition, publishingCadence, contentThemes, technicalHighlights, technicalRisks, contentIdea, recommendation, description, actionPlan, overallAnalysis phải viết tiếng Việt rõ ràng, tự nhiên.
- Chỉ JSON keys giữ bằng tiếng Anh.

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
      "strengths": ["3-4 điểm mạnh cụ thể"],
      "weaknesses": ["3-4 điểm yếu cụ thể"],
      "contentStrategy": "Mô tả 2-3 câu về cách họ triển khai nội dung",
      "linkProfile": "Mô tả 2-3 câu về cách họ xây dựng liên kết",
      "marketPosition": "Cách thương hiệu này định vị trong SEO/thị trường",
      "publishingCadence": "Tần suất xuất bản nội dung ước tính",
      "contentThemes": ["2-4 cụm chủ đề họ làm tốt"],
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

    const result = await chatCompletion(systemPrompt, userPrompt, { json: true, max_tokens: 6000 });
    const parsed = JSON.parse(result);
    res.json(normalizeCompetitorAnalysis(parsed));
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
