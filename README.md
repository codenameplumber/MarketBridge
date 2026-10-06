# KonfluenX

*Connect. Discover. Converge.*

A Deriv-connected social trading platform, built as an **installable web app (PWA)**.
Stage 1 is this static HTML/CSS/JS build; every folder, partial and mock payload is
pre-shaped so Stage 2 (Laravel + Livewire) is a port, not a rewrite.

**KonfluenX** is the product name. The lockup reads `KONFLUENX` with the X
carrying a red→green gradient, and the tagline `CONNECT · DISCOVER · CONVERGE`
beneath. Copy says "KonfluenX" wherever the product is meant.

---

## Run it

Service workers and `fetch()` need HTTP — opening `index.html` from disk will not work.

```bash
# any static server, from this folder
npx serve .          # or: python -m http.server 8000
```

Then open `http://localhost:8000`.

| Route | What it is |
|---|---|
| `/index.html` | Public marketing site |
| `/auth/login.html` | Login → register → connect Deriv |
| `/users/index.html` | Customer app (the PWA `start_url`) |
| `/admin/index.html` | Admin console |

**Dark is the default.** With nothing stored the app renders dark whatever the
OS prefers; Settings offers Light and Auto, and that choice is remembered. Each
page carries a pre-paint snippet so the theme never flashes.

Add `?theme=dark`, `?theme=light` or `?theme=system` to any URL to force a theme
for one load — useful for QA and screenshots. It is not persisted.

> **Checking narrow layouts:** headless Chrome on this setup clamps its layout
> viewport to 548px, so `--window-size=390` renders at 548 and the PNG simply
> crops — which reads as overflow that is not there. Measure narrow layouts by
> loading the page in a sized `<iframe>` and reading `scrollWidth` against
> `clientWidth`; screenshot at 548 or wider.

---

## Structure

```
marketbridge/
├── index.html  about  contact  faq            Public site
│   terms  privacy  risk-disclosure  signal-disclaimer
├── offline.html                               Shown when offline
├── manifest.webmanifest  sw.js                PWA: install + offline
│
├── auth/           login · register · forgot-password · connect-deriv
│
├── users/          THE CUSTOMER APP
│   ├── index.html                 Dashboard
│   ├── markets/    index · detail · watchlist
│   ├── trade/      index · accumulators · rise-fall · digits ·
│   │               multipliers · open-contracts · history
│   ├── signals/    index · detail-executable · detail-analysis ·
│   │               compose · provider
│   ├── community/  index · rooms · room · post-detail · compose
│   ├── results/    index · leaderboard
│   ├── resources/  index · detail
│   ├── wallet/     accounts · account-detail · deposit · withdraw ·
│   │               transfer · history · statement · leaving
│   ├── profile/    index · settings · partner · saved · rewards
│   ├── legal/      signal-disclaimer · risk-disclosure · report
│   └── notifications.html · search.html
│
├── moderator/      CONTENT POLICING — 6 screens
│   index · reports · community → community-detail
│   signals → signal-detail
│
├── admin/          PLATFORM OPERATIONS — 14 screens
│   everything above, plus
│   analytics    users → user-detail   boosted
│   resources → resource-edit          markets   transactions
│
├── superadmin/     OWNS THE PLATFORM — 18 screens
│   everything above, plus
│   staff        (who has access, and the manifest as a comparison)
│   staff-audit  (append-only record of every staff action)
│   capabilities settings
│
├── assets/
│   ├── css/    tokens · base · components · app · public · admin
│   ├── js/core/     icons · util · api · collection · uploads ·
│   │                ws · charts · roles · shell · pwa
│   ├── js/components/  cards.js · datatable.js
│   └── icons/  logo.png + icon.png (brand) and generated PWA icons
│
├── tools/          sync-portals.js · check-links.js
├── mock/           API fixtures in the EXACT shape Laravel will return
└── _docs/          Original PRD + design mockups
```

---

## The three rules that make Stage 2 mechanical

**1. One file per component.** Every reusable card lives in
`assets/js/components/cards.js` as a template function that maps 1:1 to a Blade
component:

```
MB.card.signalExecutable(s)  ->  resources/views/livewire/signal/card-executable.blade.php
                             ->  app/Modules/Signal/Livewire/CardExecutable.php
                             ->  <livewire:signal.card-executable :signal="$signal" />
```

