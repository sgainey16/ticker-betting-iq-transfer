import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import PressConference from "@/pages/PressConference";
import Predictions from "@/pages/Predictions";
import VoiceLab from "@/pages/VoiceLab";
import Voices from "@/pages/Voices";
import Stats from "@/pages/Stats";
import Fantasy from "@/pages/Fantasy";
import Login from "@/pages/Login";
import BackOffice from "@/pages/BackOffice";
import MatchupDeepDive from "@/pages/MatchupDeepDive";
import PlayerDetail from "@/pages/PlayerDetail";
import GreatestGoalDemo from "@/pages/GreatestGoalDemo";
import DeskPreview from "@/pages/DeskPreview";
import ComingSoon from "@/pages/ComingSoon";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/press-conference" element={<PressConference />} />
            {/* legacy alias */}
            <Route path="/ask" element={<Navigate to="/press-conference" replace />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/fantasy" element={<Fantasy />} />
            <Route path="/back-office" element={<BackOffice />} />
            <Route path="/matchup/:matchupId" element={<MatchupDeepDive />} />
            <Route path="/player/:playerId" element={<PlayerDetail />} />
            <Route path="/demo/greatest-goal" element={<GreatestGoalDemo />} />
            <Route path="/login" element={<Login />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/voice-lab" element={<VoiceLab />} />
            <Route path="/voices" element={<Voices />} />
            <Route path="/desk-preview" element={<DeskPreview />} />
            <Route path="/soon/:slug" element={<ComingSoon />} />
          </Routes>
        </Layout>
        <Toaster theme="dark" richColors position="bottom-right" />
      </BrowserRouter>
    </div>
  );
}

export default App;
