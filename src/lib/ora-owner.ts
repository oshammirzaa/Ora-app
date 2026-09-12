import { createServerFn } from "@tanstack/react-start";

type OwnerBootstrapInput = { email?: string; password?: string };

function ownerBootstrapInput(data: OwnerBootstrapInput): OwnerBootstrapInput {
  return {
    email: String(data?.email || ""),
    password: String(data?.password || ""),
  };
}

/** Unsigned: creates the first owner only when the email matches ORA_OWNER_EMAIL. */
export const bootstrapOwner = createServerFn({ method: "POST" })
  .validator(ownerBootstrapInput)
  .handler(async ({ data }) => {
    const { bootstrapDesignatedOwner } = await import("./ora-owner.server");
    return bootstrapDesignatedOwner(data);
  });
