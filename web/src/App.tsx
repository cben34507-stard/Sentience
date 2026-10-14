import { useCallback, useEffect, useRef, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { SplashWordmark } from "./components/Splash";
import { WaveField, type WavePhase } from "./components/WaveField";
import { Shell } from "./components/Shell";
import { Today } from "./pages/Today";
import { Review } from "./pages/Review";
import { Goals } from "./pages/Goals";
import { Health } from "./pages/Health";
import { Profile } from "./pages/Profile";
import { Tests } from "./pages/Tests";
import { useTheme } from "./lib/theme";

const SPLASH_KEY = "sentience.splashShown";

export default function App() {
  const { isDark } = useTheme();
  const [phase, setPhase] = useState<WavePhase>(() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) === "1" ? "ambient" : "intro";
    } catch {
      return "intro";
    }
  });
  const timers = useRef<number[]>([]);

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setPhase("intro");
    timers.current = [
      window.setTimeout(() => setPhase("expand"), 2100),
      window.setTimeout(() => {
        setPhase("ambient");
        try {
          sessionStorage.setItem(SPLASH_KEY, "1");
        } catch {
          /* ignore */
        }
      }, 3100),
    ];
  }, []);

  useEffect(() => {
    if (phase === "intro") play();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <WaveField phase={phase} isDark={isDark} />
      <SplashWordmark phase={phase} />
      <Routes>
        <Route element={<Shell onReplaySplash={play} />}>
          <Route index element={<Today />} />
          <Route path="/review" element={<Review />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/health" element={<Health />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Today />} />
        </Route>
      </Routes>
    </>
  );
}
