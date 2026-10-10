"use client";

import { SpinMark } from "./spin-mark";
import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOOLS, type ToolId } from "@/lib/catalog";
import { useReward, useWorkspace } from "@/lib/workspace-store";
import { SidebarAd } from "./ads/rail";
import { Icon, type IconName } from "./icon";
import { UsageMeters } from "./usage-meters";
import { Ring } from "./credits-button";


const TOOL_LINKS: ToolId[] = ["chat", "code", "design", "images"];
const PAGES: { href: string; label: string; icon: IconName }[] = [
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/coworkers", label: "Coworkers", icon: "users" },
];

const row = "flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px]";

function Mark() {
  return <SpinMark size={22} tile />;
}

const CARD_KEY = "wanlly-credits-card";
const cardListeners = new Set<() => void>();

/** Whether the credits card is folded, remembered on this device. */
function useFolded(): [boolean, (v: boolean) => void] {
  const folded = useSyncExternalStore(
    (cb) => {
      cardListeners.add(cb);
      return () => cardListeners.delete(cb);
    },
    () => {
      try {
        const saved = localStorage.getItem(CARD_KEY);
        // No choice yet: folded on short screens (laptops at 125-150% zoom), so Recents stay visible.
        return saved ? saved === "folded" : window.innerHeight < 800;
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(CARD_KEY, v ? "folded" : "open");
    } catch {}
    cardListeners.forEach((cb) => cb());
  };
  return [folded, set];
}

function TodayCard() {
  const { floor: FLOOR_CREDITS } = useReward();
  const { credits, floorUnlocked, synced, usage, dispatch } = useWorkspace();
  const [folded, setFolded] = useFolded();
  const dayUsed = usage ? usage.dayUsed / usage.dayLimit : 0;
  return (
    <div className={`flex flex-col rounded-[14px] border border-line bg-surface ${folded ? "p-1" : "gap-3 p-3 pt-1.5"}`}>
      <button
        type="button"
        aria-expanded={!folded}
        aria-label={folded ? "Show credits and limits" : "Hide credits and limits"}
        onClick={() => setFolded(!folded)}
        className={`-mx-1.5 flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-hover ${folded ? "mx-0 px-2" : ""}`}
      >
        {folded && <Ring used={dayUsed} />}
        <span className="text-[13px] text-muted">Credits</span>
        <b className="ml-auto font-mono text-[13px] font-medium tabular-nums">{synced ? credits : "–"}</b>
        <Icon name="down" size={14} className={`text-faint transition-transform ${folded ? "-rotate-90" : ""}`} />
      </button>
      {!folded && (
        <>
          <UsageMeters usage={usage} />
          <button
            type="button"
            onClick={() => dispatch({ type: "setEarnOpen", open: true })}
            className="flex items-center justify-center gap-2 rounded-[10px] border border-accent-line bg-accent-soft p-2 text-[13px] font-semibold text-accent"
          >
            <Icon name={floorUnlocked ? "bolt" : "play"} size={15} />
            {floorUnlocked ? "Earn more credits" : `Watch an ad · +${FLOOR_CREDITS} today`}
          </button>
        </>
      )}
    </div>
  );
}

/** The signed-in person, with sign out; or Sign in and Sign up when signed out. */
function Account({ onNavigate, active }: { onNavigate: () => void; active: boolean }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  // If Clerk can't load (blocked script, bad key), stop waiting and offer sign-in after a few seconds.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (isLoaded) return;
    const t = window.setTimeout(() => setGaveUp(true), 4000);
    return () => window.clearTimeout(t);
  }, [isLoaded]);

  if (!isLoaded && !gaveUp) return <div className="mt-1 h-[42px] animate-pulse rounded-xl bg-hover" aria-hidden="true" />;

  if (!isSignedIn || !user) {
    return (
      <div className="mt-1 flex gap-2">
        <Link href="/sign-in" className="flex-1 rounded-[10px] bg-fg px-3 py-2 text-center text-[13px] font-semibold text-bg">
          Sign in
        </Link>
        <Link href="/sign-up" className="flex-1 rounded-[10px] border border-line bg-surface px-3 py-2 text-center text-[13px] font-medium hover:border-faint">
          Sign up
        </Link>
      </div>
    );
  }

  const name = user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Your account";
  return (
    <div className={`mt-1 flex items-center gap-1 rounded-xl px-1.5 py-1.5 ${active ? "bg-hover" : ""}`}>
      <Link href="/profile" onClick={onNavigate} aria-current={active ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg hover:opacity-80">
        {/* eslint-disable-next-line @next/next/no-img-element -- Clerk serves the avatar */}
        <img src={user.imageUrl} alt="" className="size-[30px] shrink-0 rounded-full bg-hover object-cover" />
        <span className="flex min-w-0 flex-1 flex-col text-[13px] leading-tight">
          <span className="truncate">{name}</span>
          <small className="truncate text-xs text-faint">{user.primaryEmailAddress?.emailAddress ?? "Signed in"}</small>
        </span>
      </Link>
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        onClick={() => signOut({ redirectUrl: "/sign-in" })}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-hover hover:text-fg"
      >
        <Icon name="logout" size={16} />
      </button>
    </div>
  );
}

