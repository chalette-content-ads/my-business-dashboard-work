// English texts of the "Match your columns" page that are looked up by name (so the
// translation test cannot find them in tr() calls): test/i18n.test.js checks that each
// has a Chinese translation in src/i18n/zh.js.

export const ROLE_TEXT = {
  Sales: ['Orders or invoices', 'One row per order or invoice. The dashboard needs this sheet.'],
  Customers: ['Customers', 'One row per customer. Optional.'],
  Payments: ['Payments received', 'One row per payment, with the order or invoice number it pays. Optional.'],
  Stock: ['Stock', 'One row per product or material. Optional.'],
};
export const ABSENT_TEXT = {
  Customers: 'No customers sheet: if the orders have a customer number, the customer list is made from them.',
  Payments: 'No payments sheet: the payments page, balances and payment reminders are hidden.',
  Stock: 'No stock sheet: the stock page and stock reminders are hidden.',
};
export const FIELD_TEXT = {
  'Sales.id': 'Order or invoice number', 'Sales.customer_id': 'Customer number', 'Sales.date': 'Order date', 'Sales.item_id': 'Product code',
  'Sales.description': 'What was sold', 'Sales.offering_type': 'Product or service', 'Sales.quantity': 'Quantity', 'Sales.unit_price': 'Unit price',
  'Sales.amount': 'Order amount (the total of the order)', 'Sales.channel': 'Sales channel', 'Sales.status': 'Status',
  'Sales.payment_due_date': 'Payment due date', 'Sales.promised_completion_date': 'Promised delivery or completion date', 'Sales.actual_completion_date': 'Actual completion date',
  'Customers.id': 'Customer number', 'Customers.name': 'Customer name', 'Customers.type': 'Customer or prospect', 'Customers.contact': 'Contact',
  'Customers.created_date': 'Date joined', 'Customers.owner': 'Person responsible', 'Customers.next_follow_up_date': 'Next follow-up date', 'Customers.notes': 'Notes',
  'Payments.id': 'Receipt or payment number', 'Payments.sale_id': 'Order or invoice number it pays', 'Payments.date': 'Payment date',
  'Payments.amount': 'Amount received', 'Payments.method': 'Payment method',
  'Stock.id': 'Product or material code', 'Stock.name': 'Name', 'Stock.snapshot_date': 'Stock count date', 'Stock.on_hand': 'Quantity on hand',
  'Stock.reserved': 'Reserved', 'Stock.reorder_threshold': 'Reorder level (restock below this)',
};
export const OPTION_TEXT = {
  Completed: 'Done (Completed)', 'In Progress': 'Being worked on (In Progress)', Confirmed: 'Confirmed, not started (Confirmed)',
  Cancelled: 'Cancelled or void, not counted (Cancelled)', Customer: 'Customer', Prospect: 'Prospect (not a customer yet)', Product: 'Product', Service: 'Service',
};
export const VALUE_TEXT = {
  'Sales.status': ['What do your status words mean?', 'Status means whether the order or service is done, not whether it is paid: payments are counted from the payments sheet. So "paid", "issued" or "unpaid" usually mean Done.'],
  'Customers.type': ['Customer or prospect?', 'Prospects are people who have not bought yet.'],
  'Sales.offering_type': ['Product or service?', ''],
};
