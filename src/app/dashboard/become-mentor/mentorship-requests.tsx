"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PendingMentorshipRequest } from "@/repositories/mentorships";
import { respondToMentorshipRequestAction } from "./actions";

export function MentorshipRequests({
  requests,
}: {
  requests: PendingMentorshipRequest[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function respond(mentorshipId: string, accept: boolean) {
    startTransition(async () => {
      await respondToMentorshipRequestAction(mentorshipId, accept);
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucune demande d&apos;accompagnement en attente.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <li
          key={request.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
        >
          <div>
            <p className="font-medium">{request.menteeFullName}</p>
            <p className="text-muted-foreground text-xs">
              @{request.menteeUsername}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => respond(request.id, true)}
            >
              Accepter
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => respond(request.id, false)}
            >
              Refuser
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