export function Sidebar() {
  const { sidebarOpen, tool, me, synced, recents, conversationId, dispatch, openConversation, refreshRecents } = useWorkspace();
  const path = usePathname();
  const router = useRouter();
  const close = () => dispatch({ type: "setSidebar", open: false });

  useEffect(() => {
    if (synced && recents === null) refreshRecents();
  }, [synced, recents, refreshRecents]);

  // Search: the words typed find chats by title or by anything said in them.
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<typeof recents>(null);
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/conversations?q=${encodeURIComponent(q)}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { conversations: [] }))
        .then((b) => setFound(b.conversations))
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);
  const endSearch = () => {
    setSearching(false);
    setQuery("");
    setFound(null);
  };
  const list = query.trim() ? found : recents;

  const remove = async (id: number, title: string) => {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    const r = await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return dispatch({ type: "toast", text: "Couldn't delete that. Try again" });
    if (id === conversationId) dispatch({ type: "newChat" });
    refreshRecents();
  };

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={close} aria-hidden="true" />}
      <aside
        className={`flex min-h-0 flex-col gap-1 border-r border-line bg-side px-3 py-3.5 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(300px,86vw)] max-md:pt-[calc(14px+env(safe-area-inset-top,0px))] max-md:transition-transform max-md:duration-200 ${sidebarOpen ? "max-md:translate-x-0 max-md:shadow-soft" : "max-md:-translate-x-[102%]"}`}
        aria-label="Sidebar"
      >
        <Link href="/app" onClick={close} className="flex items-center gap-2.5 px-2 pt-1 pb-3">
          <Mark />
          <b className="font-display text-lg font-semibold tracking-[-0.02em]">Wanlly</b>
        </Link>
        <Link
          href="/app"
          onClick={() => dispatch({ type: "newChat" })}
          className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-2.5 py-2 font-medium hover:border-faint"
        >
          <Icon name="plus" />
          New chat
          <kbd className="ml-auto font-mono text-[11px] text-faint">⌘K</kbd>
        </Link>

        <nav className="mt-2 flex flex-col gap-px" aria-label="Main">
          {TOOL_LINKS.map((id) => {
            const active = path === "/app" && tool === id;
            return (
              <Link
                key={id}
                href="/app"
                aria-current={active ? "page" : undefined}
                onClick={() => dispatch({ type: "setTool", tool: id })}
                className={`${row} ${active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg"}`}
              >
                <Icon name={id} size={16} />
                {TOOLS[id].label}
                {id === "images" && <span className="ml-auto rounded-md border border-line px-1.5 py-px text-[10px] font-medium text-faint">Soon</span>}
              </Link>
            );
          })}
          {PAGES.map((p) => {
            const active = path.startsWith(p.href);
            return (
              <Link
                key={p.href}
                href={p.href}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={`${row} ${active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg"}`}
              >
                <Icon name={p.icon} size={16} />
                {p.label}
                {p.href === "/coworkers" && <span className="ml-auto rounded-md border border-line px-1.5 py-px text-[10px] font-medium text-faint">Soon</span>}
              </Link>
            );
          })}
          {me?.role && me.role !== "user" && (
            <Link href="/admin" onClick={close} className={`${row} text-muted hover:bg-hover hover:text-fg`}>
              <Icon name="shield" size={16} />
              Admin
            </Link>
          )}
        </nav>

        {searching ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 focus-within:border-faint">
            <Icon name="search" size={14} className="shrink-0 text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setFound(null);
              }}
              onKeyDown={(e) => e.key === "Escape" && endSearch()}
              placeholder="Search chats"
              aria-label="Search chats"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] outline-none placeholder:text-faint"
            />
            <button type="button" aria-label="Close search" onClick={endSearch} className="rounded-md p-0.5 text-faint hover:text-fg">
              <Icon name="x" size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center px-2.5 pt-3 pb-1">
            <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Recent</span>
            <button type="button" aria-label="Search chats" title="Search chats" onClick={() => setSearching(true)} className="ml-auto rounded-md p-1 text-faint hover:bg-hover hover:text-fg">
              <Icon name="search" size={14} />
            </button>
          </div>
        )}
        <nav className="flex min-h-0 flex-1 flex-col gap-px overflow-auto" aria-label={query.trim() ? "Search results" : "Recent"}>
          {list === null ? (
            query.trim() ? <p className="px-2.5 py-1.5 text-xs text-faint">Searching…</p> : null
          ) : list.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs text-faint">{query.trim() ? `No chats mention “${query.trim()}”.` : "Your chats will show here."}</p>
          ) : (
            list.map((r) => {
              const active = r.id === conversationId && path === "/app";
              return (
                <div key={r.id} className={`group flex items-center rounded-lg ${active ? "bg-hover" : "hover:bg-hover"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      openConversation(r.id);
                      if (path !== "/app") router.push("/app");
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`${row} min-w-0 flex-1 ${active ? "font-medium text-fg" : "text-muted hover:text-fg"}`}
                  >
                    {r.tool === "code" && <Icon name="code" size={14} className="shrink-0 text-faint" />}
                    <span className="truncate">{r.title}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${r.title}`}
                    onClick={() => remove(r.id, r.title)}
                    className="mr-1 hidden rounded-md p-1 text-faint group-hover:block hover:bg-line hover:text-fg focus-visible:block"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              );
            })
          )}
        </nav>

        <div className="flex flex-col gap-2 pt-2">
          <SidebarAd />
          <TodayCard />
        </div>
        <Account onNavigate={close} active={path.startsWith("/profile")} />
      </aside>
    </>
  );
}
