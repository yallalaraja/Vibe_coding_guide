const docs = {
  zh: {
    label: "中文",
    path: "./vibe-coding-guide-zh.md",
    pdf: "./vibe-coding-guide-zh.pdf",
    title: "把 AI Coding 变成可复用的工程工作流。",
    summary:
      "从 spec、上下文、subagent、worktree、skill，到 CI、测试和审查习惯，帮你把 Agent 产出的代码管得住、交得出。",
    status: "中文教程",
    search: "搜索章节",
    top: "顶部",
    sections: "节",
    metrics: {
      chapters: "章",
      languages: "种语言",
      pdf: "已包含",
    },
  },
  en: {
    label: "EN",
    path: "./vibe-coding-guide-en.md",
    pdf: "./vibe-coding-guide-en.pdf",
    title: "Turn AI coding into a repeatable workflow.",
    summary:
      "Specs, context, subagents, worktrees, skills, CI, testing, and review habits for builders who want AI agents to produce work they can trust.",
    status: "English guide",
    search: "Search chapters",
    top: "Top",
    sections: "sections",
    metrics: {
      chapters: "chapters",
      languages: "languages",
      pdf: "included",
    },
  },
};

const state = {
  lang: "zh",
  headings: [],
  observer: null,
};

const els = {
  article: document.querySelector("#guide-content"),
  toc: document.querySelector("#toc-list"),
  search: document.querySelector("#toc-search"),
  status: document.querySelector("#doc-status"),
  progress: document.querySelector("#reading-progress"),
  pdf: document.querySelector("#pdf-link"),
  top: document.querySelector("#top-button"),
  heroTitle: document.querySelector(".reader-hero h1"),
  heroSummary: document.querySelector(".reader-summary"),
  metricChapters: document.querySelector("#metric-chapters"),
  metricLanguages: document.querySelector("#metric-languages"),
  metricPdf: document.querySelector("#metric-pdf"),
  langButtons: [...document.querySelectorAll("[data-lang]")],
};

function preferredLanguage() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("lang");

  if (requested && docs[requested]) return requested;
  if (window.location.hash === "#en" || window.location.hash === "#zh") {
    return window.location.hash.slice(1);
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function slugify(text, index) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[`"'’‘“”]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_.]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `section-${index + 1}`;
}

function setLanguageChrome(lang) {
  const doc = docs[lang];
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  els.heroTitle.textContent = doc.title;
  els.heroSummary.textContent = doc.summary;
  els.search.placeholder = doc.search;
  els.pdf.href = doc.pdf;
  els.top.querySelector("span").textContent = doc.top;
  els.metricChapters.innerHTML = `<strong>16</strong> ${doc.metrics.chapters}`;
  els.metricLanguages.innerHTML = `<strong>2</strong> ${doc.metrics.languages}`;
  els.metricPdf.innerHTML = `<strong>PDF</strong> ${doc.metrics.pdf}`;

  els.langButtons.forEach((button) => {
    const isActive = button.dataset.lang === lang;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

async function loadGuide(lang, shouldPushUrl = true) {
  state.lang = lang;
  setLanguageChrome(lang);
  els.article.classList.add("loading");
  els.article.innerHTML = "Loading guide...";
  els.status.textContent = `${docs[lang].status} · loading`;

  const response = await fetch(docs[lang].path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load ${docs[lang].path}`);
  }

  const markdown = await response.text();
  const rendered = marked.parse(markdown, {
    gfm: true,
  });

  els.article.innerHTML = DOMPurify.sanitize(rendered);
  els.article.classList.remove("loading");

  postProcessArticle();
  renderToc();
  observeHeadings();
  updateReadingProgress();
  window.lucide?.createIcons();

  els.status.textContent = `${docs[lang].status} · ${state.headings.filter((heading) => heading.depth === 2).length} ${docs[lang].sections}`;

  if (shouldPushUrl) {
    const params = new URLSearchParams(window.location.search);
    params.set("lang", lang);
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }
}

function postProcessArticle() {
  const headingCounts = new Map();
  state.headings = [...els.article.querySelectorAll("h1, h2, h3")].map((heading, index) => {
    const text = heading.textContent.trim();
    const base = slugify(text, index);
    const count = headingCounts.get(base) || 0;
    headingCounts.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    heading.id = id;

    return {
      id,
      text,
      depth: Number(heading.tagName.slice(1)),
      element: heading,
    };
  });

  els.article.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    if (href.endsWith("vibe-coding-guide-zh.md")) {
      link.setAttribute("href", "?lang=zh");
    } else if (href.endsWith("vibe-coding-guide-en.md")) {
      link.setAttribute("href", "?lang=en");
    } else if (/^https?:\/\//.test(href)) {
      link.target = "_blank";
      link.rel = "noreferrer";
    }
  });

  els.article.querySelectorAll("pre code.language-mermaid").forEach((code) => {
    const wrapper = document.createElement("div");
    wrapper.className = "mermaid";
    wrapper.textContent = code.textContent;
    code.closest("pre").replaceWith(wrapper);
  });

  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#d8ede8",
        primaryTextColor: "#1d2528",
        primaryBorderColor: "#0f766e",
        lineColor: "#6b665d",
        secondaryColor: "#edf4f2",
        tertiaryColor: "#f6faf8",
      },
    });
    mermaid.run({ querySelector: ".mermaid" });
  }
}

function renderToc() {
  const query = els.search.value.trim().toLowerCase();
  els.toc.innerHTML = "";

  state.headings
    .filter((heading) => heading.depth === 2 || heading.depth === 3)
    .forEach((heading) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.className = `depth-${heading.depth}`;
      link.textContent = heading.text;

      if (query && !heading.text.toLowerCase().includes(query)) {
        item.classList.add("is-hidden");
      }

      item.append(link);
      els.toc.append(item);
    });
}

function observeHeadings() {
  state.observer?.disconnect();
  const links = new Map([...els.toc.querySelectorAll("a")].map((link) => [link.hash.slice(1), link]));

  state.observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = links.get(entry.target.id);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach((candidate) => candidate.classList.remove("is-active"));
          link.classList.add("is-active");
        }
      });
    },
    {
      rootMargin: "-18% 0px -72% 0px",
      threshold: 0,
    },
  );

  state.headings.forEach((heading) => state.observer.observe(heading.element));
}

function updateReadingProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const progress = max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0;
  els.progress.style.width = `${progress}%`;
}

els.langButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const lang = button.dataset.lang;
    if (lang && docs[lang] && lang !== state.lang) {
      loadGuide(lang).catch(showError);
    }
  });
});

els.search.addEventListener("input", renderToc);
els.top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
window.addEventListener("scroll", updateReadingProgress, { passive: true });
window.addEventListener("resize", updateReadingProgress);

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;
  const href = link.getAttribute("href");
  if (href !== "?lang=zh" && href !== "?lang=en") return;
  event.preventDefault();
  const lang = new URL(link.href).searchParams.get("lang");
  loadGuide(lang).catch(showError);
});

function showError(error) {
  console.error(error);
  els.status.textContent = "Could not load guide";
  els.article.classList.remove("loading");
  els.article.innerHTML = `<h1>Could not load guide</h1><p>${error.message}</p>`;
}

loadGuide(preferredLanguage(), false).catch(showError);
