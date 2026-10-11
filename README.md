# Flowcraft

Describe something in plain words and get a diagram back.

<br />

## 1. Description

**Flowcraft** is a web app that turns plain text into diagrams.

Most people never draw the diagram they need, because diagram tools make you drag boxes and arrows one at a time. Flowcraft lets you **write** instead. Type a sentence like *"How does online food delivery work?"* or *"ER diagram for a college database"* and it draws a clean, laid-out diagram in a few seconds. You can then refine it by chatting (*"add a step for refunds"*), edit the text yourself, drag boxes around, change colours, share a read-only link or download a PNG or SVG.

It is made for:
- **Students** mapping a subject, drawing ER and UML diagrams for DBMS and software engineering courses, or turning notes into a mind map.
- **Developers and small teams** writing down a process, a data model, a class design or the messages between services.
- **Everyone else**: a family tree, a trip plan, a morning routine. Prompts work in any language the AI model supports.

<br />

## 2. Features

**Eight diagram types**
- Flowchart, mind map and org chart.
- ER diagram (Chen notation) for databases.
- UML class, use case, sequence and state diagrams.

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

### Writing diagrams by hand

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

## 3. Technologies used

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router 7 |
| Diagrams | React Flow (canvas), dagre (auto-layout), html-to-image (PNG/SVG export) |
| Styling | Plain CSS with design tokens, Geist (self-hosted font), Phosphor icons |
| Backend | Node.js, Express 5, TypeScript, zod (request validation), helmet, rate limiting |
| Database | MongoDB with Mongoose (schemas, indexes, aggregation for stats) |
| Authentication | Clerk |
| AI | Google Gemini (`gemini-2.5-flash`), called directly or through Vercel AI Gateway |
| Testing | Vitest, Supertest, mongodb-memory-server |
| Tooling | npm workspaces (monorepo), ESLint, Docker, GitHub Actions |

### Project structure

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

**Styles.** `client/src/styles/tokens.css` holds every colour, radius, shadow and font. Dark mode swaps those tokens when `<html data-theme="dark">` is set (see `src/lib/theme.ts`). Each other stylesheet covers one area: controls, feedback, prompt, diagram, landing, MacBook, library and editor.

<br />

## 4. Setup and installation instructions

### Requirements

- **Node.js 22.9 or newer**
- **MongoDB**: local, through Docker (`docker compose up -d mongo`), or a free [Atlas](https://www.mongodb.com/atlas) cluster
- A free **[Clerk](https://dashboard.clerk.com)** application for sign-in
- Optional: an AI key, either [Vercel AI Gateway](https://vercel.com/ai-gateway) or [Google Gemini](https://aistudio.google.com/apikey) (free). Without one, everything except AI generation still works.

### Step 1: Install

```bash
git clone https://github.com/devansh-jagtap/Flowcraft.git flowcraft
cd flowcraft
npm install
```

`npm install` sets up both the server and the client (npm workspaces).

### Step 2: Get your Clerk keys

In the [Clerk dashboard](https://dashboard.clerk.com), create an application and open **API keys**. You need two keys, and **each one goes in a different file**:

| Key | Looks like | Goes in |
| --- | --- | --- |
| Publishable key | `pk_test_...` | `client/.env` as `VITE_CLERK_PUBLISHABLE_KEY` |
| Secret key | `sk_test_...` | `server/.env` as `CLERK_SECRET_KEY` |

> The secret key must never go in `client/.env`. The server only reads `server/.env`, so a secret key in the wrong file makes every signed-in request fail.

### Step 3: Configure

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

## 5. How to run the application

### Development

```bash
docker compose up -d mongo     # skip if you use your own MongoDB
npm run dev
```

Open **http://localhost:5173**. The API runs on port 5000 and Vite proxies `/api` to it. The API restarts when its code changes, but not when `.env` changes, so restart `npm run dev` after editing env files.

### Example data (optional)

```bash
npm run seed
```

This adds three example diagrams for `demo@flowcraft.app`. To put them in your own account, run `SEED_EMAIL=you@example.com npm run seed` and sign in with that (verified) email.

### Pages

| Path | Page | Sign-in |
| --- | --- | --- |
| `/` | Landing page with a prompt box, live demo and templates | |
| `/try` | Playground: the full editor, saved in the browser. `?template=<id>` opens a template. | |
| `/login`, `/register` | Clerk sign-in and sign-up | |
| `/app` | My diagrams: library, search, filters, new diagram | yes |
| `/d/:id` | Editor with autosave | yes |
| `/s/:shareId` | Public read-only view with "Make a copy" | |

### Tests and checks

```bash
npm test            # API integration tests and parser/layout unit tests
npm run typecheck
npm run lint
npm run build
```

The API tests start an in-memory MongoDB (the binary downloads on the first run) and use a fake Clerk, so they need no keys. GitHub Actions runs typecheck, lint, tests and build on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

### Production

Build with `VITE_CLERK_PUBLISHABLE_KEY` set, then run `npm start` with `NODE_ENV=production`, `CLERK_SECRET_KEY`, `CLIENT_ORIGIN` and `MONGODB_URI`. Express serves the built React app, so everything runs as one service on port 5000.

With Docker:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_... CLERK_SECRET_KEY=sk_... docker compose --profile full up --build
```

Then open http://localhost:5000.

<br />

## 6. AI tool used

I used **Code0** (the extension, running on Claude credits), together with **Claude Code**. That's why many commits list Claude as a co-author.

<br />

## 7. AI development experience

I used Code0 and Claude Code as pair programmers. I described the feature I wanted, reviewed the plan and the code they wrote, and steered the design through several rounds of feedback. They were strongest at building a complete feature end to end (React components, Express routes, zod validation and tests) and at tracking down bugs from an error message. They also got things wrong. The first UI looked templated, with emoji and generic styling, and needed several redesigns before it looked the way I wanted. One history rewrite changed more commits than the tool first reported. I checked every change with the type checker, the linter and the test suites, by trying it in the browser, and by asking for proof before anything was pushed.

<br />

## 8. Tasks where I used the AI tool

1. **Component development:** the React Flow diagram editor with live text parsing and auto-layout, the macOS-style landing page with a live MacBook demo, the Finder-style library, and the Light / Dark / Auto appearance menu.
2. **API creation:** the Express and MongoDB REST API (diagrams, sharing, forking, stats) with zod validation on every request, and the AI generation endpoint that schema-checks the model's answer and retries once with feedback.
3. **Debugging:** an infinite render loop on the diagram canvas, two different steps merging into one node, and AI answers that were invalid (steps left unconnected, or a whole diagram on one line), which led to stricter checks and an automatic retry.
4. **Refactoring:** moving sign-in from email and password to Clerk, adding the ER and UML diagram types, and reorganising the client into feature folders with one stylesheet per area.
5. **Testing:** API integration tests that run against an in-memory MongoDB with a fake Clerk, and unit tests for the diagram parsers and layouts.

<br />

## License

MIT © Devansh Jagtap
