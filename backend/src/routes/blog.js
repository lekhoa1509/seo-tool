import { Router } from 'express';
import {
  buildChatMessages,
  createGptChatCompletion,
  createGptChatCompletionStream,
  streamGptChatCompletion,
} from '../services/gptChat.js';
import { createSeoImage } from '../services/gptImage.js';
import {
  previewProductTabSync,
  syncProductTabs,
  validateProductTabCredentials,
} from '../services/productTabs.js';

const router = Router();

const CONTENT_MODES = {
  'blog-post': {
    value: 'blog-post',
    label: 'SEO blog post',
    category: 'Blog Category',
    schemaType: 'Article',
    imageType: 'blog featured image',
    imageStyle: 'modern editorial illustration',
    imagePrompt: 'Create a polished blog featured image that communicates the core topic and organic growth without fake logos or readable UI text.',
    writingGuidance: [
      'Write as an educational, search-intent-driven blog article.',
      'Open with a strong hook, then give practical, actionable sections.',
      'Use examples, checklists, comparisons, and a concise conclusion with a clear CTA.',
    ],
  },
  'product-post': {
    value: 'product-post',
    label: 'SEO product article',
    category: 'Product Category',
    schemaType: 'Product',
    imageType: 'product hero image',
    imageStyle: 'premium product marketing visual',
    imagePrompt: 'Create a premium product hero image. Show the product or product category as the clear focal point with commercial lighting and SEO-friendly marketing composition. Do not invent brand logos or readable claims.',
    writingGuidance: [
      'Write as a product-focused SEO article or product landing page section.',
      'Explain the product value proposition, ideal buyer, benefits, use cases, differentiators, and buying considerations.',
      'Do not invent exact prices, guarantees, technical specs, certifications, or brand claims unless the user supplied them.',
      'Include natural conversion copy and a helpful CTA without sounding exaggerated.',
    ],
  },
};

function getContentMode(contentType = 'blog-post') {
  return CONTENT_MODES[contentType] || CONTENT_MODES['blog-post'];
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function getProductTabsErrorStatus(error) {
  return /Thiếu|required|không hợp lệ/i.test(error?.message || '') ? 400 : 500;
}

function readBarn2TabKeys(body = {}) {
  return {
    usage: body.barn2TabKeys?.usage || body.barn2UsageTabKey,
    storage: body.barn2TabKeys?.storage || body.barn2StorageTabKey,
  };
}

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function writeStreamEvent(res, payload) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

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

async function jsonCompletion(systemPrompt, userPrompt, options = {}) {
  const complete = options.stream ? createGptChatCompletionStream : createGptChatCompletion;
  const result = await complete(
    buildChatMessages([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]),
    { ...options, json: true }
  );

  const data = parseJsonCompletion(result.content);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('GPT returned an invalid article payload');
  }

  return { data, model: result.model };
}

function startSse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function writeDone(res) {
  if (res.writableEnded) return;
  res.write('data: [DONE]\n\n');
  res.end();
}

function buildArticlePrompts({
  topic,
  keywords,
  tone,
  language,
  wordCount,
  contentType,
  targetAudience,
  includeOutline,
}) {
  const mode = getContentMode(contentType);
  const primaryKeyword = keywords[0] || topic;
  const secondaryKeywords = keywords.slice(1).join(', ') || 'related terms';

  const systemPrompt = `You are an expert SEO content writer and digital marketing specialist.
You write high-quality, engaging, SEO-optimized content that ranks well on Google.
Your content follows E-E-A-T principles (Experience, Expertise, Authoritativeness, Trustworthiness).
Always write in ${language}. Return valid JSON only.`;

  const userPrompt = `Write a complete, publication-ready ${mode.label} about: "${topic}"

Requirements:
- Primary keyword: ${primaryKeyword}
- Secondary keywords: ${secondaryKeywords}
- Tone: ${tone}
- Target audience: ${targetAudience}
- Target word count: ${wordCount} words
- Language: ${language}
- Include outline: ${includeOutline ? 'yes' : 'no'}

Content mode guidance:
${mode.writingGuidance.map((item) => `- ${item}`).join('\n')}

Return JSON with this exact structure:
{
  "contentType": "${mode.value}",
  "title": "SEO-optimized H1 title (50-60 chars with primary keyword)",
  "slug": "url-friendly-slug",
  "metaDescription": "Compelling meta description 150-160 chars with keyword",
  "focusKeyword": "${primaryKeyword}",
  "secondaryKeywords": ["kw1", "kw2", "kw3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "${mode.category}",
  "readingTime": "8 min read",
  "publishDate": "${new Date().toISOString().split('T')[0]}",
  "outline": [
    { "heading": "H2: Section Title", "type": "h2" },
    { "heading": "H3: Subsection", "type": "h3", "parent": 0 }
  ],
  "content": "Full ${mode.label} HTML content here with proper H2, H3, <p>, <ul>, <ol>, <strong>, <em> tags. Minimum ${wordCount} words. Well-structured with clear sections.",
  "excerpt": "2-3 sentence article summary for previews",
  "faq": [
    { "question": "Common question about the topic?", "answer": "Comprehensive answer" }
  ],
  "schemaMarkup": {
    "@context": "https://schema.org",
    "@type": "${mode.schemaType}",
    "headline": "Title",
    "name": "Topic or product name",
    "description": "Meta description",
    "keywords": "keyword1, keyword2"
  },
  "seoTips": ["SEO recommendation 1", "SEO recommendation 2"],
  "internalLinkSuggestions": ["Topic for related article 1", "Topic for related article 2"],
  "imageBrief": "Short visual brief for a featured image",
  "wordCount": ${wordCount}
}`;

  return { systemPrompt, userPrompt, mode };
}

