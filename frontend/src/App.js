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
import HomeV2 from "@/pages/HomeV2";
import TonightGame from "@/pages/TonightGame";
import PlayerProfile from "@/pages/PlayerProfile";
import Lineup from "@/pages/Lineup";
import OhlHome from "@/pages/ohl/OhlHome";
import WhlRecapSample from "@/pages/whl/WhlRecapSample";
import WhlDeskShow from "@/pages/whl/WhlDeskShow";
import Onboarding from "@/pages/plus/Onboarding";
import YourTicker from "@/pages/plus/YourTicker";
import DivisionPage from "@/pages/plus/DivisionPage";
import TeamPage from "@/pages/plus/TeamPage";
import ProspectPage from "@/pages/plus/ProspectPage";
import Upgrade from "@/pages/plus/Upgrade";
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
            {/* Deep-link per-game route — same GameHub, always expanded. */}
            <Route path="/tonight/:gameId" element={<TonightGame />} />
            {/* Legacy Picks route — merged into Tonight. Preserves any share
             * links or muscle-memory bookmarks users have from the old page. */}
            <Route path="/predictions" element={<Navigate to="/show" replace />} />
            <Route path="/recap" element={<Navigate to="/" replace />} />
            <Route path="/press-conference" element={<Navigate to="/home-v2" replace />} />
            <Route path="/uncut/canucks" element={<CanucksUncut />} />
            <Route path="/home-v2" element={<HomeV2 />} />
            {/* OHL sidecar route — vibe-check for the junior hockey product.
             * Fully isolated from the NHL pages; nothing here touches the
             * working Ticker. Kill or promote independently. */}
            <Route path="/ohl" element={<Navigate to="/ohl/home" replace />} />
            <Route path="/ohl/home" element={<OhlHome />} />
            <Route path="/whl/recap-sample" element={<WhlRecapSample />} />
            <Route path="/whl/desk-show" element={<WhlDeskShow />} />
            {/* Ticker+ cascade — CHL + NCAA personalization sidecar.
             * All routes live under /plus/* so the NHL app is untouched. */}
            <Route path="/plus" element={<Navigate to="/plus/your-ticker" replace />} />
            <Route path="/plus/onboarding" element={<Onboarding />} />
            <Route path="/plus/your-ticker" element={<YourTicker />} />
            <Route path="/plus/chl/:division" element={<DivisionPage kind="chl" />} />
            <Route path="/plus/ncaa/:conf" element={<DivisionPage kind="ncaa" />} />
            <Route path="/plus/team/:code" element={<TeamPage />} />
            <Route path="/plus/prospect/:id" element={<ProspectPage />} />
            <Route path="/plus/upgrade" element={<Upgrade />} />
            <Route path="/player/:slug" element={<PlayerProfile />} />
            <Route path="/lineup/:team" element={<Lineup />} />
            <Route path="/lineup" element={<Lineup />} />
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
