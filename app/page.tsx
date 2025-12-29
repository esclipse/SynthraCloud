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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <main className="max-w-[1600px] mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 flex items-center justify-center gap-3">
            <Globe className="w-10 h-10 text-blue-600" />
            Global Content Localizer
          </h1>
          <p className="text-lg text-gray-600">
            Auto-translate your rich text content into multiple languages instantly.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
          {/* Left Column: Input */}
          <div className="flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center">
              <label htmlFor="input" className="text-lg font-semibold text-gray-800">
                Source Content
              </label>
              <button
                onClick={loadPreset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                title="Load example content with images and formatting"
              >
                <Sparkles className="w-4 h-4" /> Load Preset Case
              </button>
            </div>

            <div className="flex-1 overflow-hidden rounded-lg border border-gray-300 relative flex flex-col">
              {showFormatPrompt && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    {detectedFormat === 'html' ? (
                      <Code2 className="w-5 h-5 text-amber-600" />
                    ) : (
                      <FileType className="w-5 h-5 text-amber-600" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        Detected raw {detectedFormat === 'html' ? 'HTML' : 'Markdown'}
                        content
                      </p>
                      <p className="text-xs text-amber-600">
                        Do you want to convert it to rich text format?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFormatPrompt(false)}
                      className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 rounded-md transition-colors"
                    >
                      Ignore
                    </button>
                    <button
                      onClick={handleFormatConversion}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-sm transition-colors"
                    >
                      Convert & Display
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1">
                <Editor
                  value={inputContent}
                  onChange={setInputContent}
                  placeholder="Type or paste your content here..."
                />
              </div>
            </div>

            <button
              onClick={handleTranslateAll}
              disabled={isTranslatingAll || (!inputContent.trim() && !inputContent.includes('<img'))}
              className="w-full py-4 rounded-lg bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {isTranslatingAll ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Translating to {TARGET_LANGUAGES.length} Languages...
                </>
              ) : (
                <>
                  Translate to All Languages <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>
          </div>

          {/* Right Column: Multi-language Output */}
          <div className="flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                {TARGET_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setActiveTab(lang.code)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                      ${
                        activeTab === lang.code
                          ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                        <Check className="w-3 h-3 text-green-500 ml-1" />
                      )}
                  </button>
                ))}
              </div>

              <button
                onClick={copyToClipboard}
                disabled={!translations[activeTab]?.content}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors ml-4 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy
                  </>
                )}
              </button>
            </div>

            <div className="relative flex-1 rounded-lg border border-gray-300 overflow-hidden">
              {translations[activeTab].isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 backdrop-blur-sm z-10">
                  <Loader2 className="w-10 h-10 animate-spin mb-2 text-blue-500" />
                  <p>
                    Translating to{' '}
                    {TARGET_LANGUAGES.find((l) => l.code === activeTab)?.label}...
                  </p>
                </div>
              ) : null}

              {translations[activeTab].error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 bg-red-50 p-8 text-center z-10">
                  <p className="font-semibold text-lg">Translation Failed</p>
                  <p className="text-sm mt-2">{translations[activeTab].error}</p>
                </div>
              ) : null}

              <Editor
                value={translations[activeTab].content}
                readOnly={true}
                placeholder={`Translation for ${TARGET_LANGUAGES.find((l) => l.code === activeTab)?.label} will appear here...`}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
