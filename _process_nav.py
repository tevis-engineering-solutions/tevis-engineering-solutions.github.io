#!/usr/bin/env python3
"""
Process all TES website HTML files to replace old mega-nav with new TES nav.
"""
import re, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))   # the repo root, wherever it is checked out

# ===== SHARED REPLACEMENT STRINGS =====

FA_LINK = '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css">'

NEW_CSS = """    /* ===== TES NAV ===== */
    .tnav-bar { position:sticky; top:0; z-index:50; background:rgba(9,18,12,0.9); backdrop-filter:blur(12px); border-bottom:1px solid rgba(74,172,101,0.22); }
    .tnav-inner { display:flex; align-items:center; gap:1.25rem; padding:0.8rem 5%; max-width:1280px; margin:0 auto; }
    .tnav-brand { display:flex; align-items:center; gap:0.8rem; cursor:pointer; text-decoration:none; }
    .tnav-brand img { width:44px; height:44px; border-radius:10px; border:1px solid rgba(255,255,255,0.15); }
    .tnav-brand .bn { display:flex; flex-direction:column; font-family:'Montserrat','Segoe UI',system-ui,sans-serif; text-transform:uppercase; letter-spacing:0.08em; line-height:1.15; }
    .tnav-brand .bn b { font-size:1rem; font-weight:800; color:#fff; }
    .tnav-brand .bn s { font-size:0.7rem; font-weight:500; color:#8aa48d; text-decoration:none; }
    .tnav-spacer { flex:1; }
    .tnav-wrap { position:relative; }
    .tnav-trigger { display:inline-flex; align-items:center; gap:0.5rem; font-family:'Montserrat','Segoe UI',system-ui,sans-serif; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; font-size:0.85rem; color:#c2d2c5; background:transparent; border:1px solid transparent; padding:0.6rem 1rem; border-radius:999px; cursor:pointer; transition:color .2s,background .2s,border-color .2s; }
    .tnav-wrap:hover .tnav-trigger,.tnav-trigger[aria-expanded="true"] { color:#fff; background:rgba(74,172,101,0.10); border-color:rgba(74,172,101,0.22); }
    .tnav-chev { transition:transform .25s cubic-bezier(0.22,1,0.36,1); }
    .tnav-wrap:hover .tnav-chev,.tnav-trigger[aria-expanded="true"] .tnav-chev { transform:rotate(180deg); }
    .tnav-mega { position:fixed; top:72px; left:50%; width:min(840px,calc(100vw - 32px)); max-height:calc(100vh - 92px); overflow-y:auto; background:#142019; border:1px solid #2c4232; border-radius:20px; box-shadow:0 24px 60px rgba(0,0,0,0.55); padding:1.4rem; display:grid; grid-template-columns:1fr 1fr 0.85fr; gap:1.1rem; opacity:0; visibility:hidden; pointer-events:none; transform:translateX(-50%) translateY(8px); transition:opacity .22s cubic-bezier(0.22,1,0.36,1),transform .22s cubic-bezier(0.22,1,0.36,1); z-index:60; }
    .tnav-mega::before { content:''; position:absolute; top:-22px; left:0; right:0; height:24px; }
    .tnav-wrap:hover .tnav-mega,.tnav-mega.is-open { opacity:1; visibility:visible; pointer-events:auto; transform:translateX(-50%) translateY(0); }
    .tnav-col-head { font-family:'Montserrat','Segoe UI',system-ui,sans-serif; font-size:0.64rem; font-weight:800; text-transform:uppercase; letter-spacing:0.14em; color:#c89830; margin:0 0 0.55rem; padding-left:0.45rem; }
    .tnav-link { display:flex; gap:0.7rem; align-items:flex-start; padding:0.5rem; border-radius:12px; cursor:pointer; text-decoration:none; transition:background .18s,transform .18s; }
    .tnav-link:hover { background:#1c2e22; transform:translateX(3px); }
    .tnav-ic { width:34px; height:34px; flex-shrink:0; border-radius:9px; background:rgba(74,172,101,0.10); border:1px solid rgba(74,172,101,0.22); color:#4aac65; display:flex; align-items:center; justify-content:center; font-size:0.85rem; transition:background .18s,color .18s; }
    .tnav-link:hover .tnav-ic { background:#4aac65; color:#0d1710; }
    .tnav-tt { font-family:'Montserrat','Segoe UI',system-ui,sans-serif; font-weight:700; font-size:0.85rem; color:#e4ede5; line-height:1.2; display:block; }
    .tnav-dd { font-size:0.73rem; color:#8aa48d; margin-top:2px; line-height:1.3; display:block; }
    .tnav-cta { background:radial-gradient(110% 120% at 50% 0%,rgba(74,172,101,0.16),transparent 60%),linear-gradient(160deg,#16261d,#0f1c14); border:1px solid rgba(74,172,101,0.22); border-radius:18px; padding:1.3rem 1.1rem; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:0.5rem; }
    .tnav-cta .star { color:#c89830; font-size:1.3rem; }
    .tnav-cta h4 { font-family:'Montserrat','Segoe UI',system-ui,sans-serif; text-transform:uppercase; letter-spacing:0.04em; font-size:0.95rem; color:#fff; margin:0.2rem 0 0; }
    .tnav-cta p { font-size:0.76rem; color:#8aa48d; margin:0 0 0.6rem; line-height:1.45; }
    .tnav-right { display:flex; align-items:center; gap:0.9rem; }
    .tnav-sup-btn { display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; font-family:'Montserrat','Segoe UI',system-ui,sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; text-decoration:none; border-radius:999px; cursor:pointer; border:2px solid rgba(255,255,255,0.45); padding:8px 18px; font-size:0.78rem; color:#e4ede5; background:transparent; transition:transform 0.2s,border-color 0.2s; }
    .tnav-sup-btn:hover { transform:translateY(-2px); border-color:#fff; }
    .tnav-cta-btn { display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; font-family:'Montserrat','Segoe UI',system-ui,sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; text-decoration:none; border-radius:999px; cursor:pointer; border:1px solid rgba(255,255,255,0.25); padding:8px 18px; font-size:0.78rem; color:#0d1710; background:linear-gradient(135deg,#c89830,#e0b840); box-shadow:0 10px 20px rgba(200,152,48,0.28); transition:transform 0.2s,filter 0.2s; }
    .tnav-cta-btn:hover { transform:translateY(-2px); filter:brightness(1.06); }
    @media (max-width:860px) { .tnav-mega { top:68px; left:4vw; right:4vw; width:auto; grid-template-columns:1fr; max-height:calc(100vh - 84px); transform:translateY(8px); } .tnav-wrap:hover .tnav-mega,.tnav-mega.is-open { transform:translateY(0); } .tnav-cta,.tnav-brand .bn { display:none; } }
    @media (max-width:460px) { .tnav-inner { gap:0.6rem; padding:0.7rem 4%; } .tnav-trigger { padding:0.55rem 0.75rem; } .tnav-sup-btn span.lbl { display:none; } }
    /* ===== TES FOOTER ===== */
    .tfoot { background:#050b07; border-top:1px solid #2c4232; padding:3rem 5% 2rem; }
    .tfoot-grid { max-width:1280px; margin:0 auto; display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr; gap:2rem; }
    .tfoot-brand { display:flex; align-items:center; gap:0.7rem; margin-bottom:1rem; cursor:pointer; text-decoration:none; }
    .tfoot-brand img { width:40px; height:40px; border-radius:9px; }
    .tfoot-brand b { font-family:'Montserrat','Segoe UI',system-ui,sans-serif; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#fff; font-size:0.95rem; }
    .tfoot-blurb { color:#8aa48d; font-size:0.9rem; line-height:1.7; max-width:34ch; margin:0 0 1rem; }
    .tfoot-col h5 { font-family:'Montserrat','Segoe UI',system-ui,sans-serif; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#c89830; margin-bottom:0.9rem; }
    .tfoot-col a { display:block; color:#8aa48d; text-decoration:none; font-size:0.88rem; padding:0.3rem 0; transition:color 0.2s,transform 0.2s; }
    .tfoot-col a:hover { color:#4aac65; transform:translateX(3px); }
    .tfoot-bar { max-width:1280px; margin:2rem auto 0; padding-top:1.5rem; border-top:1px solid #2c4232; display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; align-items:center; }
    .tfoot-bar span { color:#8aa48d; font-size:0.82rem; }
    .tfoot-social { display:flex; gap:1.2rem; }
    .tfoot-social a { color:#8aa48d; font-size:1.1rem; transition:color 0.2s; }
    .tfoot-social a:hover { color:#4aac65; }
    .tfoot-veteran { display:inline-flex; align-items:center; gap:0.45rem; font-family:'Montserrat','Segoe UI',system-ui,sans-serif; font-size:0.78rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; padding:6px 12px; border-radius:999px; line-height:1; background:linear-gradient(135deg,#2d6a3f,#3d8a55); border:1px solid rgba(255,255,255,0.18); color:#fff; }
    @media (max-width:780px) { .tfoot-grid { grid-template-columns:1fr 1fr; } }
    @media (max-width:480px) { .tfoot-grid { grid-template-columns:1fr; } }"""

