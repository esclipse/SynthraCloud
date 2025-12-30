import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const DEFAULT_API_KEY = 'sk-rX3L6olaIfp2yYILAy1EWbgYI0bLebutNUJrrVKdeBLSlvJM';
const DEFAULT_BASE_URL = 'https://geekai.co/api/v1';
const DEFAULT_MODEL = 'qwen-plus';
const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

const createClient = (apiKey?: string, baseURL?: string) =>
  new OpenAI({
    apiKey: apiKey || DEFAULT_API_KEY,
    baseURL: baseURL || DEFAULT_BASE_URL,
  });

export async function POST(request: Request) {
  try {
    const { strategy, symbols, notes, settings, scoring, mode, aiPrompt } =
      await request.json();

    if (!strategy) {
      return NextResponse.json(
        { error: 'Missing strategy' },
        { status: 400 }
      );
    }

    const shouldScore = mode !== 'strategy';
    const strategyResponse = await fetch(`${PYTHON_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strategy,
        symbols,
        notes,
        scoring,
        score: shouldScore,
      }),
    });

    if (!strategyResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch strategy results' },
        { status: 500 }
      );
    }

    const strategyResult = await strategyResponse.json();

    const prompt = `
你是量化策略与投资风险分析助手。请基于以下信息输出中文分析报告（使用小标题与要点）：

【策略】
${strategy}

【股票池】
${symbols}

【补充说明】
${notes || '无'}

【评分标准】
- 市盈率上限：${strategyResult?.scoring?.pe_max ?? 150}
- 市值下限（亿）：${strategyResult?.scoring?.market_cap_min ?? 100}
- 盈利要求：${strategyResult?.scoring?.require_profit ? '是' : '否'}

【评分指令】
${aiPrompt || '使用默认评分逻辑进行排序与打分。'}

【策略结果】
总样本数：${strategyResult?.stats?.total ?? 0}
命中数量：${strategyResult?.stats?.matched ?? 0}
命中列表：
${(strategyResult?.matches || [])
  .map(
    (item: any) =>
      `- ${item.symbol} | 评分 ${item.score ?? 0} | 收盘 ${item.close} | 涨幅 ${
        item.change_pct
      }%`
  )
  .join('\n')}

【策略算法参考】
- 使用 Akshare 获取最近 M=60 天日线数据
- 识别底部位置（相对底部或震荡幅度达标）
- 触发条件：长阳（涨幅>5%且收盘>开盘）、突兀（前3日震荡幅度<1.03）、倍量（成交量倍数>=4）
- 满足“底部位置 + 长阳 + 突兀 + 倍量”时判定信号

输出要求：
1. 给出策略信号解读、风险提示、适用场景
2. 对股票池给出整体趋势判断与观察要点（不需要真实数据，可给分析框架）
3. 附上后续动作建议（如补充指标、观察周期）
4. 明确提醒：内容仅供研究，不构成投资建议
`;

    let analysis = '';
    if (
      shouldScore &&
      (settings?.apiKey || settings?.baseURL || settings?.model)
    ) {
      const completion = await createClient(
        settings?.apiKey,
        settings?.baseURL
      ).chat.completions.create({
        model: settings?.model || DEFAULT_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      } as any);
      analysis = completion.choices[0]?.message?.content || '';
    }

    return NextResponse.json({
      analysis,
      matches: strategyResult?.matches || [],
      stats: strategyResult?.stats || { total: 0, matched: 0 },
      scoring: strategyResult?.scoring || {
        pe_max: 150,
        market_cap_min: 100,
        require_profit: true,
      },
      scoreEnabled: strategyResult?.score_enabled ?? shouldScore,
    });
  } catch (error: any) {
    console.error('Stock analysis error:', error);
    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to generate analysis',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
