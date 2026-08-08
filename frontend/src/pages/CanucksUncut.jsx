// The Ticker Uncut — Canucks 5-year post-mortem, spoken by Reggie & Marc.
//
// Full script rendered line-by-line through ElevenLabs (existing endpoint
// /api/recap-show/line-audio?speaker=X&text=Y). Plays sequentially. Shows
// a broadcast chyron with the current speaker + line so you can watch it
// as a "show" rather than just listen.
//
// This is the demo piece for the "edgy Chiclets-style" tone direction —
// every roast in here is anchored to a real documented event.

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import { API, BACKEND_URL } from "@/lib/api";
import { TMark, C } from "@/lib/brand";

// ------------------------------ SCRIPT ------------------------------

const SEGMENTS = [
  { title: "Cold Open", lines: [
    ["reggie", "Vancouver Canucks. Where hockey careers go to develop concussions, and coaches go to cry on television."],
    ["marc",   "Reggie. We haven't started."],
    ["reggie", "Oh, we started, Marc. The moment Francesco Aquilini bought the team in 2004, the clock started. We're just doing the eulogy."],
    ["marc",   "Nobody's dead."],
    ["reggie", "Elias Pettersson's cap hit sure is."],
    ["marc",   "Okay. Roll it."],
  ]},
  { title: "The Ownership Floor", lines: [
    ["marc",   "Let's start at the top. The Aquilini family. Owned the club since 2004."],
    ["reggie", "Rich guys who watched Moneyball once and thought — I can do that in hockey. Spoiler alert. You cannot."],
    ["marc",   "Their reputation league-wide is… involved. Interpret that how you want."],
    ["reggie", "Interpret it? Marc, they fired Bruce Boudreau by leaking it to the media while he was still coaching games. Bruce cried at a press conference. On camera. In front of God, the Sedins, and the entire nation of Canada."],
    ["marc",   "January 2023. That is accurate."],
    ["reggie", "That's not ownership. That's middle school. You want to fire your coach? Walk into his office like a man. Don't send Sportsnet a text at eleven p.m. and let him find out from his kid."],
    ["marc",   "For the record — Rutherford was the GM who leaked it. Ownership signed off."],
    ["reggie", "Marc. Marc. Who owns the leak? The guy in the corner office. Always."],
    ["marc",   "Fair."],
    ["reggie", "And don't get me started on the son on Twitter dot com during games. Live-tweeting from the owner's box like he just discovered the internet."],
    ["marc",   "He's stopped."],
    ["reggie", "Yeah, after the whole city asked him to."],
  ]},
  { title: "The Benning Years — Setting the Fire", lines: [
    ["marc",   "Jim Benning. General Manager, 2014 to December 2021."],
    ["reggie", "The man who looked at the salary cap and said — what if we made it a personal challenge to lose?"],
    ["marc",   "Let's be fair. He drafted Elias Pettersson, Quinn Hughes, and Thatcher Demko. That's a Hall-of-Fame D-man, a top-line center, and a starting goalie. That's more than most GMs do in a career."],
    ["reggie", "And then he handed the credit card to a squirrel."],
    ["marc",   "Go ahead."],
    ["reggie", "Loui Eriksson. Six million dollars. Six years. Signed in July 2016. Marc. How many goals did Loui Eriksson score in his final three Canucks seasons combined?"],
    ["marc",   "Eight."],
    ["reggie", "Eight. Goals. Combined. Three seasons. That's not a hockey contract, Marc. That's a hostage situation."],
    ["marc",   "He wanted the Sedins as linemates. The Sedins retired one year later."],
    ["reggie", "So we're paying six million a year to a guy whose entire strategy depended on two thirty-six-year-olds who told everyone they were leaving. Perfect. Very GM."],
    ["marc",   "Then there's Tyler Myers."],
    ["reggie", "Six million. Five years. The tallest turnstile in the Western Conference."],
    ["marc",   "He plays big minutes."],
    ["reggie", "He plays big rectangles, Marc. He's a rectangle out there. Opposing forwards go around him like he's a construction pylon. Except the pylon costs Vancouver six million dollars a year."],
    ["marc",   "Antoine Roussel. Jay Beagle. Micheal Ferland."],
    ["reggie", "The Stanley Cup Champion Buffet. Benning saw guys who won one round with Vegas or Washington and said — I'll take three. Fourteen million dollars a year on fourth-liners who couldn't skate anymore."],
    ["marc",   "And then in 2021…"],
    ["reggie", "Oh, here we go."],
    ["marc",   "The Oliver Ekman-Larsson trade."],
    ["reggie", "Marc. Do you want to tell them or should I?"],
    ["marc",   "You've earned it."],
    ["reggie", "Arizona. The Arizona Coyotes. A team run by a folding table in a parking lot. Called Vancouver and said — we'll give you Oliver Ekman-Larsson for a first-round pick, a second-round pick, a seventh-round pick, Loui Eriksson's cap hit, Jay Beagle, and Antoine Roussel. And Jim Benning said…"],
    ["marc",   "Deal."],
    ["reggie", "Deal. Marc. He said deal. To Arizona. The team that plays in a college gym. He gave up multiple firsts to take on the worst contract in the sport. And do you know what happened to OEL two years later?"],
    ["marc",   "Bought out."],
    ["reggie", "Bought. Out. Vancouver is still paying him. In 2025-26. To not play for them. In 2027, they will still be paying him. To not play for them. That is Jim Benning's monument. It should be a statue outside the arena — a bronze cast of Jim signing a napkin."],
    ["marc",   "He was fired December 2021."],
    ["reggie", "Two years too late. Cost this franchise a decade."],
  ]},
  { title: "The Coaching Carousel", lines: [
    ["marc",   "Travis Green. Fired December 2021."],
    ["reggie", "Fine coach. Wrong roster. Not his fault."],
    ["marc",   "Bruce Boudreau. Hired the same day."],
    ["reggie", "Bruce did what Bruce does. Team started eight-and-two, everyone in Vancouver bought a Boudreau jersey. And then Rutherford came in and treated him like a rental car."],
    ["marc",   "The infamous — everyone's a candidate — press conference…"],
    ["reggie", "While Bruce was still coaching! Marc, the GM said out loud, on the record, in front of a microphone, that he was interviewing replacements for a coach who had not been fired yet. Bruce had to keep coaching games knowing his boss was tinder-swiping other coaches in the next room over."],
    ["marc",   "Rick Tocchet took over. January 2023."],
    ["reggie", "And Tocchet — credit where it's due — dragged this roster to a Pacific Division title in 2023-24. Won the Jack Adams. Legit accomplishment."],
    ["marc",   "And then left after 2024-25."],
    ["reggie", "Fled. Marc. Fled. To Philadelphia. You don't leave Vancouver, a Canadian market, for the Philadelphia Flyers unless something is very, very wrong in the building."],
    ["marc",   "He and Allvin reportedly didn't see eye to eye on direction."],
    ["reggie", "He and Allvin reportedly hated each other. And Tocchet chose the Broad Street Bullies over the Aquilini circus. That should tell every fan everything they need to know about the front office."],
    ["marc",   "Adam Foote is the current head coach."],
    ["reggie", "Adam Foote. Great player. Norris-caliber defender. Never head-coached in the NHL before this. Zero head-coaching experience. Handed the keys to a franchise on fire."],
    ["marc",   "He was an assistant last year."],
    ["reggie", "Marc. Being Rick Tocchet's assistant is not the same as running a locker room where the two best forwards openly hate each other. That's not a promotion. That's arson training."],
  ]},
  { title: "Pettersson and the Miller Divorce", lines: [
    ["marc",   "March 2024. Elias Pettersson signs an eight-year, ninety-two-point-eight million dollar extension. Eleven-point-six million AAV."],
    ["reggie", "Marc. What was Elias Pettersson's point total the very next season?"],
    ["marc",   "Forty-five."],
    ["reggie", "Forty-five points. On an eleven-point-six million dollar contract. Marc. In accounting terms — that's a war crime."],
    ["marc",   "He was reportedly playing through issues."],
    ["reggie", "Reportedly. The rumor mill says Pettersson wanted out of Vancouver the day he signed. The rumor mill says he and JT Miller stopped speaking in October. The rumor mill says teammates picked sides. Marc, if the rumor mill is right — and it usually is — Vancouver just committed ninety-three million dollars to a guy who wanted to be traded before the ink dried."],
    ["marc",   "The Miller trade to the Rangers, January 2025 — that confirmed the fracture publicly."],
    ["reggie", "JT Miller. Their leading scorer. Traded mid-season. To New York. Because you can't have your two top-six guys refusing to be on the same power play unit. That's not a team, Marc. That's a group project with two kids who won't share the crayons."],
    ["marc",   "They got a package back."],
    ["reggie", "They got magic beans back, Marc. They got Filip Chytil and a first. Chytil is a fine player. Chytil is not JT Miller. And now Vancouver has traded away a top-six center in his prime, kept the ninety-three-million-dollar Swedish enigma who can't score, and hired a rookie head coach to make it all work."],
    ["marc",   "It's a lot."],
    ["reggie", "It's a disaster."],
  ]},
  { title: "Where They Are Tonight", lines: [
    ["marc",   "As of this broadcast, the Canucks are in the basement of the Pacific. Boeser has a year left on his deal, and every hockey reporter says he's being shopped."],
    ["reggie", "Because of course he is."],
    ["marc",   "Quinn Hughes is signed through 2027. His brothers Jack and Luke play in New Jersey."],
    ["reggie", "Now we're at the part that keeps Vancouver fans awake at night. Marc — say it."],
    ["marc",   "If Quinn Hughes wants to play with his brothers, there is nothing Vancouver can do to stop him from walking in 2027."],
    ["reggie", "Nothing. Not money. Not location. Not loyalty. His brothers play in Newark, New Jersey. And a player of Quinn Hughes' caliber — the reigning conversation for best defenseman in the world — gets to write his own script. And if Vancouver doesn't extend him this summer, the entire Canucks' organization is playing chicken with a semi-truck."],
    ["marc",   "Thatcher Demko has been injured on and off for two years."],
    ["reggie", "The one guy who could steal them games. Broken. Kevin Lankinen has been steady, but Lankinen is not stealing you a playoff series."],
    ["marc",   "The pipeline…"],
    ["reggie", "Is thin. Tom Willander is a real prospect. Lekkerimaki has a shot. Beyond that? They traded most of their picks trying to win now, and they didn't win now."],
  ]},
  { title: "Is There A Way Out?", lines: [
    ["marc",   "The way out. Reggie, you want optimism or realism?"],
    ["reggie", "Realism. Canucks fans have earned the truth."],
    ["marc",   "Alright. Three moves. One. Sign Quinn Hughes to an extension the moment he's eligible. Whatever it takes. If it's fourteen million, sign him. If it's fifteen, sign him. Losing him for nothing ends the franchise for a decade."],
    ["marc",   "Two. Boeser has to be traded before the deadline. His value only goes down. Get a young top-nine forward and a first-round pick. Don't be cute. Take the best offer on the table."],
    ["marc",   "Three. Pettersson has to be figured out. Either he becomes a top-ten center again, or you eat the pain and buy out the contract in year three when the penalty is manageable. There is no version of this team winning while paying eleven-six for forty-five points."],
    ["reggie", "And on the ice?"],
    ["marc",   "Foote has to be given real assistants. Bring in a veteran voice — a Peter Laviolette, a Todd McLellan — as associate coach. Foote can grow into the job, but not alone."],
    ["reggie", "Marc. That's a very reasonable plan."],
    ["marc",   "Thank you."],
    ["reggie", "Which is why none of it will happen. Because this is Vancouver. This ownership group would rather leak Boudreau's firing than extend Quinn Hughes on time. This front office will hold onto Pettersson at eleven-six until 2032 because we believe in the player. And Foote will be fired by Christmas because Rutherford is already texting other coaches."],
    ["marc",   "I'm allowed to hope."],
    ["reggie", "You are. This is a free country. Canucks fans though — they've been hoping since 1994. That's not hope, Marc. That's Stockholm Syndrome with a jersey on."],
  ]},
  { title: "Cold Close", lines: [
    ["reggie", "Vancouver Canucks. Fans deserve better. The players — most of them — deserve better. Quinn Hughes definitely deserves better. Bruce Boudreau definitely deserved better."],
    ["marc",   "The way out exists. The question is whether the people in charge are capable of taking it."],
    ["reggie", "They are not."],
    ["marc",   "Reggie."],
    ["reggie", "They are not, Marc."],
    ["marc",   "Alright. That's the Canucks. Five years of unforced errors, one Norris-caliber defenseman waiting to be traded, and one coach still crying somewhere."],
    ["reggie", "Bruce, if you're listening — we love you, big guy. You deserved a better exit."],
    ["marc",   "Reggie and Marc. This has been The Ticker Uncut."],
    ["reggie", "Canucks fans — take care of yourselves. It's not your fault."],
  ]},
];

