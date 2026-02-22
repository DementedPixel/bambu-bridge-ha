/**
 * HA MQTT Discovery for Bambu Lab printers.
 *
 * - Publishes multi-component device discovery config (retained)
 * - Aggregates partial printer reports into cached state
 * - Publishes merged state to bambu_bridge/{serial}/state
 * - Publishes availability to bambu_bridge/{serial}/status
 * - Routes HA commands to Bambu printer request format
 */

import type { MqttClient } from 'mqtt';

const BRIDGE_VERSION = '1.0.0';

export interface PrinterBridge {
  serial: string;
  name: string;
  ip: string;
  model?: string;
}

// ---------------------------------------------------------------------------
// Speed profile mapping
// ---------------------------------------------------------------------------

const SPEED_VALUES: Record<string, string> = {
  Silent: '1',
  Standard: '2',
  Sport: '3',
  Ludicrous: '4',
};

// ---------------------------------------------------------------------------
// Discovery config publishing
// ---------------------------------------------------------------------------

function buildDiscoveryPayload(printer: PrinterBridge): object {
  const serial = printer.serial;
  const uid = `bambu_${serial}`;
  const stateTopic = `bambu_bridge/${serial}/state`;
  const cmdBase = `bambu_bridge/${serial}/command`;

  const payload = {
    dev: {
      ids: [uid],
      name: printer.name,
      mf: 'Bambu Lab',
      mdl: printer.model || undefined,
      sn: serial,
      sw: BRIDGE_VERSION,
      cu: `http://${printer.ip}`,
    },
    o: {
      name: 'Bambu MQTT Bridge',
      sw: BRIDGE_VERSION,
    },
    avty: [
      {
        t: `bambu_bridge/${serial}/status`,
        pl_avail: 'online',
        pl_not_avail: 'offline',
      },
    ],
    cmps: {
      // ── Sensors (14) ──────────────────────────────────────────────
      nozzle_temp: {
        p: 'sensor',
        name: 'Nozzle Temperature',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.nozzle_temper | default(0) }}',
        dev_cla: 'temperature',
        unit_of_meas: '°C',
        stat_cla: 'measurement',
        sug_dsp_prc: 1,
        ic: 'mdi:printer-3d-nozzle-heat',
        uniq_id: `${uid}_nozzle_temp`,
      },
      nozzle_target: {
        p: 'sensor',
        name: 'Nozzle Target',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.nozzle_target_temper | default(0) }}',
        dev_cla: 'temperature',
        unit_of_meas: '°C',
        stat_cla: 'measurement',
        sug_dsp_prc: 1,
        ic: 'mdi:printer-3d-nozzle-heat-outline',
        uniq_id: `${uid}_nozzle_target`,
      },
      bed_temp: {
        p: 'sensor',
        name: 'Bed Temperature',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.bed_temper | default(0) }}',
        dev_cla: 'temperature',
        unit_of_meas: '°C',
        stat_cla: 'measurement',
        sug_dsp_prc: 1,
        ic: 'mdi:radiator',
        uniq_id: `${uid}_bed_temp`,
      },
      bed_target: {
        p: 'sensor',
        name: 'Bed Target',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.bed_target_temper | default(0) }}',
        dev_cla: 'temperature',
        unit_of_meas: '°C',
        stat_cla: 'measurement',
        sug_dsp_prc: 1,
        ic: 'mdi:radiator',
        uniq_id: `${uid}_bed_target`,
      },
      chamber_temp: {
        p: 'sensor',
        name: 'Chamber Temperature',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.chamber_temper | default(0) }}',
        dev_cla: 'temperature',
        unit_of_meas: '°C',
        stat_cla: 'measurement',
        sug_dsp_prc: 1,
        ic: 'mdi:thermometer',
        uniq_id: `${uid}_chamber_temp`,
      },
      progress: {
        p: 'sensor',
        name: 'Print Progress',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.mc_percent | default(0) }}',
        unit_of_meas: '%',
        stat_cla: 'measurement',
        ic: 'mdi:progress-clock',
        uniq_id: `${uid}_progress`,
      },
      time_remaining: {
        p: 'sensor',
        name: 'Time Remaining',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.mc_remaining_time | default(0) }}',
        dev_cla: 'duration',
        unit_of_meas: 'min',
        ic: 'mdi:timer-sand',
        uniq_id: `${uid}_time_remaining`,
      },
      layer: {
        p: 'sensor',
        name: 'Current Layer',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.layer_num | default(0) }}',
        stat_cla: 'measurement',
        ic: 'mdi:layers',
        uniq_id: `${uid}_layer`,
      },
      total_layers: {
        p: 'sensor',
        name: 'Total Layers',
        stat_t: stateTopic,
        val_tpl: '{{ value_json.total_layer_num | default(0) }}',
        ic: 'mdi:layers-triple',
        uniq_id: `${uid}_total_layers`,
      },
      status: {
        p: 'sensor',
        name: 'Print Status',
        stat_t: stateTopic,
        val_tpl: "{{ value_json.gcode_state | default('UNKNOWN') }}",
        ic: 'mdi:printer-3d',
        uniq_id: `${uid}_status`,
      },
      current_file: {
        p: 'sensor',
        name: 'Current File',
        stat_t: stateTopic,
        val_tpl: "{{ value_json.subtask_name | default('') }}",
        ic: 'mdi:file-cad-box',
        uniq_id: `${uid}_current_file`,
      },
      speed_profile: {
        p: 'sensor',
        name: 'Speed Profile',
        stat_t: stateTopic,
        val_tpl:
          "{% set m = {1:'Silent',2:'Standard',3:'Sport',4:'Ludicrous'} %}" +
          "{{ m[value_json.spd_lvl | int] | default('Unknown') }}",
        ic: 'mdi:speedometer',
        uniq_id: `${uid}_speed_profile`,
      },
      wifi_signal: {
        p: 'sensor',
        name: 'WiFi Signal',
        stat_t: stateTopic,
        val_tpl: "{{ value_json.wifi_signal | default('0dBm') | replace('dBm','') | int }}",
        dev_cla: 'signal_strength',
        unit_of_meas: 'dBm',
        stat_cla: 'measurement',
        ic: 'mdi:wifi',
        uniq_id: `${uid}_wifi_signal`,
      },
      active_tray: {
        p: 'sensor',
        name: 'Active AMS Tray',
        stat_t: stateTopic,
        val_tpl: "{{ value_json.ams.tray_now | default('N/A') if value_json.ams is defined else 'N/A' }}",
        ic: 'mdi:palette-swatch',
        uniq_id: `${uid}_active_tray`,
      },

      // ── Binary Sensors (4) ────────────────────────────────────────
      printing: {
        p: 'binary_sensor',
        name: 'Printing',
        stat_t: stateTopic,
        val_tpl: "{{ 'ON' if value_json.gcode_state == 'RUNNING' else 'OFF' }}",
        dev_cla: 'running',
        ic: 'mdi:printer-3d-nozzle',
        uniq_id: `${uid}_printing`,
      },
      print_error: {
        p: 'binary_sensor',
        name: 'Print Error',
        stat_t: stateTopic,
        val_tpl: "{{ 'ON' if value_json.print_error | default(0) | int != 0 else 'OFF' }}",
        dev_cla: 'problem',
        ic: 'mdi:alert-circle',
        uniq_id: `${uid}_print_error`,
      },
      chamber_light_status: {
        p: 'binary_sensor',
        name: 'Chamber Light',
        stat_t: stateTopic,
        val_tpl:
          "{% set lr = value_json.lights_report | default([]) %}" +
          "{{ 'ON' if lr and lr[0].mode == 'on' else 'OFF' }}",
        dev_cla: 'light',
        ic: 'mdi:lightbulb',
        uniq_id: `${uid}_chamber_light_status`,
      },
      ams_connected: {
        p: 'binary_sensor',
        name: 'AMS Connected',
        stat_t: stateTopic,
        val_tpl:
          "{% if value_json.ams is defined and value_json.ams.ams is defined %}" +
          "{{ 'ON' if value_json.ams.ams | length > 0 else 'OFF' }}" +
          "{% else %}OFF{% endif %}",
        dev_cla: 'connectivity',
        ic: 'mdi:tray-full',
        uniq_id: `${uid}_ams_connected`,
      },

      // ── Camera (1) ────────────────────────────────────────────────
      camera: {
        p: 'camera',
        name: 'Camera',
        t: `bambu_bridge/${serial}/camera`,
        img_e: 'b64',
        ic: 'mdi:camera',
        uniq_id: `${uid}_camera`,
      },

      // ── Buttons (3) ───────────────────────────────────────────────
      pause_btn: {
        p: 'button',
        name: 'Pause Print',
        cmd_t: `${cmdBase}/pause`,
        ic: 'mdi:pause',
        uniq_id: `${uid}_pause`,
      },
      resume_btn: {
        p: 'button',
        name: 'Resume Print',
        cmd_t: `${cmdBase}/resume`,
        ic: 'mdi:play',
        uniq_id: `${uid}_resume`,
      },
      stop_btn: {
        p: 'button',
        name: 'Stop Print',
        cmd_t: `${cmdBase}/stop`,
        ic: 'mdi:stop',
        uniq_id: `${uid}_stop`,
      },

      // ── Selects (2) ───────────────────────────────────────────────
      speed_select: {
        p: 'select',
        name: 'Speed Profile',
        stat_t: stateTopic,
        val_tpl:
          "{% set m = {1:'Silent',2:'Standard',3:'Sport',4:'Ludicrous'} %}" +
          "{{ m[value_json.spd_lvl | int] | default('Standard') }}",
        cmd_t: `${cmdBase}/speed`,
        ops: ['Silent', 'Standard', 'Sport', 'Ludicrous'],
        ic: 'mdi:speedometer',
        uniq_id: `${uid}_speed_select`,
      },
      light_select: {
        p: 'select',
        name: 'Chamber Light',
        stat_t: stateTopic,
        val_tpl:
          "{% set lr = value_json.lights_report | default([]) %}" +
          "{% if lr %}{{ lr[0].mode | title }}{% else %}Off{% endif %}",
        cmd_t: `${cmdBase}/light`,
        ops: ['On', 'Off'],
        ic: 'mdi:lightbulb',
        uniq_id: `${uid}_light_select`,
      },

      // ── AMS Tray Sensors (4 trays × 3 = 12) ──────────────────────
      ...buildAmsTrayEntities(uid, stateTopic),
    },
  };

  // Add expire_after to all sensors and binary sensors so they go
  // unavailable in HA after 2 minutes of no state updates.
  const cmps = payload.cmps as Record<string, Record<string, unknown>>;
  for (const cmp of Object.values(cmps)) {
    if (cmp.p === 'sensor' || cmp.p === 'binary_sensor') {
      cmp.exp_aft = 120;
    }
  }

  return payload;
}

