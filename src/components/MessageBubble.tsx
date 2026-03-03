import "./MessageBubble.css";

type MessageBubbleProps = {
  message: string;
  isSent: boolean;
  createdAt: string;
};

export function MessageBubble({ message, isSent, createdAt }: MessageBubbleProps) {
  const date = new Date(createdAt);
  const timeStr = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className={`message-bubble message-bubble--${isSent ? "sent" : "received"}`}>
      <div className="message-bubble__text">{message}</div>
      <div className="message-bubble__time">{timeStr}</div>
    </div>
  );
}
