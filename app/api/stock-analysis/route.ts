import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-rX3L6olaIfp2yYILAy1EWbgYI0bLebutNUJrrVKdeBLSlvJM',
  baseURL: 'https://geekai.co/api/v1',
});

export async function POST(request: Request) {
  try {
    const { strategy, symbols, notes } = await request.json();

    if (!strategy || !symbols) {
      return NextResponse.json(
        { error: 'Missing strategy or symbols' },
        { status: 400 }
      );
    }

    const prompt = `
你是量化策略与投资风险分析助手。请基于以下信息输出中文分析报告（使用小标题与要点）：

【策略】
${strategy}

【股票池】
${symbols}

【补充说明】
${notes || '无'}

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

    const completion = await client.chat.completions.create({
      model: 'qwen-plus',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    } as any);

    const analysis = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ analysis });
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
