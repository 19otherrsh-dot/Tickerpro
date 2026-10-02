import styles from "./page.module.css";

const features = [
  { title: "Open Source & Self-Hostable", description: "Run the whole platform in your own cloud. Your customer data never leaves your infrastructure.", icon: "🔓", color: "linear-gradient(135deg, #6366F1, #818CF8)", badge: "Only on TickerPro" },
  { title: "Local-LLM AI (No Token Fees)", description: "Copilot, auto-replies, and sentiment run on your own Ollama model — zero per-message AI cost.", icon: "✨", color: "linear-gradient(135deg, #8B5CF6, #A78BFA)", badge: "Only on TickerPro" },
  { title: "Shop by Photo", description: "A customer sends a product photo — AI matches it to your catalog and adds it to their cart.", icon: "📸", color: "linear-gradient(135deg, #EC4899, #F472B6)", badge: "AI Commerce" },
  { title: "True Omnichannel Inbox", description: "WhatsApp, Instagram DMs, and Messenger in one shared team inbox with smart auto-routing.", icon: "📥", color: "linear-gradient(135deg, #3B82F6, #60A5FA)" },
  { title: "Visual Bot Studio", description: "Drag-and-drop flow builder — triggers, conditions, AI replies, API calls, human handoff.", icon: "🤖", color: "linear-gradient(135deg, #10B981, #34D399)" },
  { title: "Broadcasts with A/B Testing", description: "Split audiences between template variants and let the winner win. No competitor offers this.", icon: "📢", color: "linear-gradient(135deg, #F59E0B, #FBBF24)", badge: "Differentiator" },
  { title: "Commerce Built In", description: "Shopify + WooCommerce sync, catalog orders, in-chat Stripe/Razorpay payments, cart recovery.", icon: "🛒", color: "linear-gradient(135deg, #14B8A6, #2DD4BF)" },
  { title: "Fair, Transparent Billing", description: "Per-conversation credits at Meta's real cost — no hidden per-message markup like the others.", icon: "💰", color: "linear-gradient(135deg, #EF4444, #F87171)", badge: "Differentiator" },
  { title: "Enterprise Governance", description: "Role-based access (5 roles), searchable audit logs, and signed outbound webhooks.", icon: "🔒", color: "linear-gradient(135deg, #0EA5E9, #38BDF8)" },
];

const plans = [
  {
    name: "Open Source",
    price: "Free",
    cadence: "self-hosted, forever",
    description: "The full platform, MIT-licensed. Run it on your own infrastructure.",
    features: ["All core features", "Unlimited agents & numbers", "Local-LLM AI included", "Community support"],
    cta: "View on GitHub",
    href: "https://github.com/your-org/tickerpro",
    highlight: false,
  },
  {
    name: "Cloud Starter",
    price: "$29",
    cadence: "per month",
    description: "Managed hosting for small teams who don't want to run infrastructure.",
    features: ["1 WhatsApp number", "Up to 3 agents", "AI copilot & sentiment", "Email support"],
    cta: "Start Free Trial",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Cloud Growth",
    price: "$99",
    cadence: "per month",
    description: "For growing brands running marketing and support at scale.",
    features: ["Multi-number & omnichannel", "A/B broadcasts + drips", "Commerce + Shop-by-Photo", "Priority support"],
    cta: "Start Free Trial",
    href: "/signup",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    description: "Data residency, SSO, and a dedicated success manager.",
    features: ["Self-host or private cloud", "SSO + custom RBAC", "SLA & dedicated support", "Onboarding & migration"],
    cta: "Talk to Sales",
    href: "/signup",
    highlight: false,
  },
];

