# camp-auth — flows

Mermaid sequence diagrams for the load-bearing flows.

## Login flow (gate ON)

```mermaid
sequenceDiagram
  actor User
  participant Browser
  participant Middleware as middleware.ts
  participant Login as /api/camp/login
  participant DB as MongoDB

  User->>Browser: visits /play/unmasked
  Browser->>Middleware: GET /play/unmasked
  Middleware->>Browser: 307 → /login?next=/play/unmasked
  Browser->>User: shows login form (CampLoginForm)
  User->>Browser: submits team1 + password
  Browser->>Login: POST { username, password }
  Login->>DB: Session.findOne (latest)
  Login->>DB: Team.findOne({sessionId, loginUsername}).select('+passwordHash')
  Login-->>Login: bcrypt.compare(password, hash)
  Login-->>Browser: Set-Cookie youthcamp_camp_auth=1, youthcamp_team_id=<id> (httpOnly, 14d)
  Login-->>Browser: 200 { ok: true, teamId, teamName }
  Browser->>Browser: window.location.assign('/play/unmasked')
  Browser->>Middleware: GET /play/unmasked (cookies sent)
  Middleware-->>Browser: passes through
```

The form uses `window.location.assign(next)` instead of `router.push` ([camp-login-form.tsx:33](../../app/login/camp-login-form.tsx#L33)) — full navigation guarantees the new httpOnly cookies are sent on the next request, avoiding soft-nav edge cases.

## Login flow (gate OFF)

```mermaid
sequenceDiagram
  actor User
  participant Browser
  participant Login as /api/camp/login

  User->>Browser: submits any creds
  Browser->>Login: POST { username, password }
  Login->>Login: isCampGateEnabled() === false
  Login-->>Browser: Set-Cookie youthcamp_camp_auth=1 (no team cookie!)
  Login-->>Browser: 200 { ok: true, message: 'Camp gate off …' }
```

When the gate is off, the login route **does not** check credentials and **does not** set `youthcamp_team_id`. Game routes will still demand a team cookie via `requireCampTeamForGameRoute`, redirecting to `/login` if missing. That's why local dev usually still needs you to log in — the team cookie is required.

## Gate redirect flow

```mermaid
flowchart TD
  Req[Request /camp/* or /play/*] --> M{middleware.ts}
  M -->|gate disabled| Pass[NextResponse.next]
  M -->|gate enabled, cookie='1'| Pass
  M -->|gate enabled, cookie missing| Redir[307 /login?next=...]
  Redir --> LoginPage[/login page]
  LoginPage -->|already authed| Auto[redirect safeCampLoginNext]
  LoginPage -->|not authed| Form[Show CampLoginForm]
```

[middleware.ts:9-27](../../middleware.ts#L9-L27)

## Team selection flow (post-login)

```mermaid
sequenceDiagram
  actor User
  participant Dashboard as /camp page
  participant SelectTeam as /api/camp/select-team

  User->>Dashboard: pick a different team in dropdown
  Dashboard->>SelectTeam: POST { teamId }
  SelectTeam->>SelectTeam: validate ObjectId
  SelectTeam-->>Dashboard: Set-Cookie youthcamp_team_id=<id>
  SelectTeam-->>Dashboard: 200 { ok: true }
  Dashboard->>Dashboard: fetch /api/camp/analytics?…
  Dashboard->>Dashboard: router.refresh
```

Note `/api/camp/select-team` does **not** re-check credentials. The `youthcamp_camp_auth=1` cookie is taken as proof of authentication; the dashboard select is a UI-level "act as team X". This is fine because all teams in the camp share the same season — there's no privacy boundary between them.

## Logout flow

```mermaid
sequenceDiagram
  actor User
  participant Browser
  participant Logout as /api/camp/logout

  User->>Browser: clicks "Sign out"
  Browser->>Logout: POST
  Logout-->>Browser: cookies.delete(camp_auth, team_id)
  Logout-->>Browser: 200 { ok: true }
  Browser->>Browser: router.push('/') / router.refresh
```

[CampLogoutButton](../../components/camp/camp-logout-button.tsx), [CampHeaderLogout](../../components/camp/camp-header-logout.tsx).

## Game-route SSR flow (Day 1–2 detail page)

```mermaid
flowchart TD
  Req[GET /games/salbabida-race] --> Page[GameDetailPage]
  Page --> DB[(GameDefinition.findOne)]
  DB --> Day0{day === 0?}
  Day0 -->|yes| NF[notFound]
  Day0 -->|no| Playable{isPlayable?}
  Playable -->|true| Require[requireCampTeamForGameRoute]
  Playable -->|false| Require2[requireCampTeamForGameRoute]
  Require2 --> HasResult{teamHasGameResult?}
  HasResult -->|no| NF
  HasResult -->|yes| Render[render rules + scoring]
  Require --> Render
```

The `/games/[slug]` page is locked behind a published `GameResult` for non-playable events — teams can't see scoring details for a game that hasn't been judged yet. Playable engines (`mindgame`, `unmasked`) skip that check. See [team-game-access.ts:55-81](../../lib/camp/team-game-access.ts#L55-L81).
