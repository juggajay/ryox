# Invoice Logic by Job Type - Design Document

## Overview

Implement different invoicing logic for Contract jobs vs Labour Hire jobs to match real-world billing practices and ensure Xero API compatibility.

## Job Types

### Contract Jobs - Progress Claims
- Invoice based on cumulative completion percentage
- User enters "job is X% complete"
- System calculates: (X% of quoted price) - already invoiced = this invoice

### Labour Hire Jobs - Weekly Invoicing
- Invoice based on weekly timesheet hours
- One invoice per job per week
- Line items show each worker's hours and rate

---

## Contract Job Invoice Flow

### User Flow
1. Click "Create Invoice"
2. Select a contract job
3. See: Quoted price, previously invoiced amount/percentage
4. Enter new completion percentage (must be > previous)
5. System shows calculated invoice amount
6. Confirm and create

### Calculation
```
quotedPrice = $15,000
completionPercent = 60%
previouslyInvoiced = $3,000 (20%)

targetAmount = quotedPrice × (completionPercent / 100)
             = $15,000 × 0.60 = $9,000

thisInvoiceAmount = targetAmount - previouslyInvoiced
                  = $9,000 - $3,000 = $6,000
```

### Validation Rules
- Completion % must be > previous highest invoiced %
- Completion % must be <= 100
- Cannot create invoice if already at 100%

### Xero Export Format
```javascript
LineItems: [
  {
    Description: "Kitchen Renovation - 123 Smith St\nProgress Claim: 60% complete",
    Quantity: 1,
    UnitAmount: 6000,
    AccountCode: "200"
  }
]
```

---

## Labour Hire Job Invoice Flow

### User Flow
1. Click "Create Invoice"
2. Select a labour hire job
3. See list of available weeks with approved timesheets
4. Select a week (e.g., "13-17 Jan 2025 - 3 workers, 114 hrs")
5. See worker breakdown and total amount
6. Confirm and create

### Calculation (per worker)
```
Worker: John Smith
Timesheets for week: Mon 8hrs, Tue 8hrs, Wed 7.5hrs, Thu 8hrs, Fri 6.5hrs
totalHours = 38
chargeOutRate = $85 (from allocation or worker default)
lineTotal = 38 × $85 = $3,230

Worker: Mike Jones
totalHours = 40
chargeOutRate = $90
lineTotal = 40 × $90 = $3,600

invoiceTotal = $3,230 + $3,600 = $6,830
```

### Validation Rules
- Week must have all timesheets approved (no pending)
- Week must not already be invoiced
- Each worker must have a charge-out rate

### Xero Export Format
```javascript
LineItems: [
  {
    Description: "Site Labour - 456 Jones Ave\nJohn Smith",
    Quantity: 38,      // hours
    UnitAmount: 85,    // rate
    AccountCode: "200"
  },
  {
    Description: "Site Labour - 456 Jones Ave\nMike Jones",
    Quantity: 40,
    UnitAmount: 90,
    AccountCode: "200"
  }
]
```

---

## Database Changes

### Jobs Table - Add Field
- `totalInvoicedAmount` (number) - cumulative amount invoiced for contract jobs

### Invoices Table - Add Fields
- `completionPercentage` (number, optional) - for contract progress claims
- `weekStart` (number, optional) - timestamp for labour hire weekly invoices
- `weekEnd` (number, optional) - timestamp for labour hire weekly invoices
- `lineItems` (array, optional) - for labour hire worker breakdown:
  ```typescript
  lineItems: [{
    workerId: Id<"workers">,
    workerName: string,
    hours: number,
    rate: number,
    total: number
  }]
  ```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Contract at 100% already invoiced | Hide job from invoice creation dropdown |
| Contract % less than previous | Validation error |
| Labour hire week has pending timesheets | Don't show week in selection |
| Labour hire week already invoiced | Don't show week (timesheets marked invoiced) |
| Worker has no charge-out rate | Use worker's default rate from profile |
| No approved timesheets for job | Show message, disable create |

---

## Files to Modify

### Backend (Convex)
- `convex/schema.ts` - Add new fields to invoices table
- `convex/invoices.ts` - Split create logic by job type, add queries for available weeks
- `convex/xero.ts` - Update exportInvoice to handle line items array

### Frontend
- `src/app/(dashboard)/invoices/page.tsx` - New create modal with job-type-specific forms

---

## Xero API Compatibility

Verified against [Xero API documentation](https://developer.xero.com/documentation/api/accounting/invoices):

Required LineItem fields:
- `Description` - string, required
- `Quantity` - number, required (zero or positive)
- `UnitAmount` - number, required
- `AccountCode` - string, required

Both invoice formats use standard Xero fields. Xero automatically calculates `LineAmount` from `Quantity × UnitAmount`.
