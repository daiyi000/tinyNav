import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import Login from "./pages/Login";

export default function App() {
  const location = useLocation();
  const [presenceReady, setPresenceReady] = useState(false);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPresenceReady(true));
    });
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  return (
    <AnimatePresence mode="wait" initial={presenceReady ? true : false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </AnimatePresence>
  );
}

