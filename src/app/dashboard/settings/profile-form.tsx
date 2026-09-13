"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "./actions";

export function ProfileForm({
  fullName,
  username,
  phone,
  country,
}: {
  fullName: string;
  username: string;
  phone: string;
  country: string;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ fullName, username, phone, country });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nom complet</Label>
          <Input
            id="fullName"
            value={values.fullName}
            onChange={(e) =>
              setValues((v) => ({ ...v, fullName: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Pseudo</Label>
          <Input
            id="username"
            value={values.username}
            onChange={(e) =>
              setValues((v) => ({ ...v, username: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            value={values.phone}
            onChange={(e) =>
              setValues((v) => ({ ...v, phone: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Pays</Label>
          <Input
            id="country"
            value={values.country}
            onChange={(e) =>
              setValues((v) => ({ ...v, country: e.target.value }))
            }
          />
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-sm text-green-600">Profil mis à jour.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
