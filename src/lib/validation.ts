import { z } from "zod";

export const txTypeSchema = z.enum(["income", "expense"]);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

// `.strict()` rejects unknown fields outright. Without it, a client could
// post `{ amount, type, … , user_id: "victim" }` and Zod would silently strip
// `user_id` — the service layer ignores it anyway, but contract-loose APIs
// hide client bugs and grow attack surface.
export const transactionInputSchema = z
  .object({
    amount: z
      .number({ message: "Amount must be a number" })
      .finite("Amount must be a finite number")
      .gt(0, "Enter an amount greater than zero")
      .max(1_000_000_000, "Amount is too large"),
    type: txTypeSchema,
    description: z.string().max(140, "Description must be 140 characters or fewer"),
    category: z
      .string()
      .trim()
      .min(1, "Pick a category")
      .max(40, "Category is too long"),
    occurred_on: isoDateSchema,
  })
  .strict();

export type TransactionInput = z.infer<typeof transactionInputSchema>;

// PATCH /api/transactions/[id] — every field optional, at least one required.
export const transactionUpdateSchema = transactionInputSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  { message: "Send at least one field to update" }
);
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;

export const periodSchema = z.enum(["day", "week", "month", "year"]);

// Query-string parser for list / analytics endpoints.
export const txListQuerySchema = z.object({
  period: periodSchema.optional(),
  category: z.string().trim().min(1).max(40).optional(),
});

export const analyticsQuerySchema = z.object({
  period: periodSchema.optional().default("month"),
});

export const idSchema = z.string().uuid("Invalid id");

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}

// ---------------------------------------------------------------------------
// Bills / Subscriptions (M4)
// ---------------------------------------------------------------------------
export const billStatusSchema = z.enum([
  "upcoming",
  "due_week",
  "paid",
  "overdue",
]);

export const recurrenceSchema = z.enum(["none", "weekly", "monthly", "yearly"]);

export const billInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Give the bill a name")
      .max(60, "Name must be 60 characters or fewer"),
    amount: z
      .number({ message: "Amount must be a number" })
      .finite("Amount must be a finite number")
      .gt(0, "Enter an amount greater than zero")
      .max(1_000_000_000, "Amount is too large"),
    due_on: isoDateSchema,
    recurrence: recurrenceSchema,
  })
  .strict();

export type BillInput = z.infer<typeof billInputSchema>;

// PATCH /api/bills/[id] — partial bill update. Status may be sent on its own
// (drag-to-column flow) or alongside the editable fields.
export const billUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    amount: z
      .number()
      .finite()
      .gt(0, "Amount must be > 0")
      .max(1_000_000_000)
      .optional(),
    due_on: isoDateSchema.optional(),
    recurrence: recurrenceSchema.optional(),
    status: billStatusSchema.optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "Send at least one field to update",
  });

export type BillUpdate = z.infer<typeof billUpdateSchema>;
