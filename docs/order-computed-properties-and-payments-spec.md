# Order Computed Properties and Deferred Payments Spec

## Goal

Change order behavior so:

- Orders are created with zero payments by default.
- Payments are created later and attached to an existing order.
- `Order` responses expose computed properties:
  - `isDelivered`
  - `paymentStatus`
  - `totalPrice`

This spec defines the required backend, database, API, frontend, and migration work.

Important Prisma constraint:

- scalar-based computed fields can be exposed with Prisma Client `result` extensions
- relation-based computed fields cannot be implemented that way

For this feature:

- `isDelivered` may be exposed as a Prisma `result` extension because it only depends on `deliveredAt`
- `totalPrice` and `paymentStatus` must not be implemented as Prisma `result` extensions because they depend on relations

## Current State

### Database and API

- `Order.deliveryDate` currently exists in Prisma and is used as a regular persisted field.
- `Payment` rows are tied to `Order` by `orderId`.
- Order creation currently requires `payments`.
- Order update for items currently also requires `payments` and `total`.
- The backend validates that payment sum equals `dto.total`.
- The persisted `Order.total` is sent in API responses and used by the frontend as the order total.

### Frontend

- The order creation screen automatically sends one payment for the full order total.
- The order edit screen automatically replaces payments with one payment for the full total.
- Order list/detail views display `total` and raw `payments`, but do not expose `paymentStatus`, `totalPrice`, or `isDelivered`.
- There is no dedicated flow to add a payment to an existing unpaid or partially paid order.

## Target Behavior

### Delivery

- Add `deliveredAt DateTime?` to `Order`.
- `isDelivered` is computed as `deliveredAt !== null`.
- `deliveryDate` remains a scheduled/planned delivery date if the product/business still needs it.
- `deliveredAt` is the real fulfillment timestamp.

### Payments

- Creating an order must not create payments automatically.
- An order can have:
  - no payments
  - one payment
  - multiple partial payments
- `paymentStatus` is a computed enum declared in code, not in Prisma schema:
  - `UNPAID`
  - `PARTIALLY_PAID`
  - `PAID`

### Total price

- `totalPrice` is computed from order items:
  - `sum(orderItem.quantity * orderItem.price)`
- `totalPrice` is returned by the API.
- `paymentStatus` is computed by comparing:
  - paid amount = sum of all payment amounts
  - order amount = `totalPrice`

## Domain Rules

### Computed fields

- `isDelivered = deliveredAt !== null`
- `totalPrice = sum(quantity * price)` across all order items
- `paidAmount = sum(payment.amount)` across all payments
- `paymentStatus`:
  - `UNPAID` when `paidAmount === 0`
  - `PAID` when `abs(paidAmount - totalPrice) < tolerance`
  - `PARTIALLY_PAID` when `paidAmount > 0` and `paidAmount < totalPrice`

### Numeric tolerance

- Use a small tolerance for decimal comparisons, for example `0.01`.
- Keep calculation logic centralized in one backend helper to avoid different rounding behavior across endpoints.

### Overpayments

- Decide one of these policies before implementation:
  1. Reject overpayments at API level.
  2. Allow overpayments and still return `PAID`.

Recommended: reject overpayments. It is simpler and avoids hidden credit-balance behavior that does not exist elsewhere in the system.

## Prisma Capability Matrix

| Property | Prisma `result` extension possible? | Queryable in `where` / `orderBy`? | Needs relations? | Recommended implementation |
|---|---|---|---|---|
| `isDelivered` | Yes | No | No | Prisma `result` extension based on `deliveredAt` |
| `totalPrice` | No | No | Yes | service mapper/helper or DB view |
| `paymentStatus` | No | No | Yes | service mapper/helper plus query helper backed by `$queryRaw` or DB view |

Notes:

- Prisma `result` computed fields are runtime-only, not real DB columns.
- Prisma `result` extensions cannot depend on `orderItems` or `payments`.
- Even for `isDelivered`, queries must use `where: { deliveredAt: ... }`, not `where: { isDelivered: ... }`.

## Required Data Model Changes

### Prisma schema

Update `apps/api/prisma/schema.prisma`:

- In `model Order`:
  - add `deliveredAt DateTime?`
- Keep existing `deliveryDate` unless the business explicitly wants to rename its meaning.
- Do not add `paymentStatus`, `isDelivered`, or `totalPrice` to Prisma schema.
- Do not create a Prisma enum for `paymentStatus`.

### Migration

Create a Prisma migration that:

- adds nullable `deliveredAt` to `Order`
- does not backfill delivered rows automatically unless there is a real source of truth

Recommended backfill policy:

- leave `deliveredAt = null` for all existing orders
- do not infer delivery from `deliveryDate`

Reason:

- `deliveryDate` is currently a planned/scheduled date, not reliable proof of delivery
- auto-marking historical orders as delivered would create false data

## Required Backend Changes

### 1. Add application enum for payment status

Create a code-level enum in the API, for example in `apps/api/src/order/`:

```ts
export enum OrderPaymentStatus {
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
}
```

This enum must not be declared in Prisma schema.

### 2. Centralize order computed fields

Split this by field type.

#### 2.a. Scalar-only computed field in Prisma service

`isDelivered` may be exposed from Prisma itself through a `result` extension in `prisma.service.ts`, backed by `deliveredAt`.

Target usage:

```ts
const order = await this.prismaService.order.findFirst();
order.isDelivered;
```

Important limitations:

- `isDelivered` is still not queryable as `where: { isDelivered: true }`
- queries must use `deliveredAt` directly
- `$extends` returns a new client object, so the current `class PrismaService extends PrismaClient` pattern may need to be refactored to a wrapped extended client if the implementation chooses to expose extensions directly from the service

#### 2.b. Relation-based computed fields in order module

Add one helper in the order domain that receives an order with:

- `orderItems`
- `payments`
- `deliveredAt`

and returns the enriched order with:

- `totalPrice`
- `isDelivered`
- `paymentStatus`
- optionally `paidAmount` and `remainingAmount`

Recommended additional computed fields:

- `paidAmount`
- `remainingAmount`

They are not required by the request, but they simplify the frontend and reduce repeated logic.

Recommended formulas:

- `totalPrice = sum(quantity * price)`
- `paidAmount = sum(payment.amount)`
- `remainingAmount = max(totalPrice - paidAmount, 0)`

Reason for splitting:

- `totalPrice` and `paymentStatus` depend on relations and cannot be implemented as Prisma `result` extensions
- they must be computed after fetching an order with `include: { orderItems: true, payments: true }`

### 3. Stop requiring payments on order creation

Update `apps/api/src/order/dto/create-order.dto.ts`:

- remove required `payments`
- remove `ArrayMinSize(1)` for payments
- either:
  - remove the field completely from `CreateOrderDto`, or
  - keep it optional and ignore/forbid it during create

Recommended: remove `payments` from order creation DTO entirely.

Update `OrderService.create`:

- remove payment-total validation
- stop creating `payments` nested records during order creation
- keep item validation and stock deduction behavior
- compute and return the new computed fields in the response

### 4. Stop coupling item edits with payment replacement

Current behavior couples item replacement with `payments` and `total`.
That must change.

Update `apps/api/src/order/dto/update-order.dto.ts`:

- remove `payments` from item-update flow
- `items` and `total` may still be coupled if `total` remains persisted
- do not require payment payload when editing items

Update `OrderService.update` and `updateWithItemsAndStock`:

- remove the `hasPayments` dependency check
- remove payment-sum validation from item edits
- stop deleting/recreating payments during item edits
- preserve existing payments when order items are updated

Important consequence:

- if an order was partially paid and its item total changes, the system must recompute `paymentStatus` based on the new `totalPrice`

### 5. Decide the role of persisted `Order.total`

There are 2 valid approaches.

#### Option A: Keep `Order.total` persisted

- Continue storing `Order.total`.
- Validate that `Order.total` equals computed item total on create/update.
- Return both:
  - `total`
  - `totalPrice`

Pros:

- Smaller refactor.
- Lower risk.

Cons:

- Duplicated source of truth.

#### Option B: Remove `Order.total` later

- Make order item sum the single source of truth.
- Replace usage of `order.total` with computed `totalPrice`.

Pros:

- Cleaner model.

Cons:

- Larger refactor across API and frontend.

Recommended for this change: Option A.

Reason:

- The repository already depends on `total` in DTOs, validation, list pages, detail pages, and edit flows.
- This spec is already large because it adds deferred payments.

If Option A is chosen, define one invariant:

- `order.total` must always equal computed `totalPrice`

### 6. Add endpoints for payments on existing orders

There is currently no dedicated payment endpoint. Add one.

Recommended API design:

- `POST /orders/:id/payments`
- optional: `GET /orders/:id/payments`
- optional: `DELETE /orders/:id/payments/:paymentId`

Minimum required endpoint:

- `POST /orders/:id/payments`

Request body:

```ts
{
  amount: number;
  method: PaymentMethod;
}
```

Validation rules:

- `amount > 0`
- order must exist
- if overpayments are rejected:
  - `paidAmount + newPaymentAmount <= totalPrice + tolerance`

Response:

- recommended: return the full updated order with computed fields
- acceptable alternative: return created payment and let frontend refetch order

Recommended: return updated order. It reduces extra requests and keeps the client simple.

### 7. Add endpoint or behavior for marking delivered

There are 2 options.

#### Option A: use generic order update

Allow `PATCH /orders/:id` with:

```ts
{
  deliveredAt: string | null
}
```

#### Option B: dedicated delivery action

Add:

- `POST /orders/:id/deliver`
- or `PATCH /orders/:id/delivery`

Recommended: Option A.

Reason:

- Lower API surface.
- Fits current controller style.

Required DTO/API change:

- add optional `deliveredAt` to update DTO
- support setting a timestamp and clearing it with `null` if needed

### 8. Return computed fields from all order read/write endpoints

Every order response should return consistent computed fields:

- `POST /orders`
- `GET /orders`
- `GET /orders/:id`
- `PATCH /orders/:id`
- `POST /orders/:id/payments`

If this is not done consistently, frontend state will diverge depending on which endpoint produced the order object.

### 9. Prisma service

Do not put `paymentStatus` or `totalPrice` in Prisma `result` extensions inside `prisma.service.ts`.

Reason:

- `paymentStatus` depends on relation data (`payments`, `orderItems`)
- `totalPrice` depends on relation data (`orderItems`)
- Prisma `result` extensions do not support relation fields
- consistent relation-aware computation is easier in the order service layer after queries with `include`

`prisma.service.ts` may either:

- remain simple and leave all computed fields to the order service, or
- expose only scalar-only derived fields such as `isDelivered`

If Prisma extensions are added, use them only for scalar-only fields.

Recommended implementation location:

- `isDelivered`: optional Prisma `result` extension in `prisma.service.ts`
- `totalPrice`, `paymentStatus`, `paidAmount`, `remainingAmount`: service-level mapper/helper in the order module

### 10. Optional query helpers for payment status

If the application needs ergonomic methods such as:

```ts
this.prismaService.order.findPaid()
this.prismaService.order.findUnpaid()
this.prismaService.order.findPartiallyPaid()
this.prismaService.order.findByPaymentStatus("PAID")
```

do not implement them with in-memory filtering.

Reason:

- fetching all orders and filtering in application memory does not scale
- pagination becomes incorrect if filtering is done after fetch

Recommended implementations:

#### Option A: Prisma model extension backed by `$queryRaw`

- add model-level helper methods on `order`
- use SQL aggregation to find matching order IDs
- fetch matching orders with normal Prisma queries
- apply the order mapper/helper to return consistent computed fields

Use when:

- the team wants a Prisma-native calling style
- payment-status filtering must happen at DB level
- adding a DB view is not desired yet

#### Option B: PostgreSQL view mapped in Prisma

- create a DB view that joins `Order`, `OrderItem`, and `Payment`
- expose aggregated columns such as:
  - `totalPrice`
  - `paidAmount`
  - `remainingAmount`
  - `paymentStatus`
- map the view in Prisma as a read-only model

Use when:

- payment-status queries and sorting are common
- the team prefers DB-native computed read models
- read-only derived data is acceptable

Recommended choice for this repo:

- start with Option A if only a small number of payment-status queries are needed
- move to Option B if these queries become central and performance-sensitive

## Required Frontend Changes

### 1. Shared types

Update `apps/web/lib/types.ts`:

- add frontend enum:

```ts
export enum OrderPaymentStatus {
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
}
```

- update `Order` type to include:
  - `deliveredAt?: string | null`
  - `isDelivered: boolean`
  - `paymentStatus: OrderPaymentStatus`
  - `totalPrice: number`
- recommended:
  - `paidAmount: number`
  - `remainingAmount: number`

Update request types:

- `CreateOrderRequest`
  - remove `payments`
- `UpdateOrderRequest`
  - remove `payments`
  - add `deliveredAt?: string | null`
- add `CreateOrderPaymentRequest`
  - `amount: number`
  - `method: PaymentMethod`

### 2. API client

Update `apps/web/lib/api-client.ts`:

- remove payment payload from `createOrder`
- remove payment payload from `updateOrder`
- add method for creating order payments, for example:

