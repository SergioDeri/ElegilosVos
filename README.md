# Elegilos Vos

**Pick your starting eleven. Let the crowd decide.**

*Elegilos Vos* ("you pick them", in Uruguayan Spanish) is a mobile-first web app for supporters of **Peñarol** and **Nacional**, Uruguay's two biggest football clubs. Before every match, each fan builds the starting lineup they would field. When voting closes, every lineup is combined into a single **Fans' XI**: the team the supporters as a whole chose. After the match, it is compared with the eleven the coach actually played.

The whole app is drawn in a 16-bit pixel-art style, so building a lineup feels like setting up a team in a retro football game.

---

## Why it exists

Fans argue about lineups all week: who should start, who should be dropped, which formation to play. That opinion is scattered across group chats, radio call-ins and social media, and none of it is ever counted.

Elegilos Vos gives that opinion a place to live:

- **Every fan gets a vote**, and the vote is a full lineup, not a thumbs-up on a single player.
- **The crowd's answer is computed fairly** and frozen when voting closes, so it can't be changed after the fact.
- **The crowd is held up against reality**: the Fans' XI is compared with the coach's actual starting XI, and each fan can see how close their own pick was.

## How it works

### For fans

1. **Sign up** with Google or with an email and password (email is verified with a one-time code).
2. **Choose your club**, Peñarol or Nacional. This is permanent: you only ever vote for your own club.
3. **Build your lineup** for the next match:
   - pick a formation (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2 or 4-1-4-1);
   - drag players from the bench onto the pitch (mouse, touch, or keyboard), or tap a player and then tap a position;
   - only available players can be picked (injured or suspended players are shown separately), and only goalkeepers can play in goal.
4. **There is no submit button.** Your lineup saves automatically as you go. Whatever you have saved when voting closes is your vote. Incomplete lineups still count.
5. **Watch the live standings** (*Parcial*) while voting is open: the eleven that is currently winning, with percentages per formation and per position.
6. **See the Fans' XI** when voting closes, how many of your picks made it, and later how it compares with the coach's real lineup.
7. **Share** the Fans' XI or your own lineup as an image, or via a public link that anyone can open without an account.

### The voting calendar

Each club has its own sequence of matches, and each match has its own vote:

- **Voting opens** as soon as the club's previous match ends. A match is considered over 2 hours after kick-off.
- **Voting closes 1 hour before kick-off.** If the match is rescheduled, the deadline moves with it and your lineup is kept. If the match is cancelled, its vote is void.
- **Your lineup carries over.** When a new vote opens, you start from your most recent lineup, minus any players who are no longer available, so you only need to make changes.

### How the Fans' XI is calculated

Combining thousands of lineups that use different formations is the interesting part. The full reasoning is in [ADR 0001](docs/adr/0001-agregacion-del-11-elegido.md); in short:

1. **The formation** is the one chosen by the most fans.
2. **Every lineup counts towards the positions**, even those built with a different formation. A hand-written *equivalence table* maps each position in each formation to its closest position in every other formation (for example, a right winger in a 4-3-3 counts towards the right midfielder in a 4-4-2).
3. **Players are assigned optimally.** The Hungarian algorithm picks 11 different players so that the total number of votes is as high as possible. This avoids the unfair results of a greedy approach, for example when the same player wins two positions.
4. **Unavailable players are discarded** at closing time, and any position left without valid votes is filled with the available players who received the most votes elsewhere.
5. **Ties** are broken deterministically by which votes were settled first, so the result is always reproducible.

The result is then frozen and never changes.

### Notifications

Fans can opt in to push notifications (the app is installable as a PWA). They are told when a new vote opens, when it is about to close (3 hours before), when the Fans' XI is ready, and when a player in their saved lineup becomes unavailable.

### For the club admin

A backoffice inside the same app lets the admin keep everything in sync with reality:

- the **squads** of both clubs: players, shirt numbers, natural positions and availability (available, injured, suspended, unavailable);
- **opponents** and their crests;
- the **fixture**: matches, kick-off times, rescheduling and cancellations;
- each club's **crest**;
- the **real starting XI** after each match, for the comparison with the Fans' XI;
- a live view of each open vote.

