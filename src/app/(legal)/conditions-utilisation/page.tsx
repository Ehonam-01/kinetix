import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY } from "@/config/legal";
import { SITE_NAME } from "@/config/site";
import { GRACE_PERIOD_DAYS } from "@/repositories/subscriptions";
import {
  Definition,
  Field,
  LegalDocument,
  List,
  Section,
} from "../_components/legal-content";

export const metadata: Metadata = {
  title: `Conditions d'utilisation — ${SITE_NAME}`,
  description: `Conditions générales d'utilisation et de vente de la plateforme ${SITE_NAME}, abonnement, remboursement et programme ambassadeur.`,
  alternates: { canonical: "/conditions-utilisation" },
};

export default function ConditionsUtilisationPage() {
  const e = LEGAL_ENTITY;
  return (
    <LegalDocument
      title="Conditions générales d'utilisation"
      intro={
        <p>
          Les présentes conditions encadrent l&apos;accès et l&apos;utilisation
          de la plateforme {SITE_NAME}, éditée par{" "}
          <Field value={e.companyName} /> (voir les{" "}
          <Link href="/mentions-legales" className="underline">
            mentions légales
          </Link>
          ). En créant un compte, vous déclarez les avoir lues et les accepter
          sans réserve.
        </p>
      }
    >
      <Section title="1. Définitions">
        <List>
          <Definition term="Plateforme">
            le site kinetix-africa.com et l&apos;ensemble des services
            accessibles depuis l&apos;espace membre.
          </Definition>
          <Definition term="Membre">
            toute personne disposant d&apos;un compte sur la Plateforme.
          </Definition>
          <Definition term="Abonnement">
            l&apos;accès payant d&apos;une durée d&apos;un an à l&apos;ensemble
            des formations et services de la Plateforme.
          </Definition>
          <Definition term="Parrain">
            le Membre désigné par son pseudo lors de l&apos;inscription.
          </Definition>
          <Definition term="Ambassadeur">
            le Membre ayant adhéré au programme ambassadeur (article 7).
          </Definition>
          <Definition term="Solde">
            le montant en francs CFA crédité sur le compte d&apos;un Membre
            (commissions, transferts reçus, recharges).
          </Definition>
        </List>
      </Section>

      <Section title="2. Inscription et compte">
        <List>
          <li>
            L&apos;inscription est réservée aux personnes âgées d&apos;au moins
            18 ans et capables de contracter.
          </li>
          <li>
            Toute inscription nécessite de désigner un Parrain, identifié par
            son pseudo. Ce choix est définitif.
          </li>
          <li>
            Vous vous engagez à fournir des informations exactes et à les tenir
            à jour. Un seul compte est autorisé par personne.
          </li>
          <li>
            Vos identifiants sont personnels et confidentiels. Toute action
            réalisée depuis votre compte est réputée faite par vous. Prévenez
            immédiatement le support en cas d&apos;utilisation non autorisée.
          </li>
          <li>
            Votre adresse email doit être confirmée pour activer le compte.
            L&apos;accès à l&apos;espace membre nécessite ensuite un Abonnement
            payé.
          </li>
        </List>
      </Section>

      <Section title="3. Abonnement et paiement">
        <List>
          <li>
            L&apos;Abonnement est annuel. Son prix, en francs CFA, est celui
            affiché sur la Plateforme au moment de la souscription.
          </li>
          <li>
            Le paiement s&apos;effectue par mobile money via nos prestataires de
            paiement, ou à partir du Solde d&apos;un Membre. Lorsque le Solde
            utilisé appartient à un autre Membre, celui-ci doit valider lui-même
            le paiement depuis son propre espace, avec un code reçu par email.
          </li>
          <li>
            L&apos;Abonnement est activé dès que le paiement est confirmé par le
            prestataire. Il n&apos;est pas renouvelé automatiquement : des
            rappels sont envoyés 7 jours et 1 jour avant l&apos;échéance.
          </li>
          <li>
            Un renouvellement effectué avant l&apos;échéance prolonge
            l&apos;Abonnement d&apos;un an à partir de sa date
            d&apos;expiration, sans perte de jours payés.
          </li>
        </List>
      </Section>

      <Section title="4. Échéance, période de grâce et désactivation">
        <List>
          <li>
            À l&apos;échéance, l&apos;accès est maintenu pendant une période de
            grâce de {GRACE_PERIOD_DAYS} jours, pendant laquelle le Membre peut
            renouveler lui-même son Abonnement. La nouvelle année démarre alors
            à la date d&apos;expiration précédente.
          </li>
          <li>
            Passé ce délai, le compte est désactivé : aucune action n&apos;est
            plus possible sur la Plateforme (formations, transferts, retraits,
            programme ambassadeur…), y compris le paiement en autonomie.
          </li>
          <li>
            Seul le support peut réactiver un compte désactivé. La réactivation
            ouvre une nouvelle année d&apos;Abonnement à compter de sa date.
          </li>
        </List>
      </Section>

      <Section id="remboursement" title="5. Politique de remboursement">
        <p>
          L&apos;Abonnement donne un accès immédiat à des contenus numériques.
          En conséquence, une fois l&apos;Abonnement activé, aucun remboursement
          n&apos;est accordé, y compris en cas de non-utilisation ou de
          désactivation du compte à l&apos;issue de la période de grâce.
        </p>
        <p>Un remboursement est toutefois accordé en cas de :</p>
        <List>
          <li>paiement débité en double pour un même Abonnement ;</li>
          <li>
            paiement débité sans que l&apos;Abonnement ait pu être activé en
            raison d&apos;une erreur technique de la Plateforme.
          </li>
        </List>
        <p>
          La demande doit être adressée à{" "}
          <a href={`mailto:${e.email}`} className="underline">
            {e.email}
          </a>{" "}
          dans les 30 jours suivant le paiement, avec la référence de la
          transaction mobile money. Le remboursement est effectué sur le moyen
          de paiement utilisé ou sur le Solde du Membre. Les commissions versées
          au titre d&apos;un paiement remboursé sont annulées.
        </p>
      </Section>

      <Section title="6. Utilisation des contenus et de la communauté">
        <List>
          <li>
            Les formations sont accordées pour un usage strictement personnel.
            Il est interdit de partager son compte, de copier, enregistrer,
            revendre ou diffuser tout ou partie des contenus.
          </li>
          <li>
            Dans les espaces communautaires et de mentorat, chacun s&apos;engage
            à rester courtois, honnête et respectueux. Sont interdits les propos
            illicites, haineux ou diffamatoires, le harcèlement, le spam et les
            faux avis.
          </li>
          <li>
            Les mentors sont des Membres validés par l&apos;équipe. Leurs
            conseils relèvent de leur seule responsabilité ; les échanges entre
            Membres ne sont pas des prestations fournies par {SITE_NAME}.
          </li>
        </List>
      </Section>

      <Section title="7. Programme ambassadeur">
        <List>
          <li>
            L&apos;adhésion est gratuite et facultative. Elle nécessite un
            Abonnement actif et un Parrain lui-même Ambassadeur actif. Le lien
            de parrainage personnel de l&apos;Ambassadeur utilise son pseudo.
          </li>
          <li>
            Les commissions sont versées uniquement sur des souscriptions
            réellement payées : jamais pour le simple fait d&apos;inscrire une
            personne. La commission de vente directe est versée sur la toute
            première souscription d&apos;un filleul ; les commissions de
            génération dépendent du niveau atteint. Les taux et conditions en
            vigueur sont publiés sur la page{" "}
            <Link href="/programme-ambassadeur" className="underline">
              Programme ambassadeur
            </Link>
            . Ils peuvent évoluer ; une modification ne s&apos;applique jamais
            aux commissions déjà acquises.
          </li>
          <li>
            Une vente est attribuée en priorité au Parrain désigné à
            l&apos;inscription. À défaut, elle est attribuée à
            l&apos;Ambassadeur dont le lien a été utilisé en dernier, dans la
            limite de la durée d&apos;attribution affichée sur la page du
            programme.
          </li>
          <li>
            <strong>Aucun revenu n&apos;est garanti.</strong> Les gains
            dépendent uniquement des souscriptions réelles générées.
            L&apos;Ambassadeur s&apos;interdit toute promesse de gains, tout
            argument trompeur, le démarchage abusif (spam), la création de faux
            comptes et l&apos;auto-parrainage.
          </li>
          <li>
            Des récompenses matérielles peuvent être attribuées à certains
            niveaux, selon le catalogue en vigueur. Elles doivent être réclamées
            depuis l&apos;espace membre, avec une adresse de livraison exacte.
          </li>
          <li>
            L&apos;Ambassadeur agit en toute indépendance : il n&apos;est ni
            salarié, ni mandataire, ni représentant de{" "}
            <Field value={e.companyName} />. Il est seul responsable des
            déclarations fiscales et sociales liées à ses gains.
          </li>
          <li>
            Toute commission obtenue par fraude, ou liée à un paiement remboursé
            ou contesté, peut être annulée. En cas de manquement, le statut
            d&apos;Ambassadeur peut être suspendu ou retiré.
          </li>
        </List>
      </Section>

      <Section title="8. Solde, transferts et retraits">
        <List>
          <li>
            Le Solde est un compte interne à la Plateforme exprimé en francs
            CFA. Il ne constitue ni un compte bancaire ni un compte de paiement
            et ne produit pas d&apos;intérêts.
          </li>
          <li>
            Un Membre peut transférer tout ou partie de son Solde disponible à
            un autre Membre, ou l&apos;utiliser pour payer un Abonnement. Chaque
            opération est confirmée par un code à usage unique envoyé par email.
          </li>
          <li>
            Les retraits se font vers un numéro mobile money, au-delà d&apos;un
            montant minimum affiché dans l&apos;espace membre. Chaque demande
            est confirmée par un code email puis validée par l&apos;équipe avant
            le virement. Le Membre est responsable de l&apos;exactitude du
            numéro indiqué. D&apos;éventuels frais de l&apos;opérateur peuvent
            s&apos;appliquer.
          </li>
          <li>
            Les codes de confirmation sont strictement personnels : {SITE_NAME}{" "}
            ne vous les demandera jamais. Ne les communiquez à personne.
          </li>
        </List>
      </Section>

      <Section title="9. Suspension et suppression du compte">
        <List>
          <li>
            Nous pouvons suspendre ou fermer un compte en cas de manquement aux
            présentes conditions, de fraude ou d&apos;usage abusif, après en
            avoir informé le Membre sauf urgence.
          </li>
          <li>
            Vous pouvez supprimer votre compte à tout moment depuis vos
            paramètres. Vos informations personnelles sont alors anonymisées et
            l&apos;accès est définitivement fermé.{" "}
            <strong>
              Pensez à retirer votre Solde avant : il ne pourra plus l&apos;être
              après la suppression.
            </strong>{" "}
            Les données nécessaires à l&apos;historique financier et au réseau
            des autres Membres sont conservées sous forme anonymisée.
          </li>
        </List>
      </Section>

      <Section title="10. Disponibilité et responsabilité">
        <p>
          Nous mettons tout en œuvre pour assurer un accès continu et sécurisé à
          la Plateforme, sans pouvoir garantir l&apos;absence
          d&apos;interruption (maintenance, pannes des prestataires, opérateurs
          mobile money). Notre responsabilité ne saurait être engagée pour un
          dommage indirect, ni pour le contenu des échanges entre Membres ou des
          sites tiers.
        </p>
      </Section>

      <Section title="11. Données personnelles">
        <p>
          Le traitement de vos données est décrit dans notre{" "}
          <Link href="/confidentialite" className="underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </Section>

      <Section title="12. Modification des conditions">
        <p>
          Nous pouvons faire évoluer les présentes conditions. La version en
          vigueur est celle publiée sur cette page, à la date indiquée en haut.
          En cas de changement important, les Membres en sont informés par email
          ou dans leur espace.
        </p>
      </Section>

      <Section title="13. Droit applicable et litiges">
        <p>
          Les présentes conditions sont régies par le droit togolais. En cas de
          différend, les parties recherchent d&apos;abord une solution amiable
          en écrivant à{" "}
          <a href={`mailto:${e.email}`} className="underline">
            {e.email}
          </a>
          . À défaut d&apos;accord, les tribunaux compétents de {e.jurisdiction}{" "}
          seront seuls compétents.
        </p>
      </Section>
    </LegalDocument>
  );
}