function buildAmsTrayEntities(uid: string, stateTopic: string): Record<string, object> {
  const entities: Record<string, object> = {};

  for (let tray = 0; tray < 4; tray++) {
    const trayPath = `value_json.ams.ams[0].tray[${tray}]`;

    entities[`ams_tray_${tray}_filament`] = {
      p: 'sensor',
      name: `AMS Tray ${tray + 1} Filament`,
      stat_t: stateTopic,
      val_tpl:
        `{% if ${trayPath} is defined %}` +
        `{{ ${trayPath}.tray_sub_brands | default(${trayPath}.tray_type | default('Empty')) }}` +
        `{% else %}Empty{% endif %}`,
      ic: 'mdi:printer-3d-nozzle',
      uniq_id: `${uid}_ams_tray_${tray}_filament`,
    };

    entities[`ams_tray_${tray}_colour`] = {
      p: 'sensor',
      name: `AMS Tray ${tray + 1} Colour`,
      stat_t: stateTopic,
      val_tpl:
        `{% if ${trayPath} is defined and ${trayPath}.tray_color is defined %}` +
        `#{{ ${trayPath}.tray_color[:6] }}` +
        `{% else %}#000000{% endif %}`,
      ic: 'mdi:palette',
      uniq_id: `${uid}_ams_tray_${tray}_colour`,
    };

    entities[`ams_tray_${tray}_remaining`] = {
      p: 'sensor',
      name: `AMS Tray ${tray + 1} Remaining`,
      stat_t: stateTopic,
      val_tpl:
        `{% if ${trayPath} is defined %}` +
        `{{ ${trayPath}.remain | default(0) }}` +
        `{% else %}0{% endif %}`,
      unit_of_meas: '%',
      stat_cla: 'measurement',
      ic: 'mdi:gauge',
      uniq_id: `${uid}_ams_tray_${tray}_remaining`,
    };
  }

  return entities;
}