def new_nav(prefix=""):
    return f"""<!-- ===== NAV ===== -->
<div class="tnav-bar">
  <div class="tnav-inner">
    <a class="tnav-brand" href="{prefix}index.html">
      <img src="{prefix}assets/logo-mark.png" alt="Tevis Engineering Solutions">
      <span class="bn"><b>Tevis Engineering</b><s>Solutions</s></span>
    </a>
    <div class="tnav-spacer"></div>
    <div class="tnav-wrap" id="navWrap">
      <button class="tnav-trigger" type="button" aria-haspopup="true" aria-expanded="false" id="navTrigger">
        Menu
        <svg class="tnav-chev" width="11" height="7" viewBox="0 0 10 7" fill="none" aria-hidden="true"><path d="M1 1.5l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="tnav-mega" id="navMega" role="navigation" aria-label="Site navigation">
        <div>
          <div class="tnav-col-head">Services</div>
          <a class="tnav-link" href="{prefix}how_support_works.html"><span class="tnav-ic"><i class="fa-regular fa-circle-question"></i></span><span><span class="tnav-tt">How Support Works</span><span class="tnav-dd">Intake, scope, delivery, and billing</span></span></a>
          <a class="tnav-link" href="{prefix}pricing_sheet.html"><span class="tnav-ic"><i class="fa-solid fa-tag"></i></span><span><span class="tnav-tt">Pricing</span><span class="tnav-dd">Flat rates, hourly, and retainer plans</span></span></a>
          <a class="tnav-link" href="{prefix}blog/index.html"><span class="tnav-ic"><i class="fa-solid fa-newspaper"></i></span><span><span class="tnav-tt">Blog</span><span class="tnav-dd">Guides on IT, web, and engineering</span></span></a>
          <a class="tnav-link" href="{prefix}assessment.html"><span class="tnav-ic"><i class="fa-solid fa-chart-simple"></i></span><span><span class="tnav-tt">IT Assessment</span><span class="tnav-dd">Free 7-question readiness quiz</span></span></a>
          <a class="tnav-link" href="{prefix}website_creation.html"><span class="tnav-ic"><i class="fa-solid fa-globe"></i></span><span><span class="tnav-tt">Web &amp; App Design</span><span class="tnav-dd">Sites, tools, and digital presence</span></span></a>
          <a class="tnav-link" href="{prefix}data_destruction.html"><span class="tnav-ic"><i class="fa-solid fa-shield-halved"></i></span><span><span class="tnav-tt">Data Destruction</span><span class="tnav-dd">NIST-aligned secure media sanitization</span></span></a>
          <a class="tnav-link" href="{prefix}ai-integration.html"><span class="tnav-ic"><i class="fa-solid fa-wand-magic-sparkles"></i></span><span><span class="tnav-tt">AI Integration</span><span class="tnav-dd">Plug-and-play AI for your workflow</span></span></a>
        </div>
        <div>
          <div class="tnav-col-head">Company &amp; Tools</div>
          <a class="tnav-link" href="{prefix}service_catalog.html"><span class="tnav-ic"><i class="fa-solid fa-rectangle-list"></i></span><span><span class="tnav-tt">Services Catalog</span><span class="tnav-dd">Full rate card &amp; line sheet</span></span></a>
          <a class="tnav-link" href="{prefix}blog/index.html"><span class="tnav-ic"><i class="fa-solid fa-newspaper"></i></span><span><span class="tnav-tt">Blog / Knowledge Base</span><span class="tnav-dd">IT tips and guides for small businesses</span></span></a>
          <a class="tnav-link" href="{prefix}make_ticket.html"><span class="tnav-ic"><i class="fa-solid fa-headset"></i></span><span><span class="tnav-tt">Submit a Ticket</span><span class="tnav-dd">Get into the support queue now</span></span></a>
          <a class="tnav-link" href="{prefix}pay_invoice.html"><span class="tnav-ic"><i class="fa-solid fa-credit-card"></i></span><span><span class="tnav-tt">Pay an Invoice</span><span class="tnav-dd">Look up and pay your balance online</span></span></a>
          <a class="tnav-link" href="{prefix}make_ticket.html"><span class="tnav-ic"><i class="fa-solid fa-envelope"></i></span><span><span class="tnav-tt">Contact</span><span class="tnav-dd">Send a message or request a quote</span></span></a>
          <a class="tnav-link" href="{prefix}privacy_policy.html"><span class="tnav-ic"><i class="fa-solid fa-file-shield"></i></span><span><span class="tnav-tt">Privacy &amp; Terms</span><span class="tnav-dd">Payment terms and data policy</span></span></a>
        </div>
        <div class="tnav-cta">
          <span class="star">&#9733;</span>
          <h4>Need help now?</h4>
          <p>Talk straight to the engineer &mdash; no call center, one-business-day reply.</p>
          <a class="tnav-cta-btn" href="{prefix}make_ticket.html"><i class="fa-solid fa-headset"></i> Get Support</a>
        </div>
      </div>
    </div>
    <div class="tnav-spacer"></div>
    <div class="tnav-right">
      <a class="tnav-sup-btn" href="{prefix}make_ticket.html"><i class="fa-solid fa-headset"></i> <span class="lbl">Get Support</span></a>
    </div>
  </div>
</div>"""