function buildStreamPrompts({
  topic,
  keywords,
  tone,
  language,
  wordCount,
  contentType,
  targetAudience,
}) {
  const mode = getContentMode(contentType);

  const systemPrompt = `You are an expert SEO content writer. Write high-quality, engaging, SEO-optimized ${mode.label}s in ${language}.
Follow E-E-A-T principles. Use proper heading structure (H2, H3). Include relevant examples and data.
IMPORTANT: Return raw HTML directly. Do NOT wrap content in markdown code blocks or backticks. Do NOT use \`\`\`html or \`\`\` fences.`;

  const userPrompt = `Write a complete, well-structured ${mode.label} about: "${topic}"

Primary keyword: ${keywords[0] || topic}
Secondary keywords: ${keywords.slice(1).join(', ') || ''}
Tone: ${tone}
Target audience: ${targetAudience}
Target word count: ~${wordCount} words
Language: ${language}

Content mode guidance:
${mode.writingGuidance.map((item) => `- ${item}`).join('\n')}

Format with clear HTML headings (H2, H3), paragraphs, bullet points where appropriate.
Start with an engaging introduction that hooks the reader.
Include practical, actionable advice.
End with a strong conclusion and call-to-action.`;

  return { systemPrompt, userPrompt, mode };
}

async function createFeaturedImageForArticle({
  article,
  topic,
  keywords,
  contentType,
  targetAudience,
}) {
  const mode = getContentMode(contentType);
  const imageTopic = article?.title || topic;
  const keyword = article?.focusKeyword || keywords[0] || topic;

  return createSeoImage({
    topic: imageTopic,
    keyword,
    imageType: mode.imageType,
    style: mode.imageStyle,
    audience: targetAudience,
    brandColors: 'blue, green, white, warm yellow accent',
    mood: 'trustworthy, sharp, professional',
    aspectRatio: '16:9',
    includeText: false,
    customPrompt: article?.imageBrief
      ? `${mode.imagePrompt}\nArticle visual brief: ${article.imageBrief}`
      : mode.imagePrompt,
    outputFormat: 'png',
    imageDetail: 'high',
  });
}

