import { useEffect, useRef, type AnimationEvent, type ReactNode } from 'react';

interface Props {
  /** Shown in the middle of the window's title bar. */
  title: string;
  /** Controls on the right of the title bar. */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Called once the opening animation has finished (or straight away with reduced motion). */
  onOpen?: () => void;
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A MacBook drawn in CSS. Its screen shows a macOS desktop with one app window holding `children`. */
export default function MacBook({ title, toolbar, children, onOpen }: Props) {
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  // With reduced motion there is no animation to wait for.
  useEffect(() => {
    if (prefersReducedMotion()) onOpenRef.current?.();
  }, []);

  const handleAnimationEnd = (e: AnimationEvent) => {
    if (e.target === e.currentTarget) onOpen?.();
  };

  return (
    <figure className="macbook">
      <div className="macbook-lid">
        <span className="macbook-notch" aria-hidden />
        <div className="macbook-screen">
          <div className="mac-menubar" aria-hidden>
            <strong>Flowcraft</strong>
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Window</span>
          </div>
          <div className="mac-window" onAnimationEnd={handleAnimationEnd}>
            <div className="mac-titlebar">
              <span className="traffic" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="mac-title">{title}</span>
              <div className="mac-toolbar">{toolbar}</div>
            </div>
            <div className="mac-window-body">{children}</div>
          </div>
        </div>
      </div>
      <div className="macbook-base" aria-hidden />
    </figure>
  );
}
