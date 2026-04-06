# Integration Guide

## Purchase ingest endpoints
POST `/ingest/website` and POST `/ingest/telegram`

Required fields:
- `nickname` (string)
- `amount` (number)

Recommended:
- `orderId` (string, unique per purchase)

Optional:
- `userId` (string)
- `phone` (string)
- `items` (string array)
- `factionPreference` (`darkness` or `light`)

Example payload:
```json
{
  "orderId": "order_12345",
  "nickname": "DynastyUser",
  "amount": 250,
  "phone": "+15551234567",
  "items": ["Dynasty Legacy Set"],
  "factionPreference": "light"
}
```

Success response (202):
```json
{
  "status": "accepted",
  "source": "website",
  "leaderboard": [],
  "activity": [],
  "rules": {},
  "user": {}
}
```

Duplicate response (200):
```json
{
  "status": "duplicate",
  "source": "website",
  "duplicate": true,
  "leaderboard": [],
  "activity": [],
  "rules": {},
  "user": {}
}
```

Error responses:
- 400: invalid payload, includes `details`
- 500: server error with `error` message

## Idempotency
If the checkout retries the same purchase, send the same `orderId`. The server will return `status: duplicate` and will not credit the user again.

## Telegram bot integration
The bot should POST the JSON payload above to `/ingest/telegram` after a successful payment. Map the Telegram handle to `nickname` and include an `orderId` from the payment or bot message ID to prevent duplicates.

## Admin authentication
For production, set:
- `ADMIN_JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Then POST `/admin/login` with:
```json
{ "username": "admin", "password": "your-password" }
```

Use the returned token in all admin requests:
`Authorization: Bearer <token>`