// Flatten into an indexed playlist. Merges consecutive same-speaker lines
// into a single "turn" so ElevenLabs receives a natural multi-sentence read
// instead of cold-starting the voice every 3 seconds. This restores the
// cadence + banter feel of the Recap Show (which prompts the LLM for longer
// monologues in a single call).
function flattenScript(segments) {
  const flat = [];
  segments.forEach((seg, sIdx) => {
    let currentTurn = null;
    seg.lines.forEach(([speaker, text], lIdx) => {
      if (currentTurn && currentTurn.speaker === speaker) {
        // Same speaker keeps talking — glue this sentence onto the same turn
        // so ElevenLabs delivers it in one continuous take. A space between
        // sentences is enough; punctuation drives the pauses.
        currentTurn.text = `${currentTurn.text} ${text}`;
      } else {
        // New speaker (or first line of segment) — commit previous turn, start fresh.
        if (currentTurn) flat.push(currentTurn);
        currentTurn = {
          speaker, text,
          segmentTitle: seg.title, sIdx, lIdx,
          id: `${sIdx}-${flat.length}`,
        };
      }
    });
    if (currentTurn) flat.push(currentTurn);
  });
  return flat;
}

// Fetch an audio URL from the backend TTS endpoint.
async function fetchLineAudio(speaker, text) {
  const r = await fetch(`${API}/recap-show/line-audio?speaker=${speaker}&text=${encodeURIComponent(text)}`);
  const data = await r.json();
  if (!data.audio_url) return null;
  return data.audio_url.startsWith("/") ? `${BACKEND_URL}${data.audio_url}` : data.audio_url;
}

