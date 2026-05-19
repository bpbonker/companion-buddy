# Companion Buddy

A fork of [Bitfocus Companion](https://github.com/bitfocus/companion) that adds **Wall Panels** — touch-friendly, designable kiosk surfaces for tablets running in Chromium / iPad Safari standalone mode. Built for venues where a wall-mounted tablet is the primary control surface (replacing a Stream Deck, or alongside one).

## What this fork adds

- **Wall Panels designer** (`/panels-ui/editor`) — drag-and-drop layout with buttons, sliders, knobs, indicators, meters, labels, images, group boxes, and text/number inputs.
- **Kiosk runtime** — each panel is reachable at `/panels-ui/panel/<slug>?token=<device-token>`, sized via stretch-to-fit, screen-wake-locked.
- **PWA support** — per-panel dynamic web manifest, Add-to-Home-Screen on iPad opens the kiosk in fullscreen standalone mode using the Bitfocus Companion icon.
- **Device tokens** — venue-wide tokens issued via the editor's Devices dialog; a single tablet can drive multiple panels.
- **Panel switching from buttons** — any button can carry a `navigateTo` slug; pressing it takes the kiosk to another panel, reusing the same device token.
- **PIN protection** — per-panel PIN gate; buttons can opt-in to require the PIN before they fire (good for "Open doors" or "Power off" buttons on shared kiosks).
- **Live push on save** — saving in the editor broadcasts the new layout to every connected kiosk on that panel via the existing WebSocket. No reconnect, no flash.
- **Bound variable streaming** — sliders/knobs/inputs read & write Companion's `custom:*` variables; indicators / meters / labels render reactively as those variables change.

## Quick start (Docker)

For a home server or LAN deployment:

```bash
docker compose up -d --build
```

Then point tablets at:

- Editor: `http://<host-LAN-IP>:8000/panels-ui/editor`
- Kiosk: `http://<host-LAN-IP>:8000/panels-ui/panel/<slug>?token=<device-token>`

Panels, tokens, the kiosk-address setting, custom variables and button pages persist in the named volume `companion-buddy-config`. The image is a multi-stage build that produces a slim Debian runtime with the bundled Companion + Buddy backend and the pre-built panels UI. See `docker-compose.yml` for optional flags (USB Stream Deck passthrough, host networking for mDNS).

## Quick start (dev from source)

Requires Node `>=22.22.3 <23` and Yarn 4 via corepack.

```bash
corepack enable
yarn install
yarn dev          # starts the Companion backend at http://localhost:8000
yarn dev:panels   # starts the wall-panels Vite app at http://localhost:5174/editor
```

The legacy Companion admin UI (`http://localhost:8000`) gains a "Wall Panels" sidebar link that opens `/panels-ui/editor` in a new tab. From there, create a panel, drop controls onto the canvas, mint a device under "Devices", and scan the QR from a tablet on the same LAN.

The QR's URL uses the host setting from **Inspector → Kiosk address** (auto-detected from `os.networkInterfaces`) so the link reaches `http://192.168.x.y:8000/...` instead of `localhost`.

## Architecture summary

| Area                                | Path                                 |
| ----------------------------------- | ------------------------------------ |
| Shared schemas (Zod)                | `shared-lib/lib/Model/PanelModel.ts` |
| Backend controller / TRPC routes    | `companion/lib/Panels/Controller.ts` |
| Per-session runtime (variable push) | `companion/lib/Panels/Runtime.ts`    |
| Persistence (SQLite tables)         | `companion/lib/Panels/Store.ts`      |
| Editor + kiosk Vite app             | `webui-panels/`                      |
| Express mount under `/panels-ui`    | `companion/lib/UI/Express.ts`        |
| Sidebar link from legacy webui      | `webui/src/Layout/Sidebar.tsx`       |
| Playwright regression suite         | `tools/e2e/`                         |

## Testing

`yarn playwright test tools/e2e/stress.spec.ts tools/e2e/nav-pin-flow.spec.ts` exercises live-push, PIN flow, cross-panel nav, canvas resize, and knob behavior end-to-end against the running dev backend.

## Relationship to upstream

This is an MIT-licensed fork — see `LICENSE.md` for the upstream Bitfocus copyright plus the fork's additions. Issues that aren't specific to the panels feature should go to [bitfocus/companion](https://github.com/bitfocus/companion).

---

# Upstream: [Bitfocus Companion](https://companion.free)

**User Documentation**

- https://companion.free/user-guide/beta/getting-started/Installation

**Developer Documentation**

Bitfocus Companion is open-source software. If you would like to contribute to our project please check out the developer documentation.
Slack is also the perfect place for asking questions, especially when you're getting started.

- https://companion.free/for-developers/

**Slack / Chat**

- https://l.companion.free/q/78U0Kpbc9

**Our websites**

- https://companion.free/
- https://bitfocus.io/companion/

**Bleeding edge builds**

- https://user.bitfocus.io/download

For checking known bugs or reporting of potential bugs, please use the [issue system](https://github.com/bitfocus/companion/issues) on GitHub

**Donations**

- https://opencollective.com/companion

## Modules (Supported devices/software)

- https://bitfocus.io/connections (700+!)

## Contributors

This project exists thanks to all the people who contribute.
<a href="https://github.com/bitfocus/companion/contributors"><img src="https://opencollective.com/companion/contributors.svg?width=890&button=false" /></a>

## Backers

Thank you to all our backers! 🙏 [[Become a backer](https://opencollective.com/companion)]

<a href="https://opencollective.com/companion#backers" target="_blank"><img src="https://opencollective.com/companion/backers.svg?width=890"></a>

## Sponsors

Support this project by becoming a sponsor. Your logo will show up here with a link to your website. [[Become a sponsor](https://opencollective.com/companion)]

<a href="https://opencollective.com/companion/sponsor/0/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/0/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/1/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/1/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/2/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/2/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/3/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/3/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/4/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/4/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/5/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/5/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/6/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/6/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/7/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/7/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/8/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/8/avatar.svg"></a>
<a href="https://opencollective.com/companion/sponsor/9/website" target="_blank"><img src="https://opencollective.com/companion/sponsor/9/avatar.svg"></a>
