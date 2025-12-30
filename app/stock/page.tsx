'use client';

import { useEffect, useState } from 'react';

export default function StockPage() {
  const [strategy, setStrategy] = useState('底部暴力K线 (M60)');
  const [symbols, setSymbols] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState('');
  const [matches, setMatches] = useState<
    {
      symbol: string;
      date: string;
      close: number;
      change_pct: number;
      volume_ratio: number;
      turbulence_pct: number;
      min_price_m: number;
    }[]
  >([]);
  const [stats, setStats] = useState<{ total: number; matched: number }>({
    total: 0,
    matched: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [modelName, setModelName] = useState('');

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

  const handleAnalysis = async () => {
    if (!symbols.trim()) return;
    setLoading(true);
    setError(null);
    setResult('');
    setMatches([]);
    setStats({ total: 0, matched: 0 });

    try {
      const response = await fetch('/api/stock-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategy,
          symbols,
          notes,
          settings: {
            apiKey: apiKey.trim() || undefined,
            baseURL: baseURL.trim() || undefined,
            model: modelName.trim() || undefined,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || '分析失败');
        return;
      }

      setResult(data.analysis || '');
      setMatches(data.matches || []);
      setStats(data.stats || { total: 0, matched: 0 });
    } catch (analysisError) {
      console.error('Stock analysis error:', analysisError);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f3f3] text-black">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 md:px-8">
        <header>
          <p className="text-sm text-black/60">AI 工具</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold md:text-3xl">AI 选股工具</h1>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-xl border border-[#0d0d0d0d] px-3 py-2 text-xs text-black"
            >
              Settings
            </button>
          </div>
          <p className="mt-2 text-sm text-black/70">
            输入策略与股票池，生成策略解读与风险提示。
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-black/70">
                策略选择
                <select
                  value={strategy}
                  onChange={(event) => setStrategy(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#0d0d0d0d] bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="底部暴力K线 (M60)">底部暴力K线 (M60)</option>
                  <option value="趋势突破策略">趋势突破策略</option>
                  <option value="量价共振策略">量价共振策略</option>
                  <option value="AI 动态组合">AI 动态组合</option>
                </select>
              </label>

              <label className="text-sm text-black/70">
                股票池（逗号/空格分隔）
                <textarea
                  value={symbols}
                  onChange={(event) => setSymbols(event.target.value)}
                  rows={4}
                  placeholder="例如：600519 000001 300750"
                  className="mt-2 w-full rounded-xl border border-[#0d0d0d0d] bg-white px-3 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </label>
            </div>

            <label className="mt-4 text-sm text-black/70">
              补充说明（可选）
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="行业偏好、风险偏好、持仓周期等"
                className="mt-2 w-full rounded-xl border border-[#0d0d0d0d] bg-white px-3 py-2 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black"
              />
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleAnalysis}
                disabled={loading || !symbols.trim()}
                className="flex-1 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'AI 分析中...' : '生成分析报告'}
              </button>
              <button
                onClick={() => {
                  setSymbols('600519 000001 300750 000858');
                  setNotes('偏好消费与新能源，持仓周期 1-3 个月。');
                }}
                className="rounded-xl border border-[#0d0d0d0d] px-4 py-3 text-sm text-black"
              >
                填充示例
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-black/70">分析结果</p>
              <span className="text-xs text-black/40">
                命中 {stats.matched} / {stats.total}
              </span>
            </div>

            {error ? (
              <div className="rounded-xl border border-[#0d0d0d0d] bg-[#f3f3f3] p-3 text-sm text-black">
                {error}
              </div>
            ) : null}

            <div className="flex-1 rounded-xl border border-[#0d0d0d0d] bg-[#f3f3f3] p-4 text-sm text-black/80 whitespace-pre-wrap">
              {result || '提交股票池后，将输出策略解读、风险提示与观察要点。'}
            </div>

            <div className="rounded-xl border border-[#0d0d0d0d] bg-white p-4 text-sm text-black/70">
              <p className="text-sm font-medium text-black/70">策略命中列表</p>
              {matches.length === 0 ? (
                <p className="mt-2 text-xs text-black/50">暂无命中结果</p>
              ) : (
                <div className="mt-3 grid gap-2 text-xs text-black/70">
                  {matches.map((item) => (
                    <div
                      key={`${item.symbol}-${item.date}`}
                      className="rounded-lg border border-[#0d0d0d0d] bg-[#f3f3f3] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-black">
                          {item.symbol}
                        </span>
                        <span>{item.date}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <span>收盘价：{item.close}</span>
                        <span>涨幅：{item.change_pct}%</span>
                        <span>倍量：{item.volume_ratio}</span>
                        <span>震荡幅度：{item.turbulence_pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#0d0d0d0d] bg-white px-4 py-3 text-xs text-black/50">
              提示：此处为策略解读与风险分析，不构成投资建议。
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
                    placeholder="qwen-plus"
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
