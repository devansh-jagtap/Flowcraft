import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DiagramCanvas from '../components/diagram/DiagramCanvas';
import { DiagramThumbnail } from '../components/diagram/DiagramThumbnail';
import { Segmented } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { parseDiagram } from '../lib/diagram/parse';
import { TEMPLATES, TYPE_INFO } from '../lib/diagram/templates';
import type { DiagramType } from '../lib/diagram/types';

const DEMOS: Record<DiagramType, string> = {
  flowchart: `Hungry? -> Cook at home: yes
Hungry? -> (Keep working): no
Cook at home -> Ingredients in fridge?
Ingredients in fridge? -> (Make pasta): yes
Ingredients in fridge? -> Order food: no`,
  mindmap: `Learn to code
  Basics
    HTML & CSS
    JavaScript
  Projects
    Portfolio site
    Todo app
  Practice
    30 min daily`,
  orgchart: `Mom & Dad — Parents
  Aarav — Engineer
  Diya — Doctor
    Kiara — Baby`,
};

const FEATURES = [
  ['✍️', 'Just type', 'No dragging boxes around. Write steps or bullet points and the layout happens for you.'],
  ['🎨', 'Looks great by default', 'Five colour themes, smart spacing and clean arrows. Drag anything you want to fine-tune.'],
  ['🔗', 'Share with one link', 'Send a read-only link to friends, classmates or your team. They can copy it to remix.'],
  ['⬇️', 'Export anywhere', 'Download crisp PNG or SVG images for slides, docs, assignments or WhatsApp.'],
];

export default function LandingPage() {
  const { user } = useAuth();
  const [type, setType] = useState<DiagramType>('flowchart');
  const [source, setSource] = useState(DEMOS.flowchart);
  const graph = useMemo(() => parseDiagram(type, source), [type, source]);

  return (
    <div className="landing">
      <section className="hero container">
        <span className="eyebrow">✨ Text → diagram, instantly</span>
        <h1>
          Type it. <span className="gradient-text">See it.</span> Share it.
        </h1>
        <p className="lead">
          Flowcraft turns plain sentences into clean flowcharts, mind maps and org charts. Perfect for study notes, project
          plans, processes and family trees — no design skills needed.
        </p>
        <div className="hero-cta">
          <Link to="/try" className="btn btn-primary btn-lg">
            Start drawing — it's free
          </Link>
          {user ? (
            <Link to="/app" className="btn btn-secondary btn-lg">
              My diagrams
            </Link>
          ) : (
            <Link to="/register" className="btn btn-secondary btn-lg">
              Create an account
            </Link>
          )}
        </div>
      </section>

      <section className="container demo card">
        <div className="demo-head">
          <strong>Try it right here — edit the text 👇</strong>
          <Segmented
            label="Diagram type"
            value={type}
            options={(Object.keys(TYPE_INFO) as DiagramType[]).map((t) => ({ value: t, label: `${TYPE_INFO[t].icon} ${TYPE_INFO[t].label}` }))}
            onChange={(t) => {
              setType(t);
              setSource(DEMOS[t]);
            }}
          />
        </div>
        <div className="demo-body">
          <textarea value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} aria-label="Demo diagram text" />
          <div className="demo-canvas">
            <DiagramCanvas graph={graph} type={type} direction="TB" theme={type === 'mindmap' ? 'ocean' : type === 'orgchart' ? 'grape' : 'sunset'} />
          </div>
        </div>
      </section>

      <section className="container features">
        {FEATURES.map(([icon, title, text]) => (
          <div key={title} className="feature">
            <div className="feature-icon">{icon}</div>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="container">
        <h2 className="section-title">Start from a template</h2>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <Link key={t.id} to={`/try?template=${t.id}`} className="template-card">
              <DiagramThumbnail type={t.type} source={t.source} theme={t.theme} direction={t.direction} />
              <strong>{t.name}</strong>
              <span className="muted small">
                {TYPE_INFO[t.type].icon} {t.description}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="container footer muted small">Flowcraft · built with MongoDB, Express, React &amp; Node.js</footer>
    </div>
  );
}