def new_footer(prefix=""):
    return f"""  <!-- ===== FOOTER ===== -->
  <footer class="tfoot">
    <div class="tfoot-grid">
      <div>
        <a class="tfoot-brand" href="{prefix}index.html"><img src="{prefix}assets/logo-mark.png" alt="TES"><b>Tevis Engineering</b></a>
        <p class="tfoot-blurb">IT Support, Engineering, 3D Design/Printing and tangential services for small businesses and individuals in the Cleveland, Ohio area and beyond.</p>
      </div>
      <div class="tfoot-col">
        <h5>Services</h5>
        <a href="{prefix}pricing_sheet.html">Managed IT Support</a>
        <a href="{prefix}website_creation.html">Web &amp; App Design</a>
        <a href="{prefix}portfolio.html">PCB &amp; CAD Design</a>
        <a href="{prefix}portfolio.html">3D Printing</a>
        <a href="{prefix}data_destruction.html">Data Destruction</a>
      </div>
      <div class="tfoot-col">
        <h5>Company</h5>
        <a href="{prefix}how_support_works.html">How Support Works</a>
        <a href="{prefix}portfolio.html">Portfolio</a>
        <a href="{prefix}blog/index.html">Blog</a>
        <a href="{prefix}pricing_sheet.html">Pricing</a>
        <a href="{prefix}make_ticket.html">Contact</a>
      </div>
      <div class="tfoot-col">
        <h5>Get Started</h5>
        <a href="{prefix}make_ticket.html">Make a Ticket</a>
        <a href="{prefix}pay_invoice.html">Pay Invoice</a>
        <a href="{prefix}assessment.html">IT Assessment</a>
        <a href="{prefix}how_support_works.html">How Support Works</a>
      </div>
    </div>
    <div class="tfoot-bar">
      <span>&copy; 2026 Tevis Engineering Solutions, LLC &middot; Cleveland, OH 44121</span>
      <div class="tfoot-social">
        <a href="https://share.google/O4oor3ja1I48TL3LP" target="_blank" rel="noopener noreferrer" aria-label="Tevis Engineering Solutions on Google"><i class="fa-brands fa-google"></i></a>
        <a href="https://www.facebook.com/61595641256252/" target="_blank" rel="noopener noreferrer" aria-label="Tevis Engineering Solutions on Facebook"><i class="fa-brands fa-facebook"></i></a>
        <a href="https://www.linkedin.com/" aria-label="LinkedIn"><i class="fa-brands fa-linkedin"></i></a>
        <a href="https://github.com/tevis-engineering-solutions" aria-label="GitHub"><i class="fa-brands fa-github"></i></a>
        <a href="{prefix}make_ticket.html" aria-label="Email"><i class="fa-solid fa-envelope"></i></a>
      </div>
    </div>
  </footer>"""

