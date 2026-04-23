import { Router } from 'express';
import { chatCompletion } from '../services/openai.js';

const router = Router();

router.post('/analyze', async (req, res) => {
  try {
    const { yourDomain, competitors, targetKeyword, industry } = req.body;

    if (!yourDomain || !competitors || competitors.length === 0) {
      return res.status(400).json({ error: 'yourDomain and competitors are required' });
    }

    const systemPrompt = `You are a competitive SEO analyst like SEMrush. Provide detailed competitive analysis in JSON format only. Make data realistic and specific.`;

    const userPrompt = `Perform a comprehensive competitive SEO analysis:
- Your domain: ${yourDomain}
- Competitors: ${competitors.join(', ')}
- Target keyword/niche: ${targetKeyword || 'general'}
- Industry: ${industry || 'General'}

Return detailed JSON:
{
  "summary": "Executive summary of competitive landscape",
  "yourDomain": {
    "domain": "${yourDomain}",
    "domainAuthority": 42,
    "organicTraffic": 15000,
    "organicKeywords": 850,
    "backlinks": 3200,
    "topKeywords": [
      { "keyword": "keyword", "position": 5, "volume": 2400, "traffic": 380 }
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
        { "keyword": "keyword", "position": 2, "volume": 5400, "traffic": 2160 }
      ],
      "contentScore": 82,
      "technicalScore": 88,
      "strengths": ["strength 1", "strength 2"],
      "weaknesses": ["weakness 1", "weakness 2"],
      "contentStrategy": "Description of their content approach",
      "linkProfile": "Description of link building strategy"
    }
  ],
  "keywordGaps": [
    {
      "keyword": "keyword they rank for you don't",
      "competitorPosition": 3,
      "yourPosition": null,
      "volume": 3200,
      "difficulty": 45,
      "opportunity": "high|medium|low",
      "contentIdea": "Blog post idea to target this keyword"
    }
  ],
  "contentGaps": [
    {
      "topic": "Topic they cover you don't",
      "competitorUrl": "https://competitor.com/article",
      "estimatedTraffic": 1200,
      "contentType": "blog|guide|tool|comparison",
      "recommendation": "How to create better content"
    }
  ],
  "backlinkOpportunities": [
    {
      "type": "guest post|resource page|broken link|directory",
      "description": "Opportunity description",
      "potentialDomains": ["domain1.com", "domain2.com"],
      "difficulty": "easy|medium|hard",
      "impact": "high|medium|low"
    }
  ],
  "actionPlan": {
    "immediate": ["Quick win 1 (1-2 weeks)", "Quick win 2"],
    "shortTerm": ["Action for 1-3 months", "Action 2"],
    "longTerm": ["Strategic initiative 3-12 months", "Initiative 2"]
  },
  "overallAnalysis": "Comprehensive 3-4 paragraph analysis of competitive position"
}`;

    const result = await chatCompletion(systemPrompt, userPrompt, { json: true, max_tokens: 6000 });
    res.json(JSON.parse(result));
  } catch (err) {
    console.error('Competitor analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/backlinks', async (req, res) => {
  try {
    const { domain, competitor } = req.body;

    if (!domain) return res.status(400).json({ error: 'domain is required' });

    const systemPrompt = `You are a backlink analysis expert. Return JSON only.`;

    const userPrompt = `Analyze backlink profile for ${domain}${competitor ? ` compared to ${competitor}` : ''}.

Return JSON:
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
    { "domain": "spammy-site.com", "toxicScore": 85, "reason": "spam site", "recommendation": "disavow" }
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
