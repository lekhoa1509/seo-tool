import { Router } from 'express';
import {
  buildChatMessages,
  createGptChatCompletion,
} from '../services/gptChat.js';

const router = Router();
const KEYWORD_MODEL = 'cx/gpt-5.5';

function cleanJsonText(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseJsonCompletion(text) {
  const cleaned = cleanJsonText(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error('GPT returned invalid JSON');
  }
}

async function keywordJsonCompletion(systemPrompt, userPrompt, options = {}) {
  const result = await createGptChatCompletion(
    buildChatMessages([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]),
    {
      ...options,
      json: true,
      model: KEYWORD_MODEL,
    }
  );

  return {
    data: parseJsonCompletion(result.content),
    model: result.model,
  };
}

router.post('/research', async (req, res) => {
  try {
    const { seedKeyword, niche, language = 'Vietnamese', count = 20 } = req.body;

    if (!seedKeyword) {
      return res.status(400).json({ error: 'seedKeyword is required' });
    }

    const systemPrompt = `You are an expert SEO keyword researcher with 10+ years of experience.
You provide accurate, actionable keyword research data. Always respond with valid JSON only.`;

    const userPrompt = `Perform comprehensive keyword research for:
- Seed keyword: "${seedKeyword}"
- Niche/Industry: "${niche || 'General'}"
- Target language: ${language}
- Number of keywords: ${count}

Return a JSON object with this exact structure:
{
  "seedKeyword": "${seedKeyword}",
  "summary": "Brief market overview 2-3 sentences",
  "keywords": [
    {
      "keyword": "exact keyword phrase",
      "searchVolume": 12000,
      "difficulty": 45,
      "cpc": 1.25,
      "competition": "low|medium|high",
      "intent": "informational|commercial|transactional|navigational",
      "trend": "growing|stable|declining",
      "longTail": ["variation 1", "variation 2", "variation 3"]
    }
  ],
  "topicClusters": [
    {
      "pillarTopic": "main topic",
      "clusterKeywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "contentIdeas": ["idea 1", "idea 2", "idea 3"],
  "quickWins": ["low competition keyword with decent volume 1", "keyword 2"]
}

Make the data realistic and specific to the niche. searchVolume should be monthly searches.`;

    const { data, model } = await keywordJsonCompletion(systemPrompt, userPrompt, { max_tokens: 5000 });
    res.json({ ...data, model });
  } catch (err) {
    console.error('Keyword research error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { keyword, url } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: 'keyword is required' });
    }

    const systemPrompt = `You are an SEO analyst. Analyze SERP competition and provide JSON responses only.`;

    const userPrompt = `Analyze SERP competition for keyword: "${keyword}"${url ? ` for website: ${url}` : ''}.

Return JSON:
{
  "keyword": "${keyword}",
  "serp": {
    "difficulty": 62,
    "topResults": [
      {
        "position": 1,
        "domain": "example.com",
        "title": "Page Title",
        "domainAuthority": 85,
        "backlinks": 1250,
        "wordCount": 2400
      }
    ],
    "featuredSnippet": true,
    "peopleAlsoAsk": ["question 1?", "question 2?", "question 3?"],
    "relatedSearches": ["related 1", "related 2"]
  },
  "opportunity": {
    "score": 7.5,
    "analysis": "Detailed opportunity analysis",
    "recommendations": ["rec 1", "rec 2", "rec 3"]
  }
}`;

    const { data, model } = await keywordJsonCompletion(systemPrompt, userPrompt);
    res.json({ ...data, model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
