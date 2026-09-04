# Smart Mandi Queue

Build "Smart Mandi" — a farmer procurement queue and slot-booking platform for agricultural mandis (procurement centres).

CONTEXT

Farmers currently show up at procurement centres with no visibility into wait times. This app lets farmers book a slot ahead of time, see their live queue position, and lets centre operators manage the queue and log procurement/payment. It's built for SIH 2026 problem statement 26032.

USER ROLES (use Supabase Auth with a role field: farmer / operator / admin)

1. Farmer — registers, books a slot, sees live queue status

2. Operator — runs a single procurement centre's queue for the day

3. Admin — sees stats across all centres

CORE FEATURES (build these first, in this order)

1. Farmer registration + profile

   - Name, phone number, village/location, preferred commodities

   - Simple auth (phone or email + password)

2. Slot booking

   - Farmer selects: commodity, quantity, procurement centre, date, time slot

   - On confirm, generate a sequential token number (per centre, per day)

   - Show a booking confirmation screen with the token

3. Live queue status (the key "wow" feature)

   - Farmer-facing screen shows their token, current position in queue, and estimated wait time

   - Must update in real time as the operator advances the queue — use Supabase Realtime subscriptions on the queue/tokens table, not polling

   - Wait time formula: keep it simple and explainable — e.g. average_service_time_per_commodity × (position in queue) + buffer_minutes. Store this as a visible, human-readable calculation, not a black box.

4. Operator dashboard (per centre)

   - List of today's booked tokens for their centre, in queue order

   - "Call next token" button — advances the queue, which the farmer's screen picks up live

   - Mark each farmer as arrived / served / no-show

   - Log procurement details on serve: quantity received, price, payment status

5. Admin dashboard

   - Cross-centre overview: today's totals, tokens served, average wait time per centre

   - A simple chart (e.g. bar or line) of today's activity per centre

6. Notifications (basic)

   - In-app notification/banner when a farmer's token is close to being called

   - Leave a clearly marked stub/placeholder for SMS integration (don't build a real SMS integration yet)

DATA MODEL (Supabase/Postgres tables)

- farmers: id, name, phone, village, preferred_commodities

- centres: id, name, location

- commodities: id, name, avg_service_time_minutes

- slots: id, centre_id, date, time_slot

- tokens: id, farmer_id, centre_id, commodity_id, slot_id, token_number, status (booked/arrived/served/no_show), created_at

- transactions: id, token_id, quantity, price, payment_status, served_at

DESIGN / UX

- Mobile-first — real users are on basic Android phones, not laptops. Large tap targets, high contrast, minimal text entry.

- Clean, simple, not cluttered — this needs to demo well to judges who see it for 2–3 minutes.

- Use a calm, agricultural-appropriate color palette (greens/earth tones), not a generic SaaS look.

EXPLICITLY DO NOT BUILD YET (out of scope for this version)

- Hindi/English language toggle

- Voice assistance

- Anomaly detection or advanced analytics

- Offline mode

- Real WhatsApp/SMS sending

- Rescheduling bookings

Start by scaffolding the three role-based views (farmer, operator, admin) with routing and auth, then build the booking flow end-to-end (registration → book slot → token generated), then wire up the live queue with Realtime, then the operator "call next" action, then the admin dashboard.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a4725c05-a613-4422-bc31-f893cf240217).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
