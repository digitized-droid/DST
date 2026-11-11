# Descanso Daily Sales Tracker (DST)

A separate, private financial workspace for Descanso Comida • Cafe. This project reuses the original Descanso website's visual language, all 50 coordinated themes, the Black & White default, and the corresponding numbered logo artwork. The public event packages, buffet menu, gallery, and customer-facing content have been replaced with a daily sales and finance tracker.

## Included

- Private administrator sign-in. The tracker is hidden until a Supabase Auth session is available.
- Daily DST records by business date, with opening and closing cash denomination counts for ₱1,000, ₱500, ₱200, ₱100, ₱50, ₱20, ₱10, ₱5, and ₱1.
- Cash payments, online payments, Grab delivery orders, refunds, discounts, expenses, optional cashier petty cash, food loss records, and inventory.
- Automatic editable order numbering: Cash and Online Payments share one sequence, while Grab Delivery has a separate sequence. The next suggestion increments the most recently typed or edited numeric order number in that sequence (not necessarily the highest number), preserves leading zeroes, and does not reuse numbers from soft-deleted entries. Editing an order number immediately updates the basis for the next suggestion using a monotonic edit timestamp, so a manual edit always takes priority over stale, duplicated, or future timestamps from older/cloud records; changing an amount or note does not.
- Live daily calculations for net sales, Grab net sales, expenses, petty cash, expected closing cash, cash difference, funds after expenses, and the suggested sales fund.
- A flexible next-day opening float. The default is ₱3,000 but it can be changed in settings or for each DST.
- Yearly and monthly reports, with a daily record drill-down for every month.
- CSV report export and full JSON backup/restore. Restore merges daily records by date and transaction rows by ID instead of blindly duplicating them.
- Local-first saving, offline drafts, pending cloud synchronization, and Supabase Realtime refresh across signed-in devices.
- All original 50 themes, the Black & White default, and matching numbered logos. Muted and accent text colors are automatically adjusted when needed to improve contrast on every palette.
- Responsive desktop and mobile layouts and an installable offline app shell.

## Finance calculations

The tracker keeps sales, cashier float, and expenses distinct so the reports remain understandable:

- **Net sales** = cash payments + online payments − cash and online refunds. Enter payment amounts as the actual amount collected after discounts. Discounts are recorded separately and displayed in reports, so they are not deducted twice.
- **Grab net sales** = Grab orders − Grab refunds. Grab is reported separately from regular cash and online net sales.
- **Petty cash** = expenses whose source is marked `Cashier / petty cash`. This is optional and is only included when money is actually taken from the cashier.
- **Funds after expenses** = opening cash + regular net sales + Grab net sales − all recorded expenses.
- **Suggested sales fund** = funds after expenses − the selected next-day opening float (never below zero).
- **Expected closing cash** = opening cash + cash payments − cash refunds − cashier petty cash − cash transferred from the drawer to the sales fund.
- **Cash difference** = actual closing denomination count − expected closing cash.

The sales fund estimate is a suggestion, not a locked amount. Set the next-day opening float to ₱3,000 or another amount, record the actual cash transferred from the drawer, and count the closing denominations. Online and Grab receipts are included in business funds but are not treated as physical cashier cash.

## Supabase setup (required for sign-in and private cloud records)

The browser uses the Supabase publishable key in `config.js`. A publishable key is designed for browser use; never place a secret/service-role key in this file.

1. Open the separate Descanso Supabase project configured in `config.js`.
2. In **Authentication → Users**, create the authorized administrator account. Disable public sign-ups if only one administrator should have access.
3. Copy the administrator's UUID.
4. Open `supabase/setup.sql`, replace `ADMIN_USER_UUID` with the administrator UUID (keep the single quotes), and run the complete SQL in Supabase SQL Editor.
5. Confirm that the two new tables exist: `descanso_finance_days` and `descanso_finance_meta`.
6. Deploy this entire folder to a static host using HTTPS (for example, Netlify or GitHub Pages).
7. Visit the deployed website while online and sign in with the authorized administrator account.
8. Test a sample DST, sign out, and confirm that the login gate prevents access. Sign in again and verify that the saved record returns.
9. Load the site once while online before testing offline use. A previously authenticated device can continue using its locally stored session and local records while offline after the app shell and Supabase browser client have been cached during an online visit; new sign-ins and cloud synchronization require a connection.

### Privacy and access model

- The application does not render the finance dashboard without a Supabase Auth session.
- Row Level Security is enabled on both finance tables. Only the authenticated UUID stored as `owner_id` can read, insert, update, or delete the records.
- Anonymous visitors have no table permissions and no RLS policy.
- Do not share the administrator login. For additional staff accounts, update the SQL/RLS ownership model deliberately before creating them.
- The old `descanso_site` event-website table is not read by this app. The migration does not drop or erase that old table; it creates separate private finance tables. Old browser package/menu content is cleared from the legacy local-storage key when the tracker starts; the previously selected theme is migrated to the new theme preference key.

## Saving, merging, and offline behavior

- Each business date is stored as its own cloud row, rather than overwriting one shared website-content document.
- Draft changes are saved to local storage scoped to the signed-in administrator UUID, so another signed-in account on the same browser does not inherit that local finance cache. The **Save daily DST** button marks the dated record as saved and attempts cloud synchronization.
- If the device is offline, records remain local and are queued for synchronization when the connection returns.
- When cloud data is received, daily records are matched by business date and transaction rows are matched by unique IDs. Newer record fields are preferred, while unique transaction rows from both copies are retained. Removed rows use deletion markers so they do not reappear during a merge.
- Inventory settings and stock records are merged by their IDs.
- A JSON backup can be restored; records with the same date are merged rather than duplicated.
- This is designed for a small internal team. Avoid editing the exact same transaction on two devices at the same time; review the daily DST after simultaneous edits.

## Using the tracker

### Daily DST

1. Choose the business date.
2. Count opening cashier denominations.
3. Add cash payments, online payments, and Grab delivery orders with their order numbers.
4. Add refunds, expenses, optional petty cash, discounts, and food losses when applicable.
5. Add food items in **Inventory** before using them in the loss dropdown.
6. Count closing cashier denominations.
7. Enter the actual cash transferred from the cashier, if any, and choose the amount to leave for the next day's opening.
8. Review expected closing cash, actual closing cash, cash difference, funds after expenses, and suggested sales fund.
9. Save the DST.

### Reports & Data

Choose a year to see yearly net sales, expenses, money received, and Grab net sales. The monthly table always displays January through December. Select a month to reveal the individual DST dates and their opening cash, money received, expenses, net sales, and Grab net sales.

### Inventory

Add the food or stock items used by the cafe. The loss tracker uses this list as its dropdown. Restocking adds quantity, and loss entries in daily DST records reduce the calculated available stock. Removing an item only hides it from the active dropdown; historical loss records remain intact.

## Notes

- All amounts use Philippine pesos (PHP).
- The initial stock list is intentionally empty; add the current stock items rather than inheriting the old public buffet menu as inventory.
- The default next-day opening float is ₱3,000 and is editable.
- The app has not been connected to or tested against the live Supabase project from this environment. Run the SQL and test sign-in, RLS, saving, synchronization, and backups before using it for actual business records.
