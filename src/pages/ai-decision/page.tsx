import { Authenticated, Unauthenticated } from "convex/react";
import { Link } from "react-router-dom";
import EthmAssistant from "@/components/ethm-assistant.tsx";
import { SignInButton } from "@/components/ui/signin";
import { useProcessMode } from "@/hooks/use-process-mode";
import { Button } from "@/components/ui/button";

export default function AIDecision() {
  const { setAssistantOpen } = useProcessMode();
  return <div className="p-4 md:p-6 max-w-3xl space-y-4">
    <h1 className="text-xl font-semibold">Optional AI assistance</h1>
    <p className="text-sm text-muted-foreground">Ask for explanations of stored device data and prototype rules. The assistant needs a server-side OpenAI key and an authenticated account. The local dashboard scenarios are separate and are not sent to the assistant.</p>
    <p className="text-sm">AI output can be wrong. Physical commands require operator confirmation, server-side authorization, fresh telemetry and deterministic interlocks. A proposal or command request does not confirm a physical pump movement.</p>
    <Authenticated><Button onClick={() => setAssistantOpen(true)}>Open assistant</Button><EthmAssistant /></Authenticated>
    <Unauthenticated><SignInButton /></Unauthenticated>
    <p><Link className="text-sm underline" to="/">Return to monitoring</Link></p>
  </div>;
}
