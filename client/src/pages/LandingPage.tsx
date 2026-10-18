import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { GeneratedDiagram } from '../api/types';
import PromptBox from '../components/ai/PromptBox';
import DiagramCanvas from '../components/diagram/DiagramCanvas';
import { DiagramThumbnail } from '../components/diagram/DiagramThumbnail';
import MacBook from '../components/landing/MacBook';
import { Segmented } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { draftFromGenerated, guestDraft } from '../lib/draft';
import { parseDiagram } from '../lib/diagram/parse';
import { TEMPLATES, TYPE_INFO } from '../lib/diagram/templates';
import type { DiagramType, ThemeName } from '../lib/diagram/types';

/** The diagram types the MacBook demo can switch between. */
type DemoType = Extract<DiagramType, 'flowchart' | 'mindmap' | 'orgchart' | 'er'>;

const DEMOS: Record<DemoType, { source: string; theme: ThemeName }> = {
  flowchart: {
    theme: 'ocean',
    source: `Hungry? -> Cook at home: yes
Hungry? -> (Keep working): no
Cook at home -> Fridge full?
Fridge full? -> (Make pasta): yes
Fridge full? -> Order food: no`,
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
  er: {
    theme: 'ocean',
    source: `Student
  Roll no (key)
  Name
  Phone (multivalued)
Course
  Course id (key)
  Title
Student -- Takes -- Course: M:N`,
  },
};

const DEMO_OPTIONS = (Object.keys(DEMOS) as DemoType[]).map((t) => ({ value: t, label: TYPE_INFO[t].label }));

/** Bento order: the first tile is the large one (see .bento in styles/landing.css). */
const SHOWCASE: DiagramType[] = ['flowchart', 'mindmap', 'er', 'class', 'orgchart', 'usecase', 'sequence', 'state'];

const STEPS = [
  ['Describe it', 'Write what you want in plain words: a process, an idea, a database. Any language works.'],
  ['Flowcraft draws it', 'It picks the right diagram type and lays everything out neatly in a few seconds.'],
  ['Refine it', 'Ask for changes like “add a refund step”, drag boxes, switch colours or edit the text.'],
  ['Share it', 'Download a PNG or SVG, or send a link anyone can open.'],
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [type, setType] = useState<DemoType>('flowchart');
  const [source, setSource] = useState(DEMOS.flowchart.source);
  // The canvas measures itself on mount, so it waits until the MacBook has opened.
  const [opened, setOpened] = useState(false);
  const graph = useMemo(() => parseDiagram(type, source), [type, source]);

  async function openGenerated(diagram: GeneratedDiagram, prompt: string) {
    const draft = draftFromGenerated(diagram, prompt);
    if (user) {
      try {
        const saved = await diagramsApi.create(draft);
        navigate(`/d/${saved._id}`);
      } catch (err) {
        // Don't lose a generated diagram: open it in the editor, where it can be saved once the server answers.
        guestDraft.save(draft);
        toast(`Couldn't save it to your diagrams yet: ${(err as Error).message}. It's open in the editor.`, 'error');
        navigate('/try');
      }
    } else {
      // Guests continue in the playground; the draft is imported if they sign up.
      guestDraft.save(draft);
      navigate('/try');
    }
  }

  return (
    <div className="landing">
      <section className="hero container">
        <h1 className="hero-title">
          Describe it.
          <br />
          Get a diagram.
        </h1>
        <div className="hero-side">
          <p className="lead">Write what you want to explain. Flowcraft draws flowcharts, mind maps, ER and UML diagrams you can edit and share.</p>
          <PromptBox onGenerated={openGenerated} autoFocus />
        </div>
      </section>

      <section className="stage" aria-label="Live demo">
        <div className="stage-device">
          <MacBook
            onOpen={() => setOpened(true)}
            title="Untitled diagram"
            toolbar={
              <Segmented
                label="Diagram type"
                value={type}
                options={DEMO_OPTIONS}
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
        </div>
      </section>

      <section className="types container" id="types">
        <h2 className="section-title">Eight kinds of diagram. One way to write them.</h2>
        <p className="section-lead">Flowcharts and mind maps for ideas, ER and UML diagrams for software. Pick one, or let the AI choose.</p>
        <div className="bento">
          {SHOWCASE.map((t) => {
            const template = TEMPLATES.find((tpl) => tpl.type === t);
            if (!template) return null;
            return (
              <Link key={t} to={`/try?template=${template.id}`} className={`bento-tile tile-${t}`}>
                <div className="bento-visual">
                  <DiagramThumbnail type={template.type} source={template.source} theme={template.theme} direction={template.direction} />
                </div>
                <div className="bento-text">
                  <h3>{TYPE_INFO[t].label}</h3>
                  <p>{TYPE_INFO[t].hint}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="how container" id="how">
        <h2 className="section-title how-title">From a sentence to a diagram</h2>
        <ol className="steps">
          {STEPS.map(([title, text]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="closing container">
        <h2>Your next diagram is one sentence away.</h2>
        <Link to="/try" className="btn btn-primary btn-lg">
          Open editor
        </Link>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <span className="logo">Flowcraft</span>
          <a href="https://github.com/devansh-jagtap/Flowcraft">Source on GitHub</a>
        </div>
      </footer>
    </div>
  );
}
