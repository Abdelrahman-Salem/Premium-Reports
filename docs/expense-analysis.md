# Expense Analysis

Expense Analysis replaces the former service-sales page, occupying the first Additional reports slot and opening by default. It combines the supplied four-page Expense Report and two-page Monthly Expenses designs. Navy (`#1b365d` / `#0f2444`), red (`#b23a3a`) and pale grey are used for group bars, rankings and monthly columns. PDF reference figures are never application defaults.

## Sources and completeness

- `/api/reports/finance/profit-loss/monthly-accounts`: ledger IDs, categories and signed monthly balances.
- `/api/reports/finance/profit-loss/monthly-centers`: independent monthly category summaries and centre totals.

`ExpenseReportService` calls the financial-only entry point of `ExecutivePerformanceService`. This reuses the existing account pagination, requested-month validation, raw centre selection, reconciliation and period merging without requesting DSR/customer rows or changing the comprehensive report's loading behavior.

Account paging uses reported counts when supplied, and continues after a full page when the count is null. Repeated ledger identities, changing counts, missing month fields, null/non-numeric balances, out-of-scope month keys and discrepancies above SAR 0.02 are rejected. Account totals are checked against their months; monthly ledger totals are reconciled against selected centres. Global centre summaries are verified before selecting raw centre IDs and applying the existing Jeddah/G.S.E display grouping.

No dashboard or export becomes available until all selected periods finish. Changing period/centre filters cancels the current load, clears old data and disables export. Nonadjacent quarters generate separate nonoverlapping requests. Periods can cross years; quarter selection is for a single year. Currency is base SAR and granularity is calendar months.

## Calculations and classification

- Expenses use category 4 only. No sales or customer earnings are substituted.
- Total expenses sum all included signed monthly ledger balances.
- Average monthly expenses divide by the number of selected months, including zero months and excluding gaps between quarters.
- Account, group and month shares use total displayed expenses as denominator. No percentage is shown with a zero/negative denominator. Negative adjustments retain their sign and reduce the total.
- Top-five account/month rankings use positive balances. Each monthly card ranks its own month's positive ledger balances; its header total still includes every ledger and reversal.
- The 11 PDF groups map to stable ledger IDs in `expense-report.models.ts`, rather than account codes, which are not unique in this dataset. Each ledger is classified once. New IDs remain included under Unclassified expenses.

Group/account display filters recalculate KPIs, groups, rankings and monthly values from the already verified dataset. The centre chart is omitted while these filters are active: the available APIs do not provide that combined ledger-by-centre breakdown. The displayed/exported scope identifies the chosen group/account. Current/future months carry a calendar-status note; verified source completeness does not assert that a financial month is closed.

## PDF

The existing exporter creates a portrait dashboard PDF with company branding, period/centre/account scope and the Codit footer. Group details are always visible in both the page and export, without collapse controls. All months are included in windows of at most 12, and monthly cards and ledger rows define safe page breaks. Expense sections pack together instead of forcing a separate page per small chart. Export from a phone uses the full report layout.

## Reference reconciliation and verification

The supplied 21 November 2026 response contains 76 expense ledgers and 11 months, totalling SAR 9,927,526.90. Monthly Expenses displays the same total rounded to SAR 9,927,527. The classification PDF displays an older/different SAR 9,879,420. Differences include Brokerage Fees (907,400 versus 924,400), Office Rent (304,125 versus 324,125), and Iqama Renewal (176,425 versus 181,000). The PDFs alone do not establish why their extraction scopes/dates differ.

The regression fixture in `expense-overview/testing` is used only by tests. Tests cover all reference ledgers and month totals, classification coverage, negative adjustments, group/account scopes, null-count pagination, duplicate codes, incomplete/mismatched sources, nonadjacent quarters, year boundaries, cancellation, language changes and export integration.

Authenticated local-browser verification against TRAACS on 21 November 2026 separately confirmed:

| Scope | Expenses (SAR) | Months |
| --- | ---: | ---: |
| January-November, all five centres | 9,927,526.90 | 11 |
| January-November, G.S.E only | 5,178,560.16 | 11 |
| Q1 and Q3, all five centres | 5,674,137.30 | 6 |

Every case passed monthly financial reconciliation. Browser layout/PDF checks also use isolated responses with the supplied account balances and explicitly synthetic centre allocations; these are separate from the authenticated checks above.
