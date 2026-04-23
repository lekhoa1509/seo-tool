import { Router } from 'express';
import { chatCompletion, streamCompletion } from '../services/openai.js';

const router = Router();

router.post('/generate', async (req, res) => {
  try {
    const {
      topic,
      keywords = [],
      tone = 'professional',
      language = 'Vietnamese',
      wordCount = 1500,
      contentType = 'blog-post',
      targetAudience = 'general',
      includeOutline = true,
    } = req.body;

    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const systemPrompt = `You are an expert SEO content writer and digital marketing specialist.
You write high-quality, engaging, SEO-optimized content that ranks well on Google.
Your content follows E-E-A-T principles (Experience, Expertise, Authoritativeness, Trustworthiness).
Always write in ${language}. Return valid JSON only.`;

    const userPrompt = `Write a complete, publication-ready ${contentType} about: "${topic}"

Requirements:
- Primary keyword: ${keywords[0] || topic}
- Secondary keywords: ${keywords.slice(1).join(', ') || 'related terms'}
- Tone: ${tone}
- Target audience: ${targetAudience}
- Target word count: ${wordCount} words
- Language: ${language}

Return JSON with this exact structure:
{
  "title": "SEO-optimized H1 title (50-60 chars with primary keyword)",
  "slug": "url-friendly-slug",
  "metaDescription": "Compelling meta description 150-160 chars with keyword",
  "focusKeyword": "${keywords[0] || topic}",
  "secondaryKeywords": ["kw1", "kw2", "kw3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "Blog Category",
  "readingTime": "8 min read",
  "publishDate": "${new Date().toISOString().split('T')[0]}",
  "outline": [
    { "heading": "H2: Section Title", "type": "h2" },
    { "heading": "H3: Subsection", "type": "h3", "parent": 0 }
  ],
  "content": "Full article HTML content here with proper H2, H3, <p>, <ul>, <ol>, <strong>, <em> tags. Minimum ${wordCount} words. Well-structured with clear sections.",
  "excerpt": "2-3 sentence article summary for previews",
  "faq": [
    { "question": "Common question about the topic?", "answer": "Comprehensive answer" }
  ],
  "schemaMarkup": {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Title",
    "description": "Meta description",
    "keywords": "keyword1, keyword2"
  },
  "seoTips": ["SEO recommendation 1", "SEO recommendation 2"],
  "internalLinkSuggestions": ["Topic for related article 1", "Topic for related article 2"],
  "wordCount": ${wordCount}
}`;

    const result = await chatCompletion(systemPrompt, userPrompt, {
      json: true,
      max_tokens: 8000,
      temperature: 0.8,
    });
    res.json(JSON.parse(result));
  } catch (err) {
    console.error('Blog generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/stream', async (req, res) => {
  try {
    const {
      topic,
      keywords = [],
      tone = 'professional',
      language = 'Vietnamese',
      wordCount = 1500,
      targetAudience = 'general',
    } = req.body;

    if (!topic) {
      res.status(400).json({ error: 'topic is required' });
      return;
    }

    const systemPrompt = `You are an expert SEO content writer. Write high-quality, engaging, SEO-optimized blog posts in ${language}.
Follow E-E-A-T principles. Use proper heading structure (H2, H3). Include relevant examples and data.`;

    const userPrompt = `Write a complete, well-structured blog post about: "${topic}"

Primary keyword: ${keywords[0] || topic}
Secondary keywords: ${keywords.slice(1).join(', ') || ''}
Tone: ${tone}
Target audience: ${targetAudience}
Target word count: ~${wordCount} words
Language: ${language}

Format with clear HTML headings (H2, H3), paragraphs, bullet points where appropriate.
Start with an engaging introduction that hooks the reader.
Include practical, actionable advice.
End with a strong conclusion and call-to-action.`;

    await streamCompletion(systemPrompt, userPrompt, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/improve', async (req, res) => {
  try {
    const { content, improvement, targetKeyword } = req.body;

    if (!content || !improvement) {
      return res.status(400).json({ error: 'content and improvement are required' });
    }

    const systemPrompt = `You are an expert SEO editor. Improve blog content based on specific instructions. Return JSON only.`;

    const userPrompt = `Improve this blog content:

Target keyword: ${targetKeyword || 'not specified'}
Improvement needed: ${improvement}

Original content (first 2000 chars):
${content.substring(0, 2000)}

Return JSON:
{
  "improvedContent": "Full improved content in HTML",
  "changes": ["Change 1: description", "Change 2: description"],
  "seoImprovements": ["SEO improvement made 1", "SEO improvement 2"],
  "readabilityScore": 75,
  "keywordOptimizationScore": 82
}`;

    const result = await chatCompletion(systemPrompt, userPrompt, { json: true, max_tokens: 6000 });
    res.json(JSON.parse(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/titles', async (req, res) => {
  try {
    const { topic, keyword, count = 10 } = req.body;

    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const systemPrompt = `You are an expert headline copywriter and SEO specialist. Return JSON only.`;

    const userPrompt = `Generate ${count} compelling, SEO-optimized blog post titles for:
Topic: "${topic}"
Primary keyword: "${keyword || topic}"

Return JSON:
{
  "titles": [
    {
      "title": "Title text",
      "type": "how-to|listicle|question|comparison|guide|ultimate|case-study",
      "characterCount": 58,
      "hasKeyword": true,
      "clickbaitScore": 7,
      "seoScore": 9,
      "powerWord": "Ultimate"
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
