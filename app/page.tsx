"use client";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Product = {
  title: string;
  price: string;
  link: string;
  source?: string;
  image?: string;
};

type BotResponse = {
  reply?: string;
  query?: string;
  products?: Product[];
  error?: string;
  stage?: "daraz" | "related" | "none";
  relatedQueries?: string[];
};

type ChatEntry = {
  user: string;
  bot: BotResponse;
};

const quickPrompts = [
  "iPhone 17 Pro Max",
  "Samsung Galaxy S25 Ultra",
  "Sony WH-1000XM5",
  "MacBook Air M3",
];

const stageLabelMap: Record<NonNullable<BotResponse["stage"]>, string> = {
  daraz: "Daraz match",
  related: "Related products",
  none: "No exact match",
};

const stageToneMap: Record<NonNullable<BotResponse["stage"]>, string> = {
  daraz: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/20",
  related: "bg-amber-500/15 text-amber-800 ring-amber-500/20",
  none: "bg-slate-500/15 text-slate-700 ring-slate-500/20",
};

const sourceSections = [
  { source: "Daraz", label: "Daraz products", accent: "from-emerald-400 to-teal-300" },
  { source: "Related (Daraz)", label: "Related products", accent: "from-amber-300 to-orange-300" },
];

function ProductVisual({ title, image }: { title: string; image?: string }) {
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  if (image) {
    return (
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <Image src={image} alt={title} fill unoptimized className="object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-amber-300/25 via-white/10 to-sky-300/20 text-lg font-semibold text-white">
      {initials || "AI"}
    </div>
  );
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, loading]);

  const groupProducts = (products?: Product[]) => {
    if (!products?.length) return [];

    return sourceSections
      .map((section) => ({
        ...section,
        items: products.filter((product) => product.source === section.source),
      }))
      .filter((section) => section.items.length > 0);
  };

  const sendMessage = async () => {
    const userMessage = message.trim();
    if (!userMessage || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = (await res.json()) as BotResponse;

      setChat((prev) => [...prev, { user: userMessage, bot: data }]);
      setMessage("");
    } catch {
      setChat((prev) => [
        ...prev,
        {
          user: userMessage,
          bot: {
            error: "Unable to connect to chatbot API.",
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fillPrompt = (prompt: string) => {
    if (loading) return;
    setSelectedPrompt(prompt);
    setMessage(prompt);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#081120] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_24%),linear-gradient(180deg,#09101c_0%,#050914_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-size-[72px_72px] mask-[radial-gradient(circle_at_center,black,transparent_85%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center p-3 sm:p-5 lg:p-6">
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-4xl border border-white/10 bg-white/6 shadow-[0_30px_100px_rgba(2,6,23,0.55)] backdrop-blur-2xl sm:h-[calc(100dvh-2.5rem)]"
        >
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:px-7">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/85">
                Product search assistant
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Ask for the exact item and get focused results.
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                Search Daraz first and fall back to related Daraz products when the exact item is unavailable.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]" />
              Gemini + Daraz
            </div>
          </header>

          <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-4 py-3 sm:px-6 lg:px-7">
            <span className="shrink-0 text-xs uppercase tracking-[0.24em] text-slate-400">Quick picks</span>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => fillPrompt(prompt)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${selectedPrompt === prompt ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"}`}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="chat-scroll flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6">
            <AnimatePresence initial={false}>
              {chat.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mx-auto flex min-h-[55vh] max-w-2xl flex-col items-center justify-center rounded-4xl border border-dashed border-white/12 bg-white/4 px-6 py-12 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-300/20">
                    <span className="text-lg font-semibold">AI</span>
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Start with a product name.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                    Try an exact query like <span className="font-semibold text-white">iPhone 17 Pro Max</span> or use a quick pick above to see ranked product cards and source links.
                  </p>
                </motion.div>
              ) : null}

              {chat.map((entry, index) => {
                const stage = entry.bot.stage || "none";
                const stageLabel = stageLabelMap[stage];
                const stageTone = stageToneMap[stage];

                return (
                  <motion.div
                    key={`${entry.user}-${index}`}
                    layout
                    initial={{ opacity: 0, y: 18, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="mb-5 space-y-3"
                  >
                    <div className="ml-auto max-w-[92%] rounded-3xl rounded-tr-md border border-white/10 bg-white px-4 py-3 text-slate-950 shadow-lg shadow-black/10 sm:max-w-[78%]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">You</p>
                      <p className="mt-1 text-sm leading-6 sm:text-[15px]">{entry.user}</p>
                    </div>

                    <div className="max-w-[96%] rounded-3xl rounded-tl-md border border-white/10 bg-slate-950/80 p-4 shadow-[0_18px_40px_rgba(2,6,23,0.35)] sm:max-w-[88%] sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${stageTone}`}>
                          {stageLabel}
                        </span>
                        {entry.bot.query ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                            Query: {entry.bot.query}
                          </span>
                        ) : null}
                      </div>

                      {entry.bot.reply ? <p className="mt-3 text-sm leading-7 text-slate-200 sm:text-[15px]">{entry.bot.reply}</p> : null}
                      {entry.bot.error ? <p className="mt-3 text-sm leading-7 text-red-300">{entry.bot.error}</p> : null}

                      {entry.bot.relatedQueries?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {entry.bot.relatedQueries.map((related) => (
                            <span key={related} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                              {related}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {entry.bot.products?.length ? (
                        <div className="mt-5 space-y-5">
                          {groupProducts(entry.bot.products).map((section) => (
                            <div key={section.source} className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span className={`h-2.5 w-2.5 rounded-full bg-linear-to-r ${section.accent}`} />
                                  <p className="text-sm font-semibold text-white">{section.label}</p>
                                </div>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                  {section.items.length}
                                </span>
                              </div>

                              <div className="grid gap-3">
                                {section.items.map((product) => (
                                  <motion.article
                                    key={`${product.source}-${product.link}-${product.title}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="h-full w-full rounded-3xl border border-white/10 bg-white/4 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                  >
                                    <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center">
                                      <ProductVisual title={product.title} image={product.image} />

                                      <div className="min-w-0 flex-1">
                                        <div className="flex h-full flex-col items-start gap-2">
                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white sm:text-base">{product.title}</p>
                                            <p className="mt-2 text-sm text-slate-300">{product.price}</p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                                              {product.source || "Daraz"}
                                            </p>
                                          </div>

                                          <a
                                            href={product.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-950 underline decoration-slate-950/70 decoration-2 underline-offset-4 transition hover:decoration-slate-950"
                                          >
                                            View Product
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.article>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {!entry.bot.products?.length && !entry.bot.error ? (
                        <p className="mt-4 text-sm text-slate-400">No product cards returned.</p>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {loading ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[88%] rounded-3xl rounded-tl-md border border-white/10 bg-white/4 p-4"
              >
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-300/90" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300/90 [animation-delay:120ms]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300/90 [animation-delay:240ms]" />
                  </div>
                  <span className="text-sm">Analyzing exact product query...</span>
                </div>
              </motion.div>
            ) : null}

            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-white/10 bg-slate-950/55 p-3 sm:p-4">
            <form
              className="rounded-[26px] border border-white/10 bg-white/5 p-3 shadow-[0_10px_30px_rgba(2,6,23,0.2)]"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Search for an exact product, e.g. iPhone 17 Pro Max"
                  className="h-12 flex-1 rounded-full border border-white/10 bg-slate-950/80 px-5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50"
                />

                <motion.button
                  type="submit"
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  disabled={loading}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Searching..." : "Search"}
                </motion.button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 px-3 py-1">Daraz exact match first</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Related Daraz fallback</span>
              </div>
            </form>
          </div>
        </motion.section>
      </div>
    </main>
  );
}