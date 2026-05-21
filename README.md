# SkyBook ✈️

A modern flight booking single-page application built with **React 19**, **Vite 8**, **Tailwind CSS v3**, and **React Router v6**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Pages & Routes](#pages--routes)
- [Component Reference](#component-reference)
- [State Management](#state-management)
- [Utilities & Hooks](#utilities--hooks)
- [Styling System](#styling-system)
- [Data Layer](#data-layer)

---

## Features

| Feature | Details |
|---|---|
| **Flight search** | Origin, destination, date picker, passenger selector (1–9); submits to `/results` as URL query params |
| **Search results** | 500ms loading spinner, partial-match destination filter, staggered card fade-in, 3-way sort sidebar |
| **Multi-step booking** | 3-step flow: Seat Selection → Passenger Info → Confirmation |
| **Interactive seat map** | 30 rows × 6 seats (A–F), 3 cabin classes, deterministic occupied seats (~30%), smooth hover/select animations |
| **Passenger form** | First name, last name, email, phone — inline validation with red border + error messages |
| **Booking confirmation** | Animated green checkmark hero, full price breakdown, saves to global context |
| **My Bookings** | Lists all bookings with seat chips, passenger name, total price; inline two-button cancel confirmation |
| **Toast notifications** | Slide-in toasts (bottom-right) on booking confirmed and booking cancelled |
| **404 page** | Custom not-found page with links back to Home and My Bookings |
| **Page titles** | `document.title` updates per route via `usePageTitle` hook |
| **Scroll-aware navbar** | Gains `shadow-md` once the user scrolls past 8 px |
| **Fully responsive** | Mobile-first layout across every page |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Routing | React Router v6 |
| Styling | Tailwind CSS v3 + custom keyframe animations |
| Fonts | Inter via Google Fonts (weights 400–800) |
| Language | JavaScript (ESM) |

---

## Project Structure

```
skybook/
├── public/
├── src/
│   ├── components/
│   │   ├── FlightCard.jsx       # Destination card with book / booked states
│   │   ├── Navbar.jsx           # Sticky nav, scroll shadow, active-link underline
│   │   └── SeatMap.jsx          # Interactive 30-row cabin seat picker
│   ├── context/
│   │   ├── BookingsContext.jsx  # Global bookings state (add / remove)
│   │   └── ToastContext.jsx     # Toast notification system
│   ├── data/
│   │   └── flights.js           # 6 sample flight destinations
│   ├── hooks/
│   │   ├── useBookings.js       # Re-export convenience hook
│   │   └── usePageTitle.js      # Sets document.title per route
│   ├── pages/
│   │   ├── Booking.jsx          # 3-step booking flow
│   │   ├── Home.jsx             # Hero + search form + destination grid
│   │   ├── MyBookings.jsx       # Booking list with cancel confirmation
│   │   ├── NotFound.jsx         # 404 page
│   │   └── SearchResults.jsx    # Filtered results with sort sidebar
│   ├── utils/
│   │   └── format.js            # formatPrice, formatDate, formatSearchDate, parseDurationMinutes
│   ├── App.jsx                  # Router, providers, footer
│   ├── index.css                # Tailwind directives + global utility classes
│   └── main.jsx
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server  (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview the production build locally
npm run preview
```

---

## Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | `Home` | Hero section, search form, popular destinations, feature cards |
| `/results?…` | `SearchResults` | Filtered flight cards with sort sidebar |
| `/booking/:flightId` | `Booking` | Multi-step booking: seats → passenger → confirm |
| `/my-bookings` | `MyBookings` | All confirmed bookings, cancel flow |
| `*` | `NotFound` | 404 fallback |

### Search query params (`/results`)

| Param | Type | Example |
|---|---|---|
| `origin` | string | `London` |
| `destination` | string | `Paris` |
| `date` | YYYY-MM-DD | `2026-06-15` |
| `passengers` | number string | `2` |

---

## Component Reference

### `<Navbar />`

- Sticks to `top-0` with `z-50`
- Passive `scroll` listener sets `scrolled` state; nav gains `shadow-md` when `window.scrollY > 8`
- Active route link: bold blue text + 2px blue bottom border via React Router's `NavLink` `className` function prop

---

### `<FlightCard flight={…} style={…} />`

Displays a destination card with image, city name, IATA code badge, price, and a CTA.

| Prop | Type | Notes |
|---|---|---|
| `flight` | object | One entry from `popularDestinations` |
| `style` | CSSProperties | Optional — pass `{ animationDelay }` for stagger |

- Reads `BookingsContext` to know if the flight is already booked
- **Booked state**: green `✓ Booked` badge on the image; CTA becomes "View booking" link to `/my-bookings`
- **Available state**: "Book Now" link to `/booking/:id`
- Image zooms to `scale-110` on hover; card lifts with the `.card-hover` utility

---

### `<SeatMap flightId passengerCount selectedSeats onSeatToggle />`

Interactive cabin visualization.

| Prop | Type | Description |
|---|---|---|
| `flightId` | number | Seeds the deterministic occupied-seat RNG |
| `passengerCount` | number | How many seats may be selected |
| `selectedSeats` | string[] | e.g. `["3A", "3B"]` |
| `onSeatToggle` | `(seatId) => void` | Called on seat click |

**Cabin layout**

| Rows | Class | Surcharge |
|---|---|---|
| 1–2 | First Class | +$150 / seat |
| 3–6 | Business | +$80 / seat |
| 7–30 | Economy | Included |

- Occupied seats are generated with a seeded LCG RNG — the same flight always shows the same map across renders
- Seat states: white = available · green hover = hovered · blue + ✓ = selected · grey = occupied
- When `passengerCount` seats are already selected, remaining available seats dim to 40 % opacity

**Named exports** (used by `Booking.jsx`):

```js
import { getSeatSurcharge, getSeatLabel } from '../components/SeatMap'

getSeatSurcharge('1A')  // → 150
getSeatSurcharge('4C')  // → 80
getSeatSurcharge('12F') // → 0
getSeatLabel('1A')      // → 'First Class'
getSeatLabel('4C')      // → 'Business'
getSeatLabel('12F')     // → 'Economy'
```

---

### `<Booking />` — 3-step wizard

#### Step 1 – Seat Selection

- Passenger count stepper (1–9); changing the count resets seat selection
- Embeds `<SeatMap>` with a live selected-seats summary panel showing class and per-seat surcharge
- "Passenger Info →" button is disabled until exactly `passengerCount` seats are selected

#### Step 2 – Passenger Info

- Controlled form: first name, last name, email (regex validated), phone (regex validated)
- Errors render inline below each field with a `⚠` prefix; each error clears as the user types
- `noValidate` on the `<form>` suppresses browser native validation UI

#### Step 3 – Confirmation

- `CheckmarkHero` — large emerald circle + SVG check, `animate-scale-in` on mount
- Summary blocks: Flight · Seats · Lead Passenger · Price Breakdown
- Total displayed in blue-600 at 18 px
- "Confirm Booking ✓" (emerald) calls `addBooking`, fires a success toast, then navigates to `/my-bookings`

---

## State Management

### `BookingsContext`

Wrap your tree with `<BookingsProvider>` (done in `App.jsx`).

```jsx
import { useBookings } from './context/BookingsContext'
// convenience re-export also available at:
import { useBookings } from './hooks/useBookings'

const { bookings, addBooking, removeBooking } = useBookings()
```

| Function | Signature | Description |
|---|---|---|
| `addBooking` | `(flight, extras = {})` | Merges flight + extras, stamps `bookedAt` and a `SKYXXXXX` ref |
| `removeBooking` | `(bookingRef)` | Removes the booking with that ref string |

**Full booking record shape** (after the 3-step flow):

```js
{
  // from flights.js
  id, city, country, code, image, price, duration,

  // from the booking wizard (extras)
  seats: ['3A', '3B'],
  passenger: { firstName, lastName, email, phone },
  passengerCount: 2,
  totalPrice: 858,

  // generated by addBooking
  bookedAt: '2026-05-17T10:30:00.000Z',
  bookingRef: 'SKYAB12C'
}
```

---

### `ToastContext`

Wrap your tree with `<ToastProvider>` (outermost provider in `App.jsx` so toasts overlay everything).

```jsx
import { useToast } from './context/ToastContext'

const { addToast } = useToast()

addToast('Booking confirmed for Paris! 🎉')               // type: 'success' (green)
addToast('Booking for Tokyo has been cancelled.', 'info') // type: 'info'    (blue)
addToast('Payment failed. Please try again.', 'error')    // type: 'error'   (red)
```

- Auto-dismisses after 4.5 seconds
- Maximum 3 toasts visible at once; oldest is evicted when a 4th arrives
- Each toast slides in from the right via `animate-slide-in-right`
- Manually dismissible with the ✕ button

---

## Utilities & Hooks

### `src/utils/format.js`

| Function | Signature | Example |
|---|---|---|
| `formatPrice` | `(amount, currency?)` | `formatPrice(349)` → `"$349.00"` |
| `formatDate` | `(isoString)` | `"May 17, 2026"` |
| `formatSearchDate` | `(dateStr)` | `"Jun 12, 2026"` — parses `YYYY-MM-DD` without timezone shift |
| `parseDurationMinutes` | `(duration)` | `"8h 30m"` → `510` — used by results sort |

### `usePageTitle(title)`

```js
import { usePageTitle } from '../hooks/usePageTitle'

usePageTitle('My Bookings')
// → document.title = "My Bookings — SkyBook ✈️"
// Restores to "SkyBook ✈️" on unmount
```

---

## Styling System

### Color scheme

| Token (Tailwind) | Hex | Used for |
|---|---|---|
| `blue-600` | `#2563EB` | Primary buttons, active nav link, prices |
| `blue-700` | `#1D4ED8` | Button hover |
| `blue-50` | `#EFF6FF` | Light pill backgrounds, sidebar active row |
| `indigo-700` | `#4338CA` | Hero gradient endpoint |
| `slate-50` | `#F8FAFC` | Page background, section backgrounds |
| `slate-800` | `#1E293B` | Headings, primary body text |
| `slate-500` | `#64748B` | Secondary / muted text |
| `emerald-600` | `#059669` | Confirm button, success toasts, booked badges |

### Custom animation utilities

Defined in `tailwind.config.js`; used as standard Tailwind classes.

| Class | Effect | Duration |
|---|---|---|
| `animate-fade-in-up` | Fade in + rise 18 px | 450 ms |
| `animate-fade-in` | Opacity 0 → 1 | 300 ms |
| `animate-slide-in-right` | Slide in from off-screen right | 380 ms |
| `animate-scale-in` | Scale 40% → 100% with spring | 550 ms |

All animations use `animation-fill-mode: both` so elements stay invisible before their delay fires.

**Staggered grid pattern** — used on the Home destination grid, Search Results, and My Bookings:

```jsx
{items.map((item, i) => (
  <div
    key={item.id}
    className="animate-fade-in-up animate-stagger"
    style={{ animationDelay: `${i * 70}ms` }}
  >
    <Card item={item} />
  </div>
))}
```

### Global utility classes (`src/index.css`)

| Class | Effect |
|---|---|
| `.card-hover` | `transition-all duration-300` + `-translate-y-1 shadow-lg` on `:hover` |
| `.btn-press` | `active:scale-[0.97]` press-down feedback |
| `.animate-stagger` | `animation-fill-mode: both` — prevents flash before delay fires |

---

## Data Layer

### `src/data/flights.js`

Exports `popularDestinations` — an array of 6 static flight objects used across all pages:

```js
{
  id: 1,
  city: 'Paris',
  country: 'France',
  code: 'CDG',       // IATA airport code — used for search matching
  image: '…',        // Unsplash CDN URL (600 px wide)
  price: 349,        // Base fare in USD, per passenger
  duration: '8h 30m'
}
```

**Search matching** (`SearchResults`): case-insensitive partial match on `city`, `country`, or `code`. If nothing matches, all 6 flights are returned with an amber "no exact match" notice.

**Seat RNG** (`SeatMap`): each flight's `id` is hashed into a seed for a Linear Congruential Generator, producing a stable ~30% occupancy set that is identical across re-renders and page reloads.
