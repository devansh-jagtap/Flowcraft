import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { SEQUENCE } from '../../lib/diagram/layoutSequence';
import { ActorFigure, Handles, type ShapeFlowNode } from './ShapeNode';

/** UML class: name compartment, then attributes, then methods. */
function ClassNodeComponent({ data }: NodeProps<ShapeFlowNode>) {
  const { node, theme } = data;
  const sections = node.compartments ?? [[], []];
  return (
    <div className="class-node" style={{ background: theme.step.bg, borderColor: theme.step.border, color: theme.step.fg }}>
      <Handles />
      <div className="class-header" style={{ background: theme.terminal.bg, color: theme.terminal.fg }}>
        {node.stereotype && <small>«{node.stereotype}»</small>}
        <strong className={node.stereotype === 'abstract' ? 'is-abstract' : undefined}>{node.label}</strong>
      </div>
      {sections.map((members, i) => (
        <ul key={i} className="class-section" style={{ borderColor: theme.step.border }}>
          {members.map((member, j) => (
            <li key={j} title={member}>
              {member}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/** Sequence participant: a header (box, stick figure or database) above a dashed lifeline. */
function ParticipantNodeComponent({ data }: NodeProps<ShapeFlowNode>) {
  const { node, theme } = data;
  const { bg, fg } = theme.terminal;
  return (
    <div className="participant-node">
      <Handles />
      <div className={`participant-head is-${node.variant ?? 'box'}`} style={{ height: SEQUENCE.header }}>
        {node.variant === 'actor' ? (
          <>
            <ActorFigure color={theme.edge} height={36} />
            <span style={{ color: theme.step.fg }}>{node.label}</span>
          </>
        ) : node.variant === 'database' ? (
          <>
            <svg className="database" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
              <path d="M2 10 C2 -1, 98 -1, 98 10 V50 C98 61, 2 61, 2 50 Z" fill={bg} />
              <path d="M2 10 C2 21, 98 21, 98 10" fill="none" stroke={fg} strokeOpacity="0.55" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <span style={{ color: fg }}>{node.label}</span>
          </>
        ) : (
          <span className="participant-box" style={{ background: bg, color: fg }}>
            {node.label}
          </span>
        )}
      </div>
      <div className="lifeline" style={{ borderColor: theme.edge }} />
    </div>
  );
}

/** Frames drawn behind other nodes: a use-case system boundary or a sequence fragment. */
function ContainerNodeComponent({ data }: NodeProps<ShapeFlowNode>) {
  const { node, theme, dividers = [] } = data;
  if (node.shape === 'boundary') {
    return (
      <div className="container-node is-boundary" style={{ borderColor: theme.edge, color: theme.step.fg }}>
        <Handles />
        <strong>{node.label}</strong>
      </div>
    );
  }
  return (
    <div className="container-node is-fragment" style={{ borderColor: theme.edge, color: theme.step.fg }}>
      <Handles />
      <div className="fragment-title">
        <span className="fragment-tab" style={{ background: theme.edge, color: theme.canvas }}>
          {node.subtitle}
        </span>
        {node.label && <span>[{node.label}]</span>}
      </div>
      {dividers.map((d, i) => (
        <div key={i} className="fragment-divider" style={{ top: d.y, borderColor: theme.edge }}>
          {d.label && <span>[{d.label}]</span>}
        </div>
      ))}
    </div>
  );
}

export const ClassNode = memo(ClassNodeComponent);
export const ParticipantNode = memo(ParticipantNodeComponent);
export const ContainerNode = memo(ContainerNodeComponent);