async function createFeaturedImageForArticleWithProgress(args, res, options = {}) {
  const totalImages = options.totalImages || 1;
  const imageIndex = options.imageIndex || 1;
  const startedAt = Date.now();

  const writeImageStatus = (status, message) => {
    writeStreamEvent(res, {
      status,
      phase: 'image',
      message,
      imageIndex,
      totalImages,
      elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
    });
  };

  writeImageStatus('image-queued', `Đã gửi yêu cầu tạo ảnh ${imageIndex}/${totalImages}`);

  const progressTimer = setInterval(() => {
    writeImageStatus('image-generating', `Đang tạo ảnh ${imageIndex}/${totalImages}`);
  }, 5000);
  res.once('close', () => clearInterval(progressTimer));

  try {
    const featuredImage = await createFeaturedImageForArticle(args);
    clearInterval(progressTimer);
    writeImageStatus('image-complete', `Đã tạo xong ảnh ${imageIndex}/${totalImages}`);
    return featuredImage;
  } catch (error) {
    clearInterval(progressTimer);
    throw error;
  }
}

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
      includeImages = false,
    } = req.body;

    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const { systemPrompt, userPrompt, mode } = buildArticlePrompts({
      topic,
      keywords,
      tone,
      language,
      wordCount,
      contentType,
      targetAudience,
      includeOutline,
    });

    const { data: article, model } = await jsonCompletion(systemPrompt, userPrompt, {
      max_tokens: 8000,
      temperature: 0.8,
      stream: true,
    });

    const payload = {
      ...article,
      contentType: mode.value,
      contentModel: model,
      imageRequested: parseBoolean(includeImages),
    };

    if (parseBoolean(includeImages)) {
      try {
        payload.featuredImage = await createFeaturedImageForArticle({
          article,
          topic,
          keywords,
          contentType: mode.value,
          targetAudience,
        });
      } catch (imageErr) {
        console.error('Featured image generation error:', imageErr);
        payload.imageError = imageErr.message;
      }
    }

    res.json(payload);
  } catch (err) {
    console.error('Blog generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-stream', async (req, res) => {
  let progressTimer;

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
      includeImages = false,
    } = req.body;

    if (!topic) {
      res.status(400).json({ error: 'topic is required' });
      return;
    }

    const wantsImages = parseBoolean(includeImages);
    const totalSteps = wantsImages ? 2 : 1;
    const totalImages = wantsImages ? 1 : 0;
    const startedAt = Date.now();

    const { systemPrompt, userPrompt, mode } = buildArticlePrompts({
      topic,
      keywords,
      tone,
      language,
      wordCount,
      contentType,
      targetAudience,
      includeOutline,
    });

    startSse(res);

    const writeStatus = (payload) => writeStreamEvent(res, {
      step: 1,
      totalSteps,
      totalImages,
      elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
      ...payload,
    });

    const stopProgress = () => {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
    };

    res.once('close', stopProgress);

    writeStatus({
      status: 'content-queued',
      phase: 'content',
      message: 'Đang chuẩn bị viết bài',
    });

    progressTimer = setInterval(() => {
      writeStatus({
        status: 'content-generating',
        phase: 'content',
        message: 'Đang viết bài SEO',
      });
    }, 5000);

    const { data: article, model } = await jsonCompletion(systemPrompt, userPrompt, {
      max_tokens: 8000,
      temperature: 0.8,
      stream: true,
    });

    stopProgress();

    const payload = {
      ...article,
      contentType: mode.value,
      contentModel: model,
      imageRequested: wantsImages,
    };

    writeStatus({
      status: 'content-complete',
      phase: 'content',
      message: wantsImages ? 'Đã viết xong bài. Chuẩn bị tạo ảnh 1/1' : 'Đã viết xong bài',
      step: wantsImages ? 2 : 1,
      imageIndex: wantsImages ? 0 : undefined,
    });

    if (wantsImages) {
      try {
        payload.featuredImage = await createFeaturedImageForArticleWithProgress(
          {
            article,
            topic,
            keywords,
            contentType: mode.value,
            targetAudience,
          },
          res,
          { imageIndex: 1, totalImages }
        );
      } catch (imageErr) {
        console.error('Featured image generation error:', imageErr);
        payload.imageError = imageErr.message;
        writeStreamEvent(res, {
          status: 'image-error',
          phase: 'image',
          message: 'Không tạo được ảnh 1/1',
          imageError: imageErr.message,
          imageIndex: 1,
          totalImages,
        });
      }
    }

    writeStreamEvent(res, {
      status: 'done',
      phase: 'done',
      message: 'Hoàn tất',
      article: payload,
      totalImages,
    });
    writeDone(res);
  } catch (err) {
    if (progressTimer) clearInterval(progressTimer);
    console.error('Blog generation stream error:', err);

    if (res.headersSent) {
      writeStreamEvent(res, {
        status: 'error',
        phase: 'content',
        message: err.message,
        error: err.message,
      });
      writeDone(res);
      return;
    }

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
      contentType = 'blog-post',
      targetAudience = 'general',
      includeImages = false,
    } = req.body;

    if (!topic) {
      res.status(400).json({ error: 'topic is required' });
      return;
    }

    const { systemPrompt, userPrompt, mode } = buildStreamPrompts({
      topic,
      keywords,
      tone,
      language,
      wordCount,
      contentType,
      targetAudience,
    });

    const messages = buildChatMessages([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    if (!parseBoolean(includeImages)) {
      await streamGptChatCompletion(messages, res, {
        max_tokens: 8000,
        temperature: 0.8,
        onReady: () => writeStreamEvent(res, {
          status: 'content-generating',
          phase: 'content',
          message: 'Đang viết bài',
          step: 1,
          totalSteps: 1,
          totalImages: 0,
        }),
      });
      return;
    }

    const totalImages = 1;

    await streamGptChatCompletion(messages, res, {
      max_tokens: 8000,
      temperature: 0.8,
      writeDone: false,
      endResponse: false,
      onReady: () => writeStreamEvent(res, {
        status: 'content-generating',
        phase: 'content',
        message: 'Đang viết bài',
        step: 1,
        totalSteps: 2,
        totalImages,
      }),
    });

    writeStreamEvent(res, {
      status: 'content-complete',
      phase: 'content',
      message: `Đã viết xong bài. Chuẩn bị tạo ảnh 1/${totalImages}`,
      step: 2,
      totalSteps: 2,
      imageIndex: 0,
      totalImages,
    });

    try {
      const featuredImage = await createFeaturedImageForArticleWithProgress(
        {
          article: { title: topic, focusKeyword: keywords[0] || topic },
          topic,
          keywords,
          contentType: mode.value,
          targetAudience,
        },
        res,
        { imageIndex: 1, totalImages }
      );
      writeStreamEvent(res, { image: featuredImage });
    } catch (imageErr) {
      console.error('Stream featured image generation error:', imageErr);
      writeStreamEvent(res, {
        status: 'image-error',
        phase: 'image',
        message: `Không tạo được ảnh 1/${totalImages}`,
        imageError: imageErr.message,
        imageIndex: 1,
        totalImages,
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Blog stream error:', err);

    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    res.status(500).json({ error: err.message });
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

    const { data } = await jsonCompletion(systemPrompt, userPrompt, { max_tokens: 6000 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/titles', async (req, res) => {
  try {
    const { topic, keyword, count = 10, contentType = 'blog-post' } = req.body;

    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const mode = getContentMode(contentType);
    const systemPrompt = `You are an expert headline copywriter and SEO specialist. Return JSON only.`;

    const userPrompt = `Generate ${count} compelling, SEO-optimized ${mode.label} titles for:
Topic: "${topic}"
Primary keyword: "${keyword || topic}"

Return JSON:
{
      "titles": [
    {
      "title": "Title text",
      "type": "how-to|listicle|question|comparison|guide|ultimate|case-study|product-review|buying-guide",
      "characterCount": 58,
      "hasKeyword": true,
      "clickbaitScore": 7,
      "seoScore": 9,
      "powerWord": "Ultimate"
    }
  ]
}`;

    const { data } = await jsonCompletion(systemPrompt, userPrompt);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/publish-wordpress', async (req, res) => {
  try {
    const { wpUrl, wpUsername, wpAppPassword, title, content, status = 'draft' } = req.body;

    if (!wpUrl || !wpUsername || !wpAppPassword || !title || !content) {
      return res.status(400).json({ error: 'Missing required WordPress credentials or content' });
    }

    const apiUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
    const auth = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        title,
        content,
        status
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to publish to WordPress');
    }

    const data = await response.json();
    res.json({ success: true, url: data.link, id: data.id, editUrl: `${wpUrl.replace(/\/$/, '')}/wp-admin/post.php?post=${data.id}&action=edit` });
  } catch (err) {
    console.error('WordPress publish error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/wp-product-tabs/preview', async (req, res) => {
  try {
    const {
      wpUrl,
      wooConsumerKey,
      wooConsumerSecret,
      sheetUrl,
      minConfidence,
    } = req.body;

    validateProductTabCredentials({
      wpUrl,
      consumerKey: wooConsumerKey,
      consumerSecret: wooConsumerSecret,
      sheetUrl,
    });

    const result = await previewProductTabSync({
      wpUrl,
      consumerKey: wooConsumerKey,
      consumerSecret: wooConsumerSecret,
      sheetUrl,
      minConfidence,
      barn2TabKeys: readBarn2TabKeys(req.body),
      scanAllSheets: readBoolean(req.body.scanAllSheets),
    });

    res.json(result);
  } catch (err) {
    console.error('WooCommerce product tab preview error:', err);
    res.status(getProductTabsErrorStatus(err)).json({ error: err.message });
  }
});

router.post('/wp-product-tabs/sync', async (req, res) => {
  try {
    const {
      wpUrl,
      wooConsumerKey,
      wooConsumerSecret,
      sheetUrl,
      minConfidence,
    } = req.body;

    validateProductTabCredentials({
      wpUrl,
      consumerKey: wooConsumerKey,
      consumerSecret: wooConsumerSecret,
      sheetUrl,
    });

    const result = await syncProductTabs({
      wpUrl,
      consumerKey: wooConsumerKey,
      consumerSecret: wooConsumerSecret,
      sheetUrl,
      minConfidence,
      barn2TabKeys: readBarn2TabKeys(req.body),
      scanAllSheets: readBoolean(req.body.scanAllSheets),
      syncTarget: req.body.syncTarget,
    });

    res.json(result);
  } catch (err) {
    console.error('WooCommerce product tab sync error:', err);
    res.status(getProductTabsErrorStatus(err)).json({ error: err.message });
  }
});

export default router;
