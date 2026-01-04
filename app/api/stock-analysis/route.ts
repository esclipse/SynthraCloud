import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const DEFAULT_API_KEY = 'sk-2893a75c1cfd407aa601eab503ad918a';
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';

const DEFAULT_PYTHON_SERVICE_URL = 'https://stock-service-production-1754.up.railway.app';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

const createClient = (apiKey?: string, baseURL?: string) =>
  new OpenAI({
    apiKey: apiKey || DEFAULT_API_KEY,
    baseURL: baseURL || DEFAULT_BASE_URL,
  });

type StockAnalysisRequest = {
  strategy?: string;
  symbols?: string | string[];
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

type PollTokenPayload = {
  taskId: string;
  baseUrl: string;
  statusUrl?: string;
  resultUrl?: string;
  retryInMs?: number;
};

const buildPythonUrl = (path = '/analyze') => {
  const baseUrl = process.env.PYTHON_SERVICE_URL || DEFAULT_PYTHON_SERVICE_URL;
  const normalizedBase = baseUrl.replace(/\/$/, '');

  return `${normalizedBase}${path.startsWith('/') ? '' : '/'}${path}`;
};

const parseJsonResponse = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const decodePollToken = (token: string): PollTokenPayload | null => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    return JSON.parse(decoded) as PollTokenPayload;
  } catch {
    return null;
  }
};

const encodePollToken = (payload: PollTokenPayload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64');

const getTaskId = (data: any) => data?.task_id || data?.job_id || data?.id;

const buildStatusUrl = (payload: PollTokenPayload) => {
  if (payload.statusUrl) return payload.statusUrl;
  const base = payload.baseUrl.replace(/\/$/, '');

  return payload.taskId ? `${base}/status/${payload.taskId}` : null;
};

const buildResultUrl = (payload: PollTokenPayload) => {
  if (payload.resultUrl) return payload.resultUrl;
  const base = payload.baseUrl.replace(/\/$/, '');

  return payload.taskId ? `${base}/result/${payload.taskId}` : null;
};

const shouldContinuePolling = (data: any) => {
  const status = (data?.status || data?.state || '').toString().toLowerCase();

  if (Array.isArray(data?.matches) && data.matches.length > 0) return false;
  if (status === 'completed' || status === 'finished' || status === 'success' || status === 'ready')
    return false;

  return true;
};

const fetchAIAnalysis = async (
  aiPrompt: string,
  settings: StockAnalysisRequest['settings'],
  matches: any[]
) => {
  const apiKey = settings?.apiKey || DEFAULT_API_KEY;
  const baseURL = settings?.baseURL || DEFAULT_BASE_URL;
  const model = settings?.model || DEFAULT_MODEL;

  const client = createClient(apiKey, baseURL);

  const stocksSummary = matches
    .slice(0, 20)
    .map((stock: any) => {
      const info: string[] = [
        `${stock.name}(${stock.symbol})`,
        `收盘价: ${stock.close}`,
        `涨幅: ${stock.change_pct}%`,
        `倍量: ${stock.volume_ratio}`,
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

  return completion.choices[0]?.message?.content || '';
};

const fetchResultData = async (
  data: any,
  aiPrompt: string | undefined,
  settings: StockAnalysisRequest['settings']
) => {
  let analysis = '';
  if (aiPrompt && data?.matches && data.matches.length > 0) {
    try {
      analysis = await fetchAIAnalysis(aiPrompt, settings, data.matches);
    } catch (aiError: any) {
      console.error('AI analysis error:', aiError);
      analysis = 'AI分析生成失败，请查看下方股票评分详情。';
    }
  }

  return { ...data, analysis };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pollToken = searchParams.get('pollToken');

  if (!pollToken) {
    return NextResponse.json({ error: 'Missing poll token' }, { status: 400 });
  }

  const payload = decodePollToken(pollToken);

  if (!payload?.taskId || !payload.baseUrl) {
    return NextResponse.json({ error: 'Invalid poll token' }, { status: 400 });
  }

  const statusUrl = buildStatusUrl(payload);

  if (!statusUrl) {
    return NextResponse.json({ error: 'Unable to build status URL' }, { status: 400 });
  }

  try {
    const statusResponse = await fetch(statusUrl, { cache: 'no-store' });
    const statusData = await parseJsonResponse(statusResponse);

    if (!statusResponse.ok) {
      return NextResponse.json(
        {
          error: statusData?.error || 'Failed to fetch task status',
          details: statusData?.details,
        },
        { status: statusResponse.status }
      );
    }

    if (shouldContinuePolling(statusData)) {
      return NextResponse.json({
        polling: true,
        pollToken,
        status: statusData?.status || statusData?.state || 'pending',
        retryInMs: statusData?.retry_in_ms || payload.retryInMs || DEFAULT_POLL_INTERVAL_MS,
      });
    }

    if (Array.isArray(statusData?.matches) && statusData.matches.length > 0) {
      return NextResponse.json(statusData);
    }

    const resultUrl = buildResultUrl(payload);

    if (resultUrl) {
      const resultResponse = await fetch(resultUrl, { cache: 'no-store' });
      const resultData = await parseJsonResponse(resultResponse);

      if (!resultResponse.ok) {
        return NextResponse.json(
          {
            error: resultData?.error || 'Failed to fetch task result',
            details: resultData?.details,
          },
          { status: resultResponse.status }
        );
      }

      return NextResponse.json(resultData || statusData);
    }

    return NextResponse.json(statusData);
  } catch (error) {
    console.error('Stock analysis poll error:', error);
    return NextResponse.json({ error: 'Failed to poll Python service' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const pythonUrl = buildPythonUrl('analyze');

  let payload: StockAnalysisRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { strategy, symbols, notes, scoring, score, aiPrompt, settings } = payload;
  const strategyValue = typeof strategy === 'string' ? strategy.trim() : '';
  const symbolsValue = Array.isArray(symbols)
    ? symbols.join(',').trim()
    : typeof symbols === 'string'
      ? symbols.trim()
      : '';

  try {
    const response = await fetch(pythonUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strategy: strategyValue,
        symbols: symbolsValue,
        notes,
        scoring: scoring || undefined,
        score: score !== undefined ? score : undefined,
      }),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data?.error || 'Failed to generate analysis',
          details: data?.details,
        },
        { status: response.status }
      );
    }

    const taskId = getTaskId(data);
    const hasMatches = Array.isArray(data?.matches) && data.matches.length > 0;

    if (!hasMatches && taskId) {
      const pollToken = encodePollToken({
        taskId,
        baseUrl: buildPythonUrl('').replace(/\/$/, ''),
        statusUrl: data?.status_url,
        resultUrl: data?.result_url,
        retryInMs: data?.retry_in_ms,
      });

      return NextResponse.json({
        polling: true,
        pollToken,
        status: data?.status || data?.state || 'pending',
        retryInMs: data?.retry_in_ms || DEFAULT_POLL_INTERVAL_MS,
      });
    }

    if (!hasMatches && data?.result_url) {
      const resultResponse = await fetch(data.result_url, { cache: 'no-store' });
      const resultData = await parseJsonResponse(resultResponse);

      if (!resultResponse.ok) {
        return NextResponse.json(
          {
            error: resultData?.error || 'Failed to fetch task result',
            details: resultData?.details,
          },
          { status: resultResponse.status }
        );
      }

      return NextResponse.json(await fetchResultData(resultData, aiPrompt, settings));
    }

    return NextResponse.json(await fetchResultData(data, aiPrompt, settings));
  } catch (error) {
    console.error('Stock analysis proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to reach Python service' },
      { status: 502 }
    );
  }
}
