# Backend module structure

The files in this directory are private, reusable PHP modules. Public browser routes remain in `api/`; maintenance entry points remain in `scripts/`.

```text
includes/
|-- shared/       API helpers, authentication, database, and environment loading
|-- bookings/     Booking inventory and room-assignment logic
|-- resort/       Resort content, seed data, and stay-photo rules
|-- automations/  Shared booking conversations and Facebook delivery
`-- weather/      Weather-provider integration and forecast summaries
```

## Placement rules

- Put cross-feature infrastructure in `shared/`.
- Put business logic in the folder for the feature it implements.
- Keep public request handling in `api/`; do not expose files in `includes/` directly.
- Keep scheduled or command-line entry points in `scripts/` and have them load the appropriate include.
- Preserve the existing `includes/stay-photo-storage/` path because uploaded files may already exist there.
