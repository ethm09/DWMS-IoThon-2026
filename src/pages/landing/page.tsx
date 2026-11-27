import { Link } from "react-router-dom";
import { Brain, ShieldCheck, Radio, Waves } from "lucide-react";
import DwmsLogo from "@/components/dwms-logo";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return <div className="min-h-screen bg-[#F3F7FA]">
    <header className="relative overflow-hidden bg-[#0B2039] pb-7 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-10"><DwmsLogo light />
        <nav className="flex items-center gap-3 text-sm"><a className="hidden text-slate-300 md:inline" href="https://github.com/ethm09/DWMS-IoThon-2026/tree/improve/iothon-2026-focus">Project & evidence</a><Link to="/live" className="inline-flex min-h-11 items-center rounded-lg border border-white/30 px-3 text-xs sm:text-sm">Launch Live Platform</Link><Link to="/demo" className="hidden min-h-11 items-center rounded-lg bg-[#087EA4] px-4 font-medium sm:inline-flex">Explore Demo</Link></nav>
      </div><img src="/brand/waves.svg" alt="" className="absolute inset-x-0 bottom-0 h-6 w-full" />
    </header>
    <main>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-10 pt-8 md:px-10 md:py-16 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <p className="dwms-eyebrow">Ethm · Water Intelligence Engine</p>
          <h1 className="max-w-2xl text-[2.6rem] font-semibold leading-[1.1] tracking-[-.045em] text-[#0B2039] sm:text-5xl lg:text-[3.7rem]">AI-Powered Water<br /><span className="text-[#087EA4]">Intelligence Platform.</span></h1>
          <p className="max-w-lg text-base leading-relaxed text-[#52697C] md:text-lg">Sensors provide evidence. Ethm explains conditions, trends and incidents to support operator decisions. Independent deterministic controls enforce safety.</p>
          <div className="flex flex-wrap items-center gap-4"><Button size="lg" asChild><Link to="/demo">Explore Demo</Link></Button><Button size="lg" variant="outline" asChild><Link to="/live">Launch Live Platform</Link></Button></div>
          <p className="text-sm text-[#52697C]">Demo: no account needed. Live: approved operational access.</p>
        </div>
        <Link to="/demo" className="group relative block overflow-hidden rounded-2xl border border-[#DCE6ED] bg-white p-2 shadow-[0_18px_70px_#0B203914]" aria-label="Explore the DWMS dashboard">
          <div className="flex items-center justify-between border-b border-[#DCE6ED] px-3 pb-3 pt-2 text-xs text-[#52697C]"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#087EA4]" /> DWMS intelligence workspace</span><span>Simulation preview</span></div>
          <img src="/screenshots/dashboard-preview.png" alt="Implemented DWMS dashboard with sensor readings, response status and water process overview" className="mt-2 aspect-[1.3] w-full rounded-lg object-cover object-left-top" />
        </Link>
      </section>
      <section className="border-y border-[#DCE6ED] bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:grid-cols-3 md:px-10">
          {[{ icon: Radio, label: "Monitor", title: "Know the current condition", text: "pH, TDS and turbidity, with receipt age and device status." }, { icon: Brain, label: "Understand", title: "Put evidence in context", text: "Ethm explains available readings, significant changes and recorded incidents." }, { icon: ShieldCheck, label: "Respond", title: "Follow the response through", text: "Deterministic rules, command outcomes and explicit recovery." }].map(item => <div key={item.label} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F5F8] text-[#087EA4]"><item.icon className="h-5 w-5" /></span><div><p className="dwms-eyebrow">{item.label}</p><h2 className="mt-1 text-base font-semibold">{item.title}</h2><p className="mt-1 text-sm leading-relaxed text-[#52697C]">{item.text}</p></div></div>)}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 md:px-10">
        <div className="mb-6 flex items-center gap-2"><Waves className="h-5 w-5 text-[#087EA4]" /><h2 className="text-lg font-semibold">Monitor. Understand. Respond.</h2></div>
        <div className="grid gap-2 sm:grid-cols-5">{["Water source", "Sensors", "Arduino controller", "Response system", "Monitoring platform"].map((label) => <div key={label} className="rounded-xl border border-[#DCE6ED] bg-white px-4 py-4"><p className="text-sm font-semibold">{label}</p></div>)}</div>
        <p className="mt-4 text-xs leading-relaxed text-[#52697C]">Prototype for networks, reservoirs and treated-water reuse. Demonstration values are simulated; physical calibration and relay commissioning are pending. Flow is a demonstration parameter; no flow-sensor interface is commissioned.</p>
      </section>
    </main>
    <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-[#DCE6ED] px-5 py-6 text-xs text-[#52697C] md:px-10"><span>DWMS · AI-Powered Water Intelligence Platform</span><a href="https://github.com/ethm09/DWMS-IoThon-2026/tree/improve/iothon-2026-focus/docs/VALIDATION.md" className="underline underline-offset-4">Technical evidence & limitations</a></footer>
  </div>;
}
