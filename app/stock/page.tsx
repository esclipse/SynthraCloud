'use client';

import { useEffect, useState } from 'react';

export default function StockPage() {
  const [strategy, setStrategy] = useState('s1');
  const [result, setResult] = useState('');
  const [matches, setMatches] = useState<
    {
      symbol: string;
      name: string;
      date: string;
      close: number | null;
      change_pct: number | null;
      volume_ratio: number | null;
      turbulence_pct: number | null;
      min_price_m: number | null;
      score?: number;
      pe_ttm: number | null;
      market_cap_billion: number | null;
      net_profit: number | null;
      score_reasons?: string[];
      strategy?: string;
      j_value?: number;
      j_last?: number;
    }[]
  >([]);
  const [stats, setStats] = useState<{ total: number; matched: number }>({
    total: 0,
    matched: 0,
  });
  const [summary, setSummary] = useState<{
    total_analyzed?: number;
    strategy_counts?: Record<string, number>;
  } | null>(null);
  const [scoreEnabled, setScoreEnabled] = useState(false);
  const scoring = {
    peMax: 150,
    marketCapMin: 100,
    requireProfit: true,
  };
  const defaultPrompt =
    '请基于策略命中的股票列表，结合市盈率、市值、盈利情况进行评分，输出0-5分，并给出排序建议。';
  const [aiPrompt, setAiPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [modelName, setModelName] = useState('');
  const [symbolsInput, setSymbolsInput] = useState('');

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

  const runAnalysis = async (body: any) => {
    setLoading(true);
    setError(null);
    setResult('');
    setMatches([]);
    setStats({ total: 0, matched: 0 });
    setSummary(null);
    setScoreEnabled(false);

    try {
      const response = await fetch('/api/stock-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || '分析失败');
        return;
      }

      setResult(data.analysis || '');
      setMatches(data.matches || []);
      setStats(data.stats || { total: 0, matched: 0 });
      setSummary(data.summary || null);
      setScoreEnabled(Boolean(data.scoreEnabled));
    } catch (analysisError: any) {
      console.error('Stock analysis error:', analysisError);
      setError(analysisError?.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleStrategyRun = async () => {
    await runAnalysis({
      strategy,
      symbols: symbolsInput.trim(),
      notes: '',
      scoring: {
        pe_max: scoring.peMax,
        market_cap_min: scoring.marketCapMin,
        require_profit: scoring.requireProfit,
      },
      score: false,
    });
  };

  const handleAllStrategiesRun = async () => {
    await runAnalysis({
      strategy: 'all',
      symbols: symbolsInput.trim(),
      notes: '',
      scoring: {
        pe_max: scoring.peMax,
        market_cap_min: scoring.marketCapMin,
        require_profit: scoring.requireProfit,
      },
      score: false,
    });
  };

  const handleScore = async () => {
    if (matches.length === 0) return;

    await runAnalysis({
      strategy,
      symbols: symbolsInput.trim() || matches.map((match) => match.symbol).join(','),
      notes: '',
      scoring: {
        pe_max: scoring.peMax,
        market_cap_min: scoring.marketCapMin,
        require_profit: scoring.requireProfit,
      },
      score: true,
      aiPrompt,
      settings: {
        apiKey: apiKey.trim() || undefined,
        baseURL: baseURL.trim() || undefined,
        model: modelName.trim() || undefined,
      },
    });
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
                  <option value="s1">策略1：底部暴力K线</option>
                  <option value="s2">策略2：B2选股策略</option>
                  <option value="s3">策略3：ZG单针下20</option>
                </select>
              </label>
              <label className="text-sm text-black/70">
                指定股票代码（可选）
                <input
                  value={symbolsInput}
                  onChange={(event) => setSymbolsInput(event.target.value)}
                  placeholder="如 600519, 000001"
                  className="mt-2 w-full rounded-xl border border-[#0d0d0d0d] bg-white px-3 py-2 text-sm text-black placeholder:text-black/40"
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-[#0d0d0d0d] bg-[#f3f3f3] p-4 text-sm text-black/70">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-black/70">评分 Prompt</p>
                <button
                  onClick={() => setAiPrompt(defaultPrompt)}
                  className="rounded-lg border border-[#0d0d0d0d] px-2 py-1 text-xs text-black/70"
                >
                  恢复默认
                </button>
              </div>
              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                rows={4}
                className="mt-3 w-full rounded-xl border border-[#0d0d0d0d] bg-white px-3 py-2 text-sm text-black placeholder:text-black/40"
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleStrategyRun}
                disabled={loading}
                className="flex-1 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? '执行中...' : '执行策略'}
              </button>
              <button
                onClick={handleAllStrategiesRun}
                disabled={loading}
                className="flex-1 rounded-xl border border-[#0d0d0d0d] px-4 py-3 text-sm text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                一键执行全部策略
              </button>
              <button
                onClick={handleScore}
                disabled={loading || matches.length === 0}
                className="flex-1 rounded-xl border border-[#0d0d0d0d] px-4 py-3 text-sm text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                AI 评分
              </button>
              <button
                onClick={() => setAiPrompt(defaultPrompt)}
                className="rounded-xl border border-[#0d0d0d0d] px-4 py-3 text-sm text-black"
              >
                使用默认 Prompt
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-black/70">股票排行榜</p>
              <span className="text-xs text-black/40">
                命中 {stats.matched} / {stats.total}
              </span>
            </div>

            {error ? (
              <div className="rounded-xl border border-[#0d0d0d0d] bg-[#f3f3f3] p-3 text-sm text-black">
                {error}
              </div>
            ) : null}

            <div className="rounded-xl border border-[#0d0d0d0d] bg-white p-4 text-sm text-black/70">
              {matches.length === 0 ? (
                <p className="text-xs text-black/50">
                  {loading ? '分析中，请稍候...' : '暂无命中结果'}
                </p>
              ) : (
                <div className="grid gap-2 text-xs text-black/70">
                  {matches.map((item) => (
                    <div
                      key={`${item.symbol}-${item.date}`}
                      className="rounded-lg border border-[#0d0d0d0d] bg-[#f3f3f3] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-black">
                          {item.name}
                        </span>
                        <span className="text-black/60">{item.symbol}</span>
                      </div>
                      {item.strategy ? (
                        <div className="mt-1 text-[11px] text-black/50">
                          {item.strategy}
                        </div>
                      ) : null}
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <span>收盘价：{item.close ?? '--'}</span>
                        <span>
                          涨幅：
                          {item.change_pct !== null && item.change_pct !== undefined
                            ? `${item.change_pct}%`
                            : '--'}
                        </span>
                        <span>倍量：{item.volume_ratio ?? '--'}</span>
                        <span>
                          震荡幅度：
                          {item.turbulence_pct !== null && item.turbulence_pct !== undefined
                            ? `${item.turbulence_pct}%`
                            : '--'}
                        </span>
                        {scoreEnabled ? (
                          <>
                            <span>评分：{item.score ?? 0}</span>
                            <span>
                              市盈率：{item.pe_ttm !== null ? item.pe_ttm : '--'}
                            </span>
                            <span>
                              市值（亿）：
                              {item.market_cap_billion !== null
                                ? item.market_cap_billion.toFixed(2)
                                : '--'}
                            </span>
                            <span>
                              盈利：{item.net_profit !== null ? '是' : '--'}
                            </span>
                          </>
                        ) : null}
                        {item.j_value !== undefined ? (
                          <span>J值：{item.j_value}</span>
                        ) : null}
                        {item.j_last !== undefined ? (
                          <span>前一日J值：{item.j_last}</span>
                        ) : null}
                      </div>
                      {scoreEnabled && item.score_reasons?.length ? (
                        <div className="mt-2 text-[11px] text-black/50">
                          评分依据：{item.score_reasons.join(' / ')}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-black/70">AI 分析摘要</h2>
            {summary?.total_analyzed ? (
              <span className="text-xs text-black/40">
                已分析 {summary.total_analyzed} 只股票
              </span>
            ) : null}
          </div>
          <div className="mt-4 rounded-xl border border-[#0d0d0d0d] bg-[#f3f3f3] p-4 text-sm text-black/70">
            {result ? (
              <p className="whitespace-pre-wrap text-sm text-black/80">{result}</p>
            ) : (
              <p className="text-xs text-black/50">
                {loading ? 'AI 分析生成中...' : '暂无分析内容'}
              </p>
            )}
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
