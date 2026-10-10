# Flowcraft

Describe something in plain words and get a diagram back.

## What Flowcraft is for

Most people never draw the diagram they need, because diagram tools make you drag boxes and arrows one at a time. Flowcraft lets you **write** instead. Type a sentence like *"How does online food delivery work?"* or *"ER diagram for a college database"* and it draws a clean, laid-out diagram in a few seconds. You can then refine it by chatting (*"add a step for refunds"*), edit the text yourself, drag boxes around, change colours, share a read-only link or download a PNG or SVG.

It is made for:
- **Students** mapping a subject, drawing ER and UML diagrams for DBMS and software engineering courses, or turning notes into a mind map.
- **Developers and small teams** writing down a process, a data model, a class design or the messages between services.
- **Everyone else**: a family tree, a trip plan, a morning routine. Prompts work in any language the AI model supports.

### Features

**AI**
- Prompt to diagram: the model picks the diagram type and writes it in Flowcraft's text syntax.
- Refine by chatting. Every AI change can be undone, and the prompt history is saved with the diagram.
- Answers are schema-checked and syntax-checked. Problems (a disconnected step, a missing `end`, an unknown attribute tag) are sent back to the model for one automatic retry.
- The AI key stays on the server and generation is rate-limited per IP.

**Editing**
- Every diagram is plain text with a live preview, so you can always fix things by hand.
- Automatic layout, with dagre for graphs plus custom layouts for ER and sequence diagrams.
- Drag nodes to fine-tune; positions are saved, and **Reset layout** clears them.
- Five colour themes, zoom, pan and a minimap.
- Parse hints with line numbers, Tab and Shift+Tab indentation, built-in syntax help for every type.

