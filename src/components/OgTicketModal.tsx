import "./OgTicketModal.css";

type OgTicketModalProps = {
  open: boolean;
  onClaim: () => void;
  claiming?: boolean;
};

export function OgTicketModal({ open, onClaim, claiming }: OgTicketModalProps) {
  if (!open) return null;

  return (
    <div className="og-backdrop">
      <div className="og-modal">
        <div className="og-confetti" aria-hidden="true" />
        <h1 className="og-title">You Are an OG ???</h1>
        <p className="og-body">
          Youre one of the earliest members of ALIGN.
          <br />
          Because you joined early, you receive an OG Ticket.
        </p>
        <p className="og-body">
          When ALIGN introduces subscriptions in the future,
          <br />
          you will receive 50% OFF for life.
        </p>
        <p className="og-body">
          This benefit is permanent and tied to your account.
          <br />
          You will never pay full price.
        </p>
        <button
          type="button"
          className="og-button"
          onClick={onClaim}
          disabled={claiming}
        >
          {claiming ? "Claiming..." : "Claim My OG Ticket"}
        </button>
      </div>
    </div>
  );
}

