import { test, expect } from "@playwright/test";

test("le dashboard redirige vers /login si non authentifié", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("le formulaire d'inscription affiche les erreurs de validation", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Nous rejoindre" }).click();
  await expect(page.getByText("Nom trop court")).toBeVisible();
  await expect(page.getByText("3 caractères minimum")).toBeVisible();
  await expect(page.getByText("Email invalide")).toBeVisible();
  await expect(page.getByText("8 caractères minimum")).toBeVisible();
});

test("le pseudo refuse les caractères hors [a-z0-9_]", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Pseudo").fill("Ama Koffi!");
  await page.getByRole("button", { name: "Nous rejoindre" }).click();
  await expect(
    page.getByText("Lettres minuscules, chiffres et _ uniquement"),
  ).toBeVisible();
});

test("le formulaire de connexion affiche les erreurs de validation", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email invalide")).toBeVisible();
  await expect(page.getByText("Mot de passe requis")).toBeVisible();
});

// Pas de test "inscription réussie" ici : ça créerait un vrai compte
// persistant dans auth.users à chaque exécution, sans clé service role
// pour le nettoyer ensuite. Le test ci-dessous couvre déjà l'intégration
// réelle avec Supabase Auth (erreur renvoyée par leur backend) sans effet
// de bord durable.
test("la connexion avec de mauvais identifiants affiche une erreur serveur", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("nobody@example.com");
  await page.getByLabel("Mot de passe", { exact: true }).fill("wrongpassword");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/invalid login credentials/i)).toBeVisible({
    timeout: 15000,
  });
});