NEW_JS_IIFE = """    (function() {
      var wrap = document.getElementById('navWrap');
      var trigger = document.getElementById('navTrigger');
      var mega = document.getElementById('navMega');
      function setOpen(o) { mega.classList.toggle('is-open', o); trigger.setAttribute('aria-expanded', o ? 'true' : 'false'); }
      var closeTimer;
      trigger.addEventListener('click', function(e) { e.stopPropagation(); setOpen(!mega.classList.contains('is-open')); });
      if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
        wrap.addEventListener('mouseenter', function() { clearTimeout(closeTimer); setOpen(true); });
        wrap.addEventListener('mouseleave', function() { closeTimer = setTimeout(function() { setOpen(false); }, 150); });
        mega.addEventListener('mouseenter', function() { clearTimeout(closeTimer); });
        mega.addEventListener('mouseleave', function() { closeTimer = setTimeout(function() { setOpen(false); }, 150); });
      }
      document.addEventListener('click', function(e) { if (!wrap.contains(e.target)) setOpen(false); });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') setOpen(false); });
      mega.querySelectorAll('a').forEach(function(a) { a.addEventListener('click', function() { setOpen(false); }); });
    })();"""

NEWSLETTER_JS = """    var form = document.getElementById('newsletterForm');
    if (form) {
      form.addEventListener('submit', function() {
        window.open('https://buttondown.com/tevisengineering', 'popupwindow', 'scrollbars=yes,width=800,height=600');
      });
    }"""

