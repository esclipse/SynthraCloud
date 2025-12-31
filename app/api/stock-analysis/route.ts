import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const DEFAULT_API_KEY = 'sk-2893a75c1cfd407aa601eab503ad918a';
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';

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

const buildPythonUrl = () => {
  const baseUrl = process.env.PYTHON_SERVICE_URL;
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, '')}/analyze`;
};

const parseJsonResponse = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const pythonUrl = buildPythonUrl();
  if (!pythonUrl) {
    return NextResponse.json(
      { error: 'PYTHON_SERVICE_URL is not configured' },
      { status: 500 }
    );
  }

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

    let analysis = '';
    if (aiPrompt && data?.matches && data.matches.length > 0) {
      try {
        const apiKey = settings?.apiKey || DEFAULT_API_KEY;
        const baseURL = settings?.baseURL || DEFAULT_BASE_URL;
        const model = settings?.model || DEFAULT_MODEL;

        const client = createClient(apiKey, baseURL);

        const stocksSummary = data.matches
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
  } catch (error) {
    console.error('Stock analysis proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to reach Python service' },
      { status: 502 }
    );
  }
}
