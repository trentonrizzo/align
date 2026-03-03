import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { MessageBubble } from "../components/MessageBubble";
import { MessageInput } from "../components/MessageInput";
import "./ChatThreadPage.css";

type ChatMessage = {
  id: string;
  chat_id?: string;
  thread_id?: string;
  sender_id: string;
  body?: string;
  message?: string;
  read_at: string | null;
  created_at: string;
};

const PRESENCE_CHANNEL = "chat-typing";

export default function ChatThreadPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id;
  const [chatId, setChatId] = useState<string | null>(null);
  const [useNewSchema, setUseNewSchema] = useState(true);
  const [otherUsername, setOtherUsername] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getMessageText = (msg: ChatMessage) => msg.body ?? msg.message ?? "";
  const tableName = useNewSchema ? "messages" : "chat_messages";
  const idColumn = useNewSchema ? "chat_id" : "thread_id";

  useEffect(() => {
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

      let chatOrThreadId: string | null = null;
      let schemaNew = true;

      const { data: chat, error: chatErr } = await supabase
        .from("chats")
        .select("id")
        .eq("match_id", match.id)
        .maybeSingle();

      if (chat?.id) {
        chatOrThreadId = chat.id;
      } else if (!chatErr) {
        const { data: inserted, error: insertErr } = await supabase
          .from("chats")
          .insert({ match_id: match.id })
          .select("id")
          .single();
        if (!insertErr && inserted?.id) {
          chatOrThreadId = inserted.id;
        }
      }

      if (!chatOrThreadId) {
        const { data: thread, error: threadErr } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("match_id", match.id)
          .maybeSingle();

        if (thread?.id) {
          chatOrThreadId = thread.id;
          schemaNew = false;
        } else if (!threadErr) {
          const { data: inserted, error: insertErr } = await supabase
            .from("chat_threads")
            .insert({ match_id: match.id })
            .select("id")
            .single();
          if (!insertErr && inserted?.id) {
            chatOrThreadId = inserted.id;
            schemaNew = false;
          }
        }
      }

      setUseNewSchema(schemaNew);
      setChatId(chatOrThreadId);

      if (!chatOrThreadId) {
        setError("Could not open chat");
        setLoading(false);
        return;
      }

      if (schemaNew) {
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("chat_id", chatOrThreadId)
          .neq("sender_id", uid)
          .is("read_at", null);
      }

      const selectCols = schemaNew
        ? "id, chat_id, sender_id, body, read_at, created_at"
        : "id, thread_id, sender_id, message, created_at";

      const { data: msgs, error: msgsErr } = await supabase
        .from(tableName)
        .select(selectCols)
        .eq(idColumn, chatOrThreadId)
        .order("created_at", { ascending: true });

      if (msgsErr) {
        setError(msgsErr.message);
        setLoading(false);
        return;
      }

      const rawMsgs = (msgs ?? []) as unknown[];
      const mapped: ChatMessage[] = rawMsgs.map((m) => {
        const r = m as Record<string, unknown>;
        return {
          id: r.id as string,
          chat_id: r.chat_id as string | undefined,
          thread_id: r.thread_id as string | undefined,
          sender_id: r.sender_id as string,
          body: r.body as string | undefined,
          message: r.message as string | undefined,
          read_at: schemaNew ? (r.read_at as string | null) : null,
          created_at: r.created_at as string,
        };
      });
      setMessages(mapped);

      channel = supabase
        .channel(`chat:${chatOrThreadId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: tableName,
            filter: `${idColumn}=eq.${chatOrThreadId}`,
          },
          (payload) => {
            const newRow = payload.new as ChatMessage;
            setMessages((prev) => [...prev, newRow]);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: tableName,
            filter: `${idColumn}=eq.${chatOrThreadId}`,
          },
          () => {
            setMessages((prev) => [...prev]);
          }
        )
        .subscribe();

      const presenceChannel = supabase.channel(`${PRESENCE_CHANNEL}:${chatOrThreadId}`, {
        config: { presence: { key: uid } },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel.presenceState();
          const others = Object.entries(state)
            .filter(([k]) => k !== uid)
            .flatMap(([, presences]) => presences as { typing?: boolean }[]);
          setOtherTyping(others.some((p) => p?.typing === true));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track({ typing: false, user_id: uid });
          }
        });

      presenceChannelRef.current = presenceChannel;

      setLoading(false);
    }

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [user?.id, matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  function handleTypingStart() {
    presenceChannelRef.current?.track({ typing: true });
  }

  function handleTypingStop() {
    presenceChannelRef.current?.track({ typing: false });
  }

  async function handleSend(message: string) {
    if (!uid || !chatId) return;

    if (useNewSchema) {
      const { error: insertErr } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: uid,
        body: message,
      });
      if (insertErr) setError(insertErr.message);
    } else {
      const { error: insertErr } = await supabase.from("chat_messages").insert({
        thread_id: chatId,
        sender_id: uid,
        message,
      });
      if (insertErr) setError(insertErr.message);
    }
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
        <div className="chat-thread-header-info">
          <h1 className="chat-thread-title">{otherUsername ?? "Chat"}</h1>
          {otherTyping && (
            <span className="chat-thread-typing">
              User typing
              <span className="chat-thread-typing-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </span>
          )}
        </div>
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
                message={getMessageText(msg)}
                isSent={msg.sender_id === uid}
                createdAt={msg.created_at}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
          <MessageInput
            onSend={handleSend}
            disabled={!chatId}
            onFocus={handleTypingStart}
            onBlur={handleTypingStop}
          />
        </>
      )}
    </div>
  );
}
