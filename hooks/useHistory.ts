"use client";

import { useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-client";

export type HistoryEntry = {
  id: string;
  bot_slug: string;
  bot_name: string;
  input_values: Record<string, string>;
  output_text: string;
  created_at: string;
};

export function useHistory() {
  const saveGeneration = useCallback(async (entry: Omit<HistoryEntry, "id" | "created_at">) => {
    const db = getSupabaseBrowser();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("history") as any).insert({
      user_id: user.id,
      bot_slug: entry.bot_slug,
      bot_name: entry.bot_name,
      input_values: entry.input_values,
      output_text: entry.output_text,
    });
  }, []);

  const getHistory = useCallback(async (): Promise<HistoryEntry[]> => {
    const db = getSupabaseBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db.from("history") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as HistoryEntry[];
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    const db = getSupabaseBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("history") as any).delete().eq("id", id);
  }, []);

  return { saveGeneration, getHistory, deleteEntry };
}
