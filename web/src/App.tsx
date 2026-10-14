import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Splash } from "./components/Splash";
import { Shell } from "./components/Shell";
import { Today } from "./pages/Today";
import { Review } from "./pages/Review";
import { Goals } from "./pages/Goals";
import { Health } from "./pages/Health";
import { Profile } from "./pages/Profile";

const SPLASH_KEY = "sentience.splashShown";

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const finish = () => {
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowSplash(false);
  };

  return (
    <>
      <AnimatePresence>{showSplash && <Splash onDone={finish} />}</AnimatePresence>
      <Routes>
        <Route element={<Shell onReplaySplash={() => setShowSplash(true)} />}>
          <Route index element={<Today />} />
          <Route path="/review" element={<Review />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/health" element={<Health />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Today />} />
        </Route>
      </Routes>
    </>
  );
}
