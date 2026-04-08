import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

const HomePage = () => {
  const [scrollStage, setScrollStage] = useState(0);

  useEffect(() => {
    const updateScrollStage = () => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = window.scrollY / maxScroll;
      if (progress < 0.25) setScrollStage(0);
      else if (progress < 0.5) setScrollStage(1);
      else if (progress < 0.75) setScrollStage(2);
      else setScrollStage(3);
    };

    updateScrollStage();
    window.addEventListener('scroll', updateScrollStage, { passive: true });
    window.addEventListener('resize', updateScrollStage);

    return () => {
      window.removeEventListener('scroll', updateScrollStage);
      window.removeEventListener('resize', updateScrollStage);
    };
  }, []);

  const stageClasses = useMemo(
    () => [
      'from-cyan-100/70 via-white/80 to-indigo-100/70',
      'from-indigo-100/70 via-white/80 to-fuchsia-100/70',
      'from-emerald-100/70 via-white/80 to-cyan-100/70',
      'from-slate-100 via-white to-blue-100/80',
    ],
    []
  );

  const quickLinks = [
    { to: '/login', label: 'Care Desk' },
    { to: '/patients', label: 'Patients' },
    { to: '/login', label: 'Login' },
    { to: '/blogs', label: 'Blogs' },
    { to: '/about', label: 'About' },
    { to: '/contact-us', label: 'Contact Us' },
    { to: '/dashboard/patient', label: 'Patient View' },
  ];

  return (
    <Layout title="Home">
      <div className={`relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br ${stageClasses[scrollStage]} p-6 shadow-[0_30px_80px_rgba(14,116,144,0.18)] backdrop-blur-xl transition-all duration-700`}>
        <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 animate-pulse rounded-full bg-cyan-200/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 right-0 h-44 w-44 animate-pulse rounded-full bg-indigo-200/60 blur-3xl" style={{ animationDelay: '250ms' }} />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-24 w-24 animate-pulse rounded-full bg-fuchsia-200/40 blur-2xl" style={{ animationDelay: '500ms' }} />

        <div className="sticky top-3 z-20 mb-6 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-lg backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            {quickLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <section id="top" className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/70 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">Smart Health Ecosystem</p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">Your AI-First Healthcare Workspace</h2>
              <p className="mt-3 max-w-3xl text-lg text-slate-600">
                Monitor patient vitals, review AI insights, and respond faster with a futuristic real-time dashboard built for modern care teams.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/login" className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 text-base font-bold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-cyan-300/50">
                  Login
                </Link>
                <Link to="/blogs" className="rounded-xl border border-cyan-300/70 bg-white/80 px-5 py-3 text-base font-bold text-cyan-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-50">
                  Read Health Blogs
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-md backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">Realtime</p>
                <h3 className="mt-2 text-2xl font-extrabold text-slate-900">Vitals Streaming</h3>
                <p className="mt-2 text-base text-slate-600">Live signal flow for clinical action.</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-md backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-700">AI Layer</p>
                <h3 className="mt-2 text-2xl font-extrabold text-slate-900">Smart Insights</h3>
                <p className="mt-2 text-base text-slate-600">Model-driven cues and risk tracking.</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-white/70 bg-white/80 p-5 shadow-md backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Fast Access</p>
                <h3 className="mt-2 text-2xl font-extrabold text-slate-900">Jump to any page below while you scroll</h3>
                <p className="mt-2 text-base text-slate-600">Use the floating dock above to move between dashboard sections and application pages instantly.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-md backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <h3 className="text-xl font-extrabold text-slate-900">Realtime Monitoring</h3>
            <p className="mt-2 text-base text-slate-600">Live vitals stream for heart rate, SpO2, temperature and emergency status.</p>
          </article>

          <article className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-md backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <h3 className="text-xl font-extrabold text-slate-900">AI Triage Signals</h3>
            <p className="mt-2 text-base text-slate-600">Risk summaries and model-driven cues to support faster clinical decisions.</p>
          </article>

          <article className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-md backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <h3 className="text-xl font-extrabold text-slate-900">Care Coordination</h3>
            <p className="mt-2 text-base text-slate-600">Patient records, contact details, and interventions in one connected flow.</p>
          </article>
        </section>

        <section id="journey" className="mt-6 rounded-3xl border border-white/70 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Patient Journey</p>
              <h3 className="mt-2 text-3xl font-extrabold">Scroll. Discover. Act.</h3>
              <p className="mt-3 text-base text-slate-300">
                This landing page changes mood as you move down, echoing a modern product story: from overview to action to insight.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-sm font-semibold text-cyan-300">1. Observe</p>
                <p className="mt-2 text-sm text-slate-300">Vitals, charts, and live alerts.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-sm font-semibold text-violet-300">2. Analyze</p>
                <p className="mt-2 text-sm text-slate-300">AI risk and blog insights.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <p className="text-sm font-semibold text-emerald-300">3. Respond</p>
                <p className="mt-2 text-sm text-slate-300">Quick links to every page.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pages" className="mt-6 rounded-3xl border border-white/70 bg-white/75 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">Page Hub</p>
              <h3 className="mt-1 text-3xl font-extrabold text-slate-900">Access every page from Home</h3>
            </div>
            <p className="text-base text-slate-600">Use the dock above or these cards to move through the app.</p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">Go to</p>
                <h4 className="mt-2 text-2xl font-extrabold text-slate-900 group-hover:text-cyan-700">{item.label}</h4>
                <p className="mt-2 text-base text-slate-600">Open the {item.label.toLowerCase()} area with one click.</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="futuristic" className="mt-6 overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-r from-fuchsia-50 via-white to-cyan-50 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-fuchsia-700">Future Ready UI</p>
              <h3 className="mt-2 text-3xl font-extrabold text-slate-900">A fluid health command surface</h3>
              <p className="mt-3 text-base text-slate-600">
                With layered gradients, floating cards, and quick access hubs, the home page now behaves like an immersive product showcase.
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-md backdrop-blur-md">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Scroll Feel</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">Smooth</p>
              <p className="mt-2 text-base text-slate-600">Background mood changes as you move down the page.</p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default HomePage;
