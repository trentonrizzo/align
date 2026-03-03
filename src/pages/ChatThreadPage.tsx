import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { MessageBubble } from "../components/MessageBubble";
import { MessageInput } from "../components/MessageInput";
import "./ChatThreadPage.css";

type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

export default function ChatThreadPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id;
  const [threadId, setThreadId] = useState<string | null>(null);
  const [otherUsername, setOtherUsername] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid || !matchId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      setLoading(true);
      setError(null);

      const { data: match, error: matchErr } = await supabase
        .from("matches")
        .select("id, user_a, user_b")
        .eq("id", matchId)
        .maybeSingle();

      if (matchErr || !match) {
        setError("Match not found");
        setLoading(false);
        return;
      }

      const otherId = match.user_a === uid ? match.user_b : match.user_a;

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", otherId)
        .maybeSingle();
      setOtherUsername(profile?.username ?? "Unknown");

      let { data: thread, error: threadErr } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("match_id", match.id)
        .maybeSingle();

      if (!thread && !threadErr) {
        const { data: inserted, error: insertErr } = await supabase
          .from("chat_threads")
          .insert({ match_id: match.id })
          .select("id")
          .single();
        if (insertErr) {
          setError(insertErr.message);
          setLoading(false);
          return;
        }
        thread = inserted;
      }

      if (!thread?.id) {
        setError("Could not open chat");
        setLoading(false);
        return;
      }

      setThreadId(thread.id);

      const { data: msgs, error: msgsErr } = await supabase
        .from("chat_messages")
        .select("id, thread_id, sender_id, message, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      if (msgsErr) {
        setError(msgsErr.message);
        setLoading(false);
        return;
      }
      setMessages((msgs ?? []) as ChatMessage[]);

      channel = supabase
        .channel(`chat:${thread.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `thread_id=eq.${thread.id}`,
          },
          (payload) => {
            const newRow = payload.new as ChatMessage;
            setMessages((prev) => [...prev, newRow]);
          }
        )
        .subscribe();

      setLoading(false);
    }

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(message: string) {
    if (!uid || !threadId) return;

    const { error: insertErr } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      sender_id: uid,
      message,
    });

    if (insertErr) setError(insertErr.message);
  }

  if (!user) {
    return (
      <div className="chat-thread-page">
        <div className="chat-thread-placeholder">Loading...</div>
      </div>
    );
  }

  return (
    <div className="chat-thread-page">
      <header className="chat-thread-header">
        <button
          type="button"
          className="chat-thread-back"
          onClick={() => navigate("/aligned")}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="chat-thread-title">{otherUsername ?? "Chat"}</h1>
      </header>

      {error && <div className="chat-thread-error">{error}</div>}

      {loading ? (
        <div className="chat-thread-placeholder">Loading chat...</div>
      ) : (
        <>
          <div className="chat-thread-messages">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg.message}
                isSent={msg.sender_id === uid}
                createdAt={msg.created_at}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
          <MessageInput onSend={handleSend} disabled={!threadId} />
        </>
      )}
    </div>
  );
}