export function publishDiscovery(
  mosqClient: MqttClient,
  printer: PrinterBridge,
  prefix: string,
): void {
  const topic = `${prefix}/device/bambu_${printer.serial}/config`;
  const payload = JSON.stringify(buildDiscoveryPayload(printer));
  mosqClient.publish(topic, payload, { retain: true, qos: 1 });
  console.log(`[${printer.name}] Published HA discovery config (${topic})`);
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export function publishAvailability(
  mosqClient: MqttClient,
  serial: string,
  status: 'online' | 'offline',
): void {
  mosqClient.publish(`bambu_bridge/${serial}/status`, status, {
    retain: true,
    qos: 1,
  });
}

// ---------------------------------------------------------------------------
// State aggregation
// ---------------------------------------------------------------------------

function deepMergeAms(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing) return { ...incoming };

  const merged: Record<string, unknown> = { ...existing, ...incoming };

  // Deep merge the ams[] array by unit index, then tray[] by tray index
  const existingUnits = existing.ams as Array<Record<string, unknown>> | undefined;
  const incomingUnits = incoming.ams as Array<Record<string, unknown>> | undefined;

  if (existingUnits && incomingUnits) {
    const mergedUnits = [...existingUnits];
    for (const unit of incomingUnits) {
      const id = unit.id as string;
      const idx = mergedUnits.findIndex((u) => (u.id as string) === id);
      if (idx >= 0) {
        const existingUnit = mergedUnits[idx];
        const mergedUnit = { ...existingUnit, ...unit };

        // Deep merge trays by index
        const existingTrays = existingUnit.tray as Array<Record<string, unknown>> | undefined;
        const incomingTrays = unit.tray as Array<Record<string, unknown>> | undefined;
        if (existingTrays && incomingTrays) {
          const mergedTrays = [...existingTrays];
          for (const tray of incomingTrays) {
            const trayId = tray.id as string;
            const trayIdx = mergedTrays.findIndex((t) => (t.id as string) === trayId);
            if (trayIdx >= 0) {
              mergedTrays[trayIdx] = { ...mergedTrays[trayIdx], ...tray };
            } else {
              mergedTrays.push(tray);
            }
          }
          mergedUnit.tray = mergedTrays;
        }

        mergedUnits[idx] = mergedUnit;
      } else {
        mergedUnits.push(unit);
      }
    }
    merged.ams = mergedUnits;
  }

  return merged;
}

