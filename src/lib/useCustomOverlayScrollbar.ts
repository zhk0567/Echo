import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';

const IDLE_DELAY_MS = 700;
const FADE_MS = 480;
const SCROLLBAR_GUTTER_PX = 14;
const MIN_THUMB_HEIGHT = 40;

export interface OverlayScrollbarMetrics {
  visible: boolean;
  fading: boolean;
  showTrack: boolean;
  thumbTop: number;
  thumbHeight: number;
}

const HIDDEN_METRICS: OverlayScrollbarMetrics = {
  visible: false,
  fading: false,
  showTrack: false,
  thumbTop: 0,
  thumbHeight: 0,
};

function computeMetrics(el: HTMLElement): Omit<OverlayScrollbarMetrics, 'visible' | 'fading'> {
  const { scrollHeight, clientHeight, scrollTop } = el;
  if (scrollHeight <= clientHeight + 1) {
    return { showTrack: false, thumbTop: 0, thumbHeight: 0 };
  }

  const trackHeight = clientHeight;
  const thumbHeight = Math.min(
    trackHeight,
    Math.max(MIN_THUMB_HEIGHT, (clientHeight / scrollHeight) * trackHeight),
  );
  const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
  const scrollRange = scrollHeight - clientHeight;
  const scrollRatio = scrollRange > 0 ? scrollTop / scrollRange : 0;
  const thumbTop = maxThumbTop * scrollRatio;

  return { showTrack: true, thumbTop, thumbHeight };
}

export function useCustomOverlayScrollbar(
  scrollRef: RefObject<HTMLElement | null>,
  enabled = true,
  syncKey?: unknown,
  gutterRef?: RefObject<HTMLElement | null>,
): {
  metrics: OverlayScrollbarMetrics;
  onThumbMouseDown: (e: React.MouseEvent) => void;
} {
  const [metrics, setMetrics] = useState<OverlayScrollbarMetrics>(HIDDEN_METRICS);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pointerInGutterRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ y: 0, scrollTop: 0, thumbTop: 0, trackHeight: 0, thumbHeight: 0 });

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    idleTimerRef.current = undefined;
    fadeTimerRef.current = undefined;
  }, []);

  const syncLayout = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const layout = computeMetrics(el);
    setMetrics((prev) => ({
      ...prev,
      ...layout,
      visible: layout.showTrack ? prev.visible : false,
      fading: layout.showTrack ? prev.fading : false,
    }));
  }, [scrollRef]);

  const show = useCallback(() => {
    clearTimers();
    const el = scrollRef.current;
    if (!el) return;
    const layout = computeMetrics(el);
    if (!layout.showTrack) return;
    setMetrics({ ...layout, visible: true, fading: false });
  }, [clearTimers, scrollRef]);

  const startFade = useCallback(() => {
    if (pointerInGutterRef.current || draggingRef.current) return;
    if (!metricsRef.current.visible) return;
    setMetrics((prev) => ({ ...prev, fading: true }));
    fadeTimerRef.current = setTimeout(() => {
      setMetrics((prev) => ({ ...prev, visible: false, fading: false }));
    }, FADE_MS);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimers();
    idleTimerRef.current = setTimeout(startFade, IDLE_DELAY_MS);
  }, [clearTimers, startFade]);

  useEffect(() => {
    if (!enabled) {
      setMetrics(HIDDEN_METRICS);
      return;
    }

    const el = scrollRef.current;
    const gutterEl = gutterRef?.current ?? el;
    if (!el || !gutterEl) return;

    const isInGutter = (clientX: number) => {
      const rect = gutterEl.getBoundingClientRect();
      return clientX >= rect.right - SCROLLBAR_GUTTER_PX;
    };

    const onScroll = () => {
      syncLayout();
      show();
      scheduleHide();
    };

    const onWheel = () => {
      show();
      scheduleHide();
    };

    const onMouseMove = (e: MouseEvent) => {
      const inGutter = isInGutter(e.clientX);
      if (inGutter) {
        if (!pointerInGutterRef.current) {
          pointerInGutterRef.current = true;
          show();
        }
        return;
      }
      if (pointerInGutterRef.current) {
        pointerInGutterRef.current = false;
        if (!draggingRef.current) scheduleHide();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!isInGutter(e.clientX)) return;
      show();
    };

    const onMouseLeave = () => {
      pointerInGutterRef.current = false;
      if (!draggingRef.current) scheduleHide();
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !scrollRef.current) return;
      const { y, scrollTop, trackHeight, thumbHeight } = dragStartRef.current;
      const deltaY = e.clientY - y;
      const maxThumbTop = trackHeight - thumbHeight;
      const scrollRange = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
      if (maxThumbTop <= 0 || scrollRange <= 0) return;
      const nextScrollTop = scrollTop + (deltaY / maxThumbTop) * scrollRange;
      scrollRef.current.scrollTop = Math.max(0, Math.min(scrollRange, nextScrollTop));
      syncLayout();
    };

    const onWindowMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      scheduleHide();
    };

    syncLayout();
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    gutterEl.addEventListener('mousemove', onMouseMove);
    gutterEl.addEventListener('mousedown', onMouseDown);
    gutterEl.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncLayout) : null;
    ro?.observe(el);

    return () => {
      clearTimers();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      gutterEl.removeEventListener('mousemove', onMouseMove);
      gutterEl.removeEventListener('mousedown', onMouseDown);
      gutterEl.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      ro?.disconnect();
    };
  }, [enabled, scrollRef, gutterRef, syncLayout, show, scheduleHide, clearTimers]);

  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => syncLayout());
    return () => cancelAnimationFrame(frame);
  }, [syncKey, enabled, syncLayout]);

  const onThumbMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      const el = scrollRef.current;
      if (!el) return;
      draggingRef.current = true;
      pointerInGutterRef.current = true;
      show();
      dragStartRef.current = {
        y: e.clientY,
        scrollTop: el.scrollTop,
        thumbTop: metricsRef.current.thumbTop,
        trackHeight: el.clientHeight,
        thumbHeight: metricsRef.current.thumbHeight,
      };
    },
    [scrollRef, show],
  );

  return { metrics, onThumbMouseDown };
}
