# Changelog

## [1.0.3] - 2025-02-22

### Added

- **Ingress dashboard** — printer dashboard accessible from the HA sidebar (Settings > Add-ons > Bambu Bridge > "Open Web UI")
- Real-time WebSocket updates, camera feeds, and printer status all available through ingress
- Dashboard works behind HA's ingress proxy with correct path handling

## [1.0.2] - 2025-02-22

### Added

- Printer model field in HA discovery (shows in Devices page)
- Per-printer camera toggle (`camera_enabled` config option)
- Adaptive camera interval (60s idle, 5s when printing)
- Entity `expire_after` (sensors go unavailable after 2 min of no updates)
- Exponential backoff reconnect (1s to 30s cap with jitter)
- QoS 1 for state publishes
- 2s command debounce to prevent rapid-fire duplicates
- Startup warning if printer doesn't respond within 30s

## [1.0.1] - 2025-02-22

### Fixed

- Made `camera_enabled` optional in config schema (was blocking config save)
- Removed deprecated armv7 architecture

## [1.0.0] - 2025-02-22

### Added

- Initial release
- Per-printer MQTT bridge (MQTTS 8883 to local Mosquitto)
- Home Assistant MQTT Discovery with 36 entities per printer
- Camera snapshot capture via TLS port 6000
- Pause, Resume, Stop print controls
- Speed profile select (Silent/Standard/Sport/Ludicrous)
- Chamber light control (On/Off)
- AMS tray sensors (filament type, colour, remaining %)
- Automatic MQTT broker discovery via Supervisor API
- Multi-architecture support (amd64, aarch64)
