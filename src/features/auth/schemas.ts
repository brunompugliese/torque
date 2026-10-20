import { z } from "zod";

import { currentPasswordField, emailField } from "@/lib/validation/fields";

// Shared by LoginForm (client) and signIn (server). The password is only
// required: existing users sign in with the password they already have.
export const loginSchema = z.object({
  email: emailField,
  password: currentPasswordField,
});

export type LoginInput = z.infer<typeof loginSchema>;
