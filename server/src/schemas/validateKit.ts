import { KitSchema, type Kit } from "./kit.schema";

export type ValidationResult =
  | { valid: true; kit: Kit }
  | { valid: false; errors: string[] };

export function validateKit(data: unknown): ValidationResult {
  const result = KitSchema.safeParse(data);

  if (result.success) {
    return { valid: true, kit: result.data };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );

  return { valid: false, errors };
}