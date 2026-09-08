import * as cheerio from 'cheerio';

const WORDS_PER_MINUTE = 200;

function countWords(text = '') {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function countOccurrences(haystack = '', needle = '') {
  const h = String(haystack || '').toLowerCase();
  const n = String(needle || '').toLowerCase().trim();
  if (!n) return 0;

  let count = 0;
  let index = h.indexOf(n);
  while (index !== -1) {
    count += 1;
    index = h.indexOf(n, index + n.length);
  }
  return count;
}

function pushCheck(checklist, { id, label, status, detail }) {
  checklist.push({ id, label, status, detail });
}

/**
 * Deterministic on-page SEO analysis computed from the actual generated
 * HTML — not an LLM self-report. Word count, heading structure, keyword
 * density, image alt coverage, and internal-link usage are all measured
 * directly from the markup with cheerio.
 */
export function analyzeArticleSeo({
  html = '',
  title = '',
  metaDescription = '',
  focusKeyword = '',
  targetWordCount = 0,
  linkCandidateUrls = [],
} = {}) {
  const $ = cheerio.load(html || '', { decodeEntities: true }, false);
  const bodyText = $.root().text().replace(/\s+/g, ' ').trim();

  const wordCount = countWords(bodyText);
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  const images = $('img');
  const imageCount = images.length;
  let imagesMissingAlt = 0;
  images.each((_, el) => {
    const alt = ($(el).attr('alt') || '').trim();
    if (!alt) imagesMissingAlt += 1;
  });

  const candidateUrlSet = new Set(linkCandidateUrls.filter(Boolean));
  const links = $('a[href]');
  let internalLinkCount = 0;
  let externalLinkCount = 0;
  links.each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;
    if (candidateUrlSet.has(href)) {
      internalLinkCount += 1;
    } else if (/^https?:\/\//i.test(href)) {
      externalLinkCount += 1;
    }
  });

  const first100Words = bodyText.split(/\s+/).slice(0, 100).join(' ');
  const keywordInFirst100 = focusKeyword ? countOccurrences(first100Words, focusKeyword) > 0 : false;
  const headingsText = $('h2, h3').map((_, el) => $(el).text()).get().join(' ');
  const keywordInHeading = focusKeyword ? countOccurrences(headingsText, focusKeyword) > 0 : false;
  const keywordOccurrences = focusKeyword ? countOccurrences(bodyText, focusKeyword) : 0;
  const keywordDensity = focusKeyword && wordCount
    ? Number(((keywordOccurrences / wordCount) * 100).toFixed(2))
    : 0;

  const checklist = [];

  if (targetWordCount) {
    const ratio = wordCount / targetWordCount;
    pushCheck(checklist, {
      id: 'wordCount',
      label: 'Độ dài bài viết',
      status: ratio >= 0.85 ? 'pass' : ratio >= 0.6 ? 'warn' : 'fail',
      detail: `${wordCount.toLocaleString()} từ (mục tiêu ~${targetWordCount.toLocaleString()} từ)`,
    });
  } else {
    pushCheck(checklist, {
      id: 'wordCount',
      label: 'Độ dài bài viết',
      status: wordCount >= 600 ? 'pass' : wordCount >= 300 ? 'warn' : 'fail',
      detail: `${wordCount.toLocaleString()} từ`,
    });
  }

  pushCheck(checklist, {
    id: 'titleLength',
    label: 'Độ dài Title',
    status: title.length >= 40 && title.length <= 60 ? 'pass' : title.length > 0 ? 'warn' : 'fail',
    detail: title ? `${title.length} ký tự (khuyến nghị 40-60)` : 'Chưa có title',
  });

  pushCheck(checklist, {
    id: 'metaDescription',
    label: 'Độ dài Meta Description',
    status: metaDescription.length >= 120 && metaDescription.length <= 160 ? 'pass' : metaDescription.length > 0 ? 'warn' : 'fail',
    detail: metaDescription ? `${metaDescription.length} ký tự (khuyến nghị 120-160)` : 'Chưa có meta description',
  });

  if (focusKeyword) {
    pushCheck(checklist, {
      id: 'keywordInTitle',
      label: 'Từ khóa chính trong Title',
      status: countOccurrences(title, focusKeyword) > 0 ? 'pass' : 'fail',
      detail: `Từ khóa: "${focusKeyword}"`,
    });

    pushCheck(checklist, {
      id: 'keywordInFirst100',
      label: 'Từ khóa chính trong 100 từ đầu',
      status: keywordInFirst100 ? 'pass' : 'warn',
      detail: keywordInFirst100 ? 'Có xuất hiện' : 'Chưa thấy trong đoạn mở đầu',
    });

    pushCheck(checklist, {
      id: 'keywordInHeading',
      label: 'Từ khóa chính trong H2/H3',
      status: keywordInHeading ? 'pass' : 'warn',
      detail: keywordInHeading ? 'Có xuất hiện trong heading' : 'Chưa thấy trong heading nào',
    });

    pushCheck(checklist, {
      id: 'keywordDensity',
      label: 'Mật độ từ khóa',
      status: keywordDensity >= 0.4 && keywordDensity <= 2.5 ? 'pass' : keywordDensity > 2.5 ? 'fail' : 'warn',
      detail: `${keywordDensity}% (khuyến nghị 0.4%-2.5%, xuất hiện ${keywordOccurrences} lần)`,
    });
  }

  pushCheck(checklist, {
    id: 'headingStructure',
    label: 'Cấu trúc heading (H2/H3)',
    status: h2Count >= 2 ? 'pass' : h2Count === 1 ? 'warn' : 'fail',
    detail: `${h2Count} thẻ H2, ${h3Count} thẻ H3`,
  });

  pushCheck(checklist, {
    id: 'noDuplicateH1',
    label: 'Không trùng H1 trong nội dung',
    status: h1Count === 0 ? 'pass' : h1Count === 1 ? 'warn' : 'fail',
    detail: h1Count === 0
      ? 'Nội dung không tự chèn H1 (đúng, H1 nên là title trang)'
      : `Nội dung có ${h1Count} thẻ H1 — nên đổi thành H2`,
  });

  pushCheck(checklist, {
    id: 'images',
    label: 'Hình ảnh minh họa',
    status: imageCount > 0 ? 'pass' : 'warn',
    detail: imageCount > 0 ? `${imageCount} ảnh trong bài` : 'Chưa có ảnh trong nội dung',
  });

  if (imageCount > 0) {
    pushCheck(checklist, {
      id: 'imageAlt',
      label: 'Alt text cho ảnh',
      status: imagesMissingAlt === 0 ? 'pass' : 'fail',
      detail: imagesMissingAlt === 0 ? 'Tất cả ảnh có alt text' : `${imagesMissingAlt}/${imageCount} ảnh thiếu alt text`,
    });
  }

  if (linkCandidateUrls.length > 0) {
    pushCheck(checklist, {
      id: 'internalLinks',
      label: 'Internal link tới bài viết thật',
      status: internalLinkCount >= 2 ? 'pass' : internalLinkCount === 1 ? 'warn' : 'fail',
      detail: `${internalLinkCount} link trỏ tới bài viết đã có trên site`,
    });
  } else {
    pushCheck(checklist, {
      id: 'internalLinks',
      label: 'Internal link tới bài viết thật',
      status: 'skip',
      detail: 'Chưa kết nối WordPress nên không gợi ý được internal link thật',
    });
  }

  const scored = checklist.filter((item) => item.status !== 'skip');
  const points = scored.reduce((sum, item) => {
    if (item.status === 'pass') return sum + 1;
    if (item.status === 'warn') return sum + 0.5;
    return sum;
  }, 0);
  const score = scored.length ? Math.round((points / scored.length) * 100) : 0;

  return {
    score,
    checklist,
    metrics: {
      wordCount,
      readingTimeMinutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
      h1Count,
      h2Count,
      h3Count,
      imageCount,
      imagesMissingAlt,
      internalLinkCount,
      externalLinkCount,
      keywordDensity,
      keywordOccurrences,
      titleLength: title.length,
      metaDescriptionLength: metaDescription.length,
    },
  };
}
