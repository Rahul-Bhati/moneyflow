import { z } from "zod";

export const txTypeSchema = z.enum(["income", "expense"]);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const transactionInputSchema = z.object({
  amount: z
    .number({ message: "Amount must be a number" })
    .finite("Amount must be a finite number")
    .gt(0, "Enter an amount greater than zero")
    .max(1_000_000_000, "Amount is too large"),
  type: txTypeSchema,
  description: z.string().max(140, "Description must be 140 characters or fewer"),
  occurred_on: isoDateSchema,
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const idSchema = z.string().uuid("Invalid id");

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}
