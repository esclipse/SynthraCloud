'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Loader2, SendHorizonal } from 'lucide-react';
import { marked } from 'marked';
import Editor from '@/components/Editor';
import { PRESET_CONTENT } from '@/data/preset';

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

type ChatMessage = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
};

export default function TranslatePage() {
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
  const [activeTab, setActiveTab] = useState(TARGET_LANGUAGES[0].code);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat>(null);
  const [showFormatPrompt, setShowFormatPrompt] = useState(false);
  const [rawTextContent, setRawTextContent] = useState('');

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [modelName, setModelName] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!inputContent) {
        setShowFormatPrompt(false);
        return;
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = inputContent;
      const text = tempDiv.textContent || '';
      setRawTextContent(text);

      const htmlPattern = /<\s*[a-z][^>]*>/i;
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
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [inputContent]);

  useEffect(() => {
    const stored = localStorage.getItem('toolSettings');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setApiKey(parsed.apiKey || '');
      setBaseURL(parsed.baseURL || '');
      setModelName(parsed.model || '');
    } catch (loadError) {
      console.error('Failed to load settings:', loadError);
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem(
      'toolSettings',
      JSON.stringify({
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim(),
        model: modelName.trim(),
      })
    );
    setSettingsOpen(false);
  };

  const handleFormatConversion = async () => {
    if (!detectedFormat) return;

    if (detectedFormat === 'html') {
      setInputContent(rawTextContent);
    } else if (detectedFormat === 'markdown') {
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
    const cleanText = inputContent.replace(/<[^>]*>/g, '').trim();
    if (!cleanText && !inputContent.includes('<img')) return;

    setIsTranslatingAll(true);
    setTranslations((prev) => {
      const next = { ...prev };
      TARGET_LANGUAGES.forEach((lang) => {
        next[lang.code] = { ...next[lang.code], isLoading: true, error: null };
      });
      return next;
    });

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
          settings: {
            apiKey: apiKey.trim() || undefined,
            baseURL: baseURL.trim() || undefined,
            model: modelName.trim() || undefined,
          },
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

  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isChatting) return;
    const message: ChatMessage = {
      id: `${Date.now()}-user`,
      content: trimmed,
      role: 'user',
    };
    const nextMessages = [...chatMessages, message];
    setChatMessages(nextMessages);
    setChatInput('');
    setIsChatting(true);
    setChatError('');

    try {
      const response = await fetch('/api/creative-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: nextMessages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          settings: {
            apiKey: apiKey.trim() || undefined,
            baseURL: baseURL.trim() || undefined,
            model: modelName.trim() || undefined,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '聊天请求失败');
      }

      const assistantContent = String(data.message || '').trim();
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        content: assistantContent,
        role: 'assistant',
      };
      setChatMessages((prev) => [...prev, assistantMessage]);

      if (assistantContent) {
        const hasHtml = /<\/?[a-z][\s\S]*>/i.test(assistantContent);
        const htmlContent = hasHtml
          ? assistantContent
          : `<p>${assistantContent}</p>`;
        setInputContent((prev) => `${prev}${htmlContent}`);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatError('AI 聊天服务暂时不可用，请稍后重试。');
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f3f3] text-black">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-8">
        <header>
          <p className="text-sm text-black/60">AI 工具</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold md:text-3xl">AI 创作工具</h1>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-xl border border-[#0d0d0d0d] px-3 py-2 text-xs text-black"
            >
              Settings
            </button>
          </div>
          <p className="mt-2 text-sm text-black/70">
            输入富文本内容或对话指令，生成文章并批量输出多语版本。
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between text-sm text-black/70">
              <span className="font-medium text-black">源内容</span>
              <button
                onClick={loadPreset}
                className="rounded-xl border border-[#0d0d0d0d] px-3 py-1.5 text-xs text-black"
              >
                加载示例
              </button>
            </div>

            <div className="flex-1 overflow-hidden rounded-2xl border border-[#0d0d0d0d] bg-white">
              {showFormatPrompt && (
                <div className="flex flex-col gap-3 border-b border-[#0d0d0d0d] bg-[#f3f3f3] px-4 py-3 text-xs text-black/70 md:flex-row md:items-center md:justify-between">
                  <div>
                    检测到 {detectedFormat === 'html' ? 'HTML' : 'Markdown'} 原始格式，
                    是否转换为可编辑富文本？
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFormatPrompt(false)}
                      className="rounded-lg border border-[#0d0d0d0d] px-3 py-1"
                    >
                      关闭
                    </button>
                    <button
                      onClick={handleFormatConversion}
                      className="rounded-lg bg-black px-3 py-1 text-white"
                    >
                      转换
                    </button>
                  </div>
                </div>
              )}

              <Editor
                value={inputContent}
                onChange={setInputContent}
                placeholder="请输入或粘贴内容..."
              />
            </div>

            <button
              onClick={handleTranslateAll}
              disabled={
                isTranslatingAll ||
                (!inputContent.trim() && !inputContent.includes('<img'))
              }
              className="rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isTranslatingAll ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在翻译 {TARGET_LANGUAGES.length} 种语言...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  一键翻译全部语言 <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {TARGET_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setActiveTab(lang.code)}
                  className={`rounded-full px-4 py-2 text-sm ${
                    activeTab === lang.code
                      ? 'bg-black text-white'
                      : 'border border-[#0d0d0d0d] text-black/70'
                  }`}
                >
                  <span>{lang.flag}</span> {lang.label}
                </button>
              ))}
            </div>

            <button
              onClick={copyToClipboard}
              disabled={!translations[activeTab]?.content}
              className="inline-flex items-center gap-2 rounded-xl border border-[#0d0d0d0d] px-3 py-2 text-xs text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> 已复制
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> 复制内容
                </>
              )}
            </button>

            <div className="relative flex-1 overflow-hidden rounded-2xl border border-[#0d0d0d0d] bg-white">
              {translations[activeTab].isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 text-sm text-black/70">
                  <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                  正在翻译中...
                </div>
              ) : null}

              {translations[activeTab].error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f3f3f3] text-sm text-black">
                  {translations[activeTab].error}
                </div>
              ) : null}

              <Editor
                value={translations[activeTab].content}
                readOnly={true}
                placeholder={`译文将展示在这里（${TARGET_LANGUAGES.find(
                  (l) => l.code === activeTab
                )?.label}）...`}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">在线创作联动</h2>
          <p className="mt-1 text-sm text-black/70">
            将创作需求输入聊天框，AI 会生成内容并自动追加到左侧编辑器中。
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-2xl border border-[#0d0d0d0d] bg-[#f3f3f3] p-4 text-sm text-black/70">
              {chatMessages.length === 0
                ? '暂无聊天内容'
                : chatMessages.map((message) => (
                    <p
                      key={message.id}
                      className={`mb-2 flex items-start gap-2 last:mb-0 ${
                        message.role === 'assistant'
                          ? 'text-black'
                          : 'text-black/80'
                      }`}
                    >
                      <span className="text-xs font-semibold uppercase">
                        {message.role === 'assistant' ? 'AI' : '你'}
                      </span>
                      <span>{message.content}</span>
                    </p>
                  ))}
            </div>
            {chatError ? (
              <p className="text-sm text-red-600">{chatError}</p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleChatSend();
                  }
                }}
                placeholder="输入创作需求，回车发送..."
                className="flex-1 rounded-xl border border-[#0d0d0d0d] px-3 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black"
              />
              <button
                onClick={handleChatSend}
                disabled={isChatting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChatting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    发送
                    <SendHorizonal className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {settingsOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">模型接入设置</h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg border border-[#0d0d0d0d] px-2 py-1 text-xs text-black/70"
                >
                  Close
                </button>
              </div>
              <p className="mt-2 text-sm text-black/60">
                不填写将默认使用平台内置服务。
              </p>
              <div className="mt-4 grid gap-3">
                <label className="text-sm text-black/70">
                  Base URL
                  <input
                    value={baseURL}
                    onChange={(event) => setBaseURL(event.target.value)}
                    placeholder="https://example.com/v1"
                    className="mt-2 w-full rounded-xl border border-[#0d0d0d0d] px-3 py-2 text-sm text-black placeholder:text-black/40"
                  />
                </label>
                <label className="text-sm text-black/70">
                  API Key
                  <input
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="sk-..."
                    className="mt-2 w-full rounded-xl border border-[#0d0d0d0d] px-3 py-2 text-sm text-black placeholder:text-black/40"
                  />
                </label>
                <label className="text-sm text-black/70">
                  模型名称
                  <input
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    placeholder="qwen-mt-turbo"
                    className="mt-2 w-full rounded-xl border border-[#0d0d0d0d] px-3 py-2 text-sm text-black placeholder:text-black/40"
                  />
                </label>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  保存设置
                </button>
                <button
                  onClick={() => {
                    setApiKey('');
                    setBaseURL('');
                    setModelName('');
                  }}
                  className="rounded-xl border border-[#0d0d0d0d] px-4 py-2 text-sm text-black"
                >
                  重置
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
