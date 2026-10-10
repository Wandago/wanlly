"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
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

  const saveToGithub = async () => {
    const chosen = repo || window.prompt("Name of the GitHub repository to save to (a private one is created if it doesn't exist):", name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-app");
    if (!chosen) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/build/${id}/github`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: chosen, message: "Update from Wanlly" }) });
      const b = await r.json().catch(() => ({}));
      if (b.connect) {
        // First time: ask GitHub (through the sign-in) for permission to save repositories.
        const gh = user?.externalAccounts.find((a) => a.provider.replace("oauth_", "") === "github");
        const back = window.location.href;
        const acct = gh ? await gh.reauthorize({ additionalScopes: ["repo"], redirectUrl: back }) : await user?.createExternalAccount({ strategy: "oauth_github", additionalScopes: ["repo"], redirectUrl: back });
        const url = acct?.verification?.externalVerificationRedirectURL;
        if (!url) throw new Error("GitHub sign-in isn't switched on for Wanlly yet.");
        setRepo(chosen);
        dispatch({ type: "toast", text: "Allow GitHub, then press Save to GitHub again" });
        window.location.href = url.toString();
        return;
      }
      if (!r.ok) throw new Error(b.error ?? SAY.busy);
      setRepo(chosen);
      dispatch({ type: "toast", text: "Saved to GitHub" });
      window.open(b.url, "_blank", "noopener");
    } catch (e) {
      dispatch({ type: "toast", text: e instanceof Error ? e.message : SAY.offline });
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
      <button
        type="button"
        disabled={busy || !files.length}
        onClick={saveToGithub}
        title={repo ? `Saves to your GitHub repository ${repo}` : "Saves the files to a private repository on your GitHub"}
        className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-faint disabled:opacity-50"
      >
        <Icon name="github" size={14} /> {busy ? "Saving…" : "GitHub"}
      </button>
    </>
  );
}
