/** Registers every MCP tool on a server instance. Reads always; writes only for the `full` tier. */
import type { McpServer, Tier } from "./helpers";
import { registerReads } from "./tools/reads";
import { registerTransactionWrites } from "./tools/transactions";
import { registerCategoryWrites } from "./tools/categories";
import { registerBudgetWrites } from "./tools/budgets";
import { registerTransferWrites } from "./tools/transfers";
import { registerIncomeWrites } from "./tools/income";
import { registerAllowanceWrites } from "./tools/allowances";
import { registerSavingsWrites } from "./tools/savings";
import { registerAccountWrites } from "./tools/accounts";
import { registerSettingsWrites } from "./tools/settings";
import { registerImportWrites } from "./tools/imports";

export function registerAllTools(server: McpServer, tier: Tier) {
  registerReads(server);
  if (tier !== "full") return; // read-only token: no write tools registered at all
  registerTransactionWrites(server);
  registerCategoryWrites(server);
  registerBudgetWrites(server);
  registerTransferWrites(server);
  registerIncomeWrites(server);
  registerAllowanceWrites(server);
  registerSavingsWrites(server);
  registerAccountWrites(server);
  registerSettingsWrites(server);
  registerImportWrites(server);
}