Keep the kebab-case basename identical at every hop and the mapping needs no lookup table.

**2. Mock JSON matches the future API byte-for-byte.** Pagination envelopes, ISO-8601
timestamps, and the `execution: null` asymmetry are all already correct. Porting is one
line in `assets/js/core/api.js`:

```js
var STAGE = 'mock';   // -> 'live'
```

**3. Zero colour literals outside `assets/css/tokens.css`.** That single file is why both
themes come free. If you are about to write a hex value anywhere else, add a token instead.

---

## Architectural rules enforced in this code

These are not conventions — they are structural, and breaking them takes real effort.

### Executable vs Analysis is a type, not a label

`MB.card.signal()` dispatches on `signal.kind` and nothing else:

- **`executable`** → green card, `Trade This Signal`, opens a pre-filled trade ticket.
  Carries an `execution` object with a `capability_id`.
- **`analysis`** → blue card, `View Market`, routes to the market page.
  Carries `execution: null` and **has no field that could hold a capability**.

The composer (`users/signals/compose.html`) will not even offer the executable form
for a market with no native capabilities.

### The capability registry decides what is tradeable

`mock/capabilities.json` is the single source of truth. Every surface that shows a
trade action resolves against it:

- `users/index.html` — Trade Now cards
- `users/trade/index.html` — module list (non-native families render locked)
- `users/markets/detail.html` — per-market trade options
- `users/signals/compose.html` — which composer is offered
- `admin/capabilities.html` — the operator's view of the whole registry

Unknown or stale capability **fails closed**. In Stage 2 this becomes two tables plus
a `TradeGuard::assertExecutable()` chokepoint in front of every purchase.

### Price data is browser-direct; money goes through the server

`assets/js/core/ws.js` owns one reference-counted socket per tab. With no `app_id`
configured it runs a local simulator that emits realistic Boom/Crash/Volatility ticks,
so the whole UI is drivable with no credentials. Set `MB.ws.config.app_id` to go live —
the public surface (`subscribe` / `request` / `on`) does not change.

Purchases always go through `MB.api.post('trade/purchase', …)` so they can be guarded,
audited and attributed to a signal. They are never sent browser-direct.

### KonfluenX holds no funds

There is no wallet and no balance anywhere in this codebase. The dashboard figure is a
cached read with a visible timestamp that turns amber when stale
(`users/index.html` → `balanceStamp`). Deposit and withdrawal record intent and consent,
then hand off — see `users/wallet/leaving.html`.

---

## PWA / "downloadable"

`manifest.webmanifest` + `sw.js` make this installable and offline-capable.

- **Android / Chrome / Edge** — `beforeinstallprompt`, one tap
- **iPhone / Safari** — no install API exists; `pwa.js` shows the Share → Add to Home Screen sheet
- **Desktop** — install icon in the address bar

Caching strategy in `sw.js`:

| Resource | Strategy |
|---|---|
| App shell (HTML/CSS/JS) | stale-while-revalidate |
| Mock / API data | network-first |
| Images, fonts | cache-first |
| `/api/v1/trade`, `/deriv`, `/payments` | **never cached** |

Stale money is worse than no money — trading endpoints are excluded by rule, and
`offline.html` says so explicitly rather than showing a cached price.

---

## Conventions

- **Shell is data-driven.** Pages carry `data-shell="app|site|admin|auth"`,
  `data-nav`, `data-root`, `data-title`, `data-back`; `shell.js` renders the chrome.
  No nav markup is ever duplicated.
- **Icons** are inline SVG strings in `icons.js`, hydrated from `data-icon="name"`.
  Works from `file://`, from the network, and from the SW cache with no extra request.
- **Charts** are hand-drawn inline SVG in `charts.js` — no library. Seeded PRNG, so a
  given chart is stable across reloads. Colours come from tokens, so they re-theme.
- **Every list has three states** — skeleton, empty, error. `MB.render()` handles all
  three; do not hand-roll a list without them.
- **Numbers use `font-variant-numeric: tabular-nums`** wherever they sit in a column,
  so prices do not jitter on tick updates.


---

## Lists, filters and pagination

**Every list that can grow is paged.** A list rendered in full is a bug waiting
for the fixture to get bigger, so the rule is: if the row count is not bounded
by the design, it goes through `MB.collection()` (customer app) or
`MB.datatable()` (staff portals).

