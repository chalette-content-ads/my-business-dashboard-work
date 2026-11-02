# Metric rules

Use metadata.as_of_date (end of day) as the reporting date. Use integer cents for money calculations, display MYR/RM, and keep dates as calendar dates to avoid browser timezone shifts. No current-clock ageing of this historical pack.

## Sales and cash

Eligible sales are non-cancelled rows with sale_date on or before the reporting date. All three remaining statuses count as confirmed order value. This is booked order value, not accounting revenue, profit, or marketplace settlement.

| Metric | Definition |
|---|---|
| Period order value | Sum eligible total_amount where sale_date is inside inclusive selected dates |
| Period order count | Count distinct eligible sale_id in selected sale-date range |
| Average order value | Period order value / period order count; unavailable if count is zero |
| Cash collected in period | Sum payment amount by payment_date in selected dates; associated sale must be eligible, but its sale_date need not fall in the selected period |
| Paid to date for a sale | Sum all its payments dated on/before reporting date |
| Outstanding balance | total_amount minus paid to date, across all eligible sales through reporting date |
| Overdue balance | Sum positive outstanding balances whose payment_due_date is strictly before reporting date |
| Overdue payment count | Distinct sales with positive overdue balances |

Payment dates on the reporting date count. A deadline on that date is due today, not overdue. A negative balance is a data error, not a value to silently clamp to zero. Do not filter historical receipts by the selected sales period when calculating balances.

Customer/channel filters propagate to related sales and payments through IDs. A channel filter on cash uses the associated sale's channel. Do not join raw payments to sales and then sum duplicated sale amounts.

## Operational measures

| Metric | Definition |
|---|---|
| Pending completion | Eligible sales with Confirmed or In Progress status |
| Overdue completion | Pending completion with promised_completion_date strictly before reporting date |
| Due today | Matching deadline equals reporting date |
| Available stock | on_hand_quantity minus reserved_quantity |
| Low-stock item | Available stock <= reorder_threshold, including equality |
| Out of available stock | Available stock = 0; this is a subset of low stock, not a second count to add |
| Open units by product | Sum quantity on its pending product sales |
| Unreserved pending units | max(0, open units minus reserved_quantity); label as unreserved demand, not a per-order allocation |
| Overdue follow-up (B2B) | Nonblank next_follow_up_date strictly before reporting date |
| Unassigned prospect (B2B) | customer_type = Prospect and account_owner is blank |
| Repeat customer in period | Customer with at least two eligible sales in the selected sale-date range; label this definition explicitly |

Stock is global shared stock. It is unchanged by sales channel/date filters. Label its own snapshot date and scope. Follow-ups are as of reporting date and do not vanish under a sales-period filter. Show these controls' scope visibly.

## Comparisons

Default August MTD comparison uses August 1–30 vs July 1–30 on Day 1, and August 1–31 vs July 1–31 on Day 2. Do not compare a partial month with a full prior month without labelling it. Growth = (current - prior) / prior. If prior is zero, show unavailable rather than infinity or an invented percentage.

Monthly trend bars may show June, July, August; clearly mark August as partial on Day 1. Profit, margin, ROAS, platform health, response rate, satisfaction, appointment attendance, and birthdays cannot be calculated from these files and should not appear as fabricated widgets.

Do not accept an arbitrary historical as-of date as if it could reconstruct past statuses or stock. Only the two supplied snapshots represent full supported as-of states. The sales date-range filter is an analysis filter, not time travel.