export default function HomePage() {
  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="8" fill="url(#grad)" />
                <path d="M8 14.5L12 18.5L20 10.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 11.5L15 15.5L23 7.5" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <defs><linearGradient id="grad" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#25D366" /></linearGradient></defs>
              </svg>
            </div>
            <span className={styles.logoText}>TickerPro</span>
          </div>
          <div className={styles.navLinks}><a href="#features">Features</a><a href="#why">Why us</a><a href="#pricing">Pricing</a></div>
          <div className={styles.navActions}>
            <a href="/login" className={styles.btnSecondary}>Log In</a>
            <a href="/signup" className={styles.btnPrimary}>Start Free Trial</a>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBg}><div className={styles.heroGlow1} /><div className={styles.heroGlow2} /></div>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}><span className={styles.badgeDot} />Open-source WhatsApp CRM · Now in beta</div>
          <h1 className={styles.heroTitle}>The <span className="tp-gradient-text">open-source</span> WhatsApp<br />platform you can actually own</h1>
          <p className={styles.heroSubtitle}>AI copilot, omnichannel inbox, and marketing automation — self-hostable, with local-LLM AI that costs nothing per message and keeps customer data in your own cloud.</p>
          <div className={styles.heroActions}>
            <a href="/signup" className={styles.btnPrimaryLg}>Start Free Trial →</a>
            <a href="#pricing" className={styles.btnGhost}>See Pricing</a>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}><span className={styles.statValue}>MIT</span><span className={styles.statLabel}>Licensed</span></div>
            <div className={styles.statDivider} />
            <div className={styles.stat}><span className={styles.statValue}>Self-host</span><span className={styles.statLabel}>Your cloud</span></div>
            <div className={styles.statDivider} />
            <div className={styles.stat}><span className={styles.statValue}>Local AI</span><span className={styles.statLabel}>No token fees</span></div>
            <div className={styles.statDivider} />
            <div className={styles.stat}><span className={styles.statValue}>3 channels</span><span className={styles.statLabel}>WA · IG · FB</span></div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.features}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Platform Capabilities</span>
          <h2 className={styles.sectionTitle}>Everything your team needs to grow on WhatsApp</h2>
        </div>
        <div className={styles.featureGrid}>
          {features.map((f, i) => (
            <div key={f.title} className={styles.featureCard} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className={styles.featureIcon} style={{ background: f.color }}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.description}</p>
              {f.badge && <span className={styles.featureBadge}>{f.badge}</span>}
            </div>
          ))}
        </div>
      </section>

      <section id="why" className={styles.why}>
        <div className={styles.whyInner}>
          <div className={styles.whyText}>
            <span className={styles.sectionTag}>Why TickerPro</span>
            <h2 className={styles.sectionTitle}>Own your stack. Own your data. Own your margins.</h2>
            <p className={styles.whyLead}>
              Wati and DoubleTick are closed platforms that mark up every message and send your customer
              data to their servers. TickerPro is different by design.
            </p>
            <ul className={styles.whyList}>
              <li><b>No per-message markup.</b> You pay Meta's real conversation cost — nothing on top.</li>
              <li><b>No per-token AI bill.</b> Run AI on your own Ollama model at zero marginal cost.</li>
              <li><b>Data residency by default.</b> Self-host so nothing leaves your VPC — built for BFSI &amp; healthcare.</li>
              <li><b>No lock-in.</b> It's MIT-licensed. Export, fork, or extend it however you need.</li>
            </ul>
          </div>
          <div className={styles.compareCard}>
            <div className={styles.compareRow}><span>Open source / self-host</span><span className={styles.no}>Wati · DoubleTick ✕</span><span className={styles.yes}>TickerPro ✓</span></div>
            <div className={styles.compareRow}><span>Local-LLM AI (no token fees)</span><span className={styles.no}>✕</span><span className={styles.yes}>✓</span></div>
            <div className={styles.compareRow}><span>Native A/B broadcast testing</span><span className={styles.no}>✕</span><span className={styles.yes}>✓</span></div>
            <div className={styles.compareRow}><span>No per-message markup</span><span className={styles.no}>~20% markup</span><span className={styles.yes}>✓</span></div>
            <div className={styles.compareRow}><span>Shop-by-photo AI commerce</span><span className={styles.no}>partial</span><span className={styles.yes}>✓</span></div>
          </div>
        </div>
      </section>

      <section id="pricing" className={styles.pricing}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Pricing</span>
          <h2 className={styles.sectionTitle}>Start free. Scale when you're ready.</h2>
          <p className={styles.pricingSub}>Self-host for free forever, or let us run it for you. All plans pass through Meta's per-conversation cost with no markup.</p>
        </div>
        <div className={styles.pricingGrid}>
          {plans.map((p) => (
            <div key={p.name} className={`${styles.planCard} ${p.highlight ? styles.planHighlight : ""}`}>
              {p.highlight && <span className={styles.planTag}>Most Popular</span>}
              <h3 className={styles.planName}>{p.name}</h3>
              <div className={styles.planPrice}><span className={styles.planAmount}>{p.price}</span><span className={styles.planCadence}>{p.cadence}</span></div>
              <p className={styles.planDesc}>{p.description}</p>
              <ul className={styles.planFeatures}>
                {p.features.map((f) => <li key={f}><span className={styles.check}>✓</span>{f}</li>)}
              </ul>
              <a href={p.href} className={p.highlight ? styles.btnPrimaryLg : styles.btnGhost} style={{ width: "100%", justifyContent: "center", marginTop: "auto" }}>{p.cta}</a>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>Ready to own your WhatsApp growth?</h2>
        <p className={styles.ctaSubtitle}>14-day free trial on managed cloud. No credit card required. Or self-host today.</p>
        <a href="/signup" className={styles.btnPrimaryLg}>Start Your Free Trial →</a>
      </section>

      <footer className={styles.footer}>
        <p>© 2026 TickerPro · Open-source WhatsApp Business platform · MIT Licensed</p>
      </footer>
    </div>
  );
}