# ===== The old CSS block that appears in all files (common portion) =====
# Pattern: from /* ==================== MEGA-NAV ==================== */
# to end of 600px @media block
OLD_MEGANAV_CSS_PATTERN = re.compile(
    r'/\* ={10,} MEGA-NAV ={10,} \*/.*?'
    r'@media \(max-width: 600px\) \{[^\n]*\n',
    re.DOTALL
)

# Old topbar/brand CSS that comes BEFORE the mega-nav comment (varies per file)
# These are multi-line rules ending just before /* ====MEGA-NAV==== */
OLD_TOPBAR_CSS_PATTERNS = [
    # Pattern for files with .topbar { ... } .topbar-inner { ... } .brand { ... } .logo-slot { ... } .logo-lockup { ... } .logo-primary .logo-secondary
    re.compile(
        r'    \.topbar \{[^}]+\}\s+'
        r'(?:    \.topbar-inner \{[^}]+\}\s+)?'
        r'    \.brand \{[^}]+\}\s+'
        r'    \.logo-slot \{[^}]+\}\s+'
        r'    \.logo-lockup \{[^}]+\}\s+'
        r'    \.logo-primary \{[^\n]+\}\s+'
        r'    \.logo-secondary \{[^\n]+\}\s*\n'
        r'\s*\n\s*',
        re.DOTALL
    ),
    # 404.html variant with .nav-brand .nav-logo .nav-lockup
    re.compile(
        r'    \.topbar \{[^\n]+\}\s+'
        r'    \.topbar-inner \{[^\n]+\}\s+'
        r'    \.nav-brand \{[^\n]+\}\s+'
        r'    \.nav-logo \{[^\n]+\}\s+'
        r'    \.nav-lockup \{[^\n]+\}\s+'
        r'    \.nav-name-primary \{[^\n]+\}\s+'
        r'    \.nav-name-secondary \{[^\n]+\}\s*',
        re.DOTALL
    ),
]

