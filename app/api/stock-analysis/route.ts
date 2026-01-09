import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 300;

const DEFAULT_API_KEY = 'sk-2893a75c1cfd407aa601eab503ad918a';
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';

type StockSelectionRequest = {
  symbols?: string | string[];
  strategy?: string;
  notes?: string;
  scoring?: {
    pe_max?: number;
    market_cap_min?: number;
    require_profit?: boolean;
  };
  score?: boolean;
  aiPrompt?: string;
  settings?: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
  };
};

const STOCK_SERVICE_URL = 'https://stock-pwmnqnqhcx.cn-hangzhou.fcapp.run';

const createClient = (apiKey?: string, baseURL?: string) =>
  new OpenAI({
    apiKey: apiKey || DEFAULT_API_KEY,
    baseURL: baseURL || DEFAULT_BASE_URL,
  });

const buildPythonUrl = () => STOCK_SERVICE_URL;

const normalizeStrategyInput = (strategy?: string) => {
  if (!strategy) return 'all';
  if (strategy === 'all' || strategy === '全部策略') return 'all';
  if (strategy === 's1' || strategy.includes('底部暴力')) return 's1';
  if (strategy === 's2' || strategy.includes('B2')) return 's2';
  if (strategy === 's3' || strategy.includes('ZG')) return 's3';
  if (strategy === 'strategy1') return 's1';
  if (strategy === 'strategy2') return 's2';
  if (strategy === 'strategy3') return 's3';
  return 'all';
};

const toResultKey = (strategy: string) => {
  if (strategy === 's1') return 'strategy1';
  if (strategy === 's2') return 'strategy2';
  if (strategy === 's3') return 'strategy3';
  return 'all';
};

const pickValue = (stock: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(stock, key)) {
      const value = stock[key];
      if (value !== undefined) {
        return value;
      }
    }
  }
  return undefined;
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/,/g, ''));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const buildMatch = (stock: Record<string, any>, strategyLabel?: string) => {
  const dateValue = pickValue(stock, ['date', '日期']);
  return {
    symbol: pickValue(stock, ['symbol', 'code', '股票代码']) || '',
    name: pickValue(stock, ['name', '股票名称', '名称']) || '',
    date:
      typeof dateValue === 'string'
        ? dateValue
        : new Date().toISOString().split('T')[0],
    close: toNumber(pickValue(stock, ['close', 'close_price', '收盘价'])),
    change_pct: toNumber(pickValue(stock, ['change_pct', '涨幅(%)', '涨幅'])),
    volume_ratio: toNumber(pickValue(stock, ['volume_ratio', '成交量倍数', '成交量比'])),
    turbulence_pct: toNumber(pickValue(stock, ['turbulence_pct', '震荡幅度(%)'])),
    min_price_m: toNumber(pickValue(stock, ['min_price_m', '最低价_M'])),
    pe_ttm: toNumber(pickValue(stock, ['pe_ttm', '市盈率'])),
    market_cap_billion: toNumber(
      pickValue(stock, ['market_cap_billion', '流通市值(亿)', '市值(亿)'])
    ),
    net_profit: toNumber(pickValue(stock, ['net_profit', '盈利'])),
    j_value: toNumber(pickValue(stock, ['j_value', 'J值'])),
    j_last: toNumber(pickValue(stock, ['j_last', 'J前一交易日', '前一交易日J值'])),
    strategy: strategyLabel,
  };
};

const mergeMatch = (base: Record<string, any>, incoming: Record<string, any>) => {
  const merged = { ...base };
  ([
    'close',
    'change_pct',
    'volume_ratio',
    'turbulence_pct',
    'min_price_m',
    'pe_ttm',
    'market_cap_billion',
    'net_profit',
    'j_value',
    'j_last',
  ] as const).forEach((key) => {
    if (merged[key] === null || merged[key] === undefined || merged[key] === 0) {
      const incomingValue = incoming[key];
      if (incomingValue !== null && incomingValue !== undefined) {
        merged[key] = incomingValue;
      }
    }
  });

  if (incoming.strategy) {
    if (merged.strategy) {
      const existing = merged.strategy.split(',').map((item: string) => item.trim());
      if (!existing.includes(incoming.strategy)) {
        merged.strategy = `${merged.strategy}, ${incoming.strategy}`;
      }
    } else {
      merged.strategy = incoming.strategy;
    }
  }

  return merged;
};

