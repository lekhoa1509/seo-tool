import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_IMAGE_MODEL = 'cx/gpt-5.4-image';
const DEFAULT_IMAGE_BASE_URL = 'http://localhost:20128/v1';

function getImageConfig() {
  const apiKey = process.env.GPT_IMAGE_API_KEY || process.env.GPT_CHAT_API_KEY;
  const baseURL = (process.env.GPT_IMAGE_BASE_URL || DEFAULT_IMAGE_BASE_URL).replace(/\/$/, '');
  const model = process.env.GPT_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;

  if (!apiKey || apiKey.includes('your_')) {
    throw new Error('GPT image API key is not configured. Please set GPT_IMAGE_API_KEY in backend/.env');
  }

  return { apiKey, baseURL, model };
}

function slugify(text) {
  return String(text || 'seo-image')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'seo-image';
}

export function buildSeoImagePrompt({
  topic,
  keyword,
  imageType = 'blog hero image',
  style = 'modern editorial illustration',
  audience = 'business readers',
  brandColors = '',
  mood = 'trustworthy, sharp, professional',
  aspectRatio = '16:9',
  includeText = false,
  customPrompt = '',
}) {
  const textRule = includeText
    ? 'If text is used, keep it minimal, crisp, and readable.'
    : 'Do not include any readable text, letters, words, logos, or watermarks in the image.';

  const colorRule = brandColors
    ? `Use these brand colors as accents: ${brandColors}.`
    : 'Use a balanced palette with blue, green, white, and warm accent colors.';

  return [
    `Create a high-quality SEO ${imageType} for the topic: "${topic}".`,
    keyword ? `Primary SEO keyword/context: "${keyword}".` : '',
    `Target audience: ${audience}.`,
    `Visual style: ${style}.`,
    `Mood: ${mood}.`,
    `Composition: ${aspectRatio} marketing visual with clear focal point, website growth, search analytics, content strategy, keyword research, and organic traffic signals.`,
    `${colorRule}`,
    `${textRule}`,
    'Make it suitable for a blog featured image, landing page hero, and social preview. Avoid clutter, distorted UI, fake brand logos, and unreadable dashboards.',
    customPrompt ? `Extra direction: ${customPrompt}` : '',
  ].filter(Boolean).join('\n');
}

export function buildSeoImageEditPrompt({
  topic,
  keyword,
  editPrompt,
  imageType = 'blog hero image',
  style = 'modern editorial illustration',
  audience = 'business readers',
  brandColors = '',
  mood = 'trustworthy, sharp, professional',
  aspectRatio = '16:9',
  includeText = false,
}) {
  const textRule = includeText
    ? 'If text is used, keep it minimal, crisp, and readable.'
    : 'Do not include any readable text, letters, words, logos, or watermarks in the image.';

  const colorRule = brandColors
    ? `Blend these brand colors into the final image: ${brandColors}.`
    : 'Use a balanced SEO palette with blue, green, white, and warm accent colors.';

  return [
    'Use the uploaded image as the main visual reference and preserve its most important subject, composition, or product details.',
    `Edit and merge it into a high-quality SEO ${imageType}${topic ? ` for the topic: "${topic}"` : ''}.`,
    keyword ? `Primary SEO keyword/context: "${keyword}".` : '',
    `Target audience: ${audience}.`,
    `Visual style: ${style}.`,
    `Mood: ${mood}.`,
    `Composition: ${aspectRatio} marketing visual with SEO signals such as website growth, search analytics, content strategy, keyword research, organic traffic, or ranking improvement.`,
    `${colorRule}`,
    `${textRule}`,
    editPrompt ? `User edit instruction: ${editPrompt}` : '',
    'Make the final image suitable for a blog featured image, landing page hero, and social preview. Keep it polished, uncluttered, and commercially usable.',
  ].filter(Boolean).join('\n');
}

function getNested(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
}

function normalizeImage(item) {
  if (!item || typeof item !== 'object') return null;

  const url = item.url || item.image_url || getNested(item, 'image.url');
  const b64Json =
    item.b64_json ||
    item.b64 ||
    item.base64 ||
    item.image_base64 ||
    item.partial_image_b64 ||
    getNested(item, 'image.b64_json') ||
    getNested(item, 'result.b64_json');

  if (!url && !b64Json) return null;

  return {
    url,
    b64_json: b64Json,
    revisedPrompt: item.revised_prompt || item.revisedPrompt || item.prompt,
  };
}

