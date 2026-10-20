import { SignOutIcon } from "@phosphor-icons/react/ssr";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

import { signOut } from "../actions";

export async function SignOutButton() {
  const t = await getTranslations("auth");

  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        <SignOutIcon aria-hidden="true" />
        {t("signOut")}
      </Button>
    </form>
  );
}
