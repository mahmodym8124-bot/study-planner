import gsap from 'gsap';

// Detect accessibility and pointer capabilities
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(pointer: coarse)').matches;

/**
 * Initializes global click and hover feedback using event delegation.
 * Leverages GSAP quickTo for peak frame rates (sub-millisecond execution).
 */
export function initGlobalInteractions() {
  if (prefersReducedMotion) return;

  const selector = 'button, a, [role="button"], .btn, .icon-button, .side-link, .bottom-nav-item, .task-line, .idea-row, .lang-option, .todo-check, [data-open-idea], [data-edit-note], [data-delete-note], [data-toggle-todo], [data-delete-todo]';

  // Global Mouse Hover Delegation (Desktop only to prevent sticky touch hover on mobile)
  if (!isMobile) {
    document.body.addEventListener('mouseover', (e) => {
      const el = e.target.closest(selector);
      if (!el) return;

      // Skip elements that explicitly disable motion or are inactive
      if (el.disabled || el.classList.contains('disabled')) return;

      // Initialize quickTo properties if they don't exist on the DOM element (increased duration to 0.35s for luxury feel)
      if (!el._gsapHoverScaleX) {
        el._gsapHoverScaleX = gsap.quickTo(el, 'scaleX', { duration: 0.35, ease: 'power2.out' });
      }
      if (!el._gsapHoverScaleY) {
        el._gsapHoverScaleY = gsap.quickTo(el, 'scaleY', { duration: 0.35, ease: 'power2.out' });
      }
      if (!el._gsapHoverY) {
        el._gsapHoverY = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power2.out' });
      }

      el._gsapHoverScaleX(1.02);
      el._gsapHoverScaleY(1.02);
      el._gsapHoverY(-3);
    });

    document.body.addEventListener('mouseout', (e) => {
      const el = e.target.closest(selector);
      if (!el) return;

      if (el._gsapHoverScaleX) el._gsapHoverScaleX(1);
      if (el._gsapHoverScaleY) el._gsapHoverScaleY(1);
      if (el._gsapHoverY) el._gsapHoverY(0);
    });
  }

  // Global Active/Click Squish Delegation (Desktop and Mobile)
  const activeEvents = {
    start: isMobile ? ['touchstart'] : ['mousedown'],
    end: isMobile ? ['touchend', 'touchcancel'] : ['mouseup', 'mouseleave']
  };

  activeEvents.start.forEach((eventType) => {
    document.body.addEventListener(eventType, (e) => {
      const el = e.target.closest(selector);
      if (!el) return;

      if (el.disabled || el.classList.contains('disabled')) return;

      if (!el._gsapClickScaleX) {
        el._gsapClickScaleX = gsap.quickTo(el, 'scaleX', { duration: 0.2, ease: 'power2.out' });
      }
      if (!el._gsapClickScaleY) {
        el._gsapClickScaleY = gsap.quickTo(el, 'scaleY', { duration: 0.2, ease: 'power2.out' });
      }
      el._gsapClickScaleX(0.97);
      el._gsapClickScaleY(0.97);
    });
  });

  activeEvents.end.forEach((eventType) => {
    document.body.addEventListener(eventType, (e) => {
      const el = e.target.closest(selector);
      if (!el) return;

      if (el._gsapClickScaleX && el._gsapClickScaleY) {
        // Return to hover state (1.02) if mouse is still hovering on desktop, else return to normal (1)
        const isStillHovered = !isMobile && el.matches(':hover');
        const targetScale = isStillHovered ? 1.02 : 1.0;
        el._gsapClickScaleX(targetScale);
        el._gsapClickScaleY(targetScale);
      }
    });
  });
}

/**
 * Executes a page/view transition. Fades out the old view, renders the new view,
 * then slides and fades in the new content.
 * 
 * @param {HTMLElement} container The DOM element being updated (e.g., #view-root)
 * @param {Function} renderCallback The synchronous callback that updates the DOM content
 */
export function animatePageTransition(container, renderCallback) {
  if (!container) return renderCallback();

  if (prefersReducedMotion) {
    renderCallback();
    staggerEntrance(container);
    return;
  }

  // Safe cleanup of any active tweens on the view container itself
  gsap.killTweensOf(container);

  // Stash skeleton tracker if there was one
  if (container._skeletonPulseCleanup) {
    container._skeletonPulseCleanup();
    container._skeletonPulseCleanup = null;
  }

  gsap.to(container, {
    opacity: 0,
    y: -8,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      // 1. Render the new DOM layout
      renderCallback();

      // 2. Scan for and animate skeleton loaders
      container._skeletonPulseCleanup = animateSkeletons(container);

      // 3. Set up starting position for slide and fade-in
      const slideDist = isMobile ? 12 : 20;
      gsap.set(container, { opacity: 0, y: slideDist });

      // 4. Smooth slide and fade-in transition
      gsap.to(container, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: 'power2.out',
        onComplete: () => {
          // If skeletons are resolved, fire the stagger card entrances!
          const hasActiveSkeletons = container.querySelectorAll('.skeleton').length > 0;
          if (!hasActiveSkeletons) {
            staggerEntrance(container);
          }
        }
      });
    }
  });
}

