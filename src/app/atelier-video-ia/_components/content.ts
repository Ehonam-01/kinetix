// Prefilled on the WhatsApp button once the online sale stops.
export const WHATSAPP_REGISTER_TEXT =
  "Bonjour, je souhaite m'inscrire à l'atelier vidéo IA du 14 novembre.";

// Shown above every payment button, the whole price or a part (explicit
// user decision: the same everywhere).
export const NON_REFUNDABLE_NOTE =
  "Les montants payés ne sont pas remboursables.";

// The page's text. TO_BRING is shared with the confirmation page.
export const AUDIENCES = [
  {
    title: "🏪 Entrepreneurs et commerçants",
    text: "Crée toi-même les pubs de tes produits, **sans dépendre d'un prestataire** à chaque fois.",
  },
  {
    title: "💼 Freelances et prestataires",
    text: "Ajoute la création de vidéos publicitaires à tes services et **commence ton portfolio dès le jour même**.",
  },
  {
    title: "🎥 Créateurs de contenu et débutants",
    text: "Apprends à produire des vidéos avec l'IA, **même si tu pars de zéro**.",
  },
];

// The five skills the morning teaches, one per module of the programme.
export const SKILLS = [
  "Concevoir une publicité vidéo avec l'IA",
  "Transformer une idée en scénario vidéo",
  "Générer des images et des scènes avec l'IA",
  "Assembler le tout en une vidéo publicitaire",
  "Découvrir comment vendre cette compétence",
];

export const OUTCOMES = [
  "🎬 **Une vidéo publicitaire terminée**, au format Facebook, Instagram, TikTok et WhatsApp",
  "🧠 **La méthode complète**, de l'idée au montage final",
  "💼 **La première pièce de ton portfolio**",
  "🎯 **Un plan d'action pour trouver tes premiers clients**",
];

export const PROGRAM = [
  {
    title: "Penser comme un publicitaire",
    text: "Ce qui fait qu'une pub accroche, trouver l'idée, écrire un scénario court avec l'IA.",
  },
  {
    title: "Générer des visuels professionnels",
    text: "Mettre en scène ton produit et créer une identité visuelle cohérente.",
  },
  {
    title: "Transformer les images en vidéo",
    text: "Les outils de génération en démonstration, puis l'animation de tes visuels.",
  },
  {
    title: "Le montage final",
    text: "Voix off, musique, textes, export pour les réseaux sociaux. Puis projection des pubs réalisées et retours personnalisés.",
  },
  {
    title: "Vendre ta compétence",
    text: "Quelles entreprises ont besoin de toi, construire ton offre, prospecter.",
  },
];

export const TO_BRING = [
  "💻 **Ton ordinateur portable ou ton smartphone**, **chargé à 100 %**",
  "🔌 Ton chargeur",
  "🎧 Des écouteurs",
  "📦 **Des photos du produit** pour lequel tu veux créer ta pub (sinon, on t'en fournit un)",
];

export const INCLUDED = [
  "Formation pratique encadrée, en présentiel",
  "Création de ta propre publicité",
  "Collation",
  "Modèle d'offre commerciale",
  "Accompagnement groupe WhatsApp pendant 1 mois",
  "Attestation de participation",
];

export type Faq = { question: string; answer: string; waitlist?: boolean };

// The questions that answer the usual objections. The price, the place and
// the date come from the workshop's settings.
export function workshopFaqs({
  price,
  venue,
  date,
}: {
  price: string;
  venue: string;
  date: string;
}): Faq[] {
  return [
    {
      question:
        "Faut-il avoir des connaissances en intelligence artificielle ?",
      answer:
        "Non. La formation est accessible aux débutants : l'atelier part de zéro et chaque étape est faite avec toi, depuis l'idée jusqu'à ta publicité terminée, avec de l'aide si tu bloques.",
    },
    {
      question: "Faut-il savoir faire du montage vidéo ?",
      answer:
        "Non plus. Le montage (voix off, musique, textes, export) fait partie du programme et se fait pas à pas.",
    },
    {
      question: "Quel matériel faut-il apporter ?",
      answer:
        "Ton ordinateur portable ou ton smartphone, chargé à 100 % : les deux permettent de réaliser ta pub. Ajoute ton chargeur, des écouteurs et des photos du produit pour lequel tu veux créer ta pub (sinon, on t'en fournit un). Après ton inscription, tu reçois la liste des comptes gratuits à créer avant l'atelier.",
    },
    {
      question: "Que vais-je réaliser pendant la formation ?",
      answer:
        "Ta propre publicité vidéo, sur un produit de ton choix, accompagné jusqu'à l'export final. Tu repars aussi avec la méthode complète, la première pièce de ton portfolio et un plan d'action pour trouver tes premiers clients.",
    },
    {
      question: "Comment réserver ma place ?",
      answer: `Clique sur « Je réserve ma place » et paie en ligne par Mobile Money : les ${price} F CFA en une fois, ou un premier versement. Ta place est réservée immédiatement et tu reçois les informations pratiques ainsi que le lien du groupe WhatsApp des participants.`,
    },
    {
      question: "Puis-je payer en plusieurs fois ?",
      answer: `Oui. Fais un premier versement à partir de 1 000 F CFA : ta place est réservée tout de suite. Ensuite, tu verses ce que tu veux, quand tu veux, depuis le lien de ta réservation, jusqu'au jour de la masterclass. S'il te reste un montant à payer le jour J, tu le règles sur place. Les montants payés ne sont pas remboursables.`,
    },
    {
      question: "Où se déroule la masterclass ?",
      answer: `${venue}, le ${date}.`,
    },
    {
      question: `Pourquoi seulement ${price} F CFA ?`,
      answer: `Kinetix Africa prend en charge le coût de la formation pour faire découvrir sa méthode et son catalogue de formations. Ta contribution de ${price} F CFA couvre la réservation de ta place, la collation et l'organisation de l'atelier ; aucun autre paiement n'est demandé, et tu peux la régler en plusieurs fois. À la fin, nous te présentons la plateforme et le programme ambassadeur : rien n'est obligatoire.`,
    },
    {
      question: "Les outils sont-ils payants ?",
      answer:
        "Pendant l'atelier, tu travailles avec des outils gratuits. Les étapes qui nécessitent des outils payants sont réalisées en démonstration par le formateur, et on te montre les alternatives gratuites pour continuer chez toi.",
    },
    {
      question: "Pourrai-je vendre cette compétence ensuite ?",
      answer:
        "Tu repars avec les bases pratiques, un premier élément de portfolio et une méthode pour prospecter. Tes résultats dépendront ensuite de ta pratique, de la qualité de ton travail et de ta capacité à trouver des clients : personne ne peut te garantir de revenus, et nous ne le ferons pas.",
    },
    {
      question:
        "Je ne peux pas venir à cette date. Y aura-t-il d'autres sessions ?",
      answer:
        "Inscris-toi sur la liste d'attente, tu seras prévenu en priorité.",
      waitlist: true,
    },
  ];
}
