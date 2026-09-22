import React from 'react';
import './hint.css';

type Variant = 'double' | 'corners' | 'target';

const cells = [
  'linear-gradient(135deg,#ecbe0b 0 45%,#244c8b 46% 100%)',
  'radial-gradient(circle at 34% 40%,#e44b28 0 27%,transparent 28%),#0a653c',
  'linear-gradient(90deg,#eee 0 12%,#183d73 12% 23%,#eee 23% 35%,#183d73 35% 47%,#eee 47% 59%,#183d73 59% 71%,#eee 71% 83%,#183d73 83%)',
  'linear-gradient(45deg,#532e74 0 48%,#e7a4bc 49% 100%)',
  'radial-gradient(ellipse at 70% 55%,#e9a61d 0 30%,transparent 31%),#163867',
  'linear-gradient(135deg,#e6c2c8 0 35%,#843519 36% 67%,#0f5f36 68%)',
  'linear-gradient(90deg,#122d65 0 24%,#fff 24% 32%,#1d6a45 32% 56%,#fff 56% 64%,#9c2824 64%)',
  'radial-gradient(circle at 35% 45%,#999 0 30%,transparent 31%),#6b3b16',
  'linear-gradient(45deg,#0b3c23 0 50%,#edc517 51%)',
  'linear-gradient(90deg,#6f5887 0 46%,#c9bbd8 46%)',
  'linear-gradient(135deg,#de5527 0 49%,#173961 50%)',
  'repeating-linear-gradient(90deg,#eee 0 7px,#111 7px 14px)',
  'radial-gradient(circle at 62% 40%,#e55e26 0 35%,transparent 36%),#8e2b21',
  'linear-gradient(45deg,#164a2f 0 44%,#d5a29c 45% 72%,#2b4275 73%)',
  'linear-gradient(90deg,#c1b3d1 0 55%,#173e70 55%)',
  'linear-gradient(135deg,#e9d7d5 0 50%,#69467d 50%)',
  'repeating-linear-gradient(90deg,#f7f7f7 0 5px,#164e2e 5px 11px)',
  'linear-gradient(45deg,#d7472c 0 36%,#102f61 37% 70%,#f0c20b 71%)',
  'radial-gradient(circle at 50% 60%,#957f9f 0 30%,transparent 31%),#154b35',
  'linear-gradient(90deg,#783819 0 56%,#d39218 56%)',
  'linear-gradient(135deg,#222 0 40%,#d7b5c1 41% 70%,#176044 71%)',
  'repeating-linear-gradient(90deg,#a83b34 0 6px,#eee 6px 12px)',
  'linear-gradient(45deg,#234a80 0 53%,#d6a322 54%)',
  'radial-gradient(circle,#d8cbd7 0 38%,#683d7a 39% 65%,#122f62 66%)',
];

export function HintDemo({variant}: {variant: Variant}) {
 const label = variant === 'double' ? 'מסגרת כפולה לבן־שחור' : variant === 'corners' ? 'סוגריים כחולים בפינות' : 'מסגרת ענבר וסמן מטרה';
 return <main className="phone" dir="rtl">
   <header><span className="level">שלב 1</span><h1>צורות בצרורות</h1><span className="icons">?　♫　×</span></header>
   <section className="board" aria-label="לוח משחק עם תא רמז מסומן">
    {cells.map((bg,i)=><div key={i} className={'cell '+(i===14?'chosen':'')} style={{background:bg}}>
      {i===14 && <div className={'marker '+variant} aria-label={label}>
        {variant==='corners' && <><i className="tl"/><i className="tr"/><i className="bl"/><i className="br"/></>}
        {variant==='target' && <span className="crosshair"><b/><b/></span>}
      </div>}
    </div>)}
   </section>
   <p className="instruction">לחצו על התא שמכיל את הצורה הבאה:</p>
   <div className="goal"></div>
   <div className="actions"><button aria-label="רמז">♧</button><button aria-label="סיבוב">↻</button></div>
   <aside><strong>{label}</strong><span>{variant==='double'?'ניגודיות מרבית בכל רקע':variant==='corners'?'צורה ייחודית שאינה תלויה בצבע':'הדגשה חזקה עם סמל מרכזי'}</span></aside>
 </main>
}
