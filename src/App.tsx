import { BrowserRouter, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import UserPage from "./pages/User";
import Queue from "./pages/Queue";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/user" element={<UserPage />} />
        <Route path="/session/:sessionId" element={<Queue />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
