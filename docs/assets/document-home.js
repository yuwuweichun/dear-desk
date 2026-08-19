(() => {
  const loader = document.currentScript;
  if (!loader) return;

  const homeHref = new URL("../index.html", loader.src).href;
  const elementName = "docs-home-navigation";

  if (!customElements.get(elementName)) {
    customElements.define(
      elementName,
      class extends HTMLElement {
        connectedCallback() {
          if (this.shadowRoot) return;

          const shadow = this.attachShadow({ mode: "open" });
          const link = document.createElement("a");
          link.href = this.getAttribute("href") || homeHref;
          link.rel = "home";
          link.setAttribute("aria-label", "返回文档首页");
          link.innerHTML = '<span aria-hidden="true">←</span><span>文档首页</span>';

          const style = document.createElement("style");
          style.textContent = `
            :host {
              position: fixed;
              right: 16px;
              bottom: max(16px, env(safe-area-inset-bottom));
              z-index: 2147483000;
              display: block;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            }
            a {
              display: inline-flex;
              min-height: 44px;
              align-items: center;
              gap: 8px;
              padding: 0 14px;
              border: 1px solid #ffb0cf;
              border-radius: 6px;
              background: #ff6da8;
              color: #0c0a0b;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
              font-size: 14px;
              font-weight: 700;
              line-height: 1;
              letter-spacing: 0;
              text-decoration: none;
              transition: background-color 150ms ease, border-color 150ms ease;
            }
            a:hover {
              border-color: #ffd0e2;
              background: #ff8fba;
            }
            a:focus-visible {
              outline: 3px solid #ffffff;
              outline-offset: 3px;
            }
            @media (max-width: 580px) {
              :host {
                right: 12px;
                bottom: max(12px, env(safe-area-inset-bottom));
              }
            }
            @media (prefers-reduced-motion: reduce) {
              a { transition: none; }
            }
          `;

          shadow.append(style, link);
        }
      },
    );
  }

  const mount = () => {
    if (document.querySelector(elementName)) return;
    const navigation = document.createElement(elementName);
    navigation.setAttribute("href", homeHref);
    document.body.append(navigation);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
