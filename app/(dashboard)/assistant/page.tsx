import { CommandCentreView } from "@/components/jarvis/views/command-centre";

// The route is unchanged so existing bookmarks keep working. It is now the
// Jarvis Command Centre, the first section of Jarvis Mode.
export default function JarvisCommandCentrePage() {
  return <CommandCentreView />;
}