const parseCloudFunctionResponse = async (response: Response) => {
  try {
    const data = await response.json();
    if (data.body && typeof data.body === 'string') {
      return JSON.parse(data.body);
    }
    return data;
  } catch (error) {
    console.error('Failed to parse cloud function response:', error);
    return null;
  }
};

const convertCloudFunctionResult = (
  cloudResult: any,
  strategyKey: 'strategy1' | 'strategy2' | 'strategy3' | 'all'
) => {
  if (!cloudResult || !cloudResult.success) {
    return {
      matches: [],
      stats: { total: 0, matched: 0 },
    };
  }

  const results = cloudResult.results || {};
  const summary = cloudResult.summary || {};

  let matches: any[] = [];

  if (strategyKey === 'all') {
    const strategy1Results = (results.strategy1 || []).map((stock: Record<string, any>) =>
      buildMatch(stock, '策略1: 底部暴力K线')
    );

    const strategy2Results = (results.strategy2 || []).map((stock: Record<string, any>) =>
      buildMatch(stock, '策略2: B2选股策略')
    );

    const strategy3Results = (results.strategy3 || []).map((stock: Record<string, any>) =>
      buildMatch(stock, '策略3: ZG单针下20')
    );

    const stockMap = new Map<string, any>();

    [...strategy1Results, ...strategy2Results, ...strategy3Results].forEach((stock) => {
      const key = stock.symbol;
      if (stockMap.has(key)) {
        const existing = stockMap.get(key);
        stockMap.set(key, mergeMatch(existing, stock));
      } else {
        stockMap.set(key, stock);
      }
    });

    matches = Array.from(stockMap.values());
  } else {
    const strategyResults = results[strategyKey] || [];
    const labelMap: Record<string, string> = {
      strategy1: '策略1: 底部暴力K线',
      strategy2: '策略2: B2选股策略',
      strategy3: '策略3: ZG单针下20',
    };
    const label = labelMap[strategyKey];
    matches = strategyResults.map((stock: Record<string, any>) => buildMatch(stock, label));
  }

  return {
    matches,
    stats: {
      total: summary.total_analyzed || 0,
      matched: matches.length,
    },
  };
};

