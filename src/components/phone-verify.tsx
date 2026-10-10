"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "./icon";
import { SpinLoader } from "./spin-mark";
import { SAY } from "@/lib/messages";

/*
 * Verifying a phone over WhatsApp: the person sends a code to Wanlly's number and this dialog
 * waits until the server has seen it. Open it from anywhere with openPhoneVerify().
 */

const EVENT = "wanlly:verify-phone";
export const openPhoneVerify = () => window.dispatchEvent(new Event(EVENT));

type Code = { code: string; link: string };

export function PhoneVerifyDialog() {
  const { dispatch } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<Code | null>(null);
  const [error, setError] = useState("");

  const fetchCode = async () => {
    setError("");
    const r = await fetch("/api/me/phone", { method: "POST" }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    if (r?.ok) setCode(b as Code);
    else setError(b?.error ?? SAY.offline);
  };

  useEffect(() => {
    const onOpen = async () => {
      const s = await fetch("/api/me/phone", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null);
      if (s?.verified) return;
      if (s && !s.whatsapp) return dispatch({ type: "toast", text: "Number verification opens soon. Keep earning meanwhile." });
      setCode(null);
      setOpen(true);
      void fetchCode();
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [dispatch]);

  // While the dialog is open, check every few seconds whether the message has arrived.
  useEffect(() => {
    if (!open || !code) return;
    const started = Date.now();
    const iv = window.setInterval(async () => {
      if (Date.now() - started > 30 * 60 * 1000) return window.clearInterval(iv);
      const s = await fetch("/api/me/phone", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null);
      if (!s?.verified) return;
      window.clearInterval(iv);
      setOpen(false);
      dispatch({ type: "toast", text: "Number verified. Keep watching to earn." });
    }, 3000);
    return () => window.clearInterval(iv);
  }, [open, code, dispatch]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(8_9_12/0.45)]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[20px] border border-line bg-surface p-5 text-fg shadow-soft">
          <header className="flex items-start gap-3">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold tracking-[-0.02em]">Verify on WhatsApp</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[13px] text-muted">
                One message keeps earning fair: each number counts for one account. We never message you or show your number to anyone.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="ml-auto grid size-[34px] shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg">
              <Icon name="x" />
            </Dialog.Close>
          </header>
          {error ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-bad">{error}</p>
              <button type="button" onClick={fetchCode} className="w-fit rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-faint">
                Try again
              </button>
            </div>
          ) : !code ? (
            <p className="text-[13px] text-muted">Making your code…</p>
          ) : (
            <>
              <ol className="flex flex-col gap-2 text-[13px] text-muted">
                <li>
                  <b className="font-medium text-fg">1.</b> Tap the button. WhatsApp opens with your code typed in.
                </li>
                <li>
                  <b className="font-medium text-fg">2.</b> Press send, then come back here.
                </li>
              </ol>
              <div className="rounded-xl border border-line bg-bg px-4 py-3 text-center font-mono text-xl font-semibold tracking-[0.12em]">{code.code}</div>
              <a
                href={code.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90"
              >
                Open WhatsApp
              </a>
              <p className="flex items-center gap-2 text-xs text-faint" role="status" aria-live="polite">
                <SpinLoader size={12} label="" className="text-accent" />
                Waiting for your message. The code works for 30 minutes.
                <button type="button" onClick={fetchCode} className="ml-auto shrink-0 text-muted underline-offset-2 hover:text-fg hover:underline">
                  New code
                </button>
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