```ts
async createOrderPayment(orderId: string, data: CreateOrderPaymentRequest): Promise<Order>
```

### 3. Order creation page

Update `apps/web/app/orders/calculator/page.tsx`:

- remove automatic full-payment creation
- remove payment method selection from create flow if it is only used for auto-payment
- submit order with:
  - customer/user
  - schedule fields
  - total
  - items
  - stock location
  - comment
- after creation, show unpaid state from API response

If the business still wants a fast path for “create and immediately register payment”, that must be a separate explicit UX, not implicit behavior.

### 4. Order edit page

Update `apps/web/app/orders/[id]/edit/page.tsx`:

- remove automatic payment replacement on save
- remove `paymentMethod` state if it only exists for forced replacement payment
- keep item editing and stock adjustment flow
- allow editing `deliveredAt` or a delivered toggle if included in this screen

Important:

- editing items must not delete historical payments

### 5. Order list page

Update `apps/web/app/orders/page.tsx`:

- display computed payment status
- display computed total price if that becomes the preferred UI value
- optionally display paid/remaining amounts
- add action for registering a payment on unpaid or partially paid orders
- optionally add filter by payment status

Recommended new columns:

- `paymentStatus`
- `paidAmount`
- `remainingAmount`
- `isDelivered` or a delivery badge

### 6. Order detail page

Update `apps/web/app/orders/[id]/page.tsx`:

- show:
  - `paymentStatus`
  - `totalPrice`
  - `paidAmount`
  - `remainingAmount`
  - `deliveredAt`
  - `isDelivered`
- keep payment list
- add a payment form/button for unpaid or partially paid orders
- add a mark-as-delivered action if delivery management is included here

Recommended payment form fields:

- amount
- method

Recommended UX:

- prefill amount with `remainingAmount`
- disable submission when `remainingAmount <= 0`

## Payment Creation UX Requirements

### Minimal UX

Implement at least one frontend entry point to register a payment:

- from order detail page

Optional additional entry points:

- from order list modal
- from a dedicated payments tab/section

### Suggested flow

1. User opens an unpaid or partially paid order.
2. User clicks `Add payment`.
3. Modal opens with:
   - amount
   - payment method
4. Frontend calls `POST /orders/:id/payments`.
5. API returns updated order with computed fields.
6. UI refreshes payments list and payment summary.

### Validation UX

- prevent zero or negative amounts
- if overpayments are rejected, show backend error message clearly
- hide or disable add-payment action for `PAID` orders

## Response Contract

The enriched `Order` response should look conceptually like:

```ts
{
  id: string;
  customerId?: string | null;
  userId?: string | null;
  deliveryDate?: string | null;
  deliveredAt?: string | null;
  total: number;
  totalPrice: number;
  isDelivered: boolean;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  paidAmount: number;
  remainingAmount: number;
  orderItems: [...];
  payments: [...];
}
```

Notes:

- `total` remains persisted if Option A is chosen.
- `totalPrice` is the computed total from items and should match `total`.
- `paymentStatus`, `paidAmount`, `remainingAmount`, and `isDelivered` are computed by backend code before returning the response.

## File-Level Change Plan

### Backend

- `apps/api/prisma/schema.prisma`
  - add `deliveredAt DateTime?`
- `apps/api/prisma/migrations/...`
  - add migration for `deliveredAt`
- `apps/api/src/prisma/prisma.service.ts`
  - optionally add Prisma `result` extension for `order.isDelivered`
- `apps/api/src/order/dto/create-order.dto.ts`
  - remove order-create payments requirement
- `apps/api/src/order/dto/update-order.dto.ts`
  - remove payment replacement fields
  - add optional `deliveredAt`
- `apps/api/src/order/order.service.ts`
  - remove automatic payment creation on order create
  - remove payment replacement on order update
  - add helper to compute relation-based response fields
  - use helper in all order responses
  - add payment creation method
- `apps/api/src/order/order.controller.ts`
  - add route for creating payments on an order
- `apps/api/src/order/`
  - add code enum for `OrderPaymentStatus`
  - add DTO for creating an order payment
  - add helper file for computed order values
  - optional: add Prisma model extension or query helper for `findByPaymentStatus`
- `apps/api/prisma/migrations/...`
  - optional later: add manual SQL for a DB view if the view-backed approach is chosen

### Frontend

- `apps/web/lib/types.ts`
  - add order payment status enum and new order fields
  - remove payment arrays from create/update order request types
  - add order payment request type
