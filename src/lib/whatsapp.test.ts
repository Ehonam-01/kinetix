import { describe, expect, it } from "vitest";
import { registerSchema } from "@/schemas/auth";
import { updateProfileSchema } from "@/schemas/profile";
import { toWhatsappDigits, whatsappHref } from "./whatsapp";

describe("WhatsApp numbers", () => {
  it("normalizes the usual ways of typing a number", () => {
    expect(toWhatsappDigits("+228 90 00 00 00")).toBe("22890000000");
    expect(toWhatsappDigits("00228-90.00.00.00")).toBe("22890000000");
    expect(toWhatsappDigits("(229) 01 97 50 50 50")).toBe("2290197505050");
    expect(toWhatsappDigits("90 00")).toBeNull();
    expect(toWhatsappDigits("+228 9O 00 00 00")).toBeNull();
    expect(toWhatsappDigits("")).toBeNull();
    expect(toWhatsappDigits(null)).toBeNull();
  });

  it("builds a wa.me link", () => {
    expect(whatsappHref("22890000000", "Bonjour Afi")).toBe(
      "https://wa.me/22890000000?text=Bonjour%20Afi",
    );
  });

  it("is required at sign-up, stored as digits", () => {
    const base = {
      fullName: "Afi Mensah",
      username: "afi",
      email: "afi@example.com",
      password: "motdepasse",
      sponsorUsername: "ehonam",
    };
    expect(
      registerSchema.safeParse({ ...base, whatsapp: "+228 90 00 00 00" }).data
        ?.whatsapp,
    ).toBe("22890000000");
    expect(registerSchema.safeParse({ ...base, whatsapp: "90" }).success).toBe(
      false,
    );
    expect(registerSchema.safeParse(base).success).toBe(false);
  });

  it("is optional in the profile, and checked when given", () => {
    const base = { fullName: "Afi Mensah", username: "afi" };
    expect(updateProfileSchema.parse({ ...base, phone: "" }).phone).toBe("");
    expect(
      updateProfileSchema.parse({ ...base, phone: "+228 90 00 00 00" }).phone,
    ).toBe("22890000000");
    expect(
      updateProfileSchema.safeParse({ ...base, phone: "abc" }).success,
    ).toBe(false);
  });
});
