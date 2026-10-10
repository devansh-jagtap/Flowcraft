import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { GeneratedDiagram } from '../api/types';
import DiagramCanvas from '../components/diagram/DiagramCanvas';
import { DiagramThumbnail } from '../components/diagram/DiagramThumbnail';
import PromptBox from '../components/PromptBox';
import { Segmented } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { draftFromGenerated, guestDraft } from '../lib/draft';
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

const STEPS = [
  ['💬', 'Describe it', 'Write what you want in plain words — a process, an idea, a team. Any language.'],
  ['✨', 'AI draws it', 'Flowcraft picks the right diagram type and lays it out neatly in seconds.'],
  ['🛠️', 'Refine it', 'Ask for changes like “add a refund step”, drag boxes, change colours, or edit the text.'],
  ['🔗', 'Share it', 'Download PNG/SVG or send a link anyone can open.'],
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<DiagramType>('flowchart');
  const [source, setSource] = useState(DEMOS.flowchart);
  const graph = useMemo(() => parseDiagram(type, source), [type, source]);

  async function openGenerated(diagram: GeneratedDiagram, prompt: string) {
    const draft = draftFromGenerated(diagram, prompt);
    if (user) {
      const saved = await diagramsApi.create(draft);
      navigate(`/d/${saved._id}`);
    } else {
      // Guests continue in the playground; the draft is imported if they sign up.
      guestDraft.save(draft);
      navigate('/try');
    }
  }

  return (
    <div className="landing">
      <section className="hero container">
        <span className="eyebrow">✨ AI diagram generator</span>
        <h1>
          Describe it. <span className="gradient-text">Get a diagram.</span>
        </h1>
        <p className="lead">
          Type what you want to explain — a process, a plan, a team — and Flowcraft's AI draws a clean flowchart, mind map or
          org chart you can edit, share and download.
        </p>
        <PromptBox onGenerated={openGenerated} autoFocus />
        <p className="muted small hero-alt">
          No account needed · <Link to="/try?template=morning-routine">or start from a template</Link>
        </p>
      </section>

      <section className="container steps">
        {STEPS.map(([icon, title, text], i) => (
          <div key={title} className="step">
            <div className="feature-icon">{icon}</div>
            <span className="step-number">Step {i + 1}</span>
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="container demo card">
        <div className="demo-head">
          <div>
            <strong>Prefer typing it yourself?</strong>
            <p className="muted small">Every diagram is backed by simple text — edit it and watch the diagram update live.</p>
          </div>
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

      <section className="container templates-section">
        <h2 className="section-title">Or start from a template</h2>
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

      <footer className="container footer muted small">Flowcraft · built with MongoDB, Express, React, Node.js &amp; Google Gemini</footer>
    </div>
  );
}