export async function POST(request: Request) {
  const pythonUrl = buildPythonUrl();

  let payload: StockSelectionRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { symbols, notes, scoring, score, aiPrompt, settings, strategy } = payload;
  const symbolsValue = Array.isArray(symbols)
    ? symbols.join(',').trim()
    : typeof symbols === 'string'
      ? symbols.trim()
      : '';
  const normalizedStrategy = normalizeStrategyInput(strategy);
  const strategyKey = toResultKey(normalizedStrategy) as
    | 'strategy1'
    | 'strategy2'
    | 'strategy3'
    | 'all';

  try {
    const controller = new AbortController();
    const hasSymbols = symbolsValue && symbolsValue.trim().length > 0;
    const timeout = hasSymbols ? 3 * 60 * 1000 : 15 * 60 * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response | null = null;
    let data: any = null;
    const maxRetries = 2;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);

        response = await fetch(pythonUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stock_count: 100,
            strategy: normalizedStrategy,
            symbols: symbolsValue || undefined,
            notes: notes || undefined,
            scoring: scoring || undefined,
            score: score !== undefined ? score : undefined,
          }),
          signal: retryController.signal,
          keepalive: true,
        });

        clearTimeout(retryTimeoutId);
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status >= 500 && retryCount < maxRetries) {
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
            continue;
          }

          const cloudResult = await parseCloudFunctionResponse(response);
          return NextResponse.json(
            {
              error: cloudResult?.error || `Failed to generate analysis (HTTP ${response.status})`,
              details: cloudResult?.details,
            },
            { status: response.status }
          );
        }

        const cloudResult = await parseCloudFunctionResponse(response);

        if (!cloudResult || !cloudResult.success) {
          return NextResponse.json(
            {
              error: cloudResult?.error || '云函数返回失败',
            },
            { status: 500 }
          );
        }

        const converted = convertCloudFunctionResult(cloudResult, strategyKey);
        data = {
          ...converted,
          summary: cloudResult?.summary,
        };

        break;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        const isRetryableError =
          fetchError.name === 'AbortError' ||
          fetchError.code === 'UND_ERR_HEADERS_TIMEOUT' ||
          fetchError.cause?.code === 'UND_ERR_HEADERS_TIMEOUT' ||
          fetchError.message?.includes('fetch failed') ||
          fetchError.message?.includes('ECONNREFUSED') ||
          fetchError.message?.includes('ETIMEDOUT');

        if (isRetryableError && retryCount < maxRetries) {
          retryCount++;
          await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
          continue;
        }

        throw fetchError;
      }
    }

    if (!response || !data) {
      throw new Error('Failed to get response after retries');
    }

    let analysis = '';
    if (aiPrompt && data?.matches && data.matches.length > 0) {
      try {
        const apiKey = settings?.apiKey || DEFAULT_API_KEY;
        const baseURL = settings?.baseURL || DEFAULT_BASE_URL;
        const model = settings?.model || DEFAULT_MODEL;

        const client = createClient(apiKey, baseURL);

        const formatValue = (value: unknown) => {
          if (value === null || value === undefined || value === '') return '--';
          if (typeof value === 'number') return Number.isNaN(value) ? '--' : value;
          return value;
        };

        const stocksSummary = data.matches
          .slice(0, 20)
          .map((stock: any) => {
            const info: string[] = [
              `${stock.name}(${stock.symbol})`,
              `收盘价: ${formatValue(stock.close)}`,
              `涨幅: ${formatValue(stock.change_pct)}%`,
              `倍量: ${formatValue(stock.volume_ratio)}`,
            ];
            if (stock.score !== undefined) {
              info.push(`评分: ${stock.score}/5`);
            }
            if (stock.pe_ttm !== null) {
              info.push(`市盈率: ${stock.pe_ttm}`);
            }
            if (stock.market_cap_billion !== null) {
              info.push(`市值: ${stock.market_cap_billion.toFixed(2)}亿`);
            }
            if (stock.score_reasons && stock.score_reasons.length > 0) {
              info.push(`评分依据: ${stock.score_reasons.join(', ')}`);
            }
            if (stock.j_value !== undefined) {
              info.push(`J值: ${stock.j_value}`);
            }
            if (stock.j_last !== undefined) {
              info.push(`前一日J值: ${stock.j_last}`);
            }
            return info.join(', ');
          })
          .join('\n');

        const userPrompt = `${aiPrompt}\n\n股票列表:\n${stocksSummary}\n\n请基于以上股票列表进行分析和评分。`;

        const completion = await client.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        analysis = completion.choices[0]?.message?.content || '';
      } catch (aiError: any) {
        console.error('AI analysis error:', aiError);
        analysis = 'AI分析生成失败，请查看下方股票评分详情。';
      }
    }

    return NextResponse.json({
      ...data,
      analysis,
    });
  } catch (error: any) {
    console.error('[Sync] Selection error:', error);

    if (error.name === 'AbortError' || error.code === 'UND_ERR_HEADERS_TIMEOUT') {
      return NextResponse.json(
        {
          error: '请求超时 - 选股分析耗时过长。建议：\n- 尝试指定具体的股票代码而不是全量分析\n- 稍后重试\n- 检查 Python 服务是否正常运行',
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || '无法连接到 Python 服务。请检查服务地址和网络连接。',
        details: error.stack?.substring(0, 200),
      },
      { status: 502 }
    );
  }
}
