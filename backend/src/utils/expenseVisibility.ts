/**
 * Règles de visibilité / classification des dépenses (confidentialité).
 *
 * - Dépense PARTAGÉE (de groupe) : visible par tous les participants du voyage.
 * - Dépense PERSONNELLE : visible UNIQUEMENT par celui qui l'a payée/créée.
 *   Sont personnelles : les dépenses dérivées (part d'une dépense partagée,
 *   parentExpenseId défini), les dépenses « perso » (une seule part = le payeur)
 *   et les dépenses legacy sans parts.
 */
export interface ExpenseVisibility {
  paidById: string;
  parentExpenseId?: string | null;
  shares?: { userId: string }[] | null;
}

/** Dépense générée automatiquement (part d'une dépense partagée). */
export const isDerived = (e: ExpenseVisibility): boolean => e.parentExpenseId != null;

/** Dépense personnelle (donc privée). */
export const isPersonalExpense = (e: ExpenseVisibility): boolean =>
  isDerived(e) ||
  !e.shares ||
  e.shares.length === 0 ||
  (e.shares.length === 1 && e.shares[0].userId === e.paidById);

/** Un utilisateur peut voir une dépense si elle est partagée, ou si elle est à lui. */
export const canSeeExpense = (e: ExpenseVisibility, userId: string): boolean =>
  !isPersonalExpense(e) || e.paidById === userId;
