import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import AskAnalyst from "@/pages/AskAnalyst";
import Predictions from "@/pages/Predictions";
import VoiceLab from "@/pages/VoiceLab";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ask" element={<AskAnalyst />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/voice-lab" element={<VoiceLab />} />
          </Routes>
        </Layout>
        <Toaster theme="dark" richColors position="bottom-right" />
      </BrowserRouter>
    </div>
  );
}

export default App;
