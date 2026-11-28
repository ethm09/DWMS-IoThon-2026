import { WorkspaceLink as Link } from "@/components/workspace-link";
export default function About() {
  return <div className="p-4 md:p-6 space-y-4 max-w-3xl">
    <h1 className="text-xl font-bold">DWMS · IoThon 2026</h1>
    <p>Water-quality monitoring for networks, reservoirs and treated-water reuse.</p>
    <p className="text-sm text-muted-foreground">DWMS connects pH, TDS and turbidity telemetry to device history, threshold alerts and deterministic operational responses. The device registry supports separate locations and per-device credentials. Scale and field reliability still need measurement.</p>
    <h2 className="font-semibold">Evidence boundary</h2>
    <ul className="list-disc pl-5 text-sm space-y-2">
      <li>The local dashboard demo uses fixed synthetic scenarios, never physical measurements.</li>
      <li>Software tests exercise validation, safety and communication failure paths. They do not certify hardware.</li>
      <li>The included Arduino firmware leaves calibrated conversion and relay actuation disabled until the installed hardware is verified.</li>
      <li>Controller acknowledgement reports software output state; there is no relay-contact or pump-motion feedback.</li>
    </ul>
    <p className="text-sm">AI assistance is optional. Backend authorization and deterministic interlocks govern every physical command.</p>
    <p className="text-sm">These three sensors do not establish potable-water safety. Site thresholds and treatment procedures require qualified review.</p>
    <div className="flex flex-wrap gap-4 text-sm underline"><Link to="/dashboard">Dashboard demo</Link><Link to="/thresholds">Safety rules</Link><a href="https://github.com/ethm09/DWMS-IoThon-2026/tree/improve/iothon-2026-focus/docs">Architecture and validation</a></div>
  </div>;
}