export function handleReport(
  mosqClient: MqttClient,
  serial: string,
  reportPayload: Buffer,
  cachedState: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const data = JSON.parse(reportPayload.toString());
    const status = data.print;
    if (!status) return cachedState;

    // Shallow merge top-level print fields
    const newState: Record<string, unknown> = { ...cachedState, ...status };

    // Deep merge AMS data
    if (status.ams) {
      newState.ams = deepMergeAms(
        cachedState.ams as Record<string, unknown> | undefined,
        status.ams,
      );
    }

    // Publish merged state
    mosqClient.publish(
      `bambu_bridge/${serial}/state`,
      JSON.stringify(newState),
      { qos: 1 },
    );

    return newState;
  } catch {
    return cachedState;
  }
}

// ---------------------------------------------------------------------------
// HA topic subscriptions
// ---------------------------------------------------------------------------

export function subscribeHATopics(
  mosqClient: MqttClient,
  serial: string,
  prefix: string,
): void {
  mosqClient.subscribe(`bambu_bridge/${serial}/command/#`, (err) => {
    if (err) {
      console.error(`Failed to subscribe to bambu_bridge/${serial}/command/#:`, err);
    }
  });
  mosqClient.subscribe(`${prefix}/status`, (err) => {
    if (err) {
      console.error(`Failed to subscribe to ${prefix}/status:`, err);
    }
  });
}

// ---------------------------------------------------------------------------
// Command routing (HA → Bambu)
// ---------------------------------------------------------------------------

export function handleHACommand(
  topic: string,
  serial: string,
  payload: Buffer,
): string | null {
  const prefix = `bambu_bridge/${serial}/command/`;
  if (!topic.startsWith(prefix)) return null;

  const command = topic.slice(prefix.length);
  const msg = payload.toString().trim();

  switch (command) {
    case 'pause':
      return JSON.stringify({
        print: { sequence_id: '0', command: 'pause' },
      });

    case 'resume':
      return JSON.stringify({
        print: { sequence_id: '0', command: 'resume' },
      });

    case 'stop':
      return JSON.stringify({
        print: { sequence_id: '0', command: 'stop' },
      });

    case 'speed': {
      const param = SPEED_VALUES[msg] || '2';
      return JSON.stringify({
        print: { sequence_id: '0', command: 'print_speed', param },
      });
    }

    case 'light': {
      const mode = msg.toLowerCase() === 'on' ? 'on' : 'off';
      return JSON.stringify({
        system: {
          sequence_id: '0',
          command: 'ledctrl',
          led_node: 'chamber_light',
          led_mode: mode,
        },
      });
    }

    default:
      console.warn(`Unknown HA command: ${command}`);
      return null;
  }
}
