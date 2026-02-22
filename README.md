# Bambu Lab MQTT Bridge — Home Assistant Add-on

**MQTT bridge for Bambu Lab printers that solves the single-client limitation.**  
Republishes all printer MQTT traffic to your local Mosquitto broker and **auto-discovers printers as devices** with **36 entities each** in Home Assistant via MQTT Discovery.

## What It Does

- Connects to each Bambu Lab printer as the **sole MQTT client** (MQTTS port 8883)
- Republishes **all messages** to your local Mosquitto broker
- Publishes HA MQTT Discovery payloads — printers **auto-appear** as devices with sensors, camera, controls, AMS
- Enables **BambuStudio, Node-RED, scripts, HA** to all consume printer data **simultaneously** _(no more connection conflicts)_

## Prerequisites

- Home Assistant with the **Mosquitto broker** add-on installed and running
- **MQTT integration** configured in Home Assistant _(no HACS or custom integrations needed)_
- Bambu Lab printer(s) on the same local network with **LAN Mode enabled**

## Installation (3 minutes)

1. **Settings > Add-ons > Add-on Store**
2. **...** menu > **Repositories** → Add: `https://github.com/DementedPixel/bambu-bridge-ha`
3. Install **Bambu Lab MQTT Bridge**
4. **Configuration** tab → Add your printer(s): IP + LAN access code
5. **Start** the add-on

Printers appear automatically in **Devices & Services > MQTT** → **Printers**.

## Entities Per Printer (36 total)

| Type             | Count | Examples                                                      |
| ---------------- | ----- | ------------------------------------------------------------- |
| Sensors          | 14    | Nozzle/bed/chamber temp, print progress, layers, status, WiFi |
| Binary Sensors   | 4     | Printing, print error, chamber light, AMS connected           |
| Camera           | 1     | Periodic JPEG snapshots                                       |
| Buttons          | 3     | Pause, resume, stop                                           |
| Selects          | 2     | Speed profile, chamber light                                  |
| AMS Tray Sensors | 12    | Filament type, colour, remaining % _(4 trays)_                |

## How This Compares to ha‑bambulab

| Bambu MQTT Bridge                                | [ha‑bambulab](https://github.com/greghesp/ha-bambulab) |
| ------------------------------------------------ | ------------------------------------------------------- |
| **MQTT + auto‑discovery** (standard HA entities) | Native HA integration                                   |
| **Multi‑client** (Studio + HA + Node‑RED)        | HA‑only                                                 |
| **Add‑on** (no HACS)                             | HACS required                                           |
| **LAN‑only** (no cloud auth)                     | Cloud + LAN                                             |
| **Printer farms** via topic conventions          | Multi‑printer supported                                 |

_Different approaches — this bridge is ideal for MQTT‑heavy setups where printers should behave like any other MQTT device. Both can coexist._

## Documentation

See [DOCS.md](bambu-bridge/DOCS.md) or the **Documentation** tab in the add‑on UI for full setup, entity list, and troubleshooting.

## License

MIT