# Old header HTML pattern (from <header class="topbar"> to </header>)
OLD_HEADER_PATTERN = re.compile(
    r'<header class="topbar">.*?</header>\s*',
    re.DOTALL
)

# Old nav-brand (404.html) header pattern
OLD_HEADER_404_PATTERN = re.compile(
    r'<header class="topbar">.*?</header>\s*',
    re.DOTALL
)

# Old footer patterns
OLD_FOOTER_SIMPLE = re.compile(
    r'  <footer>\s*.*?</footer>\s*',
    re.DOTALL
)
OLD_FOOTER_CLASS = re.compile(
    r'  <footer[^>]*>\s*.*?</footer>\s*',
    re.DOTALL
)

# Old JS IIFE pattern
OLD_JS_IIFE_PATTERN = re.compile(
    r'    // ---- Mega-nav ----\s*\n'
    r'    \(function\(\) \{.*?\}\)\(\);\s*',
    re.DOTALL
)
# Also matches without the comment
OLD_JS_IIFE_PATTERN2 = re.compile(
    r'    \(function\(\) \{\s*\n'
    r'      var menuBtn = document\.getElementById\(\'menuBtn\'\).*?\}\)\(\);\s*',
    re.DOTALL
)


def add_fa_link(content):
    """Add FA CSS link after Google Fonts link if not present."""
    if 'font-awesome/6.6.0' in content:
        return content
    fonts_pattern = re.compile(
        r'(<link href="https://fonts\.googleapis\.com/css2[^"]*" rel="stylesheet">)'
    )
    return fonts_pattern.sub(r'\1\n' + FA_LINK, content, count=1)


def replace_old_nav_css(content):
    """Remove old topbar CSS + mega-nav CSS block, add new CSS before </style>."""
    # First try to find and remove .topbar { through .logo-secondary line, then mega-nav block
    # Strategy: find the mega-nav comment, find where topbar starts before it, remove both

    mega_match = OLD_MEGANAV_CSS_PATTERN.search(content)
    if not mega_match:
        print("  WARNING: Could not find MEGA-NAV CSS pattern")
        return content

    mega_start = mega_match.start()
    mega_end = mega_match.end()

    # Find the topbar { block that comes before MEGA-NAV comment
    # Look backwards from mega_start for ".topbar {"
    topbar_idx = content.rfind('    .topbar {', 0, mega_start)
    if topbar_idx == -1:
        # Try without indentation (404.html style - single-line)
        topbar_idx = content.rfind('    .topbar { ', 0, mega_start)

    if topbar_idx == -1:
        print("  WARNING: Could not find .topbar block before MEGA-NAV CSS")
        # Just replace the mega-nav block
        old_mega = content[mega_start:mega_end]
        content = content.replace(old_mega, NEW_CSS + '\n', 1)
        return content

    # The block to remove runs from topbar_idx to mega_end
    old_css_block = content[topbar_idx:mega_end]
    content = content[:topbar_idx] + NEW_CSS + '\n' + content[mega_end:]
    return content


def replace_old_header(content, prefix=""):
    """Replace old <header class="topbar">...</header> with new nav div."""
    match = OLD_HEADER_PATTERN.search(content)
    if not match:
        print("  WARNING: Could not find <header class=\"topbar\"> pattern")
        return content

    nav_html = new_nav(prefix)
    # Place nav right before <body> content (where header was)
    old_header = content[match.start():match.end()]
    content = content.replace(old_header, nav_html + '\n\n', 1)
    return content


