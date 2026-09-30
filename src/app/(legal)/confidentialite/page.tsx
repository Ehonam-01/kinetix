import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY } from "@/config/legal";
import { SITE_NAME } from "@/config/site";
import {
  Field,
  LegalDocument,
  List,
  Section,
} from "../_components/legal-content";

export const metadata: Metadata = {
  title: `Politique de confidentialité — ${SITE_NAME}`,
  description: `Comment ${SITE_NAME} collecte, utilise et protège vos données personnelles.`,
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  const e = LEGAL_ENTITY;
  const mail = (
    <a href={`mailto:${e.email}`} className="underline">
      {e.email}
    </a>
  );
  return (
    <LegalDocument
      title="Politique de confidentialité"
      intro={
        <p>
          Cette politique explique quelles données personnelles nous collectons
          sur la plateforme {SITE_NAME}, pourquoi, avec qui nous les partageons
          et quels sont vos droits, conformément au règlement général sur la
          protection des données applicable au Royaume-Uni (UK GDPR) et au
          Data Protection Act 2018. Pour les Membres qui résident au Togo, la
          loi togolaise n°2019-014 du 29 octobre 2019 relative à la protection
          des données à caractère personnel s&apos;applique également.
        </p>
      }
    >
      <Section title="1. Responsable du traitement">
        <p>
          <Field value={e.companyName} />, <Field value={e.address} />. Contact
          pour toute question relative à vos données : {mail}.
        </p>
      </Section>

      <Section title="2. Données collectées">
        <List>
          <li>
            <strong>Compte</strong> : nom complet, pseudo, adresse email, mot de
            passe (stocké uniquement sous forme chiffrée par notre prestataire
            d&apos;authentification, jamais lisible par nous).
          </li>
          <li>
            <strong>Profil</strong> (facultatif) : téléphone, pays, biographie,
            objectif, compétences.
          </li>
          <li>
            <strong>Parrainage et réseau</strong> : votre Parrain, votre
            position dans le réseau, et, si vous arrivez par un lien de
            parrainage, un identifiant de visite anonyme, la date et la page
            concernée.
          </li>
          <li>
            <strong>Paiements et Solde</strong> : numéro mobile money, opérateur
            et pays utilisés, montants, statuts et références des transactions,
            commissions, transferts et retraits. Nous ne collectons aucune
            donnée de carte bancaire.
          </li>
          <li>
            <strong>Apprentissage</strong> : leçons terminées, résultats aux
            quiz.
          </li>
          <li>
            <strong>Communauté</strong> : demandes de mentorat, avis laissés aux
            mentors, candidature au statut de mentor.
          </li>
          <li>
            <strong>Récompenses</strong> : adresse de livraison lorsque vous
            réclamez une récompense matérielle.
          </li>
          <li>
            <strong>Données techniques</strong> : adresse IP, utilisée
            temporairement pour limiter les tentatives abusives (connexion,
            codes de confirmation), et journaux techniques de sécurité.
          </li>
        </List>
      </Section>

      <Section title="3. Pourquoi nous utilisons vos données">
        <List>
          <li>
            Créer et gérer votre compte, vous donner accès aux formations et
            suivre votre progression (exécution du contrat).
          </li>
          <li>
            Traiter vos paiements, calculer et verser les commissions, gérer
            votre Solde, vos transferts et vos retraits (exécution du contrat).
          </li>
          <li>
            Vous envoyer les emails nécessaires au service : confirmation
            d&apos;inscription, codes de confirmation, rappels d&apos;échéance
            (exécution du contrat).
          </li>
          <li>
            Sécuriser la plateforme et prévenir la fraude (intérêt légitime).
          </li>
          <li>
            Respecter nos obligations légales, notamment comptables (obligation
            légale).
          </li>
        </List>
        <p>
          Nous ne vendons pas vos données et ne les utilisons pas à des fins
          publicitaires.
        </p>
      </Section>

      <Section title="4. Qui peut voir vos données">
        <List>
          <li>
            <strong>Les autres Membres</strong> voient uniquement ce qui est
            nécessaire au fonctionnement du réseau et de la communauté : votre
            pseudo et votre nom apparaissent dans le réseau de vos parrains et
            filleuls, et votre nom s&apos;affiche lorsqu&apos;une personne
            saisit votre pseudo pour vous désigner comme parrain ou vous envoyer
            un transfert. Si vous êtes mentor, votre profil public (nom,
            domaine, présentation, avis) est visible des Membres.
          </li>
          <li>
            <strong>L&apos;équipe {SITE_NAME}</strong>, pour le support, la
            validation des retraits et la gestion des comptes.
          </li>
          <li>
            <strong>Nos prestataires</strong>, uniquement pour les besoins du
            service :
            <List>
              <li>Vercel (hébergement du site) ;</li>
              <li>
                Supabase (base de données, authentification, stockage des
                fichiers) ;
              </li>
              <li>
                PayDunya et Bictorys (paiements et virements mobile money) ;
              </li>
              <li>Resend (envoi des emails) ;</li>
              <li>
                Upstash (limitation des tentatives abusives, à partir de
                l&apos;adresse IP ou de l&apos;identifiant de compte) ;
              </li>
              <li>
                YouTube et Vimeo, lorsque vous lancez une vidéo intégrée à une
                formation.
              </li>
            </List>
          </li>
          <li>
            <strong>Les autorités</strong>, lorsque la loi l&apos;exige.
          </li>
        </List>
      </Section>

      <Section title="5. Transferts hors du Royaume-Uni">
        <p>
          Nos prestataires techniques hébergent des données en dehors du
          Royaume-Uni, notamment aux États-Unis. Ces transferts sont limités à
          ce qui est nécessaire au service et encadrés par les garanties
          prévues par le UK GDPR, en particulier les clauses contractuelles de
          protection des données conclues avec ces prestataires.
        </p>
      </Section>

      <Section title="6. Durées de conservation">
        <List>
          <li>
            <strong>Compte</strong> : tant qu&apos;il est ouvert. À la
            suppression, vos informations personnelles (nom, pseudo, contact,
            profil) sont anonymisées sans délai.
          </li>
          <li>
            <strong>Historique financier</strong> (paiements, commissions,
            transferts, retraits) : 6 ans après la fin de l&apos;exercice
            concerné, durée de conservation des documents comptables exigée
            au Royaume-Uni, sous forme anonymisée après suppression du compte.
          </li>
          <li>
            <strong>Codes de confirmation</strong> : stockés uniquement sous
            forme chiffrée, valables quelques minutes.
          </li>
          <li>
            <strong>Adresse IP</strong> pour la limitation des tentatives : au
            plus une heure.
          </li>
          <li>
            <strong>Cookie de parrainage</strong> : 180 jours au maximum.
          </li>
        </List>
      </Section>

      <Section title="7. Sécurité">
        <p>
          Les échanges sont chiffrés (HTTPS). Les mots de passe et les codes de
          confirmation ne sont jamais stockés en clair. Chaque mouvement
          d&apos;argent est confirmé par un code envoyé par email, les accès de
          l&apos;équipe sont restreints et les tentatives répétées sont limitées
          automatiquement.
        </p>
      </Section>

      <Section title="8. Cookies et stockage local">
        <p>
          Nous n&apos;utilisons ni cookie publicitaire ni outil de mesure
          d&apos;audience. Nous utilisons uniquement :
        </p>
        <List>
          <li>des cookies de session, indispensables pour rester connecté ;</li>
          <li>
            un cookie de parrainage, déposé lorsque vous arrivez par le lien
            d&apos;un Ambassadeur, pour lui attribuer votre éventuelle
            souscription ;
          </li>
          <li>
            un stockage local dans votre navigateur pour mémoriser le thème
            clair ou sombre.
          </li>
        </List>
        <p>
          Les vidéos YouTube et Vimeo intégrées aux formations peuvent déposer
          leurs propres cookies lorsque vous les lancez.
        </p>
      </Section>

      <Section title="9. Vos droits">
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, de
          suppression, de limitation et d&apos;opposition au traitement de vos
          données, ainsi que d&apos;un droit à la portabilité de celles que
          vous nous avez fournies. Vous
          pouvez modifier votre profil et supprimer votre compte directement
          depuis vos paramètres, ou exercer vos droits en écrivant à {mail}.
          Nous répondons dans un délai d&apos;un mois.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de
          l&apos;Information Commissioner&apos;s Office (ICO), l&apos;autorité
          britannique de protection des données (ico.org.uk), ou, si vous
          résidez au Togo, auprès de l&apos;Instance de Protection des Données
          à Caractère Personnel (IPDCP).
        </p>
      </Section>

      <Section title="10. Mineurs">
        <p>
          La plateforme est réservée aux personnes âgées d&apos;au moins 18 ans.
          Nous ne collectons pas sciemment de données concernant des mineurs.
        </p>
      </Section>

      <Section title="11. Modifications">
        <p>
          Cette politique peut évoluer. La version en vigueur est celle publiée
          sur cette page. Voir aussi nos{" "}
          <Link href="/conditions-utilisation" className="underline">
            conditions d&apos;utilisation
          </Link>
          .
        </p>
      </Section>
    </LegalDocument>
  );
}
