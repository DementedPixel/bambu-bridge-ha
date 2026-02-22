# Bambu Lab MQTT Bridge

## Overview

This add-on bridges Bambu Lab printers to your Home Assistant MQTT broker,
solving Bambu's one-MQTT-client-per-printer limitation. Once running, your
printers auto-discover in Home Assistant with sensors, controls, and camera.

## Prerequisites

1. **Mosquitto broker add-on** must be installed and running in Home Assistant.
   Go to Settings > Add-ons > Add-on Store > Mosquitto broker.
2. **MQTT integration** must be configured in Home Assistant.
   Go to Settings > Devices & Services > Add Integration > MQTT.
3. **Printer network access**: Your printers must be on the same local network
   as Home Assistant, with LAN Mode enabled.

## How It Works

The bridge connects to each printer via MQTTS (port 8883) using the Bambu
proprietary protocol. It republishes all printer messages to your Mosquitto
broker, allowing unlimited MQTT clients to subscribe. The bridge also:

- Publishes Home Assistant MQTT Discovery payloads so printers auto-appear
- Aggregates partial printer status reports into a complete state
- Captures periodic camera snapshots and publishes them via MQTT
- Routes Home Assistant commands (pause, resume, stop, speed, light) back
  to the printers

## Configuration

### Adding a Printer

You need the following from each printer:

- **Name**: A friendly display name (e.g. "Workshop Printer")
- **IP Address**: The printer's local IP (e.g. 192.168.1.100)
- **Serial Number**: Found in BambuStudio > Device Info, or on the printer
  touchscreen under Settings > Device Info
- **Access Code**: The 8-digit LAN access code, found in BambuStudio >
  Device > Connection, or on the printer under Settings > Network

### Options

| Option | Default | Description |
|--------|---------|-------------|
| Discovery Prefix | homeassistant | MQTT discovery prefix. Only change if customised in your MQTT integration. |
| Camera Interval | 5 | Seconds between camera snapshots. Range: 1-60. |
| Log Level | info | Logging verbosity. Use `debug` for troubleshooting. |

### Camera

Camera snapshots are captured periodically from each printer's built-in camera
using a custom TLS protocol on port 6000. The snapshots are published as
base64-encoded JPEG images to MQTT and appear as camera entities in HA.

To disable camera for all printers, set `camera_enabled` to false on each
printer in the configuration. The camera interval applies globally to all
printers that have camera enabled.

## Entities Per Printer

Each printer creates a device in Home Assistant with 36 entities:

### Sensors (14)

| Entity | Description |
|--------|-------------|
| Nozzle Temperature | Current nozzle temperature in °C |
| Nozzle Target | Target nozzle temperature in °C |
| Bed Temperature | Current bed temperature in °C |
| Bed Target | Target bed temperature in °C |
| Chamber Temperature | Current chamber temperature in °C |
| Print Progress | Current print progress in % |
| Time Remaining | Estimated time remaining in minutes |
| Current Layer | Current print layer number |
| Total Layers | Total number of layers |
| Print Status | Printer state (IDLE, RUNNING, PAUSE, FINISH, etc.) |
| Current File | Name of the file being printed |
| Speed Profile | Current speed setting (Silent/Standard/Sport/Ludicrous) |
| WiFi Signal | WiFi signal strength in dBm |
| Active AMS Tray | Currently selected AMS tray number |

### Binary Sensors (4)

| Entity | Description |
|--------|-------------|
| Printing | ON when a print is actively running |
| Print Error | ON when a print error has occurred |
| Chamber Light | ON when the chamber light is on |
| AMS Connected | ON when an AMS unit is connected |

### Camera (1)

Periodic JPEG snapshots from the printer's built-in camera.

### Controls

| Entity | Type | Description |
|--------|------|-------------|
| Pause Print | Button | Pause the current print |
| Resume Print | Button | Resume a paused print |
| Stop Print | Button | Stop the current print |
| Speed Profile | Select | Silent, Standard, Sport, or Ludicrous |
| Chamber Light | Select | On or Off |

### AMS Tray Sensors (12)

For each of 4 AMS trays:

| Entity | Description |
|--------|-------------|
| Tray N Filament | Filament type (e.g. "PLA Matte") |
| Tray N Colour | Filament colour as hex code |
| Tray N Remaining | Filament remaining percentage |

## Troubleshooting

### Printer not appearing in Home Assistant

1. Check the add-on log for connection errors
2. Verify the printer IP is reachable from your HA host
3. Verify the serial number and access code are correct
4. Ensure LAN Mode is enabled on the printer
5. Check that the Mosquitto add-on is running
6. Check that the MQTT integration is configured in HA

### Camera not updating

- Camera uses TLS port 6000. Ensure no firewall blocks this port.
- Try increasing the camera interval if you see timeout errors.
- Check that `camera_enabled` is set to true for the printer.

### "No MQTT service available" error

- Install and start the Mosquitto broker add-on
- The MQTT integration must be configured in HA

### Bridge disconnects or reconnects frequently

- Check your network stability between HA and the printer
- The bridge auto-reconnects with a 5-second interval
- Check the add-on log with log level set to `debug`

## Network Ports Used

| Port | Direction | Protocol | Purpose |
|------|-----------|----------|---------|
| 8883 | Add-on > Printer | MQTTS | Printer status and commands |
| 6000 | Add-on > Printer | TLS | Camera snapshots |
| 1883 | Add-on > Broker | MQTT | Local MQTT broker connection |

All connections are outbound from the add-on. No inbound ports need to be
opened or exposed.

## Coexistence with Other Tools

This bridge is the sole MQTT client connected to each printer. All other
tools (BambuStudio, Node-RED, custom scripts) should connect to your
Mosquitto broker instead of directly to the printer. This avoids the
one-client disconnection problem.

### Using with ha-bambulab

If you also use the [ha-bambulab](https://github.com/greghesp/ha-bambulab)
custom integration, you can configure it to connect to your Mosquitto broker
instead of directly to the printer. This allows both integrations to coexist.

## MQTT Topics

For advanced users, the bridge publishes to these MQTT topics:

| Topic | Purpose |
|-------|---------|
| `device/{serial}/report` | Raw printer reports (forwarded from printer) |
| `bambu_bridge/{serial}/state` | Merged state JSON for HA entities |
| `bambu_bridge/{serial}/status` | Online/offline availability |
| `bambu_bridge/{serial}/camera` | Base64 JPEG camera snapshots |
| `bambu_bridge/{serial}/command/*` | HA command routing |
