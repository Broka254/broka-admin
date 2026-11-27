import { JarvisWorkspace } from "@/components/jarvis/jarvis-workspace";

// The route is unchanged so existing bookmarks keep working. It is now Jarvis
// Mode, the executive briefing and investigation workspace for administrators.
export default function JarvisModePage() {
  return <JarvisWorkspace />;
}
