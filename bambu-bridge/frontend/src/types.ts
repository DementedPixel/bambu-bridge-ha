export type PrinterId = string;

export interface AmsTray {
  id: string;
  tray_color?: string;   // hex like "00AE42FF" (RRGGBBAA)
  tray_type?: string;     // e.g. "PLA", "ABS"
  remain?: number;        // 0-100
}

export interface AmsUnit {
  id: string;
  humidity: string;
  temp: string;
  tray?: AmsTray[];
}

export interface PrinterStatus {
  gcode_state?: string;
  mc_percent?: number;
  mc_remaining_time?: number;
  layer_num?: number;
  total_layer_num?: number;
  subtask_name?: string;
  nozzle_temper?: number;
  nozzle_target_temper?: number;
  bed_temper?: number;
  bed_target_temper?: number;
  wifi_signal?: string;
  print_error?: number;
  ams?: {
    ams?: AmsUnit[];
    ams_exist_bits?: string;
    tray_now?: string;
  };
  lights_report?: Array<{ node: string; mode: string }>;
  _cached_at?: string | null;
  _age_seconds?: number | null;
  [key: string]: unknown;
}

export interface WsMessage {
  printer: PrinterId;
  status?: PrinterStatus;
  event?: string;
}