The backoffice requires two-factor authentication (TOTP).

## Privacy

- Your lineup is **private**. Other fans only ever see totals and the Fans' XI, never anyone's individual vote, name or email.
- Public pages and share images contain only match data and the aggregated result.
- You can **delete your account** and your data at any time from the app.
- All authorization is enforced inside the database with row-level security, not only in the app's code.

## The pixel-art look

Everything is drawn on a single pixel grid, using a limited 24-colour palette:

- each player appears in a 24x24 **club shirt** with their number and surname; goalkeepers wear the keeper's shirt;
- the **pitch** is drawn top-down with striped grass and chalk lines, and it fills the available space. It is vertical on a phone held upright, and horizontal on desktop or a phone turned sideways;
- club **crests** are 48x48 pixel-art images;
- the colour theme follows your club (yellow and black for Peñarol; white, blue and red for Nacional);
- animations move in steps, like an old game: players sway, dropped shirts jump, and confetti falls on the Fans' XI. All of it is turned off if your device asks for reduced motion.

The art is rendered with plain HTML, CSS and SVG rather than a canvas, so forms, accessibility, screen readers and drag and drop keep working normally. See [ADR 0004](docs/adr/0004-pixel-art-en-dom-con-unidad-px.md).

## Tech stack

| Area | Choice |
|---|---|
| Web app | [Next.js](https://nextjs.org/) 16 (App Router), React 19, strict TypeScript |
| Backend | [Supabase](https://supabase.com/): Postgres, Auth (Google + email, TOTP for admins) and Storage |
| Authorization | Postgres row-level security, deny-by-default ([ADR 0003](docs/adr/0003-stack-next-supabase.md)) |
| Scheduled jobs | `pg_cron` + `pg_net` in the database: closing votes, carrying lineups over, sending notifications |
| Drag and drop | [dnd-kit](https://dndkit.com/) |
| Push | Web Push (VAPID) |
| Fonts | Press Start 2P and Tiny5 (both OFL), self-hosted |
| Tests | [Vitest](https://vitest.dev/): unit tests for the domain logic, plus access-policy tests against a local Supabase |
| Hosting | Vercel + Supabase |

### Project layout

```
src/
  domain/     Pure business logic (no React, Next or Supabase): voting calendar,
              lineup editor, vote counting, carry-over, pixel art, pitch layout...
  app/        Next.js routes: the fan app, the admin backoffice, public share pages
  lib/        Glue between the app and Supabase (sessions, reads, uploads, jobs)
supabase/
  migrations/ Database schema and access policies
tests/rls/    Tests that the database only lets each user do what they should
docs/
  adr/        Architecture decision records
```

The domain vocabulary (Club, Fixture, Lineup, Fans' XI…) is defined, in Spanish, in [`CONTEXT.md`](CONTEXT.md), and the code uses the same words.

## Running it locally

You need Node.js 24, npm and Docker.

```bash
npm install
npx supabase start          # local Postgres, Auth and Storage (Docker)
npx supabase db reset       # apply migrations and sample data
cp .env.example .env.local  # then fill in the keys shown by `npx supabase status`
npm run dev                 # http://localhost:3000
```

Sign up at `/registro`. Verification codes are delivered to the local mail inbox at http://127.0.0.1:54324.

```bash
npm run typecheck && npm run lint && npm test   # types, lint, unit tests
npm run test:rls                                 # access-policy tests (needs local Supabase)
```

## Documentation

- **[Developer guide](docs/DESARROLLO.md)** (Spanish): project structure, conventions, data model, every feature in detail, environment variables, security review and step-by-step production deployment.
- **[Architecture decisions](docs/adr/)** (Spanish): why the Fans' XI is aggregated the way it is, why lineups have no submit button, why all security lives in the database (the repository is public), and why pixel art is drawn in the DOM.
- **[Domain glossary](CONTEXT.md)** (Spanish).

## Status

The MVP and the pixel-art redesign are feature-complete and covered by tests. The app is getting ready for its first production deployment.