- `apps/web/lib/api-client.ts`
  - add order payment API method
- `apps/web/app/orders/calculator/page.tsx`
  - remove implicit payment creation
- `apps/web/app/orders/[id]/edit/page.tsx`
  - remove payment replacement behavior
- `apps/web/app/orders/page.tsx`
  - show payment/delivery computed state
  - add payment action entry point
- `apps/web/app/orders/[id]/page.tsx`
  - show payment summary and add-payment UI

## Migration and Compatibility Considerations

### Existing orders

- Existing `Payment` rows remain valid.
- Existing orders that already have one full payment should compute as `PAID`.
- Existing orders with no payments should compute as `UNPAID`.
- Existing orders with partial payment sums should compute as `PARTIALLY_PAID`.

### Existing frontend assumptions

Current UI assumes:

- order creation always includes a payment
- order editing can replace payments

These assumptions must be removed everywhere, or the frontend will keep sending obsolete payloads and break after the backend contract changes.

### Backward compatibility strategy

Recommended sequence:

1. Add `deliveredAt` migration.
2. Decide Prisma strategy for `isDelivered`:
   - Prisma `result` extension
   - or service-level only
3. Backend supports relation-based computed fields and no-payment order creation.
4. Backend supports payment creation endpoint.
5. If needed, add payment-status query helpers backed by `$queryRaw` or a DB view.
6. Frontend switches order create/edit flows to new contract.
7. Frontend adds payment registration UI.

If backend and frontend are deployed independently, temporary backward compatibility may be needed.

Recommended temporary compatibility behavior:

- backend may accept `payments` on create for a short transition period but should not require it
- frontend should be updated immediately after backend release

If both apps are deployed together, transition compatibility is optional.

## Acceptance Criteria

### Backend

- Creating an order with items and no payments succeeds.
- Created order returns:
  - `isDelivered = false`
  - `paymentStatus = UNPAID`
  - `totalPrice` equal to item sum
- Updating order items does not delete existing payments.
- Adding a partial payment changes status from `UNPAID` to `PARTIALLY_PAID`.
- Adding the remaining payment changes status to `PAID`.
- Setting `deliveredAt` marks `isDelivered = true`.
- Clearing `deliveredAt` marks `isDelivered = false`.
- All order endpoints return the same computed fields.

### Frontend

- User can create an order without entering a payment.
- User can open an unpaid or partially paid order and register a payment.
- Order detail and list show payment status correctly.
- Order edit no longer overwrites payment history.
- Delivery state is visible and editable according to the chosen UX.

## Suggested Test Cases

### Backend unit/integration

1. Create order with no payments.
2. Create order with multiple items and verify `totalPrice`.
3. Add payment smaller than total and verify `PARTIALLY_PAID`.
4. Add payment equal to remaining amount and verify `PAID`.
5. Verify `UNPAID` when no payments exist.
6. Verify `isDelivered` false when `deliveredAt` null.
7. Verify `isDelivered` true when `deliveredAt` set.
8. Update items on partially paid order and verify payments remain intact.
9. If overpayments are rejected, verify API rejects amount beyond remaining balance.

### Frontend

1. Create order without payment.
2. View unpaid order.
3. Add partial payment.
4. Add final payment.
5. Edit order items after partial payment and verify payment history still appears.
6. Mark order as delivered and verify badge/state changes.

## Recommended Implementation Order

1. Add `deliveredAt` migration.
2. Decide whether `isDelivered` will be exposed through Prisma `result` extension or only through the order mapper.
3. Add backend enum/helper for relation-based computed order fields.
4. Refactor order read endpoints to always return enriched orders.
5. Remove required payments from create/update order DTOs and service logic.
6. Add backend endpoint to create payments for an existing order.
7. If payment-status querying is needed now, add `$queryRaw`-backed model helpers or a DB view.
8. Update frontend shared types and API client.
9. Update create-order page to stop sending implicit payments.
10. Update edit-order page to stop replacing payments.
11. Add payment registration UI.
12. Add delivery UI if included in this change.
13. Add tests.

## Explicit Non-Goals

- Do not implement computed properties in Prisma schema.
- Do not store `paymentStatus` in the database.
- Do not store `isDelivered` in the database.
- Do not infer `deliveredAt` from legacy `deliveryDate`.
- Do not implement automatic payment creation on order creation.
- Do not try to implement `totalPrice` or `paymentStatus` as Prisma `result` extensions.
- Do not rely on in-memory filtering to implement `findByPaymentStatus` on non-trivial datasets.