// ------------------------------ PAGE ------------------------------

export default function CanucksUncut() {
  const script = useMemo(() => flattenScript(SEGMENTS), []);
  const [idx, setIdx] = useState(-1); // -1 = not started
  const [playing, setPlaying] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const audioRef = useRef(null);
  const cacheRef = useRef(new Map()); // id -> audio URL

  // Prefetch a line's audio if not already cached.
  const ensureAudio = async (lineIdx) => {
    if (lineIdx < 0 || lineIdx >= script.length) return null;
    const line = script[lineIdx];
    if (cacheRef.current.has(line.id)) return cacheRef.current.get(line.id);
    const url = await fetchLineAudio(line.speaker, line.text);
    if (url) cacheRef.current.set(line.id, url);
    return url;
  };

  // Play a specific line by index. Prefetches the next 2 lines.
  const playLine = async (lineIdx) => {
    if (lineIdx < 0 || lineIdx >= script.length) {
      setPlaying(false);
      setIdx(-1);
      return;
    }
    setIdx(lineIdx);
    setPrefetching(true);
    const url = await ensureAudio(lineIdx);
    setPrefetching(false);
    if (!url) { advance(); return; }
    // fire-and-forget prefetch of the next two lines
    ensureAudio(lineIdx + 1);
    ensureAudio(lineIdx + 2);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = url;
    audio.onended = () => advance();
    audio.onerror = () => advance();
    try { await audio.play(); } catch { /* autoplay blocked — user will tap */ }
    setPlaying(true);
  };

  const advance = () => {
    setIdx((cur) => {
      const next = cur + 1;
      if (next >= script.length) { setPlaying(false); return -1; }
      // Tight hand-off — small gap so the next voice starts almost immediately
      // (natural broadcast rhythm), but not zero (avoids clip clipping).
      setTimeout(() => playLine(next), 90);
      return cur;
    });
  };

  const start = () => { playLine(0); };
  const togglePause = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };
  const skip = () => {
    const a = audioRef.current;
    if (a) { try { a.pause(); } catch {} }
    if (idx + 1 < script.length) playLine(idx + 1);
    else { setPlaying(false); setIdx(-1); }
  };
  const restart = () => {
    cacheRef.current.clear();
    setIdx(-1);
    playLine(0);
  };

  useEffect(() => {
    return () => { try { audioRef.current?.pause(); } catch {} };
  }, []);

  const currentLine = idx >= 0 ? script[idx] : null;
  const isReggie = currentLine?.speaker === "reggie";

  return (
    <div className="min-h-screen text-white bg-[#0b0b10] pb-32">
      <audio ref={audioRef} />

      {/* Chyron header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-4"
           style={{ background: "linear-gradient(90deg, rgba(30,91,255,0.15), transparent 60%)" }}>
        <TMark size={38} variant="light" />
        <div className="flex-1">
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", letterSpacing: "0.05em" }}>
            THE TICKER · UNCUT
          </div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.35em", color: "#1E5BFF" }}>
            HOW THE CANUCKS SET FIRE TO THEMSELVES · A FIVE-YEAR AUTOPSY
          </div>
        </div>
        {currentLine && (
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
            {currentLine.segmentTitle.toUpperCase()}
          </div>
        )}
      </div>

      {/* Stage */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Two-host desk */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          <HostCard name="Reggie Banks" role="Color · Anchor" initials="RB" active={isReggie && playing} />
          <HostCard name="Marc Collins" role="Analytics · Co-Host" initials="MC" active={!isReggie && playing && currentLine} />
        </div>

        {/* Current line — big broadcast lower-third */}
        <div className="min-h-[220px] flex items-center justify-center px-4">
          {!currentLine ? (
            <div className="text-center">
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "34px", color: "#fff", lineHeight: 1.15 }}>
                A no-holds-barred, five-year post-mortem of the Vancouver Canucks.
              </div>
              <div className="mt-4 text-white/60" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "18px" }}>
                Ownership. Coaches. Contracts. Rumors.<br />
                Every roast anchored to a real event.
              </div>
              <button
                onClick={start}
                data-testid="canucks-play"
                className="mt-8 inline-flex items-center gap-3 px-8 py-4 rounded-full text-black font-bold hover:opacity-90 transition-opacity"
                style={{ background: "#1E5BFF", fontFamily: "Oswald", fontSize: "16px", letterSpacing: "0.2em", boxShadow: "0 8px 30px -6px rgba(30,91,255,0.6)" }}
              >
                <Play className="w-5 h-5" fill="currentColor" />
                ROLL THE TAPE
              </button>
            </div>
          ) : (
            <div className="w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full flex items-center justify-center"
                     style={{ background: isReggie ? "#1E5BFF33" : "#c9d4ff22", border: `1px solid ${isReggie ? "#1E5BFF66" : "#c9d4ff55"}` }}>
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: isReggie ? "#1E5BFF" : "#c9d4ff" }}>
                    {isReggie ? "RH" : "MC"}
                  </span>
                </div>
                <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.3em", color: isReggie ? "#1E5BFF" : "#c9d4ff" }}>
                  {isReggie ? "REGGIE BANKS" : "MARC COLLINS"}
                </div>
                {prefetching && (
                  <div className="text-[11px] text-white/40" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>
                    LOADING…
                  </div>
                )}
              </div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "26px", lineHeight: 1.35, color: "#fff" }}>
                "{currentLine.text}"
              </div>
              <div className="mt-6 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${((idx + 1) / script.length) * 100}%`, background: "#1E5BFF" }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-white/45" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>
                <span>LINE {idx + 1} OF {script.length}</span>
                <span>{Math.round(((idx + 1) / script.length) * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transport controls (bottom bar) */}
      {currentLine && (
        <div className="fixed left-0 right-0 bottom-0 border-t border-white/10 px-4 py-4" style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)" }}>
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-4">
            <button
              onClick={restart}
              className="h-11 w-11 rounded-full border border-white/15 hover:border-white/50 flex items-center justify-center"
              data-testid="canucks-restart"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4 text-white/80" />
            </button>
            <button
              onClick={togglePause}
              className="h-14 w-14 rounded-full flex items-center justify-center hover:opacity-90"
              style={{ background: "#1E5BFF" }}
              data-testid="canucks-pause"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="w-5 h-5 text-white" fill="currentColor" /> : <Play className="w-5 h-5 text-white translate-x-[2px]" fill="currentColor" />}
            </button>
            <button
              onClick={skip}
              className="h-11 w-11 rounded-full border border-white/15 hover:border-white/50 flex items-center justify-center"
              data-testid="canucks-skip"
              title="Next line"
            >
              <SkipForward className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HostCard({ name, role, initials, active }) {
  return (
    <div
      className={`rounded-lg border p-5 flex items-center gap-4 transition-all ${active ? "border-[#1E5BFF] shadow-[0_0_30px_-8px_rgba(30,91,255,0.7)]" : "border-white/10"}`}
      style={{ background: active ? "linear-gradient(135deg, rgba(30,91,255,0.15), rgba(11,11,16,0.9))" : "rgba(0,0,0,0.4)" }}
    >
      <div className={`h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${active ? "scale-110" : ""}`}
           style={{ background: active ? "#1E5BFF33" : "rgba(255,255,255,0.05)", border: `2px solid ${active ? "#1E5BFF" : "rgba(255,255,255,0.15)"}` }}>
        <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: active ? "#1E5BFF" : "#fff" }}>
          {initials}
        </span>
      </div>
      <div>
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", color: "#fff", letterSpacing: "0.02em" }}>{name}</div>
        <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.28em", color: active ? "#1E5BFF" : "#a0a0a5" }}>
          {role}
        </div>
        {active && (
          <div className="mt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[10px] text-red-300" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.3em" }}>ON AIR</span>
          </div>
        )}
      </div>
    </div>
  );
}
