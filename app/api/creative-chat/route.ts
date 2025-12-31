import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const DEFAULT_API_KEY =
  process.env.OPENAI_API_KEY || 'sk-2893a75c1cfd407aa601eab503ad918a';
const DEFAULT_BASE_URL =
  process.env.OPENAI_BASE_URL ||
  'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'qwen3-plus';
const SYSTEM_PROMPT =
  '你是内容创作助手，请根据用户需求输出适合富文本编辑器的 HTML 片段。' +
  '输出仅包含正文内容，不要包含 markdown 代码块、标题之外的说明或外层 HTML/Body 标签。';

const createClient = (apiKey?: string, baseURL?: string) =>
  new OpenAI({
    apiKey: apiKey || DEFAULT_API_KEY,
    baseURL: baseURL || DEFAULT_BASE_URL,
  });

export async function POST(request: Request) {
  try {
    const { messages, settings } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing chat messages' },
        { status: 400 }
      );
    }

    const sanitizedMessages = messages
      .filter(
        (message) =>
          message &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    if (sanitizedMessages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid chat messages' },
        { status: 400 }
      );
    }

    const completion = await createClient(
      settings?.apiKey,
      settings?.baseURL
    ).chat.completions.create({
      model: settings?.model || DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        ...sanitizedMessages,
      ],
    });

    const assistantMessage = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ message: assistantMessage });
  } catch (error: any) {
    console.error('Creative chat error:', error);
    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to generate creative response',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
