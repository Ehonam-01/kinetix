import {
  ExternalLink,
  FolderOpen,
  Hash,
  HeartHandshake,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import { getDiscordInviteUrl } from "@/config/env.community";
import { requireUser } from "@/services/auth/current-user";

// The members' private Discord: one channel per formation, shared
// resources, mutual help. The invite link is only ever rendered here —
// behind sign-in, and behind dashboard/layout.tsx's subscription gate
// (an unpaid or deactivated account never reaches this page).
//
// This route used to redirect to /dashboard/mentors (the in-app member
// directory was retired — its data, directoryVisible and
// listCommunityMembers, is still left dormant, not deleted).
const WHAT_YOU_FIND = [
  {
    icon: Hash,
    title: "Un salon par formation",
    text: "Échangez avec les membres qui suivent la même formation que vous : questions, retours d'expérience, entraide.",
  },
  {
    icon: FolderOpen,
    title: "Des ressources partagées",
    text: "Modèles, fichiers et supports utiles aux formations, mis à disposition par l'équipe.",
  },
  {
    icon: Megaphone,
    title: "Les annonces de l'équipe",
    text: "Nouvelles formations, sessions en direct et nouveautés de la plateforme, en premier.",
  },
  {
    icon: HeartHandshake,
    title: "Une communauté qui avance ensemble",
    text: "Des membres qui partagent vos objectifs, pour ne plus progresser seul.",
  },
];

export default async function CommunityPage() {
  await requireUser();
  const inviteUrl = getDiscordInviteUrl();

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-[#5865F2] text-white">
        <div className="space-y-4 p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-wide text-white/75 uppercase">
            Réservé aux membres
          </p>
          <h1 className="max-w-xl text-2xl font-semibold text-balance sm:text-3xl">
            Rejoignez la communauté Kinetix sur Discord
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/85">
            Un espace privé pour échanger entre membres, salon par formation, et
            retrouver les ressources de vos formations.
          </p>
          {inviteUrl ? (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#3b45c4] shadow-sm transition-colors hover:bg-white/90"
            >
              Rejoindre le Discord
              <ExternalLink className="size-4" />
            </a>
          ) : (
            <p className="inline-block rounded-xl bg-white/15 px-4 py-2 text-sm">
              Le lien d&apos;invitation sera bientôt disponible ici.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {WHAT_YOU_FIND.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="border-border bg-card flex gap-3 rounded-2xl border p-4"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/10 text-[#5865F2]">
              <Icon className="size-5" />
            </div>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">{text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-border bg-muted/40 flex gap-3 rounded-2xl border p-4 text-sm">
        <ShieldCheck className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">Les règles de la communauté</p>
          <p className="text-muted-foreground">
            Bienveillance et respect. Pas de promesses de gains, pas de
            recrutement, pas de publicité. Le lien d&apos;invitation est
            personnel à la communauté : merci de ne pas le partager en dehors de
            la plateforme.
          </p>
        </div>
      </div>
    </div>
  );
}
