import { useEffect, useRef, useState } from 'react';
import bgHome from '../assets/backgrounds/ec4e1a1be318bdae156f1987f22be6a9.gif';
import bgGame from '../assets/backgrounds/8d4074e7caaf7d9a965da253f3928c6e.gif';

export default function Backdrop({ which, reduced }) {
  const imgRef = useRef(null);
  const [url, setUrl] = useState(which === 'game' ? bgGame : bgHome);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const next = which === 'game' ? bgGame : bgHome;
    if (next === url) return undefined;
    if (reduced) {
      setUrl(next);
      return undefined;
    }
    setFading(true);
    const t = setTimeout(() => {
      setUrl(next);
      requestAnimationFrame(() => setFading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [which, url, reduced]);

  useEffect(() => {
    if (reduced) return undefined;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let running = true;

    const onMove = (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * -26;
      targetY = (e.clientY / window.innerHeight - 0.5) * -18;
    };
    const loop = () => {
      if (!running) return;
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      if (imgRef.current) imgRef.current.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, [reduced]);

  return (
    <div id="bg">
      <div
        id="bg-img"
        ref={imgRef}
        style={{ backgroundImage: 'url("' + url + '")', opacity: fading ? 0 : 0.55 }}
      />
      <div className="bg-tint" />
    </div>
  );
}
