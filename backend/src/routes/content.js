import { Router } from 'express';
import { chatCompletion } from '../services/openai.js';

const router = Router();

router.post('/optimize', async (req, res) => {
  try {
    const { content, targetKeyword, url, language = 'Vietnamese' } = req.body;

    if (!content || !targetKeyword) {
      return res.status(400).json({ error: 'content and targetKeyword are required' });
    }

    const wordCount = content.split(/\s+/).length;
    const keywordCount = (content.toLowerCase().match(new RegExp(targetKeyword.toLowerCase(), 'g')) || []).length;
    const keywordDensity = ((keywordCount / wordCount) * 100).toFixed(2);

    const systemPrompt = `You are a content SEO expert specializing in on-page optimization. Analyze content thoroughly and return JSON only.`;

    const userPrompt = `Analyze and optimize this content for SEO:

Target Keyword: "${targetKeyword}"
Language: ${language}
Word Count: ${wordCount}
Keyword Density: ${keywordDensity}%
${url ? `URL: ${url}` : ''}

Content (first 3000 chars):
${content.substring(0, 3000)}

Return comprehensive JSON:
{
  "scores": {
    "overall": 72,
    "readability": 68,
    "keywordOptimization": 75,
    "contentDepth": 65,
    "eeat": 70,
    "structure": 80
  },
  "analysis": {
    "wordCount": ${wordCount},
    "targetWordCount": 1800,
    "keywordDensity": ${keywordDensity},
    "idealKeywordDensity": "1-2%",
    "readabilityLevel": "Grade 10 - Fairly Difficult",
    "avgSentenceLength": 18,
    "passiveVoicePercentage": 15,
    "transitionWords": 25
  },
  "titleOptimization": {
    "current": "Extracted or N/A",
    "suggestions": [
      { "title": "Optimized title 1", "reason": "Why this works" },
      { "title": "Optimized title 2", "reason": "Why this works" }
    ],
    "ideal": { "length": 58, "includesKeyword": true, "powerWord": "Ultimate" }
  },
  "metaDescription": {
    "current": "Extracted or N/A",
    "suggestions": [
      { "description": "Optimized meta description with keyword", "length": 145 }
    ]
  },
  "headings": {
    "issues": ["Issue with heading structure"],
    "recommendations": ["Add H2 for each main section", "Include keyword in H2"]
  },
  "lsiKeywords": [
    { "keyword": "related keyword", "usage": "missing|underused|good", "suggestion": "How to add naturally" }
  ],
  "contentImprovements": [
    {
      "section": "Introduction",
      "issue": "Doesn't clearly state what the article covers",
      "suggestion": "Add a brief overview paragraph",
      "priority": "high|medium|low",
      "improvedText": "Suggested rewrite"
    }
  ],
  "featuredSnippetOpportunity": {
    "eligible": true,
    "type": "paragraph|list|table",
    "recommendation": "How to optimize for featured snippet"
  },
  "eeatSignals": {
    "expertise": { "score": 65, "improvements": ["Add author bio", "Cite sources"] },
    "authoritativeness": { "score": 60, "improvements": ["Add external links to authoritative sources"] },
    "trustworthiness": { "score": 70, "improvements": ["Add publication date"] }
  },
  "technicalChecks": {
    "hasImages": true,
    "hasInternalLinks": false,
    "hasExternalLinks": true,
    "hasSchema": false,
    "hasCTA": true
  },
  "topPriorities": ["Priority improvement 1", "Priority improvement 2", "Priority improvement 3"]
}`;

    const result = await chatCompletion(systemPrompt, userPrompt, { json: true, max_tokens: 5000 });
    res.json(JSON.parse(result));
  } catch (err) {
    console.error('Content optimization error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/outline', async (req, res) => {
  try {
    const { topic, targetKeyword, competitors, contentType = 'blog', wordTarget = 1500 } = req.body;

    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const systemPrompt = `You are a content strategist and SEO expert. Create data-driven content outlines. Return JSON only.`;

    const userPrompt = `Create a comprehensive SEO content outline for:
Topic: "${topic}"
Target Keyword: "${targetKeyword || topic}"
Content Type: ${contentType}
Word Target: ${wordTarget}
${competitors ? `Competing content to beat: ${competitors.join(', ')}` : ''}

Return JSON:
{
  "title": "SEO-optimized title",
  "slug": "url-friendly-slug",
  "metaDescription": "145-char meta description",
  "targetKeyword": "${targetKeyword || topic}",
  "secondaryKeywords": ["keyword1", "keyword2", "keyword3"],
  "estimatedWordCount": ${wordTarget},
  "readingTime": "8 min read",
  "contentBrief": "2-3 sentence content brief",
  "outline": [
    {
      "heading": "H1: Article Title",
      "type": "h1",
      "notes": "Key points to cover",
      "wordCount": 0,
      "keywords": []
    },
    {
      "heading": "Introduction",
      "type": "intro",
      "notes": "Hook, problem statement, what reader will learn",
      "wordCount": 150,
      "keywords": ["target keyword"]
    },
    {
      "heading": "H2: Section Title",
      "type": "h2",
      "notes": "What to cover in this section",
      "wordCount": 300,
      "keywords": ["LSI keyword"],
      "subsections": [
        {
          "heading": "H3: Subsection",
          "type": "h3",
          "notes": "Details",
          "wordCount": 150
        }
      ]
    }
  ],
  "contentElements": {
    "images": ["Image idea 1", "Image idea 2"],
    "tables": ["Table comparing X and Y"],
    "lists": ["List of top 5 tools"],
    "cta": "Call to action recommendation",
    "faq": ["FAQ question 1?", "FAQ question 2?"]
  },
  "differentiators": ["What makes this content better than competitors", "Unique angle or data point"],
  "internalLinkOpportunities": ["Related article to link to"],
  "externalLinkSuggestions": ["Type of authoritative sources to cite"]
}`;

    const result = await chatCompletion(systemPrompt, userPrompt, { json: true, max_tokens: 4000 });
    res.json(JSON.parse(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
