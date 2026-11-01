# Sales Performance Summary

The new fourth report follows the five-page PDF layout. PDF figures are a design reference, not application data. All displayed values are requested from TRAACS for the selected calendar months and cost centres.

## Source Mapping

| Source | Use |
| --- | --- |
| `/api/reports/finance/profit-loss/monthly-accounts` | Monthly service income, expense accounts, service mix and heatmap |
| `/api/reports/finance/profit-loss/monthly-centers` | Service sales, accounting income, expenses and net profit per centre |
| `/api/reports/sales/dsr` and `/api/reports/sales/dsr-tickets` | Complete customer detail rows and top-five ranking |

The first two routes map to the existing TRAACS monthly account P&L and month-and-cost-centre P&L endpoints. The DSR next-page route is used whenever the first detail response is truncated.

## Definitions

- Service sales: the `base_dat_documentYYYYMM` totals returned by the centre report.
- Accounting income: category 3 ledger balances. This is not automatically labelled as sales excluding VAT.
- Expenses: category 4 balances from the same monthly account and centre reports.
- Net profit: accounting income minus expenses, including the selected Head Quarter overhead.
- Net margin: net profit divided by positive accounting income; no meaningful margin is shown without positive income.
- Monthly averages: total divided by the number of included months, including zero months and excluding gaps between nonconsecutive quarters.
- Top-five customer shares: each customer's net sales divided by the top-five total, as in the PDF. The top-two concentration uses the same denominator.
- Customer account names containing USD do not change the currency: all requests use base SAR.

## Reference Discrepancies

The PDF's first and third pages show January-September 2026 income of approximately SAR 10,779,040 and net profit of SAR 2,252,576. These imply expenses of approximately SAR 8,526,464. The fourth page instead shows expenses of SAR 8,681,241, producing net profit of about SAR 2,097,799. The fifth-page centre profits reflect this different expense set.

The new report uses one reconciled P&L set for every financial section. It does not reproduce the conflicting expense figures or infer VAT from the difference between service sales and accounting income.

## Completeness And Scope

1. Request exactly the calendar months selected; nonadjacent quarters produce separate, nonoverlapping requests.
2. Send the selected centre IDs to the account and DSR endpoints. The centre endpoint returns global data; reconcile its global rows against its summaries before selecting centres locally.
3. Check that both financial responses contain exactly the requested month keys in order, including zero months.
4. Fetch all reported account and DSR pages; reject missing rows, repeated accounts, changed counts and invalid numeric fields.
5. Reconcile monthly account income and expense totals against the selected centres. The existing P&L mapper also validates account totals and sales summaries.
6. Require every DSR row's document date to fall within the requested period and require loaded rows to equal the declared total.
7. Reconcile complete DSR customer sales against selected-centre service sales, for each month and the full period, to SAR 0.02. A discrepancy blocks the whole report and needs investigation in TRAACS; values are never adjusted to force a match.
8. Publish the report only after all sources and selected periods have completed. Filter changes clear the previous report and disable export.

Raw centre scope is selected before the existing 808/810 grouping. Administrative costs are included only when Head Quarter is selected. Only the period and centre options supported across all three sources are offered; financial periods are whole calendar months.

## Validation

`npm test -- --watch=false` covers reconciliation, selected-centre scope, nonconsecutive quarters, account pagination, missing months, out-of-period customer rows, null values and repeated pages. `npm run test:proxy` checks production DSR pagination routing.

Browser layout verification uses isolated mocked TRAACS responses. A separate authenticated live check on 29 October 2026 verified 1 January-30 September 2026 for all five cost-centre IDs: service sales SAR 11,462,547.88; accounting income SAR 10,779,039.52; expenses SAR 8,839,059.34; net profit SAR 1,939,980.18; margin 18.0%. The executive page reconciled all three sources, and the sales and cost-centre pages independently agreed on the financial totals. These current TRAACS expense figures differ from the older PDF reference.
