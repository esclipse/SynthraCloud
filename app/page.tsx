'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight,
  Loader2,
  Copy,
  Check,
  Globe,
  Sparkles,
  Code2,
  FileType,
} from 'lucide-react';
import Editor from '@/components/Editor';
import { PRESET_CONTENT } from '@/data/preset';
import { marked } from 'marked';

const TARGET_LANGUAGES = [
  { code: 'German', label: 'German (Deutsch)', flag: '🇩🇪' },
  { code: 'French', label: 'French (Français)', flag: '🇫🇷' },
  { code: 'Russian', label: 'Russian (Русский)', flag: '🇷🇺' },
];

type TranslationState = {
  [key: string]: {
    content: string;
    isLoading: boolean;
    error: string | null;
  };
};

type DetectedFormat = 'html' | 'markdown' | null;

export default function Home() {
  const [inputContent, setInputContent] = useState('');
  const [translations, setTranslations] = useState<TranslationState>(
    TARGET_LANGUAGES.reduce(
      (acc, lang) => ({
        ...acc,
        [lang.code]: { content: '', isLoading: false, error: null },
      }),
      {}
    )
  );

  // Active tab for viewing results
  const [activeTab, setActiveTab] = useState(TARGET_LANGUAGES[0].code);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const [stockStrategy, setStockStrategy] = useState('底部暴力K线 (M60)');
  const [stockSymbols, setStockSymbols] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [stockResult, setStockResult] = useState('');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'stock' | 'translate'>('stock');

  // Format Detection State
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat>(null);
  const [showFormatPrompt, setShowFormatPrompt] = useState(false);
  const [rawTextContent, setRawTextContent] = useState('');

  // Check for Raw HTML/Markdown in the text content
  useEffect(() => {
    // Debounce detection to avoid performance issues during typing/pasting
    const timeoutId = setTimeout(() => {
      if (!inputContent) {
        setShowFormatPrompt(false);
        return;
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = inputContent;
      const text = tempDiv.textContent || '';
      setRawTextContent(text);

      // Simplified Heuristics for detection to avoid ReDoS
      // HTML: Starts with <tag ...> or <tag />
      const htmlPattern = /<\s*[a-z][^>]*>/i;
      // Markdown: Common patterns like # Heading, **bold**, - list, [link](url)
      const markdownPattern =
        /^\s*(#{1,6}\s|\*\s|-\s|>\s|1\.\s)|(\[.+\]\(.+\))|(\*\*.+\*\*)|(`{3})/m;

      if (htmlPattern.test(text)) {
        setDetectedFormat('html');
        setShowFormatPrompt(true);
      } else if (markdownPattern.test(text)) {
        setDetectedFormat('markdown');
        setShowFormatPrompt(true);
      } else {
        setShowFormatPrompt(false);
        setDetectedFormat(null);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [inputContent]);

  const handleFormatConversion = async () => {
    if (!detectedFormat) return;

    if (detectedFormat === 'html') {
      // If it's HTML, we just set the visible text as the new editor HTML value
      // The editor will parse it and render it
      setInputContent(rawTextContent);
    } else if (detectedFormat === 'markdown') {
      // If it's Markdown, we parse it to HTML first
      try {
        const html = await marked.parse(rawTextContent);
        setInputContent(html);
      } catch (error) {
        console.error('Markdown parsing error:', error);
        alert('Failed to parse Markdown');
      }
    }
    setShowFormatPrompt(false);
  };

  const handleTranslateAll = async () => {
    // Basic check for empty content (simple HTML might just be <p><br></p>)
    const cleanText = inputContent.replace(/<[^>]*>/g, '').trim();
    if (!cleanText && !inputContent.includes('<img')) return;

    setIsTranslatingAll(true);

    // Reset and start loading for all languages
    setTranslations((prev) => {
      const next = { ...prev };
      TARGET_LANGUAGES.forEach((lang) => {
        next[lang.code] = { ...next[lang.code], isLoading: true, error: null };
      });
      return next;
    });

    // Fire requests concurrently
    const promises = TARGET_LANGUAGES.map(async (lang) => {
      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: inputContent,
            targetLanguage: lang.code,
          }),
        });

        const data = await response.json();

        setTranslations((prev) => ({
          ...prev,
          [lang.code]: {
            content: response.ok ? data.translatedContent : '',
            isLoading: false,
            error: response.ok ? null : data.error || 'Translation failed',
          },
        }));
      } catch (error) {
        console.error(`Error translating to ${lang.code}:`, error);
        setTranslations((prev) => ({
          ...prev,
          [lang.code]: {
            content: '',
            isLoading: false,
            error: 'Network error',
          },
        }));
      }
    });

    await Promise.all(promises);
    setIsTranslatingAll(false);
  };

  const copyToClipboard = async () => {
    const currentContent = translations[activeTab]?.content;
    if (!currentContent) return;
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const loadPreset = () => {
    setInputContent(PRESET_CONTENT);
  };

  const handleStockAnalysis = async () => {
    if (!stockSymbols.trim()) return;
    setStockLoading(true);
    setStockError(null);
    setStockResult('');

    try {
      const response = await fetch('/api/stock-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategy: stockStrategy,
          symbols: stockSymbols,
          notes: stockNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStockError(data.error || '分析失败');
        setStockLoading(false);
        return;
      }

      setStockResult(data.analysis || '');
    } catch (error) {
      console.error('Stock analysis error:', error);
      setStockError('网络错误，请稍后重试');
    } finally {
      setStockLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_45%),radial-gradient(circle_at_25%_25%,_rgba(16,185,129,0.18),_transparent_40%)]" />
      <div className="relative">
        <header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <Globe className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-semibold">AgentHub</p>
              <p className="text-xs text-blue-200/70">整合平台 · AI 工具集</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
            <span className="hover:text-white transition-colors">Agent 集合</span>
            <span className="hover:text-white transition-colors">AI 工具</span>
            <span className="hover:text-white transition-colors">解决方案</span>
            <button className="px-4 py-2 rounded-full bg-white text-slate-900 font-semibold shadow-lg shadow-blue-500/20">
              立即体验
            </button>
          </nav>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
          <section className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-blue-100">
                <Sparkles className="w-4 h-4 text-blue-300" />
                AI+ 工具矩阵 · Agent 一站式调度
              </div>
              <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
                面向团队的 AI 整合平台，<br />
                一次构建，处处可用。
              </h1>
              <p className="text-base sm:text-lg text-slate-200/80">
                集成高效 Agent、精选 AI 工具与工作流，让内容运营、智能投研、研发协作更轻松。
                当前已上线 AI 选股与翻译工具，更多 AI+ 能力持续扩展。
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold shadow-lg shadow-blue-500/30">
                  立即体验 AI 选股
                </button>
                <button className="px-6 py-3 rounded-xl border border-white/20 text-white/90 hover:bg-white/10">
                  查看 Agent 目录
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm text-white/80">
                {[
                  { label: '可用 Agent', value: '24+' },
                  { label: '工具模块', value: '32' },
                  { label: '企业团队', value: '120+' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="text-xl font-semibold text-white">{item.value}</p>
                    <p className="text-xs text-white/60">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm text-white/60">工作台速览</p>
                <h2 className="text-2xl font-semibold mt-2">统一调度中心</h2>
                <div className="mt-6 space-y-4">
                  {[
                    {
                      title: '内容本地化',
                      desc: '多语言翻译、润色、格式保留。',
                    },
                    {
                      title: '智能工作流',
                      desc: '自动分配 Agent 与工具编排。',
                    },
                    {
                      title: '交付看板',
                      desc: '追踪任务状态与内容版本。',
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl bg-slate-900/60 border border-white/10 p-4"
                    >
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-white/60 mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-blue-500/30 via-indigo-500/20 to-emerald-500/20 p-6">
                <p className="text-sm text-white/70">AI 选股引擎已上线</p>
                <p className="text-lg font-semibold mt-1">多策略筛选 + AI 解析报告</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-white/70">
                  <span className="px-3 py-1 rounded-full bg-white/10">策略可组合</span>
                  <span className="px-3 py-1 rounded-full bg-white/10">信号自动解读</span>
                  <span className="px-3 py-1 rounded-full bg-white/10">风险提示</span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid lg:grid-cols-3 gap-6">
            {[
              {
                title: '精选 Agent 集合',
                desc: '覆盖内容、研发、增长、客服等多场景，让团队随时调度最合适的智能协作伙伴。',
              },
              {
                title: 'AI 工具小站',
                desc: '沉淀高频工具，如翻译、总结、校对与分析，让日常流程更高效。',
              },
              {
                title: '统一权限与品牌',
                desc: '统一身份、权限与品牌视觉，让工具体验更一致、更易扩展。',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3"
              >
                <p className="text-lg font-semibold">{item.title}</p>
                <p className="text-sm text-white/70 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-blue-200/80">工具工作台</p>
                <h2 className="text-2xl font-semibold">AI+ 核心工具快速启动</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-white/70">
                <span className="px-3 py-1 rounded-full bg-white/10">统一 key + url 接入</span>
                <span className="px-3 py-1 rounded-full bg-white/10">多策略可扩展</span>
                <span className="px-3 py-1 rounded-full bg-white/10">结果可复盘</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActiveTool('stock')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTool === 'stock'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                AI 选股引擎
              </button>
              <button
                onClick={() => setActiveTool('translate')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTool === 'translate'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                AI 翻译工具
              </button>
            </div>

            {activeTool === 'stock' ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="flex flex-col gap-4 rounded-2xl bg-slate-950/60 border border-white/10 p-4 md:p-6">
                  <div>
                    <p className="text-lg font-semibold">多策略选股 + AI 解读</p>
                    <p className="text-sm text-white/60 mt-1">
                      基于 Akshare 数据源与底部暴力 K 线策略，结合 AI 输出趋势与风险摘要。
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-white/70">
                      策略选择
                      <select
                        value={stockStrategy}
                        onChange={(event) => setStockStrategy(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option className="text-slate-900" value="底部暴力K线 (M60)">
                          底部暴力K线 (M60)
                        </option>
                        <option className="text-slate-900" value="趋势突破策略">
                          趋势突破策略
                        </option>
                        <option className="text-slate-900" value="量价共振策略">
                          量价共振策略
                        </option>
                        <option className="text-slate-900" value="AI 动态组合">
                          AI 动态组合
                        </option>
                      </select>
                    </label>
                    <label className="text-sm text-white/70">
                      股票池（逗号/空格分隔）
                      <textarea
                        value={stockSymbols}
                        onChange={(event) => setStockSymbols(event.target.value)}
                        rows={4}
                        placeholder="例如：600519 000001 300750"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </div>

                  <label className="text-sm text-white/70">
                    补充说明（可选）
                    <textarea
                      value={stockNotes}
                      onChange={(event) => setStockNotes(event.target.value)}
                      rows={3}
                      placeholder="可填写行业偏好、风险偏好、持仓周期等"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleStockAnalysis}
                      disabled={stockLoading || !stockSymbols.trim()}
                      className="flex-1 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {stockLoading ? 'AI 正在分析中...' : '生成 AI 分析报告'}
                    </button>
                    <button
                      onClick={() => {
                        setStockSymbols('600519 000001 300750 000858');
                        setStockNotes('偏好消费与新能源，持仓周期 1-3 个月。');
                      }}
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/80 hover:bg-white/10"
                    >
                      填充示例
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 rounded-2xl bg-white border border-white/10 p-4 md:p-6 text-slate-900">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">AI 输出</p>
                    <span className="text-xs text-slate-500">接入现有 key + url</span>
                  </div>

                  {stockError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                      {stockError}
                    </div>
                  ) : null}

                  <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
                    {stockResult ||
                      '提交股票池后，AI 将输出策略触发逻辑、风险提示与建议关注的信号。'}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                    提示：此处为策略解读与风险分析，不构成投资建议。
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4 rounded-2xl bg-slate-950/60 border border-white/10 p-4 md:p-6">
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <label htmlFor="input" className="font-medium text-white">
                      源内容
                    </label>
                    <button
                      onClick={loadPreset}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-blue-100 bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                      title="加载示例内容"
                    >
                      <Sparkles className="w-4 h-4" /> 加载示例
                    </button>
                  </div>

                  <div className="flex-1 overflow-hidden rounded-2xl border border-white/10 relative flex flex-col bg-white">
                    {showFormatPrompt && (
                      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                          {detectedFormat === 'html' ? (
                            <Code2 className="w-5 h-5 text-amber-600" />
                          ) : (
                            <FileType className="w-5 h-5 text-amber-600" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-amber-800">
                              检测到{' '}
                              {detectedFormat === 'html' ? 'HTML' : 'Markdown'}
                              原始格式
                            </p>
                            <p className="text-xs text-amber-600">
                              是否转换为可编辑富文本？
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowFormatPrompt(false)}
                            className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 rounded-md transition-colors"
                          >
                            忽略
                          </button>
                          <button
                            onClick={handleFormatConversion}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-sm transition-colors"
                          >
                            转换并展示
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex-1">
                      <Editor
                        value={inputContent}
                        onChange={setInputContent}
                        placeholder="请输入或粘贴内容..."
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleTranslateAll}
                    disabled={
                      isTranslatingAll ||
                      (!inputContent.trim() && !inputContent.includes('<img'))
                    }
                    className="w-full py-3 rounded-xl bg-blue-500 text-white font-semibold text-base hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    {isTranslatingAll ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        正在翻译 {TARGET_LANGUAGES.length} 种语言...
                      </>
                    ) : (
                      <>
                        一键翻译全部语言 <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col gap-4 rounded-2xl bg-slate-950/60 border border-white/10 p-4 md:p-6">
                  <div className="flex flex-col gap-3 border-b border-white/10 pb-4">
                    <p className="text-sm text-white/70">翻译结果</p>
                    <div className="flex flex-wrap gap-2">
                      {TARGET_LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => setActiveTab(lang.code)}
                          className={`
                          flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                          ${
                            activeTab === lang.code
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                              : 'bg-white/10 text-white/70 hover:bg-white/20'
                          }
                        `}
                        >
                          <span>{lang.flag}</span>
                          {lang.label}
                          {translations[lang.code].isLoading && (
                            <Loader2 className="w-3 h-3 animate-spin ml-1" />
                          )}
                          {translations[lang.code].content &&
                            !translations[lang.code].isLoading && (
                              <Check className="w-3 h-3 text-emerald-300 ml-1" />
                            )}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={copyToClipboard}
                      disabled={!translations[activeTab]?.content}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50 transition-colors self-start"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" /> 已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> 复制内容
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative flex-1 rounded-2xl border border-white/10 overflow-hidden bg-white">
                    {translations[activeTab].isLoading ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-white/80 backdrop-blur-sm z-10">
                        <Loader2 className="w-10 h-10 animate-spin mb-2 text-blue-500" />
                        <p>
                          正在翻译至{' '}
                          {TARGET_LANGUAGES.find((l) => l.code === activeTab)
                            ?.label}
                          ...
                        </p>
                      </div>
                    ) : null}

                    {translations[activeTab].error ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 bg-red-50 p-8 text-center z-10">
                        <p className="font-semibold text-lg">翻译失败</p>
                        <p className="text-sm mt-2">
                          {translations[activeTab].error}
                        </p>
                      </div>
                    ) : null}

                    <Editor
                      value={translations[activeTab].content}
                      readOnly={true}
                      placeholder={`译文将展示在这里（${
                        TARGET_LANGUAGES.find((l) => l.code === activeTab)?.label
                      }）...`}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
