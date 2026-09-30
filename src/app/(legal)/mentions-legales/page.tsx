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
  title: `Mentions légales — ${SITE_NAME}`,
  description: `Informations légales sur l'éditeur et l'hébergeur du site ${SITE_NAME}.`,
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  const e = LEGAL_ENTITY;
  return (
    <LegalDocument title="Mentions légales">
      <Section title="Éditeur du site">
        <p>
          Le site kinetix-africa.com et la plateforme {SITE_NAME} sont édités
          par :
        </p>
        <List>
          <li>
            <Field value={e.companyName} />, <Field value={e.legalForm} />
          </li>
          <li>
            Immatriculée auprès de <Field value={e.registration} />
          </li>
          <li>
            Siège social : <Field value={e.address} />
          </li>
          <li>
            Téléphone : <Field value={e.phone} />
          </li>
          <li>
            Email :{" "}
            <a href={`mailto:${e.email}`} className="underline">
              {e.email}
            </a>
          </li>
        </List>
        <p>
          Directeur de la publication : <Field value={e.publicationDirector} />
        </p>
      </Section>

      <Section title="Hébergement">
        <p>Le site est hébergé par :</p>
        <List>
          <li>
            <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133, Covina, CA
            91723, États-Unis — hébergement de l&apos;application web.
          </li>
          <li>
            <strong>Supabase Inc.</strong> — base de données, authentification
            et stockage des fichiers.
          </li>
        </List>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments du site et de la plateforme (textes,
          formations, vidéos, visuels, logos, marque {SITE_NAME}, logiciel) est
          la propriété de <Field value={e.companyName} /> ou de ses partenaires
          et est protégé par le droit de la propriété intellectuelle, notamment
          l&apos;Accord de Bangui révisé (OAPI). Toute reproduction,
          représentation, diffusion ou exploitation, totale ou partielle, sans
          autorisation écrite préalable est interdite.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          L&apos;éditeur s&apos;efforce de fournir des informations exactes et à
          jour, sans pouvoir garantir l&apos;absence totale d&apos;erreur ou
          d&apos;interruption du service. Les liens vers des sites tiers (par
          exemple des vidéos YouTube ou Vimeo intégrées aux formations) sont
          fournis à titre pratique ; l&apos;éditeur n&apos;est pas responsable
          de leur contenu.
        </p>
      </Section>

      <Section title="Données personnelles et cookies">
        <p>
          Le traitement des données personnelles des utilisateurs est décrit
          dans notre{" "}
          <Link href="/confidentialite" className="underline">
            politique de confidentialité
          </Link>
          . L&apos;utilisation de la plateforme est régie par nos{" "}
          <Link href="/conditions-utilisation" className="underline">
            conditions d&apos;utilisation
          </Link>
          .
        </p>
      </Section>

      <Section title="Droit applicable">
        <p>Les présentes mentions légales sont régies par le droit togolais.</p>
      </Section>
    </LegalDocument>
  );
}
