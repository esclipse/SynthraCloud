import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const DEFAULT_API_KEY = 'sk-rX3L6olaIfp2yYILAy1EWbgYI0bLebutNUJrrVKdeBLSlvJM';
const DEFAULT_BASE_URL = 'https://geekai.co/api/v1';
const DEFAULT_MODEL = 'qwen-mt-turbo';

const createClient = (apiKey?: string, baseURL?: string) =>
  new OpenAI({
    apiKey: apiKey || DEFAULT_API_KEY,
    baseURL: baseURL || DEFAULT_BASE_URL,
  });

export async function POST(request: Request) {
  try {
    const { content, targetLanguage, settings } = await request.json();

    if (!content || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing content or target language' },
        { status: 400 }
      );
    }

    // 1. Optimize: Replace Base64 images with placeholders to reduce token usage and avoid API limits
    const imageMap: Record<string, string> = {};
    let imgCounter = 0;

    const contentToTranslate = content.replace(
      /src="(data:image\/[^\"]+)"/g,
      (match: string, p1: string) => {
        const placeholder = `__IMG_PLACEHOLDER_${imgCounter++}__`;
        imageMap[placeholder] = p1;
        return `src="${placeholder}"`;
      }
    );

    // 2. Call API with optimized content
    // qwen-mt-turbo requires a specific structure with translation_options in extra_body
    // and does NOT support system messages.
    const completion = await createClient(
      settings?.apiKey,
      settings?.baseURL
    ).chat.completions.create({
      model: settings?.model || DEFAULT_MODEL,
      messages: [
        {
          role: 'user',
          content: contentToTranslate,
        },
      ],
      extra_body: {
        translation_options: {
          source_lang: 'auto',
          target_lang: targetLanguage,
        },
      },
    } as any);

    let translatedContent = completion.choices[0]?.message?.content || '';

    // 3. Restore Base64 images from placeholders
    Object.keys(imageMap).forEach((placeholder) => {
      // Use split/join to replace all occurrences if any (though logic suggests unique placeholders)
      translatedContent = translatedContent
        .split(placeholder)
        .join(imageMap[placeholder]);
    });

    return NextResponse.json({ translatedContent });
  } catch (error: any) {
    console.error('Translation error:', error);
    // Extract more specific error info if available
    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to translate content',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
