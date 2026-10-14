import { pronunciation } from "@/lib/pronunciation";

// Compatibility facade until all feature components consume AudioProvider.
export const playAudio = (text: string) => {
  void pronunciation.speak(text, { accent: "en-US" });
};
