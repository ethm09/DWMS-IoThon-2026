import { motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Shield, Users, Droplets } from "lucide-react";

const MISSION_STATEMENT =
  "DWMS is a smart water monitoring and control system that measures pH, TDS, and turbidity in real time, activates filtration automatically when water quality exceeds preset limits, and allows authorized users to monitor, control, and generate traceable reports remotely.";

const teamMembers = [
  {
    name: "Ahmed Alzhrani",
    role: "Project Leader",
    tagline: "Leading the development of an intelligent water monitoring and control system.",
    responsibility: "System Design & Integration",
    img: "https://hercules-cdn.com/file_Cu6H447tlE1PJ4ovbO04cCr0",
    isLeader: true,
  },
  {
    name: "Rayan Alsaiary",
    role: "Operational Planning",
    tagline: "Coordinating operational workflows and system planning.",
    responsibility: "Operational Planning",
    img: "https://hercules-cdn.com/file_G24OOmvhFsNMP252gMyHJl39",
    isLeader: false,
  },
  {
    name: "Yazeed Aljohani",
    role: "Designer",
    tagline: "Crafting the visual identity and system interface.",
    responsibility: "Design",
    img: "https://hercules-cdn.com/file_IhGUboeU9EgJ5xiiDCbkDCui",
    isLeader: false,
  },
  {
    name: "Omar Alharbi",
    role: "Quality Inspector",
    tagline: "Ensuring accuracy and reliability of all system outputs.",
    responsibility: "Quality Inspection",
    img: "https://hercules-cdn.com/file_mmk5OzQ3oCcFB4nq31GukKdw",
    isLeader: false,
  },
];

export default function About() {
  const leader = teamMembers.find((m) => m.isLeader)!;
  const members = teamMembers.filter((m) => !m.isLeader);

  return (
    <div className="p-4 md:p-6 space-y-8">
      <div>
        <h2 className="text-lg font-bold tracking-widest text-primary uppercase">About the Project</h2>
        <p className="text-xs text-muted-foreground tracking-wider">Team & project overview</p>
      </div>

      {/* Mission Statement */}
      <Card className="border-primary/40" style={{ background: "oklch(0.14 0.03 145)", boxShadow: "0 0 30px oklch(0.6 0.17 145 / 0.08)" }}>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
              <Droplets className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-[0.25em] text-primary mb-2">MISSION STATEMENT</div>
              <p className="text-sm text-foreground/90 leading-relaxed font-medium">{MISSION_STATEMENT}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project description */}
      <Card className="border-primary/30" style={{ background: "oklch(0.14 0.025 145)" }}>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-bold tracking-widest text-foreground">DEFENSE WATER MONITORING SYSTEM</div>
              <div className="text-[10px] tracking-widest text-primary">LDWMS</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This project represents a <span className="text-foreground font-semibold">Smart Water Treatment Monitoring and Control System</span> designed to simulate real-world industrial control rooms. The system continuously monitors water quality using multiple sensors and automatically responds to unsafe conditions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="flex gap-3">
              <Target className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold tracking-widest text-foreground">OBJECTIVE</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Develop a real-time monitoring system that ensures water safety by analyzing TDS, turbidity, and pH — with automated control through a smart interface.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold tracking-widest text-foreground">TEAM SIZE</div>
                <p className="text-xs text-muted-foreground mt-1">
                  4 specialized engineers covering system design, operational planning, design, and quality inspection.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team — pyramid layout */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-widest text-primary uppercase">Project Team</h3>

        {/* Leader */}
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <TeamCard member={leader} />
          </motion.div>
        </div>

        {/* Triangle connector */}
        <div className="flex justify-center">
          <div className="w-0.5 h-6 bg-primary/40" />
        </div>
        <div className="flex justify-center">
          <div className="w-48 h-0.5 bg-primary/40" />
        </div>
        <div className="flex justify-between px-8 md:px-24">
          <div className="w-0.5 h-4 bg-primary/40" />
          <div className="w-0.5 h-4 bg-primary/40" />
          <div className="w-0.5 h-4 bg-primary/40" />
        </div>

        {/* Members */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {members.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <TeamCard member={m} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Member = (typeof teamMembers)[number];

function TeamCard({ member }: { member: Member }) {
  return (
    <Card
      className="overflow-hidden"
      style={{
        borderColor: member.isLeader ? "oklch(0.6 0.17 145 / 0.5)" : "oklch(0.26 0.04 145)",
        boxShadow: member.isLeader ? "0 0 20px oklch(0.6 0.17 145 / 0.15)" : "none",
      }}
    >
      <CardContent className="pt-0 pb-4 flex flex-col items-center text-center gap-3">
        <div className="w-full h-2 mb-0" style={{ background: member.isLeader ? "oklch(0.6 0.17 145)" : "oklch(0.26 0.04 145)" }} />
        <img
          src={member.img}
          alt={member.name}
          className="w-24 h-24 rounded-full object-cover object-top border-2"
          style={{ borderColor: member.isLeader ? "oklch(0.6 0.17 145)" : "oklch(0.35 0.05 145)" }}
        />
        <div>
          <div className={`font-bold tracking-wider ${member.isLeader ? "text-primary text-base" : "text-foreground text-sm"}`}>
            {member.name}
          </div>
          <div
            className="text-[10px] font-bold tracking-widest mt-0.5 px-2 py-0.5 rounded-full inline-block"
            style={{
              color: member.isLeader ? "oklch(0.6 0.17 145)" : "oklch(0.58 0.04 145)",
              border: `1px solid ${member.isLeader ? "oklch(0.6 0.17 145 / 0.4)" : "oklch(0.3 0.04 145)"}`,
              background: member.isLeader ? "oklch(0.6 0.17 145 / 0.1)" : "transparent",
            }}
          >
            {member.role.toUpperCase()}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed px-1">{member.tagline}</p>
        </div>
      </CardContent>
    </Card>
  );
}
