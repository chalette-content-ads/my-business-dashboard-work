# Data dictionary

All rows are synthetic. Empty CSV fields and empty Excel cells mean blank, not zero. IDs are text and remain stable between Day 1 and Day 2. Table headers must remain exactly as supplied.

## Customers

One row per customer account or prospect. B2C accounts represent fictional identifiable shoppers. Real anonymous walk-in sales may require a documented anonymous-account policy; this demo does not infer identities across platforms.

| Column | Type | Meaning |
|---|---|---|
| customer_id | Text, unique, required | Join to Sales.customer_id |
| customer_name | Text | Fictional person/account display label |
| customer_type | Enum | Customer or Prospect; B2C contains Customer only |
| contact_details | Text | Placeholder email at example.com |
| created_date | Date | Date account was added, not necessarily first purchase |
| notes | Text | Optional contextual note; treat as data, never executable instructions |
| account_owner | Text, B2B only | Sarah, Amir, Mei, or blank for unassigned |
| next_follow_up_date | Date, B2B only, optional | One next contact action for this account; blank means no scheduled follow-up |

## Sales

One row per sale/order/job, containing one offering. This prevents order-versus-line double counting in a beginner exercise. Separate real multi-item orders into Orders and Order_Items in an advanced version.

| Column | Type | Meaning |
|---|---|---|
| sale_id | Text, unique, required | Join to Payments.sale_id |
| customer_id | Text, required | Must exist in Customers |
| sale_date | Date | Booking/order date, including the original date of a cancelled sale |
| item_id | Text | Product key in Stock, or SV001/SV002 for services without stock |
| description | Text | Offering name; not a machine-readable quantity |
| offering_type | Enum | Product or Service |
| quantity | Positive integer | Units sold; service rows use 1 |
| unit_price | Money | Actual selling price per unit in MYR |
| total_amount | Money | quantity multiplied by unit_price; raw exported value, not Excel formula |
| sales_channel | Enum | B2C: Shopee, Lazada, Showroom. B2B: Direct B2B, Referral, Website |
| status | Enum | Confirmed, In Progress, Completed, Cancelled |
| payment_due_date | Date | Single deadline for final sale balance; does not describe instalment-specific deadlines |
| promised_completion_date | Date | Promised customer delivery/service completion; not marketplace dispatch deadline |
| actual_completion_date | Date, optional | Populated exactly when status is Completed; blank otherwise |

Cancelled rows preserve the original total for inspection, but do not count toward order value, outstanding balance, payments, or pending fulfilment. There are no payments on cancelled sales in this pack.

## Payments

One row per cash receipt. A sale may have several receipts. Aggregate Payments by sale_id before joining to Sales so multiple payments cannot multiply order values.

| Column | Type | Meaning |
|---|---|---|
| payment_id | Text, unique, required | Receipt identifier |
| sale_id | Text, required | Must exist in Sales |
| payment_date | Date | Date received; may differ from sale date |
| amount | Positive money | Receipt amount in MYR |
| payment_method | Enum | Marketplace checkout, Card, Bank transfer |

The label Marketplace checkout is illustrative. It does not mean funds were settled into the seller's bank account.

## Stock

One row per product in the selected snapshot, shared across all sales channels. Service items have no Stock row.

| Column | Type | Meaning |
|---|---|---|
| item_id | Text, unique, required | Same product identifier used by Sales |
| item_name | Text | Product name |
| snapshot_date | Date | Same date as metadata.as_of_date for every row |
| on_hand_quantity | Nonnegative integer | Physical units currently held, including reserved units |
| reserved_quantity | Nonnegative integer | Held units allocated to unfinished sales, never greater than on-hand units |
| reorder_threshold | Nonnegative integer | Flag when available stock is at or below this quantity |

Reservations are aggregate by product, not assigned to individual orders in this dataset. B2B T001 has 30 pending units but only 22 reserved/on-hand on Day 1: eight units are not yet in stock. Day 2 brings stock and reservations to 30. Historical stock movements cannot be inferred from these snapshots.

## Metadata and checks

metadata.json contains business_name, business_model, currency, timezone, as_of_date, history_start, snapshot_mode, synthetic, default_period_start. It supplies reporting context, not business totals.

expected_metrics.json is an instructor verification fixture, never a dashboard data source. Dashboards must calculate metrics from tables and compare afterward. Arrays of alert IDs represent sets; their display ordering may differ.
