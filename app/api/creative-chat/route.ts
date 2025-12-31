import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const DEFAULT_API_KEY = 'sk-2893a75c1cfd407aa601eab503ad918a';
const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';
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
        (message: { role?: string; content?: string }) =>
          message &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
      )
      .map((message: { role?: string; content?: string }) => ({
        role: message.role,
        content: message.content,
      }));

    if (sanitizedMessages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid chat messages' },
        { status: 400 }
      );
    }

    const apiKey = settings?.apiKey || DEFAULT_API_KEY;
    const baseURL = settings?.baseURL || DEFAULT_BASE_URL;
    const model = settings?.model || DEFAULT_MODEL;

    console.log('Creative chat request:', {
      model,
      baseURL,
      hasApiKey: !!apiKey,
      messageCount: sanitizedMessages.length,
    });

    const client = createClient(apiKey, baseURL);

    const stream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        ...sanitizedMessages,
      ],
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: error?.message || 'Stream error' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Creative chat error:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      response: error?.response
        ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          }
        : undefined,
      stack: error?.stack,
    });

    let errorMessage = 'Unknown error';
    let statusCode = 500;

    if (error?.message) {
      errorMessage = error.message;
    }

    if (error?.response?.data) {
      const data = error.response.data;
      if (typeof data === 'string') {
        errorMessage = data;
      } else if (data?.error?.message) {
        errorMessage = data.error.message;
      } else if (data?.error) {
        errorMessage =
          typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      }
      statusCode = error.response.status || 500;
    } else if (error?.status) {
      statusCode = error.status;
    }

    if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      errorMessage = '无法连接到 API 服务器，请检查网络连接和 baseURL 配置';
      statusCode = 503;
    } else if (error?.status === 401) {
      errorMessage = 'API 密钥无效，请检查配置';
      statusCode = 401;
    } else if (error?.status === 429) {
      errorMessage = 'API 请求频率过高，请稍后重试';
      statusCode = 429;
    }

    return NextResponse.json(
      {
        error: 'Failed to generate creative response',
        details: errorMessage,
      },
      { status: statusCode }
    );
  }
}
