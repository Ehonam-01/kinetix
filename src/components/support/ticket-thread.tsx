import { cn } from "@/lib/utils";

type Message = {
  id: string;
  fromStaff: boolean;
  body: string;
  createdAt: Date;
};

const fmtDateTime = (date: Date) =>
  date.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Abidjan",
  });

// A ticket's conversation, oldest first. The member's messages on one side,
// the team's on the other, whoever is reading.
export function TicketThread({
  messages,
  memberLabel,
  staffLabel = "Équipe Kinetix Africa",
}: {
  messages: Message[];
  memberLabel: string;
  staffLabel?: string;
}) {
  return (
    <ol className="space-y-4">
      {messages.map((message) => (
        <li
          key={message.id}
          className={cn(
            "flex flex-col gap-1",
            message.fromStaff ? "items-start" : "items-end",
          )}
        >
          <p className="text-muted-foreground px-1 text-xs">
            <span className="text-foreground font-medium">
              {message.fromStaff ? staffLabel : memberLabel}
            </span>{" "}
            · {fmtDateTime(message.createdAt)}
          </p>
          <div
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-line",
              message.fromStaff
                ? "bg-primary/10 rounded-tl-sm"
                : "bg-muted rounded-tr-sm",
            )}
          >
            {message.body}
          </div>
        </li>
      ))}
    </ol>
  );
}
