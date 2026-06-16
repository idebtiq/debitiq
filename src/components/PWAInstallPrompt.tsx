"use client";

import { Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type Language = "ar" | "en";

const dismissedKey = "debtiq.pwa.installPromptSeen.v1";

function isIosSafari() {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent;
  const isIos =
    /iphone|ipad|ipod/i.test(userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios|opr|mercury/i.test(userAgent);

  return isIos && isSafari;
}

function isStandalone() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function PWAInstallPrompt({ language }: { language: Language }) {
  const [visible, setVisible] = useState(false);
  const isArabic = language === "ar";

  useEffect(() => {
    if (!isIosSafari() || isStandalone()) return;
    if (window.localStorage.getItem(dismissedKey) === "1") return;

    setVisible(true);
  }, []);

  function close(remember: boolean) {
    if (remember || typeof window !== "undefined") window.localStorage.setItem(dismissedKey, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const content = isArabic
    ? {
        title: "أضف DebtiQ إلى الشاشة الرئيسية",
        description: "للحصول على تجربة أسرع وأكثر سلاسة، أضف DebtiQ إلى الشاشة الرئيسية لهاتفك.",
        steps: ["اضغط زر المشاركة", 'اختر "إضافة إلى الشاشة الرئيسية"', 'اضغط "إضافة"'],
        gotIt: "فهمت",
        dontShow: "لا تظهر مجددًا",
        badge: "تجربة تطبيق أسرع",
      }
    : {
        title: "Install DebtiQ on your Home Screen",
        description: "For a faster app-like experience, add DebtiQ to your Home Screen.",
        steps: ["Tap the Share button", 'Select "Add to Home Screen"', 'Tap "Add"'],
        gotIt: "Got it",
        dontShow: "Don't show again",
        badge: "Faster app experience",
      };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:bottom-6 sm:px-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-[#081522]/95 dark:shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div className="relative p-5">
          <button
            aria-label={isArabic ? "إغلاق" : "Close"}
            className={`absolute top-4 grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-mint hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white ${
              isArabic ? "left-4" : "right-4"
            }`}
            onClick={() => close(false)}
            type="button"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3 pe-10">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink text-lg font-black text-mint shadow-[0_18px_48px_rgba(56,214,163,0.25)] dark:bg-mint dark:text-ink">
              DQ
            </div>
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-mint">
                <Smartphone size={13} />
                {content.badge}
              </p>
              <h2 className="mt-3 text-xl font-black leading-tight text-ink dark:text-white">{content.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{content.description}</p>
            </div>
          </div>

          <ol className="mt-5 grid gap-2">
            {content.steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint/15 text-xs font-black text-emerald-700 dark:bg-mint/20 dark:text-mint">
                  {index + 1}
                </span>
                <span className="flex-1">{step}</span>
                {index === 0 && <Share size={16} className="shrink-0 text-mint" aria-hidden="true" />}
              </li>
            ))}
          </ol>

          <p className="mt-3 rounded-xl bg-mint/10 px-3 py-2 text-xs font-black text-emerald-700 dark:text-mint">
            {isArabic ? "إذا كانت الأيقونة موجودة مسبقاً، لا تضفها مرة أخرى." : "If the icon already exists, do not add it again."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              className="h-11 rounded-xl bg-ink px-4 text-sm font-black text-white transition hover:-translate-y-0.5 dark:bg-mint dark:text-ink"
              onClick={() => close(false)}
              type="button"
            >
              {content.gotIt}
            </button>
            <button
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-mint dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              onClick={() => close(true)}
              type="button"
            >
              {content.dontShow}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
