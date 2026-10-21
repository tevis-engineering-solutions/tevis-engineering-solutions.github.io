// The Archive (blog index + posts): starfield background and, on posts, the reading progress bar.
// Needs <canvas class="stars" id="stars"> in the page; the progress bar needs #readBar and an <article>.
(function() {
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Starfield: slow twinkle, a little scroll parallax, an occasional gold shooting star.
  (function() {
    var c = document.getElementById('stars');
    if (!c || !c.getContext) return;
    var ctx = c.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, stars = [], shoot = null, lastShot = 0, raf = 0;
    function seed() {
      var n = Math.min(240, Math.round(w * h / 7000));
      stars = [];
      for (var i = 0; i < n; i++) {
        var r = Math.random();
        stars.push({
          x: Math.random() * w, y: Math.random() * h, z: 0.2 + Math.random() * 0.8,
          r: r < 0.92 ? 0.3 + Math.random() * 1.0 : 1.2 + Math.random() * 1.2,
          p: Math.random() * 6.283, s: 0.4 + Math.random() * 1.4,
          c: r > 0.94 ? '224,184,64' : (r > 0.86 ? '109,200,130' : '228,237,229')
        });
      }
    }
    function size() {
      var nw = window.innerWidth, nh = window.innerHeight, reseed = nw !== w;
      w = nw; h = nh;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reseed) seed();
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      var sy = window.scrollY || 0;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var y = (s.y - sy * s.z * 0.12) % h; if (y < 0) y += h;
        var a = still ? 0.6 * s.z : (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.s + s.p))) * s.z;
        ctx.fillStyle = 'rgba(' + s.c + ',' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.283); ctx.fill();
      }
      if (still) return;
      if (!shoot && t - lastShot > 6000 && Math.random() < 0.006) {
        shoot = { x: w * (0.3 + Math.random() * 0.6), y: h * Math.random() * 0.35, vx: -(5 + Math.random() * 3), vy: 2 + Math.random() * 1.5, life: 0 };
        lastShot = t;
      }
      if (shoot) {
        shoot.life++; shoot.x += shoot.vx; shoot.y += shoot.vy;
        var tx = shoot.x - shoot.vx * 16, ty = shoot.y - shoot.vy * 16;
        var g = ctx.createLinearGradient(shoot.x, shoot.y, tx, ty);
        var fade = Math.max(0, 1 - shoot.life / 70);
        g.addColorStop(0, 'rgba(224,184,64,' + (0.9 * fade).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(224,184,64,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(tx, ty); ctx.stroke();
        if (shoot.life > 70) shoot = null;
      }
    }
    function loop(t) { draw(t); raf = document.hidden ? 0 : requestAnimationFrame(loop); }
    var rt;
    window.addEventListener('resize', function() { clearTimeout(rt); rt = setTimeout(function() { size(); if (still) draw(0); }, 120); });
    size();
    if (still) {
      draw(0);
      window.addEventListener('scroll', function() { draw(0); }, { passive: true });
    } else {
      raf = requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', function() { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); });
    }
  })();

  // Reading progress: how far through the article body the reader is.
  (function() {
    var bar = document.getElementById('readBar');
    var body = document.querySelector('.article-body');
    if (!bar || !body) return;
    var ticking = false;
    function update() {
      ticking = false;
      var r = body.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.6;
      var p = total > 0 ? Math.min(1, Math.max(0, (window.innerHeight * 0.4 - r.top) / total)) : 1;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    window.addEventListener('scroll', function() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();
})();