**Saving and sharing**
- Sign in with [Clerk](https://clerk.com).
- Autosave that only sends changed fields, with a save status and an unsaved-changes warning.
- A library with previews, search, filters by type, sorting, starring, duplicate and delete.
- Public read-only links with a view counter. Viewers can make their own copy.
- Export the whole diagram as PNG or SVG.
- A playground that works without an account. The draft is imported after signing up.
- Twelve starter templates covering every diagram type.

**Interface**
- macOS-style design: the system font on Apple devices, system blue, hairline separators, a Finder-style library.
- Light, Dark and Auto appearance, applied before the page draws so it never flashes.
- Works on phones: the navbar collapses to icons and the editor stacks the text above the canvas.
- Keyboard friendly: visible focus rings, a skip-to-content link, menus that work with arrow keys and Escape, and reduced motion for people who prefer it.

<br />

## Setup

### Requirements

- **Node.js 22.9 or newer**
- **MongoDB**: local, through Docker (`docker compose up -d mongo`), or a free [Atlas](https://www.mongodb.com/atlas) cluster
- A free **[Clerk](https://dashboard.clerk.com)** application for sign-in
- Optional: an AI key, either [Vercel AI Gateway](https://vercel.com/ai-gateway) or [Google Gemini](https://aistudio.google.com/apikey) (free). Without one, everything except AI generation still works.

### 1. Install

```bash
git clone https://github.com/devansh-jagtap/Flowcraft.git flowcraft
cd flowcraft
npm install
```

`npm install` sets up both the server and the client (npm workspaces).

### 2. Get your Clerk keys

In the [Clerk dashboard](https://dashboard.clerk.com), create an application and open **API keys**. You need two keys, and **each one goes in a different file**:

| Key | Looks like | Goes in |
| --- | --- | --- |
| Publishable key | `pk_test_...` | `client/.env` as `VITE_CLERK_PUBLISHABLE_KEY` |
| Secret key | `sk_test_...` | `server/.env` as `CLERK_SECRET_KEY` |

> The secret key must never go in `client/.env`. The server only reads `server/.env`, so a secret key in the wrong file makes every signed-in request fail.

### 3. Configure

```bash
cp server/.env.example server/.env
```

Then edit the two files:

```bash
# client/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

```bash
# server/.env
CLERK_SECRET_KEY=sk_test_...
MONGODB_URI=mongodb://127.0.0.1:27017/flowcraft
CLIENT_ORIGIN=http://localhost:5173
GEMINI_API_KEY=...            # or AI_GATEWAY_API_KEY=...
```

All server variables are listed under [Environment variables](#environment-variables).

### 4. Run

```bash
docker compose up -d mongo     # skip if you use your own MongoDB
npm run dev
```

Open **http://localhost:5173**. The API runs on port 5000 and Vite proxies `/api` to it. The API restarts when its code changes, but not when `.env` changes, so restart `npm run dev` after editing env files.

### 5. Optional: example data

```bash
npm run seed
```

This adds three example diagrams for `demo@flowcraft.app`. To put them in your own account, run `SEED_EMAIL=you@example.com npm run seed` and sign in with that (verified) email.

### Environment variables

`server/.env`:

| Variable | What it does | Default |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | Verifies session tokens and reads profiles. **Required.** | |
| `CLERK_JWT_KEY` | Optional PEM public key to verify tokens without a network call | |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/flowcraft` |
| `PORT` | API port | `5000` |
| `CLIENT_ORIGIN` | Allowed browser origins, comma-separated. Must include the URL you open the app on. | `http://localhost:5173` |
| `AI_GATEWAY_API_KEY` | Enables AI generation through Vercel AI Gateway. Used instead of `GEMINI_API_KEY` when set. | |
| `AI_GATEWAY_MODEL` | Gateway model id | `google/gemini-2.5-flash` |
| `GEMINI_API_KEY` | Fallback when no gateway key is set: calls Gemini directly | |
| `GEMINI_MODEL` | Gemini model | `gemini-2.5-flash` |

`client/.env`:

| Variable | What it does |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key. **Required.** |
| `VITE_API_URL` | Optional API origin when the client is hosted separately. Leave unset locally. |

Never commit either `.env` file.

### Troubleshooting

| You see | Cause and fix |
| --- | --- |
| "Sign-in isn't set up on the server" | `CLERK_SECRET_KEY` is missing from `server/.env`. Add it and restart. |
| "Your session has expired, please log in again" right after signing in | The server can't verify the token. Check that `CLERK_SECRET_KEY` is in `server/.env` (not `client/.env`) and belongs to the same Clerk app as the publishable key, and that `CLIENT_ORIGIN` matches the URL in your browser. Then restart. |
| "AI isn't switched on yet" | No AI key in `server/.env`. Add `GEMINI_API_KEY` or `AI_GATEWAY_API_KEY` and restart. |
| "Cannot reach the server. Is the API running?" | The API on port 5000 isn't running, often because MongoDB isn't reachable. Check the terminal running `npm run dev`. |

<br />

## API reference

Base URL: `/api` (proxied to `http://localhost:5000/api` in development).

**Authentication.** Endpoints marked *yes* need the Clerk session token in a header: `Authorization: Bearer <token>`. The client adds it automatically. The first authenticated request creates a local user record from the Clerk profile. Accounts from before Clerk are claimed by whoever signs in with the same verified email.

**Errors.** Every error has the same shape:

```json
{ "error": { "message": "Title cannot be empty", "details": [{ "field": "title", "message": "Title cannot be empty" }] } }
```

| Status | Meaning |
| --- | --- |
| `400` | Invalid input; `details` lists each bad field |
| `401` | Not signed in, or the token could not be verified |
| `404` | Not found. Another user's diagram also returns 404, so ids can't be probed. |
| `429` | Too many AI requests from this IP |
| `502` / `503` / `504` | The AI service failed, isn't configured, or timed out; or sign-in isn't configured |

### Endpoints

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | | Health check |
| `GET` | `/api/auth/me` | yes | The current user |
| `GET` | `/api/diagrams` | yes | List my diagrams |
| `GET` | `/api/diagrams/stats` | yes | Counts by type, shared count, total views |
| `POST` | `/api/diagrams` | yes | Create a diagram |
| `GET` | `/api/diagrams/:id` | yes | Get one of my diagrams |
| `PATCH` | `/api/diagrams/:id` | yes | Update a diagram |
| `DELETE` | `/api/diagrams/:id` | yes | Delete a diagram |
| `POST` | `/api/diagrams/:id/duplicate` | yes | Duplicate a diagram |
| `POST` | `/api/diagrams/:id/share` | yes | Turn the public link on or off |
| `GET` | `/api/shared/:shareId` | | Public read-only view |
| `POST` | `/api/shared/:shareId/fork` | yes | Copy a public diagram into my account |
| `GET` | `/api/ai/status` | | Whether AI generation is configured |
| `POST` | `/api/ai/generate` | | Generate or edit a diagram from a prompt |

### The diagram object

```json
{
  "_id": "665f1c...",
  "title": "University database",
  "type": "er",
  "source": "Student\n  Roll no (key)\nStudent -- Enrolls -- Course: M:N",
  "theme": "ocean",
  "direction": "LR",
  "positions": { "student": { "x": 120, "y": 80 } },
  "prompts": [{ "text": "ER diagram for a college", "createdAt": "2026-10-11T09:30:00.000Z" }],
  "starred": false,
  "isPublic": false,
  "shareId": "k3J9xQ2a",
  "views": 0,
  "createdAt": "2026-10-11T09:30:00.000Z",
  "updatedAt": "2026-10-11T09:31:12.000Z"
}
```

| Field | Values |
| --- | --- |
| `type` | `flowchart`, `mindmap`, `orgchart`, `er`, `class`, `usecase`, `sequence`, `state` |
| `source` | The diagram text (see [Writing diagrams by hand](#writing-diagrams-by-hand)), up to 20,000 characters |
| `theme` | `ocean`, `sunset`, `forest`, `grape`, `mono` |
| `direction` | `TB` (top to bottom) or `LR` (left to right) |
| `positions` | Node positions the user dragged, keyed by node id, at most 500. Auto-layout places the rest. |
| `prompts` | The AI prompts that built the diagram, oldest first, at most 50 |

### Health and user

**`GET /api/health`** returns `{ "status": "ok", "database": "up" }` (`database` is `"down"` when MongoDB is unreachable).

**`GET /api/auth/me`** returns `{ "user": { "_id", "name", "email", "createdAt", ... } }`. Sign-up and sign-in happen in the browser through Clerk; the API only verifies tokens.

### Diagrams

**`GET /api/diagrams`** lists the signed-in user's diagrams, returning `{ "diagrams": [diagram, ...] }`. List items leave out `positions` to keep the response small; fetch one diagram to get them.

| Query | Values | Default |
| --- | --- | --- |
| `q` | Search text in titles and diagram text, max 100 characters | |
| `type` | A diagram type, or `all` | `all` |
| `starred` | `true` or `false` | |
| `sort` | `updated`, `created` or `title` | `updated` |

**`GET /api/diagrams/stats`** returns counts for the library sidebar:

```json
{ "byType": { "flowchart": 3, "mindmap": 1, "orgchart": 0, "er": 2, "class": 1, "usecase": 0, "sequence": 0, "state": 0 }, "diagrams": 7, "shared": 2, "views": 41 }
```

**`POST /api/diagrams`** creates a diagram and returns `201 { "diagram": ... }`. Only `type` is required:

```json
{ "type": "flowchart", "title": "Morning routine", "source": "(Wake up) -> Coffee -> (Work)", "theme": "sunset", "direction": "TB", "positions": {}, "prompts": [] }
```

**`GET /api/diagrams/:id`** returns `{ "diagram": ... }`.

**`PATCH /api/diagrams/:id`** updates any of `title`, `type`, `source`, `theme`, `direction`, `positions`, `prompts` and `starred`. Send only the fields that changed (at least one). Returns `{ "diagram": ... }`.

```json
{ "source": "(Wake up) -> Shower -> Coffee -> (Work)", "starred": true }
```

**`DELETE /api/diagrams/:id`** returns `204 No Content`.

**`POST /api/diagrams/:id/duplicate`** returns `201 { "diagram": ... }` with a private copy.

**`POST /api/diagrams/:id/share`** with `{ "isPublic": true }` turns the public link on. The diagram gets a `shareId`, and the public page is `/s/<shareId>`. `{ "isPublic": false }` turns it off but keeps the id, so turning it back on restores the same link. Returns `{ "diagram": ... }`.

### Shared diagrams

**`GET /api/shared/:shareId`** returns a public diagram with the owner's name as `author`, and increments its view count. Only display fields are included (no owner id, starred flag or creation date). Returns 404 if the link is off.

```json
{ "diagram": { "_id": "...", "title": "...", "type": "er", "source": "...", "theme": "ocean", "direction": "LR", "positions": {}, "prompts": [], "views": 12, "shareId": "k3J9xQ2a", "author": "Devansh Jagtap", "updatedAt": "..." } }
```

**`POST /api/shared/:shareId/fork`** copies a public diagram into the signed-in user's library and returns `201 { "diagram": ... }`.

### AI

**`GET /api/ai/status`** returns `{ "enabled": true }` when an AI Gateway or Gemini key is configured.

**`POST /api/ai/generate`** turns a prompt into a diagram. No sign-in needed, so the playground works for guests. The endpoint is rate-limited to 20 requests per 10 minutes per IP.

```json
{ "prompt": "ER diagram for an ATM system" }
```

To edit an existing diagram, send its current type and text as well:

```json
{ "prompt": "Add a Card entity", "current": { "type": "er", "source": "Customer\n  Customer id (key)\n..." } }
```

| Field | Rules |
| --- | --- |
| `prompt` | 3 to 600 characters |
| `current` | Optional `{ type, source }` of the diagram being edited |

Response:

```json
{ "diagram": { "title": "ATM System", "type": "er", "direction": "LR", "source": "Customer\n  Customer id (key)\n  Name\n..." } }
```

The server validates the model's answer against a JSON schema and checks the diagram text. If either fails, the problems go back to the model for one retry; if that also fails, the endpoint returns 502.

<br />

## Pages

| Path | Page | Sign-in |
| --- | --- | --- |
| `/` | Landing page with a prompt box, live demo and templates | |
| `/try` | Playground: the full editor, saved in the browser. `?template=<id>` opens a template. | |
| `/login`, `/register` | Clerk sign-in and sign-up | |
| `/app` | My diagrams: library, search, filters, new diagram | yes |
| `/d/:id` | Editor with autosave | yes |
| `/s/:shareId` | Public read-only view with "Make a copy" | |

<br />

## Writing diagrams by hand

Every diagram is plain text. The AI writes the same text, so you can always open the **Text** tab and edit it yourself. Lines starting with `#` are comments.

| Type | Write | Result |
| --- | --- | --- |
| Flowchart | `A -> B -> C` | steps joined by arrows |
| | `Ready?` | a step ending in `?` becomes a decision |
| | `Ready? -> Go: yes` | text after `: ` labels the arrow |
| | `(Start)` | a rounded start or end step |
| Mind map | an indented outline | the first line is the centre |
| Org chart | an indented list | indent means "reports to" |
| | `Priya: Backend` | the text after `: ` becomes a second line on the card |
| ER diagram (Chen) | `Student`, then indented `Roll no (key)` | an entity and its attributes; indent again for a composite attribute |
| | `(key)` `(partial key)` `(multivalued)` `(derived)` | underlined, dashed-underlined, double or dashed ovals |
| | `Dependent (weak)` | a weak entity (double border) |
| | `Enrolls (relationship)` | declares a relationship so it can have its own attributes |
| | `Student -- Enrolls -- Course: M:N` | a relationship diamond with cardinalities; `==` draws total participation |
| UML class | `class User`, then indented `- id: int`, `+ login(): bool` | a class with attributes and methods (also `interface`, `abstract class`, `enum`) |
| | `A --\|> B`, `A ..\|> B`, `A *-- B`, `A o-- B`, `A --> B`, `A ..> B` | inheritance, realisation, composition, aggregation, association, dependency |
| | `Customer "1" -- "*" Order: places` | multiplicities and a label |
| UML use case | `system Shop`, `actor Bank`, `Customer -> Pay` | system boundary, actors and use cases |
| | `Pay -> Log in: include` | `«include»` (or `extend`) |
| UML sequence | `actor User`, `database DB`, `User -> App: Log in` | lifelines and calls; `-->` reply, `-)` async |
| | `alt ok` … `else` … `end` | combined fragments (also `loop`, `opt`, `par`) |
| UML state | `[*] -> Idle`, `Idle -> Busy: start`, `Busy -> [*]` | initial and final states, transitions |

An ER example:

```
Student
  Roll no (key)
  Name
    First name
    Last name
  Phone (multivalued)
Course
  Course id (key)
Dependent (weak)
  Name (partial key)
Student == Enrolls -- Course: M:N
Student -- Has == Dependent: 1:N
```

<br />

## How it fits together

```
flowcraft/
├── client/                React + TypeScript + Vite
│   └── src/
│       ├── pages/         one file per route: Landing, Dashboard, Editor, Playground, Shared, Auth
│       ├── components/
│       │   ├── layout/    navbar, appearance menu, Clerk router bridge, protected routes
│       │   ├── landing/   the CSS MacBook that hosts the live demo
│       │   ├── library/   "My diagrams": sidebar, diagram cards, new-diagram dialog
│       │   ├── editor/    Workspace (toolbar + sidebar + canvas), text editor, themes, sharing
│       │   ├── ai/        prompt box and the chat-style AI panel
│       │   ├── diagram/   React Flow canvas, node shapes, ER/UML edges, static thumbnails, PNG/SVG export
│       │   └── ui.tsx     small shared pieces: spinner, empty/error states, dialogs, segmented control
│       ├── lib/diagram/   one parser per diagram type, layouts, themes, templates (with unit tests)
│       ├── lib/           light/dark appearance, guest drafts, example prompts, date formatting
│       ├── api/           typed fetch client for the REST API
│       ├── context/       auth (Clerk) and toasts
│       ├── hooks/         useAsync, useDebouncedValue, useAiEnabled
│       └── styles/        tokens.css first, then one stylesheet per area of the app
├── server/                Express + MongoDB REST API (TypeScript)
│   ├── src/
│   │   ├── ai/            AI Gateway + Gemini clients, system prompt, output checks
│   │   ├── controllers/   route handlers
│   │   ├── routes/        Express routers
│   │   ├── models/        Mongoose models: User, Diagram
│   │   ├── validators/    zod schemas for every request
│   │   ├── middleware/    Clerk auth, error handler
│   │   └── lib/           HttpError, validation helper, share ids
│   └── tests/             API integration tests
├── Dockerfile             one production image: API plus the built client
└── docker-compose.yml     MongoDB, and optionally the full app
```

**How a diagram is drawn.** The text is parsed into nodes and edges by the parser for its type (`client/src/lib/diagram/parse*.ts`). Flowcharts, trees, class, use case and state diagrams are laid out by dagre (`layout.ts`). ER diagrams lay out entities and relationships first and reserve room above and below each one for its attribute ovals (`layoutEr.ts`). Sequence diagrams place lifelines left to right and messages top to bottom (`layoutSequence.ts`). Positions the user dragged are applied on top, and React Flow renders the custom shapes and connectors. Node ids come from the text (for example `trip/stay/hotel`), so a dragged node stays attached to the right box while you keep typing.

**Tech stack.** MongoDB with Mongoose, Express 5, zod, Clerk, Google Gemini (`gemini-2.5-flash`, directly or through Vercel AI Gateway), React 19, React Router 7, React Flow, dagre, html-to-image, plain CSS with design tokens, Geist (self-hosted) and Phosphor icons, Vitest, Supertest and mongodb-memory-server, npm workspaces, ESLint, Docker and GitHub Actions.

**Styles.** `client/src/styles/tokens.css` holds every colour, radius, shadow and font. Dark mode swaps those tokens when `<html data-theme="dark">` is set (see `src/lib/theme.ts`). Each other stylesheet covers one area: controls, feedback, prompt, diagram, landing, MacBook, library and editor.

<br />

## Scripts, tests and deployment

```bash
npm run dev         # API on :5000 and React app on :5173
npm test            # API integration tests and parser/layout unit tests
npm run typecheck
npm run lint
npm run build
npm run seed        # example diagrams
```

The API tests start an in-memory MongoDB (the binary downloads on the first run) and use a fake Clerk, so they need no keys. GitHub Actions runs typecheck, lint, tests and build on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

**Production.** Build with `VITE_CLERK_PUBLISHABLE_KEY` set, then run `npm start` with `NODE_ENV=production`, `CLERK_SECRET_KEY`, `CLIENT_ORIGIN` and `MONGODB_URI`. Express serves the built React app, so everything runs as one service on port 5000.

**Docker.**

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_... CLERK_SECRET_KEY=sk_... docker compose --profile full up --build
```

Then open http://localhost:5000.

**Security.** Passwords never touch this app because Clerk owns them. Tokens are verified against Clerk's keys and the allowed origins. Other users' diagrams return 404 rather than 403, so ids can't be probed. Search input is regex-escaped, AI generation is rate-limited, and request bodies are size-limited and validated with zod. The AI keys stay on the server.

<br />

## Engineering notes: problems found and fixed

**AI output** (found by testing against the real Gemini API, not just mocks)
- **Unconnected boxes.** Gemini sometimes listed steps on their own lines without arrows. The validator now rejects unconnected steps, and the system prompt asks for connections explicitly.
- **Whole diagram on one line.** Some answers contained the two characters `\n` instead of real line breaks. Output is now normalised before validation.
- **Typos that split a flow.** In a Hindi answer the model wrote the same step two slightly different ways, so the chain broke in two. The validator now checks that every step is reachable from the first one and names the unreachable steps, so the automatic retry can fix them.
- **Over-strict validation.** A lone `(Customer opens app)` line only sets the start shape and is connected on the next line. That is valid, so the rule became "connected somewhere" instead of "every line has an arrow".

**App**
- **Infinite render loop on the canvas.** A default prop `positions = {}` created a new object on every render, which re-ran the layout memo, reset React Flow's node store and triggered "Maximum update depth exceeded". Fixed with a module-level constant, and by keeping the parent's inline `onNodeMove` callback out of the memo's dependencies through a ref.
- **"Ship it" and "Ship it?" merged into one node.** Node ids were slugs of the label, and the slug dropped the `?`. A layout unit test caught it; question nodes now get their own id.
- **Stable node ids for tree diagrams.** Index-based ids made dragged positions jump to the wrong node when a line was inserted above. Ids are now path-based (`goa-trip/stay/hotel`), with a test proving they survive edits elsewhere.
- **Autosave race conditions.** The editor only sends changed fields, keeps a snapshot of what the server confirmed, and marks the state unsaved again if the user kept typing while a request was in flight.
- **Two Vite versions in the monorepo** (one pulled in by vitest) broke type-checking of `vite.config.ts`. The versions were aligned and the test config split out.
- **"Database --> App" read as a declaration.** In sequence diagrams the case-insensitive `database` keyword swallowed messages sent *from* a participant called Database. Lines with an arrow are now always messages, with a test for it.
- **Misleading "session expired" error.** With `CLERK_SECRET_KEY` missing from `server/.env`, every token failed to verify and users were told their session had expired. The server now says that sign-in isn't configured.

<br />

## AI tool used

**Tools:** the **Code0** extension (running on Claude credits) and **Claude Code**. That's why many commits list Claude as a co-author.

### AI development experience
I used Code0 and Claude Code as pair programmers. I described the feature I wanted, reviewed the plan and the code they wrote, and steered the design through several rounds of feedback. They were strongest at building a complete feature end to end (React components, Express routes, zod validation and tests) and at tracking down bugs from an error message. They also got things wrong. The first UI looked templated, with emoji and generic styling, and needed several redesigns before it looked the way I wanted. One history rewrite changed more commits than the tool first reported. I checked every change with the type checker, the linter and the test suites, by trying it in the browser, and by asking for proof before anything was pushed.

### Tasks where the AI tool helped
1. **Component development:** the React Flow diagram editor with live text parsing and auto-layout, the macOS-style landing page with a live MacBook demo, the Finder-style library, and the Light / Dark / Auto appearance menu.
2. **API creation:** the Express and MongoDB REST API (diagrams, sharing, forking, stats) with zod validation on every request, and the AI generation endpoint that schema-checks the model's answer and retries once with feedback.
3. **Debugging:** the canvas's infinite render loop, merged node ids, and the Gemini output problems listed under "Engineering notes".
4. **Refactoring and new features:** moving sign-in from email and password to Clerk, adding the ER and UML diagram types, and reorganising the client into feature folders with one stylesheet per area.

<br />

## License

MIT © Devansh Jagtap
