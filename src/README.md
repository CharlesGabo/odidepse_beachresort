# Frontend structure

The frontend is organized by page first, then by feature.

```text
src/
|-- main.jsx                         Application entry point
|-- assets/                          Images and videos used across pages
|-- pages/
|   |-- index/
|   |   |-- IndexPage.jsx            Public resort page composition
|   |   |-- features/
|   |   |   |-- chatbot/             Website booking chatbot
|   |   |   |-- gallery/             Resort and guest galleries
|   |   |   |-- stays/               Public stay cards
|   |   |   `-- weather/             Forecast and booking weather UI
|   |   `-- styles/                  Public-page styles
|   `-- admin/
|       |-- AdminPage.jsx             Admin page composition and session shell
|       `-- features/
|           |-- bookings/             Booking calendar/planning helpers
|           |-- dashboard/            Operations dashboard calculations
|           |-- facebook-automation/  Messenger, comments, and automation UI
|           `-- resort-management/    Stay, service, and content management
`-- shared/
    |-- resort/                        Resort context, formatting, and asset map
    |-- stay-photos/                   Photo UI shared by public and admin pages
    `-- styles/                        Application-wide foundation styles
```

## Placement rules

- Put code used by only one page under that page's `features/` folder.
- Keep a component beside its feature-specific stylesheet.
- Put code in `shared/` only when both the public and admin pages import it.
- Keep static media in `assets/`, public PHP endpoints in `api/`, and reusable PHP modules in `includes/`.
- When a feature grows, add components, hooks, and utilities inside that feature instead of adding files directly under `src/`.
