import { useEffect, useRef, useState, type ReactNode, type TransitionEvent } from 'react';

interface Props {
  /** Shown in the middle of the window's title bar. */
  title: string;
  /** Controls on the right of the title bar. */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Called once the lid is open and the window has appeared (straight away with reduced motion). */
  onOpen?: () => void;
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A MacBook drawn in CSS. Its screen shows a macOS desktop with one app window holding `children`.
 * The lid opens the first time it scrolls into view, then the window appears.
 */
export default function MacBook({ title, toolbar, children, onOpen }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const openedRef = useRef(false);

  const notifyOpen = () => {
    if (openedRef.current) return;
    openedRef.current = true;
    onOpenRef.current?.();
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      if (!openedRef.current) {
        openedRef.current = true;
        onOpenRef.current?.();
      }
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // transitionend can be skipped (an interrupted transition, a background tab), so also
  // report "open" once the lid and window would have finished: 1.1s delay + 0.7s.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (openedRef.current) return;
      openedRef.current = true;
      onOpenRef.current?.();
    }, 1900);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleTransitionEnd = (e: TransitionEvent) => {
    if (e.target === e.currentTarget && e.propertyName === 'opacity') notifyOpen();
  };

  return (
    <figure className={`macbook${visible ? ' is-visible' : ''}`} ref={rootRef}>
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
          <div className="mac-window" onTransitionEnd={handleTransitionEnd}>
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
