"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type HistoryItem = {
  id: string;
  title: string;
  prompt: string;
  image_path: string;
  created_at: string;
  imageUrl?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Clean and modern");
  const [aspect, setAspect] = useState("16:9");
  const [quality, setQuality] = useState("medium");
  const [references, setReferences] = useState<FileList | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [refineText, setRefineText] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadHistory();
  }, [session?.user?.id]);

  async function handleAuth() {
    if (!supabase) {
      setMessage("Supabase is not configured yet. Add the frontend environment variables first.");
      return;
    }
    setAuthBusy(true);
    setMessage("");
    const response = authMode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (response.error) setMessage(response.error.message);
    else if (authMode === "signup" && !response.data.session) {
      setMessage("Check your email for the confirmation link, then sign in.");
    } else setMessage("Welcome to Thumbnatior AI.");
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setResult(null);
    setHistory([]);
  }

  async function loadHistory() {
    if (!supabase || !session?.user?.id) return;
    const { data, error } = await supabase
      .from("projects")
      .select("id,title,prompt,image_path,created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    if (error || !data) return;
    const withUrls = await Promise.all(data.map(async (item: HistoryItem) => {
      const { data: signed } = await supabase.storage
        .from("thumbnatior-thumbnails")
        .createSignedUrl(item.image_path, 60 * 60);
      return { ...item, imageUrl: signed?.signedUrl };
    }));
    setHistory(withUrls);
  }

  async function generate(refine = false) {
    if (!supabase || !session?.access_token) return;
    if (!prompt.trim() && !refineText.trim()) {
      setMessage("Please describe the thumbnail you want to create.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      const mainPrompt = refine && refineText.trim()
        ? `Edit the provided thumbnail according to these instructions. Preserve the elements not mentioned: ${refineText}`
        : prompt;
      form.append("prompt", `${mainPrompt}\nVisual direction: ${style}. Thumbnail aspect ratio: ${aspect}. Create a clear, readable composition designed to work at small size.`);
      form.append("aspect_ratio", aspect);
      form.append("quality", quality);

      if (refine && result) {
        const previousBlob = await fetch(result).then(r => r.blob());
        form.append("references", new File([previousBlob], "previous-thumbnail.png", { type: "image/png" }));
      }
      if (references) {
        Array.from(references).slice(0, 3).forEach(file => form.append("references", file));
      }

      const response = await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Image generation failed.");
      const dataUrl = `data:image/png;base64,${payload.image_base64}`;
      setResult(dataUrl);
      setRefineText("");
      setMessage("Your thumbnail is ready. Review it before publishing.");
    } catch (error: any) {
      setMessage(error.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProject() {
    if (!supabase || !session?.user?.id || !result) return;
    setMessage("");
    try {
      const blob = await fetch(result).then(r => r.blob());
      const path = `${session.user.id}/${crypto.randomUUID()}.png`;
      const upload = await supabase.storage.from("thumbnatior-thumbnails").upload(path, blob, {
        contentType: "image/png",
        upsert: false
      });
      if (upload.error) throw upload.error;
      const title = prompt.trim().slice(0, 70) || "Untitled thumbnail";
      const insert = await supabase.from("projects").insert({
        user_id: session.user.id,
        title,
        prompt: prompt || refineText || "Edited thumbnail",
        image_path: path
      });
      if (insert.error) throw insert.error;
      setMessage("Project saved to your account.");
      await loadHistory();
    } catch (error: any) {
      setMessage(error.message || "Could not save this project.");
    }
  }

  if (!session) {
    if (!showAuth) {
      return (
        <div className="landing-shell">
          <header className="landing-nav">
            <a className="brand" href="#top">Thumbnatior <span>AI</span></a>
            <nav><a href="#features">Features</a><a href="#workflow">How it works</a></nav>
            <button className="nav-cta" onClick={() => { setAuthMode("login"); setShowAuth(true); }}>Sign in <span>↗</span></button>
          </header>
          <main id="top">
            <section className="hero-section">
              <div className="hero-copy">
                <div className="eyebrow"><span className="live-dot"/> YOUR AI THUMBNAIL WORKSPACE</div>
                <h1>Turn your ideas into <span>click-worthy</span> thumbnails.</h1>
                <p className="hero-subtitle">Create, refine, and save video thumbnails in one focused workspace. No complicated design tools. Just your idea and a few words.</p>
                <div className="hero-actions">
                  <button className="hero-primary" onClick={() => { setAuthMode("signup"); setShowAuth(true); }}>Start creating <span>→</span></button>
                  <a className="hero-secondary" href="#workflow">See how it works</a>
                </div>
                <div className="hero-proof"><span className="proof-icon">✦</span><span>Cloud-powered creation</span><i/> <span>Simple editing</span><i/> <span>Your projects, saved</span></div>
              </div>
              <div className="hero-art" aria-label="Thumbnail design examples">
                <div className="art-glow"/>
                <div className="sample-card sample-back"><div className="sample-sun"/><div className="sample-mountain"/><b>THE BIG<br/>ADVENTURE</b><small>EXPLORE MORE</small></div>
                <div className="sample-card sample-front"><div className="sample-orb"/><div className="sample-lines"/><span className="sample-tag">NEW VIDEO</span><b>LEVEL UP<br/><em>YOUR GAME</em></b><div className="sample-play">▶</div></div>
                <div className="floating-chip"><span>✦</span> AI generated</div>
                <div className="floating-note"><span className="note-check">✓</span><div><b>Ready to refine</b><small>One prompt away</small></div></div>
              </div>
            </section>
            <section className="trust-strip"><span>MADE FOR CREATORS</span><b>You bring the idea.</b><b>Thumbnatior brings it to life.</b></section>
            <section className="features-section" id="features">
              <div className="section-heading"><div className="eyebrow">A SMALLER LEARNING CURVE</div><h2>Everything you need.<br/><span>Nothing you don't.</span></h2><p>A clean creative flow that helps you move from a rough idea to a finished thumbnail.</p></div>
              <div className="feature-grid">
                <article className="feature-card"><div className="feature-icon purple">✦</div><h3>Generate from a prompt</h3><p>Describe the scene, mood, and subject. Add references when you want more visual direction.</p><span className="feature-number">01</span></article>
                <article className="feature-card"><div className="feature-icon blue">↗</div><h3>Refine without restarting</h3><p>Ask for a change in plain language while keeping the parts of your thumbnail you already like.</p><span className="feature-number">02</span></article>
                <article className="feature-card"><div className="feature-icon green">▤</div><h3>Keep everything together</h3><p>Save your creations in your account and return to your projects whenever you need them.</p><span className="feature-number">03</span></article>
              </div>
            </section>
            <section className="workflow-section" id="workflow"><div><div className="eyebrow">YOUR CREATIVE FLOW</div><h2>From first thought<br/>to <span>final thumbnail.</span></h2><p>Start with a description, generate a visual, then fine-tune it with follow-up instructions. Your workflow stays in one place.</p><button className="hero-primary" onClick={() => { setAuthMode("signup"); setShowAuth(true); }}>Create your workspace <span>→</span></button></div><div className="workflow-steps"><div><b>01</b><section><strong>Describe</strong><small>Tell the AI what you want to see.</small></section><span>✎</span></div><div><b>02</b><section><strong>Create</strong><small>Generate a visual direction in the cloud.</small></section><span>✦</span></div><div><b>03</b><section><strong>Refine & save</strong><small>Make adjustments and keep your result.</small></section><span>✓</span></div></div></section>
            <footer className="landing-footer"><a className="brand" href="#top">Thumbnatior <span>AI</span></a><span>CREATE WITH INTENTION.</span><small>© 2026 Thumbnatior AI · Prototype</small></footer>
          </main>
        </div>
      );
    }
    return (
      <div className="shell">
        <header className="topbar">
          <button className="brand brand-button" onClick={() => setShowAuth(false)}>Thumbnatior <span>AI</span></button>
          <div className="top-actions"><button className="ghost" onClick={() => setShowAuth(false)}>Back to home</button></div>
        </header>
        <main className="auth-wrap">
          <section className="auth-card">
            <div className="eyebrow">YOUR CREATIVE WORKSPACE</div>
            <h1>{authMode === "signup" ? "Create your account." : "Welcome back."}</h1>
            <p className="subtitle">Create, refine, and keep your video thumbnails in one simple workspace.</p>
            <div className="auth-toggle">
              <button className={authMode === "signup" ? "secondary" : "ghost"} onClick={() => setAuthMode("signup")}>Create account</button>
              <button className={authMode === "login" ? "secondary" : "ghost"} onClick={() => setAuthMode("login")}>Sign in</button>
            </div>
            <label className="field">Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <label className="field">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={authMode === "signup" ? "new-password" : "current-password"} />
            <button className="primary" disabled={authBusy || !email || password.length < 8} onClick={handleAuth}>{authBusy ? "Please wait..." : authMode === "signup" ? "Create account" : "Sign in"}</button>
            {message && <div className="notice">{message}</div>}
            <p className="help">By continuing, you agree to use only images you have permission to upload and edit.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Thumbnatior <span>AI</span></div>
        <div className="top-actions">
          <span>{session.user.email}</span>
          <button className="ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="main">
        <div className="eyebrow">AI-POWERED THUMBNAIL STUDIO</div>
        <h1>Make your next video<br />impossible to scroll past.</h1>
        <p className="subtitle">Describe your idea, add visual references, and create a thumbnail. Refine the result with simple instructions.</p>

        <div className="grid">
          <section className="panel">
            <h2>01 / Describe your thumbnail</h2>
            <label className="field">Creative prompt</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A cinematic gaming thumbnail showing a surprised creator in the foreground, a mysterious glowing portal in the background, dramatic purple lighting..." />
            <label className="field">Reference images <span className="small">(optional, up to 3)</span></label>
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e => setReferences(e.target.files)} />
            <p className="help">Use references for visual direction, characters, colors, or composition. Upload images you have permission to use.</p>
            <div className="row">
              <div>
                <label className="field">Visual style</label>
                <select value={style} onChange={e => setStyle(e.target.value)}>
                  <option>Clean and modern</option>
                  <option>Gaming and energetic</option>
                  <option>Cinematic</option>
                  <option>Cartoon illustration</option>
                  <option>Photorealistic</option>
                  <option>Minimalist</option>
                </select>
              </div>
              <div>
                <label className="field">Aspect ratio</label>
                <select value={aspect} onChange={e => setAspect(e.target.value)}>
                  <option>16:9</option><option>1:1</option><option>9:16</option>
                </select>
              </div>
            </div>
            <label className="field">Render quality</label>
            <select value={quality} onChange={e => setQuality(e.target.value)}>
              <option value="low">Draft — lower cost</option>
              <option value="medium">Standard</option>
              <option value="high">High detail</option>
            </select>
            <button className="primary" disabled={busy || !prompt.trim()} onClick={() => generate(false)}>
              {busy ? "Creating your thumbnail..." : "✦ Generate thumbnail"}
            </button>
            <div className="notice">Image generation runs on the cloud. API usage may have a cost; this prototype does not include usage quotas or payments yet.</div>
          </section>

          <section className="panel">
            <h2>02 / Your canvas</h2>
            <div className="preview">
              {result ? <img src={result} alt="Generated thumbnail preview" /> : (
                <div className="empty">
                  <div style={{fontSize: 30}}>✧</div>
                  <strong>Your next thumbnail starts here</strong>
                  <span className="small">Your generated image will appear in this space.</span>
                </div>
              )}
            </div>
            {result && <>
              <button className="secondary" style={{width:"100%",marginTop:12}} onClick={saveProject}>Save to my projects</button>
              <a className="primary" style={{display:"block",textAlign:"center",textDecoration:"none"}} href={result} download="thumbnatior-thumbnail.png">Download PNG</a>
              <label className="field">Refine this thumbnail</label>
              <textarea style={{minHeight:85}} value={refineText} onChange={e => setRefineText(e.target.value)} placeholder="Make the main character larger and change the background to a sunset..." />
              <button className="primary" disabled={busy || !refineText.trim()} onClick={() => generate(true)}>
                {busy ? "Refining..." : "Refine current thumbnail"}
              </button>
            </>}
            {message && <div className={`notice ${message.includes("ready") || message.includes("saved") ? "success" : ""}`}>{message}</div>}
          </section>
        </div>

        <section className="history">
          <h2>Your saved projects</h2>
          {history.length ? <div className="history-grid">
            {history.map(item => <article className="history-item" key={item.id}>
              {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
              <div><strong>{item.title}</strong><p className="small">{new Date(item.created_at).toLocaleDateString("en-US")}</p></div>
            </article>)}
          </div> : <p className="help">Your saved thumbnails will appear here.</p>}
        </section>
        <div className="footer">THUMBNATIOR AI · CREATE WITH INTENTION</div>
      </main>
    </div>
  );
}
