import { NextResponse } from 'next/server';

type StockAnalysisRequest = {
  strategy?: string;
  symbols?: string | string[];
  notes?: string;
};

const DEFAULT_PYTHON_SERVICE_URL = 'https://stock-service-vi7q.onrender.com';

const buildPythonUrl = () => {
  const baseUrl = process.env.PYTHON_SERVICE_URL || DEFAULT_PYTHON_SERVICE_URL;

  return `${baseUrl.replace(/\/$/, '')}/api/stock-analysis`;
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

  let payload: StockAnalysisRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { strategy, symbols, notes } = payload;
  const strategyValue = typeof strategy === 'string' ? strategy.trim() : '';
  const symbolsValue = Array.isArray(symbols)
    ? symbols.join(',').trim()
    : typeof symbols === 'string'
      ? symbols.trim()
      : '';

  if (!symbolsValue) {
    return NextResponse.json({ error: 'Missing symbols' }, { status: 400 });
  }

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

    return NextResponse.json(data ?? { analysis: '' });
  } catch (error) {
    console.error('Stock analysis proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to reach Python service' },
      { status: 502 }
    );
  }
}
