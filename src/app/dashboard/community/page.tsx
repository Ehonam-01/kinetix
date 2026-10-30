import {
  ExternalLink,
  FolderOpen,
  Hash,
  HeartHandshake,
  Megaphone,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import {
  getDiscordInviteUrl,
  getWhatsappCommunityUrl,
} from "@/config/env.community";
import { requireUser } from "@/services/auth/current-user";

// The members' private WhatsApp group (the everyday exchanges) and Discord
// (one channel per formation, shared resources). The invite links are only
// ever rendered here — behind sign-in, and behind dashboard/layout.tsx's subscription gate
// (an unpaid or deactivated account never reaches this page).
//
// This route used to redirect to /dashboard/mentors (the in-app member
// directory was retired — its data, directoryVisible and
// listCommunityMembers, is still left dormant, not deleted).
const WHAT_YOU_FIND = [
  {
    icon: Hash,
    title: "Un salon par formation sur Discord",
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
  const discordUrl = getDiscordInviteUrl();
  const whatsappUrl = getWhatsappCommunityUrl();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Réservé aux membres
        </p>
        <h2 className="text-2xl font-semibold text-balance sm:text-3xl">
          Rejoignez la communauté Kinetix
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl bg-[#128C7E] p-6 text-white">
          <MessageCircle className="size-7" />
          <h3 className="text-lg font-semibold">Le groupe WhatsApp</h3>
          <p className="flex-1 text-sm leading-relaxed text-white/85">
            Le plus simple pour commencer : posez vos questions et échangez au
            quotidien avec les autres membres. Votre numéro y est visible par
            les membres du groupe.
          </p>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0b6b60] shadow-sm transition-colors hover:bg-white/90"
            >
              Rejoindre le groupe WhatsApp
              <ExternalLink className="size-4" />
            </a>
          ) : (
            <p className="rounded-xl bg-white/15 px-4 py-2 text-sm">
              Le lien d&apos;invitation sera bientôt disponible ici.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-[#5865F2] p-6 text-white">
          <Hash className="size-7" />
          <h3 className="text-lg font-semibold">Le Discord</h3>
          <p className="flex-1 text-sm leading-relaxed text-white/85">
            Un espace privé pour échanger entre membres, salon par formation, et
            retrouver les ressources de vos formations.
          </p>
          {discordUrl ? (
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#3b45c4] shadow-sm transition-colors hover:bg-white/90"
            >
              Rejoindre le Discord
              <ExternalLink className="size-4" />
            </a>
          ) : (
            <p className="rounded-xl bg-white/15 px-4 py-2 text-sm">
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
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
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
            recrutement, pas de publicité. Les liens d&apos;invitation sont
            réservés à la communauté : merci de ne pas les partager en dehors de
            la plateforme.
          </p>
        </div>
      </div>
    </div>
  );
}