/**
 * Staggers entrance of card-like elements on view load or content insertion.
 * 
 * @param {HTMLElement} container The container containing elements to animate
 */
export function staggerEntrance(container) {
  if (!container || prefersReducedMotion) return;

  const selector = '.card, .note-card, .idea-card, .stat-card, .timeline-item, .todo, .mini-stat, .feature, .lane';
  const targets = container.querySelectorAll(selector);
  if (targets.length === 0) return;

  // Clean up existing tweens on targets to avoid conflicts
  gsap.killTweensOf(targets);

  const slideY = isMobile ? 15 : 30;
  const staggerVal = isMobile ? 0.05 : 0.08;
  const durationVal = isMobile ? 0.45 : 0.6;

  gsap.fromTo(targets,
    { opacity: 0, y: slideY },
    {
      opacity: 1,
      y: 0,
      duration: durationVal,
      stagger: staggerVal,
      ease: 'power2.out',
      clearProps: 'transform,opacity' // Return styles to CSS so hover filters/transforms work
    }
  );
}

/**
 * Searches for and pulses loading placeholder skeleton blocks.
 * 
 * @param {HTMLElement} container Parent container of skeleton nodes
 * @returns {Function|null} Cleanup function to stop pulsing immediately
 */
export function animateSkeletons(container) {
  if (!container || prefersReducedMotion) return null;

  const skeletons = container.querySelectorAll('.skeleton');
  if (skeletons.length === 0) return null;

  const ctx = gsap.context(() => {
    gsap.fromTo(skeletons,
      { opacity: 0.4 },
      {
        opacity: 1,
        duration: 0.8,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut'
      }
    );
  }, container);

  return () => ctx.revert();
}

/**
 * Animates the opening of the responsive sidebar menu overlay.
 * 
 * @param {HTMLElement} sidebar The sidebar panel
 * @param {HTMLElement} scrim The background darken backdrop
 */
export function openSidebarAnimation(sidebar, scrim) {
  if (!sidebar || !scrim) return;

  // Kill concurrent toggles
  gsap.killTweensOf([sidebar, scrim]);

  sidebar.classList.add('open');
  scrim.classList.add('open');

  if (prefersReducedMotion) {
    sidebar.style.transform = 'none';
    scrim.style.display = 'block';
    scrim.style.opacity = '0.5';
    return;
  }

  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
  const startX = isRTL ? '105%' : '-105%';

  // 1. Scrim fade in
  scrim.style.display = 'block';
  gsap.fromTo(scrim, { opacity: 0 }, { opacity: 0.5, duration: 0.35, ease: 'power2.out' });

  // 2. Sidebar slide in
  gsap.fromTo(sidebar,
    { x: startX },
    { x: '0%', duration: 0.45, ease: 'power2.inOut' }
  );

  // 3. Menu items stagger fade in
  const items = sidebar.querySelectorAll('.side-link, .sidebar-footer > *');
  if (items.length > 0) {
    gsap.killTweensOf(items);
    gsap.fromTo(items,
      { opacity: 0, x: isRTL ? 15 : -15 },
      { opacity: 1, x: 0, duration: 0.45, stagger: 0.04, ease: 'power2.out', delay: 0.05 }
    );
  }
}

/**
 * Animates the closing of the responsive sidebar menu overlay.
 * 
 * @param {HTMLElement} sidebar The sidebar panel
 * @param {HTMLElement} scrim The background darken backdrop
 * @param {Function} onComplete Callback to execute after animation completes
 */
export function closeSidebarAnimation(sidebar, scrim, onComplete) {
  if (!sidebar || !scrim) {
    if (onComplete) onComplete();
    return;
  }

  gsap.killTweensOf([sidebar, scrim]);

  if (prefersReducedMotion) {
    sidebar.classList.remove('open');
    scrim.classList.remove('open');
    sidebar.style.transform = '';
    scrim.style.display = 'none';
    if (onComplete) onComplete();
    return;
  }

  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
  const endX = isRTL ? '105%' : '-105%';

  // 1. Fade out scrim
  gsap.to(scrim, {
    opacity: 0,
    duration: 0.35,
    ease: 'power2.in',
    onComplete: () => {
      scrim.classList.remove('open');
      scrim.style.display = 'none';
    }
  });

  // 2. Slide out sidebar
  gsap.to(sidebar, {
    x: endX,
    duration: 0.45,
    ease: 'power2.inOut',
    onComplete: () => {
      sidebar.classList.remove('open');
      // Reset inline x style so responsive desktop css continues functioning correctly
      gsap.set(sidebar, { clearProps: 'transform' });
      if (onComplete) onComplete();
    }
  });
}
