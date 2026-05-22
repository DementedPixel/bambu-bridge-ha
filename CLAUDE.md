# bambu-bridge-ha — Claude instructions

A **Home Assistant add-on** that bridges Bambu Lab printers to MQTT. It connects to each printer as
the *sole* MQTT client (MQTTS 8883), republishes all traffic to the local Mosquitto broker, and
publishes HA MQTT Discovery payloads so each printer auto-appears as a device with **36 entities**
(14 sensors, 4 binary sensors, 1 camera, 3 buttons, 2 selects, 12 AMS tray sensors). It also bundles
a web dashboard served via HA **ingress** (sidebar → "Bambu Bridge").

This is the productionised version of the bridge from the sibling repo `bambu_web` (cloned alongside
at `e:\HomeLab\bambu_web`).

> ⚠️ **UNRESOLVED — duplicated frontend.** The bundled dashboard frontend (`bambu-bridge/frontend/src`)
> is a **copy** of `bambu_web/src` (`PrinterCard`, `CameraFeed`, `PrintStatus`, `AmsStatus`,
> `TemperatureDisplay`, `useWebSocket`). This duplication **must be eliminated** — the approach is not
> yet decided (shared workspace package, submodule, build-time copy, or single source of truth).
> Until then, **any change to these components must be mirrored in `bambu_web` by hand**, and
> resolving the duplication should come before significant frontend work. Tracked in the KB at
> `E:\knowledge-base\projects\home-lab\bambu\tasks.md`.

## Layout

- `repository.yaml` — HA add-on repository manifest (maintainer: Interzone Digital).
- `bambu-bridge/` — the add-on itself:
  - `config.yaml` — add-on options/schema (`printers[]`, `discovery_prefix`, `camera_interval`,
    `log_level`), `ingress: true`, `ingress_port: 3001`, `services: [mqtt:need]`. **Bump `version`
    here on every change** (currently 1.0.3) and add a `CHANGELOG.md` entry.
  - `build.yaml`, `Dockerfile` — image build (`ghcr.io/dementedpixel/bambu-bridge-{arch}`, amd64 + aarch64).
  - `rootfs/` — s6/bashio service scripts and runtime files baked into the image.
  - `frontend/` — Vite + React dashboard (copy of `bambu_web/src`), served behind ingress.
  - `translations/`, `DOCS.md`, `CHANGELOG.md`, `icon.png`, `logo.png`.

## Conventions & guardrails

- **Versioning:** every functional change requires a `version:` bump in `bambu-bridge/config.yaml`
  and a matching `CHANGELOG.md` entry (Keep-a-Changelog style: `## [x.y.z] - YYYY-MM-DD`).
- **Credentials** (printer IP / serial / access code) come from the user's add-on **Configuration**
  tab at runtime via `config.yaml` options — never hardcode or commit them. `access_code` uses the
  `password` schema type. MQTT username is always `bblp`.
- **Single-MQTT-client limit:** the bridge is the sole client to each printer; that's the whole point
  (it fans the connection out to HA, BambuStudio, Node-RED, etc. via Mosquitto). Don't open a second
  direct client to a printer the bridge owns.
- Ingress: the dashboard must work behind HA's path-rewriting proxy — keep base-path handling
  (`frontend/src/utils/basePath.ts`) intact; use relative asset/WS paths.
- **No native browser dialogs** in the frontend — use proper in-app UI.
- Don't commit on `main`/`master` — branch and open a PR. No `Co-Authored-By` trailer on commits.

## Status

On hold (last active 2026-02-22), now cloned locally. Tracked in the KB at
`E:\knowledge-base\projects\home-lab\bambu\`.