function collectImages(payload, images = []) {
  if (!payload) return images;

  if (Array.isArray(payload)) {
    payload.forEach((item) => collectImages(item, images));
    return images;
  }

  if (typeof payload !== 'object') return images;

  const image = normalizeImage(payload);
  if (image) images.push(image);

  ['data', 'images', 'output', 'result', 'results', 'content'].forEach((key) => {
    if (payload[key]) collectImages(payload[key], images);
  });

  return images;
}

function formatApiError(error) {
  if (!error) return 'Image generation failed';
  if (typeof error === 'string') return error;
  return error.message || error.detail || JSON.stringify(error);
}

async function parseImageResponse(response) {
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('Image API returned an empty response');
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const payload = JSON.parse(trimmed);
    if (payload.error) throw new Error(formatApiError(payload.error));
    return { payloads: [payload], images: collectImages(payload) };
  }

  const payloads = [];
  const events = trimmed.split('\n\n');

  for (const event of events) {
    const data = event
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6))
      .join('\n')
      .trim();

    if (!data || data === '[DONE]') continue;

    const payload = JSON.parse(data);
    if (payload.error) throw new Error(formatApiError(payload.error));
    payloads.push(payload);
  }

  if (payloads.length) {
    return {
      payloads,
      images: collectImages(payloads),
    };
  }

  return {
    payloads: [{ error: trimmed }],
    images: [],
  };
}

function buildImageMetadata({ topic, keyword, outputFormat, mode = 'seo' }) {
  const title = topic || (mode === 'edit' ? 'Edited SEO image' : 'SEO image');
  const fileBase = keyword || topic || (mode === 'edit' ? 'edited-seo-image' : 'seo-image');

  return {
    title: `${title} - SEO visual`,
    altText: `Hình minh họa SEO cho chủ đề ${title}${keyword ? `, từ khóa ${keyword}` : ''}`,
    fileName: `${slugify(fileBase)}-seo.${outputFormat}`,
    caption: `Ảnh minh họa cho nội dung SEO về ${title}.`,
  };
}

export async function createSeoImage(options = {}) {
  const { apiKey, baseURL, model } = getImageConfig();
  const prompt = buildSeoImagePrompt(options);
  const outputFormat = options.outputFormat || 'png';

  const response = await fetch(`${baseURL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: options.size || 'auto',
      quality: options.quality || 'auto',
      background: options.background || 'auto',
      image_detail: options.imageDetail || 'high',
      output_format: outputFormat,
    }),
  });

  const { payloads, images } = await parseImageResponse(response);

  if (!response.ok) {
    const apiError = payloads.find((payload) => payload?.error)?.error;
    throw new Error(formatApiError(apiError) || `Image generation failed with status ${response.status}`);
  }

  if (!images.length) {
    throw new Error('Image API did not return image data');
  }

  const topic = options.topic || 'SEO image';
  const keyword = options.keyword || topic;

  return {
    image: images[images.length - 1],
    model,
    prompt,
    metadata: buildImageMetadata({ topic, keyword, outputFormat }),
  };
}

export async function editSeoImage(file, options = {}) {
  if (!file?.buffer) {
    throw new Error('image file is required');
  }

  const { apiKey, baseURL, model } = getImageConfig();
  const prompt = buildSeoImageEditPrompt(options);
  const outputFormat = options.outputFormat || 'png';

  const response = await fetch(`${baseURL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      prompt,
      image: `data:${file.mimetype || 'image/png'};base64,${file.buffer.toString('base64')}`,
      n: 1,
      size: options.size || 'auto',
      quality: options.quality || 'auto',
      background: options.background || 'auto',
      image_detail: options.imageDetail || 'high',
      output_format: outputFormat,
    }),
  });

  const { payloads, images } = await parseImageResponse(response);

  if (!response.ok) {
    const apiError = payloads.find((payload) => payload?.error)?.error;
    throw new Error(formatApiError(apiError) || `Image edit failed with status ${response.status}`);
  }

  if (!images.length) {
    throw new Error('Image API did not return edited image data');
  }

  const topic = options.topic || 'Edited SEO image';
  const keyword = options.keyword || topic;

  return {
    image: images[images.length - 1],
    model,
    prompt,
    metadata: buildImageMetadata({ topic, keyword, outputFormat, mode: 'edit' }),
  };
}
