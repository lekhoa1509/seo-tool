import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  CheckCircle,
  Clipboard,
  Code,
  Copy,
  Gauge,
  Layers,
  Lightbulb,
  Link2,
  Loader2,
  MousePointer,
  Search,
  ShoppingCart,
  Target,
  TrendingUp,
} from 'lucide-react';
import { salesAPI } from '../utils/api';

const workflows = [
  { key: 'guide', label: 'Hướng dẫn', phase: 'Guide', icon: BookOpen },
  { key: 'dashboard', label: 'Sales Dashboard', phase: 'Phase 1', icon: BarChart2 },
  { key: 'intent', label: 'Intent Mapper', phase: 'Phase 1', icon: Target },
  { key: 'money', label: 'Money Page', phase: 'Phase 2', icon: ShoppingCart },
  { key: 'links', label: 'Internal Links', phase: 'Phase 2', icon: Link2 },
  { key: 'serp', label: 'SERP Gap', phase: 'Phase 3', icon: Search },
  { key: 'rank', label: 'Rank Opportunity', phase: 'Phase 3', icon: TrendingUp },
  { key: 'cro', label: 'CRO + Schema', phase: 'Phase 4', icon: MousePointer },
];

const initialForms = {
  dashboard: {
    businessName: '',
    siteUrl: '',
    offer: '',
    targetMarket: 'Vietnam',
    rawMetrics: '',
  },
  intent: {
    seedKeyword: '',
    keywords: '',
    businessType: '',
    offer: '',
    targetMarket: 'Vietnam',
  },
  money: {
    url: '',
    pageContent: '',
    targetKeyword: '',
    offer: '',
    audience: '',
  },
  links: {
    siteUrl: '',
    targetKeyword: '',
    sourcePages: '',
    moneyPages: '',
  },
  serp: {
    keyword: '',
    ownUrl: '',
    competitorUrls: '',
    businessType: '',
  },
  rank: {
    businessGoal: 'Tăng lead/đơn hàng từ organic search',
    rawMetrics: '',
  },
  cro: {
    url: '',
    pageContent: '',
    pageType: 'Product',
    businessName: '',
    offer: '',
    targetKeyword: '',
  },
};

function scoreColor(score = 0) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-rose-500';
}

function priorityBadge(priority = '') {
  const value = String(priority).toLowerCase();
  if (value === 'high') return 'badge-red';
  if (value === 'medium') return 'badge-yellow';
  if (value === 'low') return 'badge-green';
  return 'badge-blue';
}

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return '0%';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function copyJson(value) {
  navigator.clipboard?.writeText(JSON.stringify(value, null, 2));
}

function ScoreGrid({ scores }) {
  if (!scores) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {Object.entries(scores).map(([key, value]) => (
        <div key={key} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-600">{key.replace(/([A-Z])/g, ' $1')}</span>
            <span className="text-lg font-bold text-slate-800">{value}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${scoreColor(Number(value))}`} style={{ width: `${Math.min(100, Number(value) || 0)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ loading }) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        {loading ? <Loader2 size={22} className="animate-spin" /> : <Gauge size={22} />}
      </div>
      <p className="font-medium text-slate-700">{loading ? 'Đang phân tích sales SEO...' : 'Chọn workflow và nhập dữ liệu để phân tích'}</p>
      <p className="mt-1 text-sm text-slate-400">Kết quả sẽ tập trung vào lead, đơn hàng và trang chốt sale.</p>
    </div>
  );
}

function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <strong>Lỗi:</strong> {error}
    </div>
  );
}