def replace_old_footer(content, prefix=""):
    """Replace old <footer>...</footer> with new tfoot footer."""
    match = OLD_FOOTER_CLASS.search(content)
    if not match:
        print("  WARNING: Could not find <footer> pattern")
        return content

    footer_html = new_footer(prefix)
    old_footer = content[match.start():match.end()]
    content = content.replace(old_footer, footer_html + '\n', 1)
    return content


def replace_old_js(content, has_newsletter=False):
    """Replace old mega-nav IIFE with new one."""
    # Try with comment first
    match = OLD_JS_IIFE_PATTERN.search(content)
    if not match:
        # Try without comment
        match = OLD_JS_IIFE_PATTERN2.search(content)

    if not match:
        print("  WARNING: Could not find old JS IIFE")
        return content

    old_js = content[match.start():match.end()]
    new_js = NEW_JS_IIFE + '\n'
    if has_newsletter:
        new_js += NEWSLETTER_JS + '\n'
    content = content.replace(old_js, new_js, 1)
    return content


# ===== FILE DEFINITIONS =====

def process_file(filepath, prefix="", add_fa=True, has_newsletter=False, special=None):
    print(f"\nProcessing: {os.path.basename(filepath)}")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_len = len(content)

    if add_fa:
        content = add_fa_link(content)

    if special != '404':
        content = replace_old_nav_css(content)

    content = replace_old_header(content, prefix)
    content = replace_old_footer(content, prefix)
    content = replace_old_js(content, has_newsletter)

    print(f"  Length: {original_len} -> {len(content)}")

    # Verify new nav is present
    if 'tnav-bar' not in content:
        print(f"  ERROR: tnav-bar not found in output!")
    else:
        print(f"  OK: tnav-bar present")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return 'tnav-bar' in content


# ===== MAIN =====

files_to_process = [
    # (filepath, prefix, add_fa, has_newsletter, special)
    (os.path.join(BASE, "knowledge_transfer.html"), "", True, True, None),
    (os.path.join(BASE, "website_creation.html"), "", True, True, None),
    (os.path.join(BASE, "portfolio.html"), "", False, True, None),
    (os.path.join(BASE, "assessment.html"), "", False, True, None),
    (os.path.join(BASE, "404.html"), "", False, False, "404"),
    (os.path.join(BASE, "make_ticket.html"), "", False, False, None),
    (os.path.join(BASE, "pay_invoice.html"), "", False, False, None),
    (os.path.join(BASE, "pricing_sheet.html"), "", True, False, "pricing"),
    (os.path.join(BASE, "privacy_policy.html"), "", True, False, None),
    (os.path.join(BASE, "thank_you.html"), "", False, False, None),
    # Blog pages
    (os.path.join(BASE, "blog", "index.html"), "../", True, True, None),
    (os.path.join(BASE, "blog", "small-business-backup-strategy.html"), "../", True, True, None),
    (os.path.join(BASE, "blog", "managed-it-vs-break-fix.html"), "../", True, True, None),
    (os.path.join(BASE, "blog", "website-for-small-business.html"), "../", True, True, None),
    (os.path.join(BASE, "blog", "pcb-design-for-first-time-hardware-founders.html"), "../", True, True, None),
    (os.path.join(BASE, "blog", "3d-printing-for-prototypes.html"), "../", True, True, None),
    (os.path.join(BASE, "blog", "when-does-your-pc-need-more-ram.html"), "../", True, True, None),
    (os.path.join(BASE, "blog", "5-signs-your-router-needs-replacing.html"), "../", True, True, None),
    (os.path.join(BASE, "blog", "what-to-do-before-calling-it-support.html"), "../", True, True, None),
    # Portal
    (os.path.join(BASE, "portal", "status.html"), "../", False, False, None),
]

results = []
for filepath, prefix, add_fa, has_newsletter, special in files_to_process:
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {filepath}")
        continue
    ok = process_file(filepath, prefix, add_fa, has_newsletter, special)
    results.append((os.path.basename(filepath), ok))

print("\n===== RESULTS =====")
for name, ok in results:
    status = "OK" if ok else "FAILED"
    print(f"  {status}: {name}")
