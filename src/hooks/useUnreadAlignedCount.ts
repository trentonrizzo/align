import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useUnreadAlignedCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    async function fetchCount() {
      const { data: matches } = await supabase
        .from("matches")
        .select("id")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`);

      if (!matches?.length) {
        setCount(0);
        return;
      }

      const { data: chats } = await supabase
        .from("chats")
        .select("id")
        .in("match_id", matches.map((m) => m.id));

      if (!chats?.length) {
        setCount(0);
        return;
      }

      let total = 0;
      for (const chat of chats) {
        const { count: msgCount } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("chat_id", chat.id)
          .neq("sender_id", userId)
          .is("read_at", null);
        total += msgCount ?? 0;
      }
      setCount(total);
    }

    fetchCount();

    const channel = supabase
      .channel("unread-aligned")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, fetchCount)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, fetchCount)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}
