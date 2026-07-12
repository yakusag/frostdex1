const FROSTDEX_BRAND_HTML = `
  <a href="https://frostdex.pw" target="_blank" rel="noopener noreferrer"
     style="display:flex;justify-content:center;align-items:center;gap:6px;padding:0.75rem;text-decoration:none;color:rgba(56,224,248,0.7);font-size:11px;font-weight:600;letter-spacing:1px;">
    powered by
    <span style="background:linear-gradient(90deg,#38e0f8,#0ecb81);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:800;">FrostDex</span>
  </a>
`;

function patchShadowRoot(root: ShadowRoot) {
  const style = document.createElement("style");
  style.textContent = `
    .powered-by-container { display: none !important; }
    a[href*="thirdweb"] { display: none !important; }
  `;
  root.appendChild(style);

  const inject = () => {
    const existing = root.querySelector(".powered-by-container");
    if (existing) {
      const parent = existing.parentElement;
      if (parent && !parent.querySelector("#frostdex-brand")) {
        existing.style.display = "none";
        const brand = document.createElement("div");
        brand.id = "frostdex-brand";
        brand.innerHTML = FROSTDEX_BRAND_HTML;
        parent.appendChild(brand);
      }
    }
  };

  inject();

  const obs = new MutationObserver(inject);
  obs.observe(root, { childList: true, subtree: true });
}

function watchOnboardElement() {
  const tryPatch = (el: Element) => {
    if (el.shadowRoot) {
      patchShadowRoot(el.shadowRoot);
    } else {
      const interval = setInterval(() => {
        if (el.shadowRoot) {
          clearInterval(interval);
          patchShadowRoot(el.shadowRoot);
        }
      }, 50);
      setTimeout(() => clearInterval(interval), 5000);
    }
  };

  const existing = document.querySelector("onboard-v2");
  if (existing) tryPatch(existing);

  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          if (node.tagName?.toLowerCase() === "onboard-v2") tryPatch(node);
          const inner = node.querySelector?.("onboard-v2");
          if (inner) tryPatch(inner);
        }
      });
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
}

export function initOnboardBrandingPatch() {
  if (typeof window === "undefined") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchOnboardElement, { once: true });
  } else {
    watchOnboardElement();
  }
}
