import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f3f3f3] text-black">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 md:px-8">
        <header className="space-y-3">
          <p className="text-sm text-black/60">AI 工具整合平台</p>
          <h1 className="text-3xl font-semibold md:text-4xl">
            让团队快速使用 AI 工具与 Agent
          </h1>
          <p className="text-base text-black/70">
            目前支持 AI 选股与 AI 创作工具，提供真实可用的工作流入口。
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">AI 选股</h2>
            <p className="mt-2 text-sm text-black/70">
              使用策略与股票池生成 AI 解析报告，支持底部暴力 K 线等策略。
            </p>
            <Link
              href="/stock"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              进入选股工具
            </Link>
          </article>

          <article className="rounded-2xl border border-[#0d0d0d0d] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">AI 创作</h2>
            <p className="mt-2 text-sm text-black/70">
              支持富文本内容生成与翻译，适配内容创作与多语言发布。
            </p>
            <Link
              href="/translate"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
            >
              进入创作工具
            </Link>
          </article>
        </section>

      </main>
    </div>
  );
}
