import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { GeneratedDiagram } from '../api/types';
import DiagramCanvas from '../components/diagram/DiagramCanvas';
import { DiagramThumbnail } from '../components/diagram/DiagramThumbnail';
import MacBook from '../components/landing/MacBook';
import PromptBox from '../components/ai/PromptBox';
import { Segmented } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { draftFromGenerated, guestDraft } from '../lib/draft';
import { parseDiagram } from '../lib/diagram/parse';
import { TEMPLATES, TYPE_INFO } from '../lib/diagram/templates';
import type { DiagramType, ThemeName } from '../lib/diagram/types';

const DEMOS: Record<DiagramType, { source: string; theme: ThemeName }> = {
  flowchart: {
    theme: 'ocean',
    source: `Hungry? -> Cook at home: yes
Hungry? -> (Keep working): no
Cook at home -> Ingredients in fridge?
Ingredients in fridge? -> (Make pasta): yes
Ingredients in fridge? -> Order food: no`,
  },
  mindmap: {
    theme: 'forest',
    source: `Learn to code
  Basics
    HTML & CSS
    JavaScript
  Projects
    Portfolio site
    Todo app
  Practice
    30 min daily`,
  },
  orgchart: {
    theme: 'grape',
    source: `Mom & Dad: Parents
  Aarav: Engineer
  Diya: Doctor
    Kiara: Baby`,
  },
};

const STEPS = [
  ['Describe it', 'Write what you want in plain words: a process, an idea, a team. Any language works.'],
  ['Flowcraft draws it', 'It picks the right diagram type and lays it out neatly in a few seconds.'],
  ['Refine it', 'Ask for changes like “add a refund step”, drag boxes, change colours or edit the text.'],
  ['Share it', 'Download a PNG or SVG, or send a link anyone can open.'],
];

const TYPE_OPTIONS = (Object.keys(TYPE_INFO) as DiagramType[]).map((t) => ({ value: t, label: TYPE_INFO[t].label }));

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<DiagramType>('flowchart');
  const [source, setSource] = useState(DEMOS.flowchart.source);
  // The canvas measures itself on mount, so wait until the MacBook has finished opening.
  const [opened, setOpened] = useState(false);
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
        <div className="hero-copy">
          <h1>
            Describe it.
            <br />
            Get a diagram.
          </h1>
          <p className="lead">Write what you want to explain. Flowcraft draws a flowchart, mind map or org chart you can edit and share.</p>
          <PromptBox onGenerated={openGenerated} autoFocus />
          <p className="muted small hero-alt">
            No account needed. <Link to="/try?template=morning-routine">Start from a template</Link> instead.
          </p>
        </div>

        <div className="hero-device">
          <MacBook
            onOpen={() => setOpened(true)}
            title="Untitled diagram"
            toolbar={
              <Segmented
                label="Diagram type"
                value={type}
                options={TYPE_OPTIONS}
                onChange={(t) => {
                  setType(t);
                  setSource(DEMOS[t].source);
                }}
              />
            }
          >
            <textarea value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} aria-label="Demo diagram text" />
            <div className="mac-canvas">{opened && <DiagramCanvas graph={graph} type={type} direction="TB" theme={DEMOS[type].theme} />}</div>
          </MacBook>
          <p className="muted small device-caption">Every diagram is plain text underneath. Edit the text on the left and the diagram follows.</p>
        </div>
      </section>

      <section className="how container">
        <h2 className="section-title">From a sentence to a diagram</h2>
        <ol className="steps">
          {STEPS.map(([title, text]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p className="muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="templates-section">
        <div className="container">
          <h2 className="section-title">Start from a template</h2>
        </div>
        <div className="gallery">
          {TEMPLATES.map((t) => (
            <Link key={t.id} to={`/try?template=${t.id}`} className="template-card">
              <DiagramThumbnail type={t.type} source={t.source} theme={t.theme} direction={t.direction} />
              <strong>{t.name}</strong>
              <span className="muted small">{t.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="container muted small">Flowcraft is built with MongoDB, Express, React, Node.js and Google Gemini.</div>
      </footer>
    </div>
  );
}
