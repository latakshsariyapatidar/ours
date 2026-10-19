import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  House,
  Images,
  FolderHeart,
  Heart,
  PanelsTopLeft,
  Settings as SettingsIcon,
  Plus,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { api, setCsrf } from "./api";
import { Notice, ActionForm, Field, Loading, Failure } from "./ui";
import { Home, Gallery, Albums, Settings } from "./pages";
import { StudioList, StudioEditor } from "./studio";
import { UploadManager } from "./upload";
import "./styles.css";
export const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5000, refetchOnWindowFocus: true },
  },
});
export const User = React.createContext<any>(null);
function Auth({ state, refresh }: { state: any; refresh: () => void }) {
  const [join, setJoin] = useState(location.hash.startsWith("#invite="));
  const token = location.hash.startsWith("#invite=")
    ? location.hash.slice(8)
    : "";
  useEffect(() => {
    if (token) history.replaceState(null, "", location.pathname);
  }, []);
  const [invite] = useState(token);
  const mode = state.setup ? "setup" : join ? "join" : "login";
  return (
    <main className="auth">
      <section className="auth-story">
        <div className="wordmark">
          {state.name}
          <span>♥</span>
        </div>
        <div>
          <span className="eyebrow">JUST THE TWO OF US</span>
          <h1>
            All our moments.
            <br />
            <em>A little closer.</em>
          </h1>
          <p>Our memories, our little corner of the internet.</p>
        </div>
        <div className="auth-art" aria-hidden="true">
          <span>the places we went</span>
          <span>the little things</span>
          <Heart />
        </div>
        <small>A private home for the stories we share.</small>
      </section>
      <section className="auth-form">
        <span className="eyebrow">
          WELCOME {mode === "login" ? "BACK" : "HOME"}
        </span>
        <h2>
          {mode === "setup"
            ? "Make this space yours."
            : mode === "join"
              ? "Your person saved you a place."
              : "Good to have you here."}
        </h2>
        <p>
          {mode === "setup"
            ? "Use your private setup token to create the first account."
            : mode === "join"
              ? "An invitation, just for you. Create your account below."
              : "Sign in to pick up where you left off."}
        </p>
        <ActionForm
          submit={
            mode === "login"
              ? "Come on in"
              : mode === "setup"
                ? "Create our home"
                : "Join our home"
          }
          onSubmit={async (data) => {
            const user = await api(`/auth/${mode}`, "POST", data);
            setCsrf(user.csrf);
            refresh();
          }}
        >
          {mode !== "login" && (
            <>
              <Field
                label={mode === "setup" ? "Setup token" : "Invitation token"}
                name="token"
                type="password"
                defaultValue={invite}
                required
                autoComplete="off"
              />
              <Field
                label="Your name"
                name="name"
                required
                autoComplete="name"
              />
            </>
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
          <small>Use at least 12 characters.</small>
        </ActionForm>
        {!state.setup && (
          <button className="ghost" onClick={() => setJoin(!join)}>
            {join
              ? "Already have an account? Sign in"
              : "Have an invitation? Join your person"}
          </button>
        )}
      </section>
    </main>
  );
}
function App() {
  const state = useQuery({
    queryKey: ["auth"],
    queryFn: () => api("/auth/state"),
  });
  const [upload, setUpload] = useState(false),
    [notice, setNotice] = useState(""),
    [dark, setDark] = useState(() => {
      try {
        return localStorage.getItem("ours-theme") === "dark";
      } catch {
        return false;
      }
    });
  const loc = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("ours-theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    setCsrf(state.data?.user?.csrf || "");
  }, [state.data]);
  if (state.isPending) return <Loading />;
  if (state.error)
    return <Failure error={state.error} retry={() => state.refetch()} />;
  if (!state.data.user)
    return <Auth state={state.data} refresh={() => state.refetch()} />;
  const nav = [
    ["/", "Home", House],
    ["/memories", "Memories", Images],
    ["/albums", "Albums", FolderHeart],
    ["/studio", "Our Studio", PanelsTopLeft],
    ["/favorites", "Favorites", Heart],
  ] as const;
  return (
    <User.Provider value={state.data.user}>
      <Notice.Provider value={setNotice}>
        <div className="app-shell">
          <aside className="sidebar">
            <Link to="/" className="wordmark">
              {state.data.name}
              <span>♥</span>
            </Link>
            <span className="sidebar-note">A life, collected together.</span>
            <nav>
              {nav.map(([path, label, Icon]) => (
                <NavLink key={path} to={path} end={path === "/"}>
                  <Icon size={19} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <p>
                For the big adventures.
                <br />
                And the ordinary Tuesdays.
              </p>
              <NavLink to="/settings">
                <SettingsIcon size={18} /> Settings
              </NavLink>
              <button
                className="ghost"
                onClick={async () => {
                  try {
                    await api("/auth/logout", "POST");
                    client.clear();
                    state.refetch();
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              >
                <LogOut size={17} /> Sign out
              </button>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <span>OUR MEMORIES, OUR WAY</span>
              <div className="row">
                <button
                  className="icon"
                  aria-label={
                    dark ? "Switch to light mode" : "Switch to dark mode"
                  }
                  onClick={() => setDark(!dark)}
                >
                  {dark ? <Sun size={19} /> : <Moon size={19} />}
                </button>
                <Link
                  to="/settings"
                  className="avatar"
                  aria-label="Account settings"
                >
                  {state.data.user.name.slice(0, 1)}
                </Link>
                <button className="primary" onClick={() => setUpload(true)}>
                  <Plus size={17} /> Add memories
                </button>
              </div>
            </header>
            <main id="main-content">
              <Routes>
                <Route
                  path="/"
                  element={<Home upload={() => setUpload(true)} />}
                />
                <Route path="/memories" element={<Gallery />} />
                <Route path="/favorites" element={<Gallery favorites />} />
                <Route path="/trash" element={<Gallery trash />} />
                <Route path="/albums" element={<Albums />} />
                <Route path="/albums/:albumId" element={<Gallery />} />
                <Route path="/studio" element={<StudioList />} />
                <Route path="/studio/:id" element={<StudioEditor />} />
                <Route
                  path="/settings"
                  element={<Settings refresh={() => state.refetch()} />}
                />
                <Route
                  path="*"
                  element={
                    <p>
                      This page isn’t here. <Link to="/">Go home</Link>
                    </p>
                  }
                />
              </Routes>
            </main>
          </div>
        </div>
        {upload && <UploadManager onClose={() => setUpload(false)} />}
        <div className="toast" role="status" aria-live="polite">
          {notice}
        </div>
      </Notice.Provider>
    </User.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
