"use client";

import { useActionState } from "react";
import { updateShop, type ShopFormState } from "../actions";

const field =
  "rounded-sm border border-[#3a3d46] bg-paper px-3 py-2.5 text-[15px] text-ink placeholder:text-faint disabled:opacity-60";

export function ShopForm({ name, town, canEdit }: { name: string; town: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ShopFormState, FormData>(updateShop, { ok: true, message: "" });
  return (
    <form action={action} className="flex max-w-[480px] flex-col gap-4 rounded-md border border-line bg-surface p-5">
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Shop name
        <input name="name" defaultValue={name} required maxLength={120} disabled={!canEdit} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Town
        <input name="town" defaultValue={town} maxLength={80} placeholder="Nakuru" disabled={!canEdit} className={field} />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canEdit || pending}
          className="rounded-sm bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <span role="status" className={`text-sm ${state.ok ? "text-good" : "text-bad"}`}>
          {state.message}
        </span>
      </div>
      {!canEdit && <p className="text-[13px] text-muted">Only owners and managers can change these.</p>}
    </form>
  );
}
