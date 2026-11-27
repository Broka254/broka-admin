import { JarvisFrame } from "@/components/jarvis/frame";
import { JarvisProvider } from "@/components/jarvis/provider";

// Every Jarvis section shares one Zeno session and one command bar. The
// provider mounts here, so an investigation and the last answer survive moving
// between sections. Nothing is written to browser storage.
export default function JarvisLayout({ children }: { children: React.ReactNode }) {
  return (
    <JarvisProvider>
      <JarvisFrame>{children}</JarvisFrame>
    </JarvisProvider>
  );
}
