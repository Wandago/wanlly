"use client";

import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import type { BuildFile } from "@/lib/build-preview";
import { SAY } from "@/lib/messages";
import { useLocalSetting } from "@/lib/use-local-setting";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";

/** Sending the app out: publishing it at /s/<name>, and saving it to the person's GitHub. */
export function BuildShip({ id, files, name }: { id: number; files: BuildFile[]; name: string }) {
  const { user } = useUser();
  const { dispatch } = useWorkspace();
  const [repo, setRepo] = useLocalSetting(`wanlly-build-repo-${id}`, "");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  useEffect(() => {
    fetch(`/api/build/${id}/publish`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => setLive(b.url ?? null))
      .catch(() => {});
  }, [id]);
  const publish = async () => {
    setPublishing(true);
    try {
      const r = await fetch(`/api/build/${id}/publish`, { method: "POST" });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? SAY.busy);
      setLive(b.url);
      dispatch({ type: "toast", text: live ? "Your live app is updated" : "Your app is live" });
      window.open(b.url, "_blank", "noopener");
    } catch (e) {
      dispatch({ type: "toast", text: e instanceof Error ? e.message : SAY.offline });
    } finally {
      setPublishing(false);
    }
  };
  const unpublish = async () => {
    if (!window.confirm("Take the app offline? Its link stops working until you publish again.")) return;
    await fetch(`/api/build/${id}/publish`, { method: "DELETE" }).catch(() => {});
    setLive(null);
  };

  // GitHub: a small panel to connect the account and pick (or paste) the repository.
  const [ghOpen, setGhOpen] = useState(false);
  const [gh, setGh] = useState<{ ready: boolean; connected: boolean; login: string | null } | null>(null);
  const [draftRepo, setDraftRepo] = useState("");
  const [ghError, setGhError] = useState("");
  const checkGithub = useCallback(async () => {
    const r = await fetch(`/api/build/${id}/github`, { cache: "no-store" }).catch(() => null);
    const b = r?.ok ? await r.json().catch(() => null) : null;
    setGh(b ? { ready: !!b.ready, connected: !!b.connected, login: b.login ?? null } : { ready: false, connected: false, login: null });
  }, [id]);
  const openGithub = useCallback(
    (repoHint?: string) => {
      setGhError("");
      setDraftRepo(repoHint || repo || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-app");
      setGhOpen(true);
      void checkGithub();
    },
    [repo, name, checkGithub],
  );
  // The Builder opens this panel when someone asks to push to GitHub or pastes a repository link,
  // and again after they come back from allowing GitHub.
  useEffect(() => {
    const onAsk = (e: Event) => openGithub((e as CustomEvent<{ repo?: string }>).detail?.repo);
    window.addEventListener("wanlly:github", onAsk);
    let back = false;
    try {
      back = sessionStorage.getItem(`wanlly-gh-connect-${id}`) === "1";
      sessionStorage.removeItem(`wanlly-gh-connect-${id}`);
    } catch {}
    // Sent here from a chat's "Save to GitHub": open the panel, with their repository link if any.
    const asked = new URL(window.location.href).searchParams.get("github");
    if (asked) {
      const url = new URL(window.location.href);
      url.searchParams.delete("github");
      window.history.replaceState(null, "", url.toString());
    }
    if (back || asked) queueMicrotask(() => openGithub(asked && asked !== "1" ? asked : undefined));
    return () => window.removeEventListener("wanlly:github", onAsk);
  }, [id, openGithub]);

  const connectGithub = async () => {
    setGhError("");
    try {
      const account = user?.externalAccounts.find((a) => a.provider.replace("oauth_", "") === "github");
      const back = window.location.href;
      const acct = account ? await account.reauthorize({ additionalScopes: ["repo"], redirectUrl: back }) : await user?.createExternalAccount({ strategy: "oauth_github", additionalScopes: ["repo"], redirectUrl: back });
      const url = acct?.verification?.externalVerificationRedirectURL;
      if (!url) throw new Error("GitHub didn't send a sign-in page back. Try again in a moment.");
      try {
        sessionStorage.setItem(`wanlly-gh-connect-${id}`, "1");
      } catch {}
      if (draftRepo) setRepo(draftRepo);
      window.location.href = url.toString();
    } catch (e) {
      // Clerk explains what's wrong (for example GitHub sign-in not turned on for this site).
      const clerkMessage = (e as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
      setGhError(clerkMessage?.longMessage || clerkMessage?.message || (e instanceof Error ? e.message : SAY.offline));
    }
  };

  const saveToGithub = async () => {
    const chosen = draftRepo.trim();
    if (!chosen) return setGhError("Type a name for a new repository, or paste a link to one of yours.");
    setBusy(true);
    setGhError("");
    try {
      const r = await fetch(`/api/build/${id}/github`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: chosen, message: "Update from Wanlly" }) });
      const b = await r.json().catch(() => ({}));
      if (b.connect) {
        setGh({ ready: false, connected: false, login: null });
        return;
      }
      if (!r.ok) throw new Error(b.error ?? SAY.busy);
      setRepo(chosen);
      setGhOpen(false);
      dispatch({ type: "toast", text: "Saved to GitHub" });
      window.open(b.url, "_blank", "noopener");
    } catch (e) {
      setGhError(e instanceof Error ? e.message : SAY.offline);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {live && (
        <span className="flex items-center gap-1 text-xs">
          <a href={live} target="_blank" rel="noopener noreferrer" className="max-w-[180px] truncate font-medium text-accent underline-offset-2 hover:underline">
            {live.replace(/^https?:\/\//, "")}
          </a>
          <button type="button" onClick={unpublish} className="text-faint hover:text-bad" title="Take the app offline">
            ×
          </button>
        </span>
      )}
      <button
        type="button"
        disabled={publishing || !files.length}
        onClick={publish}
        title="Puts the app online at its own link. Web and React apps only."
        className="rounded-lg bg-fg px-2.5 py-1.5 text-xs font-semibold text-bg hover:opacity-90 disabled:opacity-50"
      >
        {publishing ? "Publishing…" : live ? "Update live app" : "Publish"}
      </button>
      <div className="relative">
        <button
          type="button"
          disabled={!files.length}
          onClick={() => (ghOpen ? setGhOpen(false) : openGithub())}
          title={repo ? `Saves to your GitHub repository ${repo}` : "Saves the files to your GitHub"}
          aria-expanded={ghOpen}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-faint disabled:opacity-50"
        >
          <Icon name="github" size={14} /> GitHub
        </button>
        {ghOpen && (
          <div className="absolute right-0 z-30 mt-2 flex w-[320px] max-w-[calc(100vw-24px)] flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-[13px] shadow-soft">
            <div className="flex items-center gap-2">
              <Icon name="github" size={16} />
              <b className="font-semibold">Save to GitHub</b>
              <button type="button" onClick={() => setGhOpen(false)} aria-label="Close" className="ml-auto text-faint hover:text-fg">
                ×
              </button>
            </div>
            {!gh ? (
              <p className="text-muted">Checking your GitHub…</p>
            ) : !gh.ready ? (
              <>
                <p className="text-muted">Connect your GitHub account so Wanlly can save this project to it. You choose the repository; nothing else is touched.</p>
                <button type="button" onClick={connectGithub} className="flex items-center justify-center gap-2 rounded-lg bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90">
                  <Icon name="github" size={14} /> {gh.connected ? "Allow saving to GitHub" : "Connect GitHub"}
                </button>
              </>
            ) : (
              <>
                {gh.login && <p className="text-xs text-muted">Connected as <b className="font-semibold text-fg">@{gh.login}</b></p>}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Repository</span>
                  <input
                    value={draftRepo}
                    onChange={(e) => setDraftRepo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void saveToGithub()}
                    placeholder="my-app, or github.com/you/repo"
                    className="rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-xs outline-none focus:border-faint"
                  />
                  <span className="text-[11px] leading-snug text-faint">A new name makes a private repository. Paste a link to save into one you already have: your files are added or updated, everything else stays.</span>
                </label>
                <button type="button" disabled={busy} onClick={saveToGithub} className="rounded-lg bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90 disabled:opacity-50">
                  {busy ? "Saving…" : "Save to GitHub"}
                </button>
              </>
            )}
            {ghError && <p className="text-xs text-bad">{ghError}</p>}
          </div>
        )}
      </div>
    </>
  );
}
