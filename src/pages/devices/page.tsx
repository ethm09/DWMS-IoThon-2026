import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated } from "convex/react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Cpu, Wifi, WifiOff, AlertTriangle, Plus, Trash2,
  Terminal, Activity, Clock, Key, MapPin, Copy
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SignInButton } from "@/components/ui/signin.tsx";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

const STATUS_COLOR = {
  online: "#22c55e",
  offline: "#6b7280",
  error: "#ef4444",
} as const;

const STATUS_ICON = {
  online: <Wifi className="w-3.5 h-3.5" />,
  offline: <WifiOff className="w-3.5 h-3.5" />,
  error: <AlertTriangle className="w-3.5 h-3.5" />,
} as const;

function DeviceCard({
  device,
  onDelete,
}: {
  device: Doc<"devices">;
  onDelete: (id: string) => void;
}) {
  const latestReading = useQuery(api.devices.getLatestReading, { deviceId: device.deviceId });
  const color = STATUS_COLOR[device.status];

  // Determine water status from latest reading
  const waterStatus = getWaterStatus(latestReading);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5 space-y-4"
      style={{ borderColor: `${color}40`, background: `${color}06` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
            <Cpu className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <p className="font-bold text-sm tracking-widest text-foreground">{device.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{device.deviceId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold"
          style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}>
          {STATUS_ICON[device.status]}
          {device.status.toUpperCase()}
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {device.location && (
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{device.location}</span>
        )}
        {device.lastSeen && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last seen: {new Date(device.lastSeen).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Latest reading */}
      {latestReading && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "pH", value: latestReading.ph.toFixed(2), unit: "" },
              { label: "TDS", value: latestReading.tds.toFixed(0), unit: "ppm" },
              { label: "Turb.", value: latestReading.turbidity.toFixed(2), unit: "NTU" },
            ].map((r) => (
              <div key={r.label} className="rounded-lg p-2 text-center"
                style={{ background: "oklch(0.12 0.03 145)" }}>
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="font-mono text-sm font-bold" style={{ color: "#00f5d4" }}>
                  {r.value}<span className="text-xs opacity-60 ml-0.5">{r.unit}</span>
                </p>
              </div>
            ))}
          </div>
          {/* Water status badge */}
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
              style={{
                background: `${waterStatus.color}18`,
                color: waterStatus.color,
                border: `1px solid ${waterStatus.color}40`,
              }}>
              {waterStatus.label}
            </span>
          </div>
        </div>
      )}

      {/* API Key */}
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono"
        style={{ background: "oklch(0.1 0.02 145)", border: "1px solid oklch(0.2 0.04 145)" }}>
        <Key className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground truncate flex-1">{device.apiKey}</span>
        <button
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => { void navigator.clipboard.writeText(device.apiKey); toast.success("API key copied"); }}
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>

      {/* Delete button */}
      <div className="flex justify-end">
        <Button size="sm" variant="destructive" className="h-8 px-3 text-xs gap-1 cursor-pointer" onClick={() => onDelete(device.deviceId)}>
          <Trash2 className="w-3 h-3" /> Remove Device
        </Button>
      </div>
    </motion.div>
  );
}

/** Calculate water status from sensor readings */
function getWaterStatus(reading: Doc<"sensorReadings"> | null | undefined): { label: string; color: string } {
  if (!reading) return { label: "No Data", color: "#6b7280" };

  const phCritical = reading.ph < 5.0 || reading.ph > 10.0;
  const phWarning = reading.ph < 6.5 || reading.ph > 8.5;
  const tdsCritical = reading.tds > 800;
  const tdsWarning = reading.tds > 500;
  const turbCritical = reading.turbidity > 50;
  const turbWarning = reading.turbidity > 20;

  if (phCritical || tdsCritical || turbCritical) {
    return { label: "CRITICAL", color: "#ef4444" };
  }
  if (phWarning || tdsWarning || turbWarning) {
    return { label: "WARNING", color: "#eab308" };
  }
  return { label: "NORMAL", color: "#22c55e" };
}

