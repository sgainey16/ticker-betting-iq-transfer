import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import PressConference from "@/pages/PressConference";
import Predictions from "@/pages/Predictions";
import Recaps from "@/pages/Recaps";
import RecapShow from "@/pages/RecapShow";
import VoiceLab from "@/pages/VoiceLab";
import Voices from "@/pages/Voices";
import Stats from "@/pages/Stats";
import Scoreboard from "@/pages/Scoreboard";
import Fantasy from "@/pages/Fantasy";
import Login from "@/pages/Login";
import BackOffice from "@/pages/BackOffice";
import MatchupDeepDive from "@/pages/MatchupDeepDive";
import PlayerDetail from "@/pages/PlayerDetail";
import GreatestGoalDemo from "@/pages/GreatestGoalDemo";
import DeskPreview from "@/pages/DeskPreview";
import ComingSoon from "@/pages/ComingSoon";
import FastReelAudition from "@/pages/FastReelAudition";
import BrandAudition from "@/pages/BrandAudition";
import TeamRoomAudition from "@/pages/TeamRoomAudition";
import CanucksUncut from "@/pages/CanucksUncut";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            {/* Landing = Recap Show. The old Panel/Predict Show lives at /show. */}
            <Route path="/" element={<RecapShow />} />
            <Route path="/show" element={<Home />} />
            <Route path="/recap" element={<Navigate to="/" replace />} />
            <Route path="/press-conference" element={<TeamRoomAudition />} />
            <Route path="/uncut/canucks" element={<CanucksUncut />} />
            {/* Old presser (1-on-1 with Reggie) still reachable directly */}
            <Route path="/press-conference/classic" element={<PressConference />} />
            {/* legacy alias */}
            <Route path="/ask" element={<Navigate to="/press-conference" replace />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/fantasy" element={<Fantasy />} />
            <Route path="/back-office" element={<BackOffice />} />
            <Route path="/matchup/:matchupId" element={<MatchupDeepDive />} />
            <Route path="/player/:playerId" element={<PlayerDetail />} />
            <Route path="/demo/greatest-goal" element={<GreatestGoalDemo />} />
            <Route path="/login" element={<Login />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/recaps" element={<Recaps />} />
            <Route path="/recaps-archive" element={<Recaps />} />
            <Route path="/voice-lab" element={<VoiceLab />} />
            <Route path="/voices" element={<Voices />} />
            <Route path="/desk-preview" element={<DeskPreview />} />
            <Route path="/audition/fast-reel/:matchId" element={<FastReelAudition />} />
            <Route path="/audition/brand" element={<BrandAudition />} />
            <Route path="/audition/team-room" element={<TeamRoomAudition />} />
            <Route path="/audition/team-room/:code" element={<TeamRoomAudition />} />
            <Route path="/soon/:slug" element={<ComingSoon />} />
          </Routes>
        </Layout>
        <Toaster theme="dark" richColors position="bottom-right" />
      </BrowserRouter>
    </div>
  );
}

export default App;