The exceptions are deliberate and all look the same: a fixed-`limit` teaser
that sits under a heading with a **View all** link — the dashboard's Live
Signals and Community strips, `results/index`'s Recent Results, the profile's
last three signals, the Top Providers rail. Those are previews of a paged page,
not lists in their own right.

Two paging modes, chosen by how the list is read:

- `mode: 'pages'` — numbered pager, for lists you scan and return to
  (trade history, markets, the leaderboard, resources, transaction history)
- `mode: 'more'` — a Load more button, for feeds you read downward
  (signals, community, rooms, comments, a market's tabs, statements)

Filters, search boxes and chip rows bind to the same controller, so the count,
the rows and the pager can never disagree:

```js
var c = MB.collection({ from: 'history', into: '#histList', perPage: 12,
                        mode: 'pages', countInto: '#hCount', ... });
c.bind('#hRange', 'range');        // chip / tab row
c.bindSelect('#mktSort', 'sort');  // <select>
c.bindInput('#resSearch', 'q');    // debounced text input
```

`done(shownRows, filteredRows)` fires on **every** render, empty included, so a
header that summarises the list stays in step with it — `trade/history.html`
computes its Staked / Net P/L / Win rate from the filtered set rather than the
whole fixture, and therefore can never contradict the rows underneath.


## Market catalogue

49 markets across 6 categories. Every market declares `contract_kinds`, which
is what decides whether a signal on it can be executable at all:

| Kind | Meaning | Executable here |
|---|---|---|
| `binary` | Rise/Fall, Digits, Accumulators | Yes |
| `multiplier` | Multipliers — leveraged, CFD-style | Yes |
| `cfd_mt5` | CFD trading on Deriv MT5 | **No — analysis only** |

That last row is why a trader can post a EUR/USD or BTC/USD CFD idea with
entry, stop and targets: it publishes as analysis with **View Market**, never
as a fake trade button. Forex, crypto, commodities and indices all carry both
species depending on the contract.

Filtering runs **category → pair** everywhere: markets, signals, the signal
composer, the community feed and the room directory.

---

## Rooms and chat

Every market pair has a room, and every trader can run their own. Both use the
same page; what differs is who owns it and what it is scoped to.

**The chat fills the screen and scrolls itself.** While the Chat tab is open the
app takes `100dvh` and only the message list scrolls, so the composer stays put
and a new message does not push the page down. The room header collapses to an
identity line in this mode — the description, market links and chart belong to
the room rather than the conversation, and leaving them expanded left about 70px
for the messages. They are all still there on the other tabs.

New messages scroll into view only if the reader is already within 60px of the
bottom; someone reading back is never yanked away.

### A pager belongs to its list

`MB.collection` inserts its pager as a **sibling** of the list it pages. That
means hiding the list — a tab pane, say — leaves the pager on screen, and two
hidden panes will show their footers stacked under a third tab. The collection
now mirrors the host's hidden state onto its pager through a `MutationObserver`,
so this cannot happen again on any page.

The "N of N shown" footer only appears once the list was actually longer than a
page. Under four rows it said "4 of 4 shown", which is noise.


## Brand

`MB.brand()` renders the wordmark and `MB.brandMark()` the infinity mark; they
are the only places that reference the artwork, so the lockup changes in one
edit. `assets/icons/logo.png` is the supplied full lockup and
`assets/icons/icon.png` the supplied mark; the PWA icons are generated from the
same geometry.

### The four jobs of red

The palette carries one green and several reds, and they are **not**
interchangeable. `tokens.css` names each job separately so a future edit cannot
collapse them:

| Token | Colour | Job |
|---|---|---|
| `--vy-trade` / `--mb-green` | green | Executable · Buy · Rise · Up · **confirming a trade** |
| `--mb-sell` | red | Sell · Fall · Down · loss · destructive |
| `--vy-brand` | red | Brand CTA · account actions · install · marketing |
| `--mb-analysis` | red | Analysis signals · View Market |

The rule the buttons enforce: **a trade-confirming button is always green, and a
red button never buys.** `btn-trade`, `btn-brand`, `btn-sell` and `btn-analysis`
exist so the intent is visible in the markup rather than inferred from a colour.

`--vy-teal` is the accent in the `V` of the wordmark and is used sparingly for
neutral emphasis — never for a trading direction.

`tokens.css` is the only file in the project that contains a colour value.

### Both colours have to be visible

A trading dashboard where everything is green is not reassuring, it is useless —
the reader learns nothing from a colour that never changes. So the fixtures carry
a realistic spread (about 45% of markets down on the day, signals split roughly
evenly between buy and sell), and the surfaces that summarise them show it:

- market cards, rows and sparklines take their colour from the actual 24h move
- the leaderboard shows rank movement, W/L and P/L, and win rate is only green
  when it beats breakeven
- market chips on posts and room rows carry their pair's direction
- Popular Markets picks one market per category before repeating, rather than
  the first eight rows — which were all volatility indices, and all green


---

## Roles

Three roles, one manifest (`assets/js/core/roles.js`). Two are consoles; the
third is not.

### Moderator — a user, not a console

A moderator **is a regular user**. They keep the whole customer app — trading,
signals, wallet, profile — and what they gain lives inside the community:

- **Every room, without joining.** Follower-only rooms are hidden from ordinary
  users; `room.view_all` shows a moderator the whole board, plus a *Not joined*
  tab.
- **Flag a message.** A flag on every message but their own, opening a reason
  sheet (spam, scam, abuse, off-topic, misleading claim, other) with an optional
  note.
- **Flag a room.** The same sheet, raised against the room itself.

Everything a moderator can do is *see* or *raise*. Nothing removes, suspends or
bans — a flag opens a report an admin acts on. That asymmetry is the role: it is
what keeps a moderator a community member rather than a second class of staff,
and it is why **there is no `moderator/` folder and must never be one.**

Flags land in the admin Reports queue tagged `source: moderator`, so an admin
can tell a trusted watcher's flag from a random user report and filter on it.

### Admin and Super Admin — the consoles

| | `admin/` | `superadmin/` |
|---|---|---|
| People, content, money, markets | ✅ | ✅ |
| Acts on moderator flags | ✅ | ✅ |
| **Agents** — who users may pay | — | ✅ |
| Staff & Roles, Staff Audit | — | ✅ |
| Capability registry, Settings | — | ✅ |

`superadmin/` is the source of truth for shared page markup;
`node tools/sync-portals.js` projects it into `admin/`, changing only
`<body data-role>` and the title. What each role may *do* is decided at runtime:
any control carrying `data-can="<action>"` is **removed** — not hidden — for a
role lacking the permission, and the pass re-runs after every table render.

In the customer app there is no `<body data-role>`, so the role comes from `/me`
via `MB.roles.setUser()`, announced as an `mb:session` event.

`?role=user|moderator|admin|superadmin` forces a role for one page load, for
checking both sides of a permission without editing a fixture. QA only.

### Dialogs

`MB.confirm()` is the yes/no case. `MB.modal()` is everything else — a form, a
search, a role picker — taking a body you supply and buttons you name, and
returning a handle so the caller can close it or enable an action from inside:

```js
MB.modal({
  title: 'Add staff', wide: true,
  body: '…',
  actions: [{ label: 'Cancel', kind: 'ghost', close: true },
            { label: 'Send invite', kind: 'brand', onClick: function (m) { … } }],
  onOpen: function (root, m) { m.setAction(1, { disabled: true }); }
});
```

**Staff & Roles** uses it for every action, because granting or removing
someone's access should not happen on a stray click:

- **Add staff** — two paths in one dialog. *Register new admin* takes a name,
  a work email and a role (moderator is excluded: it is not a console role).
  *Elevate a user* searches the real member list by email or username and turns
  an existing member into a moderator; anyone already a moderator is shown but
  cannot be picked twice. The action button stays disabled until the form is
  valid or a user is chosen, and relabels itself to match the path.
- **Change role** — the three roles with what each one actually means, read
  from the manifest. Save is disabled until the role changes.
- **Block / Restore** — one button, two dialogs. Blocking asks for a reason and
  an optional note and says plainly that the audit keeps everything; an already
  blocked account offers Restore instead.

Each dialog mutates the row set and calls `redraw()`, so the table and the stat
counters follow immediately rather than waiting for a reload.

### Console screens

| Screen | What it does |
|---|---|
| `users` → `user-detail` | Profile, trading, transactions, rooms, security |
| `signals` → `signal-detail` | Chart, body, execution or analysis levels, provenance |
| `boosted` | Impressions, click-through, placement, expiry |
| `community` → `community-detail` | Growth, owner, members, block/flag |
| `resources` → `resource-edit` | Upload, free or paid, curriculum builder |
| `markets` | Add and edit markets, and their executable contract kinds |
| `transactions` | Withdrawal approval queue, per-row and bulk |
| `reports` | Review queue, with moderator flags marked as such |
| `agents` *(owner)* | The Deriv agent directory and its visibility switches |
| `staff`, `staff-audit` *(owner)* | Who has access; every action they took |
| `capabilities`, `settings` *(owner)* | What Deriv can execute; platform config |

---

## Deposits and withdrawals

Both screens carry the same **Kaastro | Deriv** switcher, and Kaastro leads on
both, marked **Recommended**. Each says plainly that Kaastro is the quick path
for people already registered, and that registering once unlocks better rates
and a full record — with a *Register on Kaastro* button beside the continue one.

### The Deriv agent route

Deriv's own payment agents, reached over WhatsApp. Two steps:

1. **Collect** — amount, nickname, which Deriv account to credit, and
   optionally a country to narrow the list.
2. **Choose an agent** — only agents the Super Admin has ticked, filtered to
   those whose limits cover the amount, each showing the local-currency
   estimate at their last advertised rate.

Tapping an agent opens WhatsApp with the message already written:

> Hello *Adebayo Payments*, I am from KonfluenX.
>
> I want to fund my Deriv account:
> • Amount: $250.00 USD
> • Nickname: JohnT
> • Deriv account: USD Wallet (CR1234567)
>
> Please send me the account for payment and your rate. Thank you.

The user never has to explain themselves twice, and the agent has everything
needed to reply with an account and a rate.

**What this flow is careful about.** KonfluenX is not party to the transaction: the
screen says so before the list, rates are labelled *indicative* rather than
quoted, and tapping an agent records an intent for support to trace — a note,
never a transaction. Money never touches KonfluenX on any route here.

### Who users are allowed to see

`superadmin/agents.html` lists Deriv's directory with one control that matters:
a visibility tick per agent. Only ticked agents reach the deposit screen.
Hiding is immediate; **showing** asks for confirmation and states whether Deriv
has verified that agent — because ticking one puts them in front of someone
about to send money.

---

## Marketing imagery

The homepage and About page use **showcase blocks built from the real product
components** — live market tiles, an actual chat thread with an attachment, the
two signal species side by side, a leaderboard — rather than stock photography.
What a visitor sees before signing up is what they get.

Charts scale properly at every width: candle count is derived from the rendered
pixel width (~13px per candle), strokes use `vector-effect="non-scaling-stroke"`
so they never stretch thin, and charts re-render on resize.

## The account area

`users/profile/index.html` is the account home: identity with the verified-trader
state, **Total Deriv Balance** summed from the connected accounts (never a stored
number), the account list, quick actions, a performance overview and the user's
own signals and posts. `users/wallet/statement.html` is the full statement behind
it — filter by account, period, entry type or reference, with a running balance
that reconciles to the closing figure at the top.

The design set shows a total of `$4,486.35` above accounts that sum to
`$4,024.95`. This build computes the honest total from the accounts rather than
copying the inconsistent figure.

Three more pages hang off the account drawer:

| Page | What it is |
|---|---|
| `profile/partner.html` | Deriv Partner (IB) status — referral link, funnel, tier progress, payouts. **Deriv pays the commission, not KonfluenX**, and the page says so |
| `profile/saved.html` | Bookmarked signals, posts, resources and markets. Stores *references* only, so a bookmark can never show a stale copy |
| `profile/rewards.html` | Contribution points and what they redeem for. **Points are not money** — not withdrawable, not transferable, no cash value |

These were linked from the account drawer but never built. They stayed missing
because the old link checker only read `href=` in markup, and the drawer builds
its hrefs in JS. `tools/check-links.js` now reads three kinds of reference —
markup, JS nav manifests, and `MB.api` fixture paths — which is how they, plus a
missing `mock/deriv/connection.json`, were found.

---

## Not yet built

Bot builder (deferred to post-v1 per the PRD), real Deriv OAuth exchange, and the
Laravel backend. Everything above is wired to the point where those drop in.
