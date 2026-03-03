import type { FormEvent } from "react";
import { useState } from "react";
import "./MessageInput.css";

type MessageInputProps = {
  onSend: (message: string) => void;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

export function MessageInput({ onSend, disabled, onFocus, onBlur }: MessageInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        type="text"
        className="message-input__field"
        placeholder="Message..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
      />
      <button type="submit" className="message-input__btn" disabled={disabled || !value.trim()}>
        Send
      </button>
    </form>
  );
}