function RegisterDeviceDialog({ onRegistered }: { onRegistered: (apiKey: string) => void }) {
  const registerDevice = useMutation(api.devices.registerDevice);
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await registerDevice({ deviceId, name, location: location || undefined });
      toast.success("Device registered successfully");
      onRegistered(result.apiKey);
      setOpen(false);
      setDeviceId(""); setName(""); setLocation("");
    } catch (err) {
      if (err instanceof ConvexError) {
        toast.error((err.data as { message: string }).message);
      } else {
        toast.error("Failed to register device");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 cursor-pointer">
          <Plus className="w-4 h-4" /> Register Device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="tracking-widest font-bold text-sm" style={{ color: "#00f5d4" }}>
            REGISTER ARDUINO SENSOR
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest">Device ID</Label>
            <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
              placeholder="arduino-01" required className="font-mono" />
            <p className="text-xs text-muted-foreground">Unique identifier — use in your Python bridge script</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Main Water Sensor" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs tracking-widest">Location (optional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Zone A — Filtration Room" />
          </div>
          <Button type="submit" disabled={loading} className="w-full cursor-pointer">
            {loading ? "Registering..." : "Register Device"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SerialBridgeModal({ apiKey, httpUrl }: { apiKey: string; httpUrl: string }) {
  const [open, setOpen] = useState(false);
  const postUrl = `${httpUrl}/arduino/data`;
  const code = `import serial
import requests
import json
import time

SERIAL_PORT = "COM3"
BAUD_RATE = 9600

HTTP_ACTIONS_URL = "${httpUrl}"
DEVICE_ID = "arduino-01"
API_KEY = "${apiKey}"

POST_URL = HTTP_ACTIONS_URL.rstrip("/") + "/arduino/data"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
    "X-Device-ID": DEVICE_ID
}

print("Starting DWMS Bridge...")
print("Sending to:", POST_URL)

arduino = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
time.sleep(2)

print("Arduino connected.")

while True:
    try:
        line = arduino.readline().decode("utf-8", errors="ignore").strip()

        if not line:
            continue

        if not line.startswith("{") or not line.endswith("}"):
            print("Ignored:", line)
            continue

        data = json.loads(line)

        payload = {
            "ph": float(data["ph"]),
            "tds": float(data["tds"]),
            "turbidity": float(data["turbidity"])
        }

        response = requests.post(
            POST_URL,
            headers=headers,
            json=payload,
            timeout=5
        )

        print("Sent:", payload, "Response:", response.status_code)

        time.sleep(1)

    except Exception as e:
        print("Error:", e)
        time.sleep(2)
`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-2 cursor-pointer">
          <Terminal className="w-4 h-4" /> Serial Bridge Script
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="tracking-widest font-bold text-sm" style={{ color: "#00f5d4" }}>
            PYTHON SERIAL BRIDGE
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <pre className="text-xs font-mono rounded-lg p-4 overflow-auto max-h-96 leading-relaxed"
            style={{ background: "oklch(0.08 0.02 145)", color: "#a8d8b9", border: "1px solid oklch(0.2 0.04 145)" }}>
            {code}
          </pre>
          <button
            onClick={() => { void navigator.clipboard.writeText(code); toast.success("Script copied"); }}
            className="absolute top-2 right-2 p-1.5 rounded cursor-pointer text-muted-foreground hover:text-foreground"
            style={{ background: "oklch(0.15 0.03 145)" }}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2 pt-2">
          <p className="text-xs font-bold tracking-wider text-primary">SETUP INSTRUCTIONS</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Install Python 3.8+ on your computer</li>
            <li>Run: <code className="text-primary font-mono">pip install pyserial requests</code></li>
            <li>Connect your Arduino Uno via USB to <code className="text-primary font-mono">COM3</code> (edit SERIAL_PORT if different)</li>
            <li>Replace <code className="text-primary font-mono">PUT_HTTP_ACTIONS_URL_HERE</code> and <code className="text-primary font-mono">PUT_API_KEY_HERE</code> with your values</li>
            <li>Save the script as <code className="text-primary font-mono">bridge.py</code></li>
            <li>Run: <code className="text-primary font-mono">python bridge.py</code></li>
          </ol>
          <div className="rounded-lg p-3 mt-3 text-xs"
            style={{ background: "oklch(0.1 0.03 145)", border: "1px solid oklch(0.2 0.04 145)" }}>
            <p className="font-bold tracking-wider text-primary mb-1">POST ENDPOINT</p>
            <code className="text-muted-foreground">{postUrl}</code>
          </div>
          <div className="rounded-lg p-3 mt-2 text-xs"
            style={{ background: "oklch(0.1 0.03 145)", border: "1px solid oklch(0.2 0.04 145)" }}>
            <p className="font-bold tracking-wider text-primary mb-1">ARDUINO SKETCH FORMAT</p>
            <code className="text-muted-foreground">
              {'Serial.println("{\\"ph\\":7.20,\\"tds\\":310.50,\\"turbidity\\":12.40}");'}
            </code>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            The bridge reads JSON from the Arduino at 9600 baud and POSTs each reading to your DWMS cloud endpoint.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeviceManagerInner() {
  const devices = useQuery(api.devices.listDevices, {});
  const deleteDevice = useMutation(api.devices.deleteDevice);
  const [lastApiKey, setLastApiKey] = useState<string | null>(null);

  // The HTTP actions URL format for Convex
  const httpUrl = window.location.hostname === "localhost"
    ? "https://your-deployment.convex.site"
    : `https://${window.location.hostname.replace(".onhercules.app", "")}.convex.site`;

  const handleDelete = async (deviceId: string) => {
    try {
      await deleteDevice({ deviceId });
      toast.success("Device removed");
    } catch {
      toast.error("Failed to remove device");
    }
  };

  const online = devices?.filter((d) => d.status === "online").length ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-widest" style={{ color: "#00f5d4" }}>
            ARDUINO SENSORS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register sensors and monitor live water quality data (pH, TDS, Turbidity)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastApiKey && (
            <SerialBridgeModal apiKey={lastApiKey} httpUrl={httpUrl} />
          )}
          <RegisterDeviceDialog onRegistered={(key) => setLastApiKey(key)} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "TOTAL DEVICES", value: devices?.length ?? 0, color: "#00f5d4" },
          { label: "ONLINE", value: online, color: "#22c55e" },
          { label: "OFFLINE", value: (devices?.filter(d => d.status === "offline").length ?? 0), color: "#6b7280" },
        ].map((s) => (
          <Card key={s.label} className="text-center py-4">
            <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs tracking-widest text-muted-foreground mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* HTTP Endpoint Info */}
      <Card className="p-5 space-y-3">
        <div className="text-xs font-bold tracking-widest flex items-center gap-2" style={{ color: "#00f5d4" }}>
          <Activity className="w-4 h-4" /> HTTP ENDPOINT
        </div>
        <div className="rounded-lg p-3 space-y-1"
          style={{ background: "oklch(0.1 0.03 145)", border: "1px solid oklch(0.2 0.04 145)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{ background: "#f59e0b20", color: "#f59e0b" }}>
              POST
            </span>
            <code className="text-xs font-mono text-primary">/arduino/data</code>
          </div>
          <p className="text-xs text-muted-foreground">Receives sensor readings from the Python Serial Bridge</p>
        </div>
        <div className="rounded-lg p-3 text-xs"
          style={{ background: "oklch(0.08 0.02 145)", border: "1px solid oklch(0.18 0.04 145)" }}>
          <p className="text-muted-foreground mb-1 font-bold tracking-wider">REQUIRED HEADERS</p>
          <code className="text-primary">X-API-Key: &lt;device api key&gt;</code>
          <br />
          <code className="text-primary">X-Device-ID: &lt;device id&gt;</code>
        </div>
        <div className="rounded-lg p-3 text-xs"
          style={{ background: "oklch(0.08 0.02 145)", border: "1px solid oklch(0.18 0.04 145)" }}>
          <p className="text-muted-foreground mb-1 font-bold tracking-wider">EXPECTED JSON BODY</p>
          <code className="text-primary">{'{"ph": 7.20, "tds": 310.50, "turbidity": 12.40}'}</code>
        </div>
      </Card>

      {/* Device list */}
      <div>
        <h2 className="text-xs font-bold tracking-widest text-muted-foreground mb-3">
          REGISTERED DEVICES ({devices?.length ?? 0})
        </h2>
        <AnimatePresence>
          {devices === undefined ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: "oklch(0.12 0.03 145)" }} />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
              <Cpu className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-bold tracking-widest text-muted-foreground">NO DEVICES REGISTERED</p>
              <p className="text-xs text-muted-foreground">Register your first Arduino sensor to start receiving water quality data</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {devices.map((device) => (
                <DeviceCard key={device._id} device={device} onDelete={(id) => { void handleDelete(id); }} />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function DeviceManager() {
  return (
    <>
      <Unauthenticated>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <Cpu className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Sign in to manage Arduino sensors</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <DeviceManagerInner />
      </Authenticated>
    </>
  );
}
