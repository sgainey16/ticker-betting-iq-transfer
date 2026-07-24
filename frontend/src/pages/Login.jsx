import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { Crown, LogIn, MailPlus } from "lucide-react";

export default function Login() {
  const deviceId = useMemo(() => getDeviceId(), []);
  const [sub, setSub] = useState({ is_premium: false, questions_used: 0, free_limit: 3 });
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api.get(`/subscription/state?device_id=${encodeURIComponent(deviceId)}`)
      .then((r) => setSub(r.data)).catch(() => {});
  }, [deviceId]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setNotice("Thanks — we'll email you the moment real accounts land.");
    setEmail("");
  }

  async function activate() {
    try {
      await api.post("/subscription/activate", { device_id: deviceId });
      setSub((s) => ({ ...s, is_premium: true }));
    } catch (e) { console.error(e); }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <header className="text-center">
        <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-[#1e5dff]">
          Members lounge
        </div>
        <h1 className="font-headline text-3xl sm:text-4xl text-white mt-2">
          Sign in coming soon.
        </h1>
        <p className="text-white/60 text-sm mt-2">
          Full accounts, saved rosters across devices, and Stripe billing land in the next drop.
          For now, your desk lives on this browser.
        </p>
      </header>

      <div className="card-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <LogIn className="w-4 h-4 text-white/60" />
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
            Device status
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="text-white/60">Founding Member</div>
            <div className="font-headline text-white text-lg mt-0.5">
              {sub.is_premium ? "Active" : "Not yet"}
            </div>
          </div>
          {!sub.is_premium && (
            <button
              onClick={activate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
              data-testid="login-activate"
            >
              <Crown className="w-3.5 h-3.5" /> Activate
            </button>
          )}
        </div>
        <div className="mt-3 text-[10px] font-accent uppercase tracking-widest text-white/35">
          MVP · free early access · payments after launch
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card-surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MailPlus className="w-4 h-4 text-white/60" />
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
            Get the launch email
          </div>
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          placeholder="you@puckmail.com"
          className="w-full bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          data-testid="login-email"
        />
        <button
          type="submit"
          className="w-full h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-[#2d2d35] hover:border-white/40 text-white font-accent uppercase tracking-widest text-xs inline-flex items-center justify-center gap-2 transition-colors"
          data-testid="login-submit"
        >
          Notify me
        </button>
        {notice && <div className="text-[11px] text-[#7de9ff] font-accent uppercase tracking-widest">{notice}</div>}
      </form>
    </div>
  );
}