function ActionList({ title, items, icon: Icon = Lightbulb }) {
  if (!items?.length) return null;
  return (
    <div className="card p-5">
      <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
        <Icon size={17} className="text-primary-500" />
        {title}
      </h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            {typeof item === 'string' ? (
              <p className="text-sm text-slate-700">{item}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                    {item.priority || index + 1}
                  </span>
                  <p className="font-medium text-slate-800">
                    {item.opportunity || item.issue || item.gap || item.action || item.heading || item.page || item.group || item.objection || item.query}
                  </p>
                  {item.priority && typeof item.priority === 'string' && (
                    <span className={priorityBadge(item.priority)}>{item.priority}</span>
                  )}
                </div>
                {Object.entries(item).filter(([key]) => !['priority', 'opportunity', 'issue', 'gap', 'action', 'heading', 'page', 'group', 'objection', 'query'].includes(key)).map(([key, value]) => (
                  <p key={key} className="text-sm text-slate-600">
                    <span className="font-medium text-slate-700">{key.replace(/([A-Z])/g, ' $1')}:</span> {Array.isArray(value) ? value.join(', ') : String(value)}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function JsonBlock({ title, value }) {
  if (!value) return null;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800">
          <Code size={17} className="text-slate-500" />
          {title}
        </h3>
        <button type="button" className="btn-outline text-xs" onClick={() => copyJson(value)}>
          <Copy size={13} />
          Copy
        </button>
      </div>
      <pre className="max-h-96 overflow-auto bg-slate-950 p-5 text-xs leading-relaxed text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function WorkflowTabs({ activeTab, onChange }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
        {workflows.map((workflow) => {
          const Icon = workflow.icon;
          const active = activeTab === workflow.key;
          return (
            <button
              key={workflow.key}
              type="button"
              onClick={() => onChange(workflow.key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={15} />
              {workflow.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const guideTerms = [
  {
    term: 'Organic Sales',
    definition: 'Doanh thu hoặc lead đến từ SEO, không tính ads. Trọng tâm là query có ý định mua, landing page chốt sale và tracking chuyển đổi.',
    example: 'Traffic từ Google vào trang báo giá, bấm Zalo, gọi điện, gửi form hoặc đặt hàng.',
  },
  {
    term: 'Search Intent',
    definition: 'Ý định phía sau từ khóa. Intent quyết định nên làm blog, category, product page, comparison page hay landing page.',
    example: '"mua giấy vệ sinh cuộn lớn giá sỉ" là transactional, nên trỏ về money page hoặc landing page báo giá.',
  },
  {
    term: 'Money Page',
    definition: 'Trang có nhiệm vụ tạo lead hoặc đơn hàng trực tiếp. Đây là nơi blog và internal link nên đẩy sức mạnh về.',
    example: 'Trang sản phẩm, trang dịch vụ, trang báo giá, category thương mại, local landing page.',
  },
  {
    term: 'Internal Link',
    definition: 'Liên kết nội bộ từ bài hỗ trợ sang money page. Nó giúp Google hiểu page quan trọng và giúp người đọc đi tới bước mua.',
    example: 'Từ bài "nên chọn giấy 1 lớp hay 2 lớp" link về trang "giấy vệ sinh cuộn lớn giá sỉ".',
  },
  {
    term: 'SERP Gap',
    definition: 'Khoảng thiếu giữa page của mình và các page đang top Google, đặc biệt là yếu tố thương mại như giá, bảng so sánh, FAQ, proof.',
    example: 'Đối thủ có bảng quy cách, MOQ và chính sách giao hàng, còn page mình chỉ có mô tả chung.',
  },
  {
    term: 'Rank Opportunity',
    definition: 'Cơ hội tăng traffic nhanh từ query đang có impression nhưng vị trí/CTR chưa tốt. Thường lấy từ Google Search Console.',
    example: 'Keyword đang ở vị trí 6-12 chỉ cần tối ưu title, content refresh và internal link là có thể tăng click.',
  },
  {
    term: 'CTR Rewrite',
    definition: 'Viết lại title/meta cho query có impression cao nhưng CTR thấp. Mục tiêu là tăng click mà chưa cần tăng ranking.',
    example: 'Thêm giá sỉ, giao nhanh, loại cuộn lớn, đối tượng B2B vào title/meta nếu đúng offer.',
  },
  {
    term: 'CRO',
    definition: 'Conversion Rate Optimization: tối ưu page để người vào từ SEO dễ liên hệ hoặc mua hơn.',
    example: 'CTA rõ ở màn hình đầu, form ngắn, nút Zalo/call nổi, có chính sách giao hàng và bằng chứng tin cậy.',
  },
  {
    term: 'Schema',
    definition: 'Dữ liệu có cấu trúc giúp Google hiểu page. Với sales SEO thường dùng Product, Service, LocalBusiness, FAQPage.',
    example: 'Product schema cho trang sản phẩm, FAQPage cho câu hỏi mua hàng, LocalBusiness cho doanh nghiệp địa phương.',
  },
];

const guideWorkflow = [
  {
    phase: 'Phase 1',
    tabs: 'Sales Dashboard + Intent Mapper',
    goal: 'Biết organic hiện đang phục vụ sales tới đâu và keyword nào có ý định mua.',
    input: 'Website, offer, thị trường, danh sách keyword hoặc export GSC.',
  },
  {
    phase: 'Phase 2',
    tabs: 'Money Page + Internal Links',
    goal: 'Sửa trang chốt đơn và đẩy sức mạnh từ blog/supporting content về money page.',
    input: 'URL money page, keyword mục tiêu, danh sách source pages và money pages.',
  },
  {
    phase: 'Phase 3',
    tabs: 'SERP Gap + Rank Opportunity',
    goal: 'Tìm phần đối thủ đang làm tốt hơn và cơ hội kéo keyword gần top lên nhanh.',
    input: 'Keyword, URL của mình, URL đối thủ, export GSC query/page/clicks/impressions/ctr/position.',
  },
  {
    phase: 'Phase 4',
    tabs: 'CRO + Schema',
    goal: 'Giảm rò rỉ khách trên landing page và tạo JSON-LD phù hợp để tăng tín hiệu tin cậy.',
    input: 'URL hoặc nội dung page, offer, page type và keyword mục tiêu.',
  },
];

function GuideContent() {
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Định nghĩa Organic Sales SEO</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Organic Sales SEO là cách làm SEO dựa trên lead, đơn hàng và doanh thu. Không chỉ hỏi page có traffic không, mà hỏi traffic đó có đúng intent mua không, có đi về money page không và page có đủ lý do để khách liên hệ không.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
            <Clipboard size={17} className="text-primary-500" />
            Quy trình dùng đề xuất
          </h3>
          <div className="space-y-3">
            {guideWorkflow.map((item) => (
              <div key={item.phase} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="badge-green">{item.phase}</span>
                  <span className="font-semibold text-slate-800">{item.tabs}</span>
                </div>
                <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Mục tiêu:</span> {item.goal}</p>
                <p className="mt-1 text-sm text-slate-600"><span className="font-medium text-slate-700">Cần nhập:</span> {item.input}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
            <Gauge size={17} className="text-amber-500" />
            Format GSC
          </h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Khi dùng Sales Dashboard hoặc Rank Opportunity, có thể dán export dạng CSV/TSV với header:
          </p>
          <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
{`query,page,clicks,impressions,ctr,position
mua giấy vệ sinh cuộn lớn,/giay-ve-sinh-cuon-lon,12,1200,1%,8.4`}
          </pre>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            CTR có thể nhập dạng 1%, 0.01 hoặc 1. Tool sẽ tự chuẩn hóa về tỷ lệ.
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
          <Lightbulb size={17} className="text-yellow-500" />
          Glossary
        </h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {guideTerms.map((item) => (
            <div key={item.term} className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="font-semibold text-slate-800">{item.term}</h4>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.definition}</p>
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                <span className="font-medium text-slate-700">Ví dụ:</span> {item.example}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardForm({ form, setForm, loading }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Field label="Tên doanh nghiệp">
        <input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="vd: SEO Pro" />
      </Field>
      <Field label="Website">
        <input className="input" value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} placeholder="https://example.com" />
      </Field>
      <Field label="Sản phẩm / dịch vụ chính">
        <input className="input" value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="vd: giấy vệ sinh cuộn lớn giá sỉ" />
      </Field>
      <Field label="Thị trường">
        <input className="input" value={form.targetMarket} onChange={(e) => setForm({ ...form, targetMarket: e.target.value })} />
      </Field>
      <div className="lg:col-span-2">
        <Field label="GSC export tuỳ chọn: query,page,clicks,impressions,ctr,position">
          <textarea className="textarea" rows={7} value={form.rawMetrics} onChange={(e) => setForm({ ...form, rawMetrics: e.target.value })} placeholder="query,page,clicks,impressions,ctr,position&#10;mua giấy vệ sinh cuộn lớn,/giay-ve-sinh-cuon-lon,12,1200,1%,8.4" />
        </Field>
      </div>
    </div>
  );
}

function IntentForm({ form, setForm }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Field label="Seed keyword">
        <input className="input" value={form.seedKeyword} onChange={(e) => setForm({ ...form, seedKeyword: e.target.value })} placeholder="vd: giấy vệ sinh cuộn lớn" />
      </Field>
      <Field label="Loại hình kinh doanh">
        <input className="input" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} placeholder="B2B, local service, ecommerce..." />
      </Field>
      <Field label="Sản phẩm / offer">
        <input className="input" value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="vd: bán sỉ giấy vệ sinh cho văn phòng" />
      </Field>
      <Field label="Thị trường">
        <input className="input" value={form.targetMarket} onChange={(e) => setForm({ ...form, targetMarket: e.target.value })} />
      </Field>
      <div className="lg:col-span-2">
        <Field label="Danh sách keyword, mỗi dòng một keyword">
          <textarea className="textarea" rows={8} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="giấy vệ sinh cuộn lớn&#10;mua giấy vệ sinh cuộn lớn giá sỉ&#10;giấy vệ sinh cuộn lớn loại nào tốt" />
        </Field>
      </div>
    </div>
  );
}

function MoneyForm({ form, setForm }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Field label="URL money page">
        <input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/san-pham" />
      </Field>
      <Field label="Từ khóa mục tiêu">
        <input className="input" value={form.targetKeyword} onChange={(e) => setForm({ ...form, targetKeyword: e.target.value })} placeholder="vd: mua giấy vệ sinh cuộn lớn" />
      </Field>
      <Field label="Offer">
        <input className="input" value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="vd: báo giá sỉ, giao tận nơi" />
      </Field>
      <Field label="Đối tượng">
        <input className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder="vd: văn phòng, nhà hàng, nhà máy" />
      </Field>
      <div className="lg:col-span-2">
        <Field label="Nội dung page nếu chưa có URL">
          <textarea className="textarea" rows={7} value={form.pageContent} onChange={(e) => setForm({ ...form, pageContent: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function LinksForm({ form, setForm }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Field label="Website">
        <input className="input" value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} placeholder="https://example.com" />
      </Field>
      <Field label="Theme / target keyword">
        <input className="input" value={form.targetKeyword} onChange={(e) => setForm({ ...form, targetKeyword: e.target.value })} placeholder="vd: giấy vệ sinh cuộn lớn" />
      </Field>
      <Field label="Source pages, mỗi dòng một URL/title">
        <textarea className="textarea" rows={10} value={form.sourcePages} onChange={(e) => setForm({ ...form, sourcePages: e.target.value })} placeholder="/blog/cach-chon-giay-ve-sinh&#10;/blog/giay-ve-sinh-1-lop-hay-2-lop" />
      </Field>
      <Field label="Money pages, mỗi dòng một URL/title">
        <textarea className="textarea" rows={10} value={form.moneyPages} onChange={(e) => setForm({ ...form, moneyPages: e.target.value })} placeholder="/giay-ve-sinh-cuon-lon&#10;/bao-gia-giay-ve-sinh-cuon-lon" />
      </Field>
    </div>
  );
}

function SerpForm({ form, setForm }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Field label="Keyword">
        <input className="input" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="vd: giấy vệ sinh cuộn lớn giá sỉ" />
      </Field>
      <Field label="Loại hình kinh doanh">
        <input className="input" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} placeholder="B2B wholesale, ecommerce..." />
      </Field>
      <div className="lg:col-span-2">
        <Field label="URL của mình">
          <input className="input" value={form.ownUrl} onChange={(e) => setForm({ ...form, ownUrl: e.target.value })} placeholder="https://example.com/page" />
        </Field>
      </div>
      <div className="lg:col-span-2">
        <Field label="URL đối thủ, tối đa 5 dòng">
          <textarea className="textarea" rows={7} value={form.competitorUrls} onChange={(e) => setForm({ ...form, competitorUrls: e.target.value })} placeholder="https://competitor.com/page-1&#10;https://competitor.com/page-2" />
        </Field>
      </div>
    </div>
  );
}

function RankForm({ form, setForm }) {
  return (
    <div className="space-y-4">
      <Field label="Mục tiêu kinh doanh">
        <input className="input" value={form.businessGoal} onChange={(e) => setForm({ ...form, businessGoal: e.target.value })} />
      </Field>
      <Field label="GSC export: query,page,clicks,impressions,ctr,position">
        <textarea className="textarea" rows={12} value={form.rawMetrics} onChange={(e) => setForm({ ...form, rawMetrics: e.target.value })} placeholder="query,page,clicks,impressions,ctr,position&#10;mua giấy vệ sinh cuộn lớn,/giay-ve-sinh-cuon-lon,12,1200,1%,8.4" />
      </Field>
    </div>
  );
}

function CroForm({ form, setForm }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Field label="URL">
        <input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/page" />
      </Field>
      <Field label="Schema type">
        <select className="input" value={form.pageType} onChange={(e) => setForm({ ...form, pageType: e.target.value })}>
          <option value="Product">Product</option>
          <option value="Service">Service</option>
          <option value="LocalBusiness">LocalBusiness</option>
          <option value="FAQPage">FAQPage</option>
          <option value="Article">Article</option>
        </select>
      </Field>
      <Field label="Tên doanh nghiệp">
        <input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
      </Field>
      <Field label="Từ khóa mục tiêu">
        <input className="input" value={form.targetKeyword} onChange={(e) => setForm({ ...form, targetKeyword: e.target.value })} />
      </Field>
      <div className="lg:col-span-2">
        <Field label="Offer">
          <input className="input" value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="vd: báo giá sỉ, giao nhanh, hỗ trợ mẫu thử" />
        </Field>
      </div>
      <div className="lg:col-span-2">
        <Field label="Nội dung page nếu chưa có URL">
          <textarea className="textarea" rows={7} value={form.pageContent} onChange={(e) => setForm({ ...form, pageContent: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function WorkflowForm({ activeTab, forms, setForms, loading, onSubmit }) {
  if (activeTab === 'guide') return null;

  const form = forms[activeTab];
  const setForm = (next) => setForms((current) => ({ ...current, [activeTab]: next }));

  return (
    <div className="card p-5">
      <form onSubmit={onSubmit} className="space-y-5">
        {activeTab === 'dashboard' && <DashboardForm form={form} setForm={setForm} loading={loading} />}
        {activeTab === 'intent' && <IntentForm form={form} setForm={setForm} />}
        {activeTab === 'money' && <MoneyForm form={form} setForm={setForm} />}
        {activeTab === 'links' && <LinksForm form={form} setForm={setForm} />}
        {activeTab === 'serp' && <SerpForm form={form} setForm={setForm} />}
        {activeTab === 'rank' && <RankForm form={form} setForm={setForm} />}
        {activeTab === 'cro' && <CroForm form={form} setForm={setForm} />}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
            {loading ? 'Đang phân tích...' : 'Phân tích'}
          </button>
          <span className="text-sm text-slate-400">Kết quả tập trung vào sales organic, không ads</span>
        </div>
      </form>
    </div>
  );
}

function DashboardResult({ data }) {
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="mb-2 text-lg font-bold text-slate-800">Organic Sales Scorecard</h2>
        <p className="mb-4 text-sm text-slate-500">{data.summary}</p>
        <ScoreGrid scores={data.scorecard} />
      </div>
      <ActionList title="Top cơ hội sales SEO" items={data.topOpportunities} icon={TrendingUp} />
      <ActionList title="Funnel gaps" items={data.salesFunnel} icon={Layers} />
      <ActionList title="KPI cần tracking" items={data.kpis} icon={Gauge} />
      <ActionList title="Kế hoạch tuần này" items={data.weeklyActionPlan} icon={Clipboard} />
    </div>
  );
}

function IntentResult({ data }) {
  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-800">Keyword Intent Map</h2>
          <p className="mt-1 text-sm text-slate-500">{data.summary}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3">Funnel</th>
                <th className="px-4 py-3">Page type</th>
                <th className="px-4 py-3">CTA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.keywordMap?.map((item, index) => (
                <tr key={`${item.keyword}-${index}`}>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.keyword}</td>
                  <td className="px-4 py-3"><span className="badge-blue">{item.intent}</span></td>
                  <td className="px-4 py-3 text-slate-600">{item.funnelStage}</td>
                  <td className="px-4 py-3 text-slate-600">{item.pageType}</td>
                  <td className="px-4 py-3 text-slate-600">{item.cta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ActionList title="Missing money pages" items={data.missingMoneyPages} icon={ShoppingCart} />
      <ActionList title="Clusters" items={data.clusters} icon={Layers} />
      <ActionList title="Quick wins" items={data.quickWins} icon={Lightbulb} />
    </div>
  );
}

function MoneyResult({ data }) {
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="mb-2 text-lg font-bold text-slate-800">Money Page Audit</h2>
        <p className="mb-4 text-sm text-slate-500">{data.summary}</p>
        <ScoreGrid scores={data.scores} />
      </div>
      <ActionList title="Conversion blockers" items={data.conversionBlockers} icon={AlertTriangle} />
      <ActionList title="Proof elements cần thêm" items={data.proofElements} icon={CheckCircle} />
      <ActionList title="Offer checklist" items={data.offerChecklist} icon={Clipboard} />
      <JsonBlock title="Copy fixes" value={data.copyFixes} />
    </div>
  );
}

function LinksResult({ data }) {
  return (
    <div className="space-y-5">
      <ActionList title="Internal link opportunities" items={data.opportunities} icon={Link2} />
      <ActionList title="Orphan risks" items={data.orphanRisks} icon={AlertTriangle} />
      <ActionList title="Anchor mix" items={data.anchorMix} icon={Target} />
      <ActionList title="Implementation plan" items={data.implementationPlan} icon={Clipboard} />
    </div>
  );
}

function SerpResult({ data }) {
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Commercial SERP Gap</h2>
            <p className="mt-1 text-sm text-slate-500">{data.summary}</p>
            <p className="mt-2 text-sm text-slate-600"><span className="font-medium">SERP intent:</span> {data.serpIntent}</p>
          </div>
          <div className="rounded-lg bg-primary-50 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-primary-700">{data.gapScore || 0}</div>
            <div className="text-xs text-primary-500">Gap score</div>
          </div>
        </div>
      </div>
      <ActionList title="Content gaps" items={data.contentGaps} icon={Search} />
      <ActionList title="Commercial gaps" items={data.commercialGaps} icon={ShoppingCart} />
      <ActionList title="Recommended sections" items={data.recommendedSections} icon={Layers} />
      <ActionList title="Win plan" items={data.winPlan} icon={Clipboard} />
    </div>
  );
}

function RankResult({ data }) {
  const opportunities = data.rankData?.opportunities || [];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Rows', value: data.rankData?.totalRows || 0 },
          { label: 'Impressions', value: data.rankData?.totals?.impressions?.toLocaleString() || 0 },
          { label: 'Missed clicks', value: data.rankData?.totals?.missedClicks?.toLocaleString() || 0 },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <div className="text-2xl font-bold text-slate-800">{item.value}</div>
            <div className="text-sm text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-800">Top rank opportunities</h2>
          <p className="mt-1 text-sm text-slate-500">{data.summary}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Query</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">CTR</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Action type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {opportunities.slice(0, 12).map((item, index) => (
                <tr key={`${item.query}-${index}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{item.query}</div>
                    <div className="text-xs text-slate-400">{item.page}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.position?.toFixed?.(1) || item.position}</td>
                  <td className="px-4 py-3 text-slate-600">{formatPercent(item.ctr)}</td>
                  <td className="px-4 py-3 font-semibold text-primary-700">{item.opportunityScore}</td>
                  <td className="px-4 py-3 text-slate-600">{item.opportunityType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ActionList title="Action plan" items={data.actions} icon={Clipboard} />
      <ActionList title="Title/meta tests" items={data.titleMetaTests} icon={Lightbulb} />
    </div>
  );
}

function CroResult({ data }) {
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="mb-2 text-lg font-bold text-slate-800">CRO + Schema</h2>
        <p className="mb-4 text-sm text-slate-500">{data.summary}</p>
        <ScoreGrid scores={data.croScores} />
      </div>
      <ActionList title="CRO issues" items={data.croIssues} icon={AlertTriangle} />
      <ActionList title="Objection handling" items={data.objectionHandling} icon={MousePointer} />
      <JsonBlock title={`Schema: ${data.schemaRecommendation?.type || 'JSON-LD'}`} value={data.schemaRecommendation?.jsonLd} />
      <JsonBlock title="FAQ schema items" value={data.faqSchemaItems} />
    </div>
  );
}

function Results({ activeTab, data, loading }) {
  if (activeTab === 'guide') return <GuideContent />;
  if (loading || !data) return <EmptyState loading={loading} />;
  if (activeTab === 'dashboard') return <DashboardResult data={data} />;
  if (activeTab === 'intent') return <IntentResult data={data} />;
  if (activeTab === 'money') return <MoneyResult data={data} />;
  if (activeTab === 'links') return <LinksResult data={data} />;
  if (activeTab === 'serp') return <SerpResult data={data} />;
  if (activeTab === 'rank') return <RankResult data={data} />;
  if (activeTab === 'cro') return <CroResult data={data} />;
  return null;
}

export default function OrganicSales() {
  const [activeTab, setActiveTab] = useState('guide');
  const [forms, setForms] = useState(initialForms);
  const [results, setResults] = useState({});
  const [loadingTab, setLoadingTab] = useState('');
  const [error, setError] = useState('');

  const loading = loadingTab === activeTab;
  const activeWorkflow = workflows.find((workflow) => workflow.key === activeTab);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoadingTab(activeTab);

    try {
      const form = forms[activeTab];
      const apiMap = {
        dashboard: salesAPI.dashboard,
        intent: salesAPI.intentMap,
        money: salesAPI.moneyPage,
        links: salesAPI.internalLinks,
        serp: salesAPI.serpGap,
        rank: salesAPI.rankOpportunities,
        cro: salesAPI.croSchema,
      };
      const result = await apiMap[activeTab](form);
      setResults((current) => ({ ...current, [activeTab]: result }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTab('');
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <TrendingUp size={24} className="text-emerald-500" />
            Organic Sales
          </h1>
          <p className="mt-1 text-sm text-slate-500">SEO hướng lead, đơn hàng và trang chốt sale.</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {activeWorkflow?.phase}
        </div>
      </div>

      <WorkflowTabs activeTab={activeTab} onChange={(key) => {
        setActiveTab(key);
        setError('');
      }} />

      <WorkflowForm
        activeTab={activeTab}
        forms={forms}
        setForms={setForms}
        loading={loading}
        onSubmit={handleSubmit}
      />

      <ErrorBox error={error} />
      <Results activeTab={activeTab} data={results[activeTab]} loading={loading} />
    </div>
  );
}
