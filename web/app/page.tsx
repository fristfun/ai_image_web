import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container-page space-y-4">
      <h1 className="text-2xl font-bold">AI 生图网站（MVP）</h1>
      <p className="text-slate-600">支持提示词 + 参考图生成，含钱包冻结扣费与后台管理骨架。</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/generate" className="rounded-md bg-slate-900 px-4 py-2 text-white">
          进入生成台
        </Link>
        <Link href="/admin" className="rounded-md border border-slate-300 px-4 py-2">
          进入后台
        </Link>
      </div>
    </main>
  );
}
