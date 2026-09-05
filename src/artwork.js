// Original, deterministic studies for the empty portfolio. No remote assets.
export const studyNames = ['Chromatic orbit', 'Soft systems', 'Afterglow', 'Wave field', 'Solar form', 'Blue shift'];
export function createArtwork(index) {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 600;
  const c = canvas.getContext('2d'), kind = index % 6;
  c.beginPath(); c.roundRect(0, 0, 960, 600, 25); c.clip();
  const palettes = [['#071a23','#b9ed67'],['#ede9e6','#bcb2db'],['#08091c','#ad4228'],['#04bcb6','#a898fa'],['#ffdc80','#e6914b'],['#2010ed','#4431fb']];
  const [bg, accent] = palettes[kind];
  const g = c.createLinearGradient(0,0,960,600); g.addColorStop(0,bg); g.addColorStop(1,accent); c.fillStyle=g; c.fillRect(0,0,960,600);
  c.save(); c.translate(480,300);
  if (kind === 0 || kind === 3 || kind === 5) {
    for(let i=100;i>=0;i--) {
      const t=i/100; c.beginPath();
      c.ellipse(Math.sin(t*7)*95,Math.cos(t*5)*42,45+t*300,25+t*215,t*2.5,0,Math.PI*2);
      c.strokeStyle=kind===0 ? `hsla(${75+t*110},85%,${35+t*35}%,.8)` : kind===3 ? `hsla(${250+t*110},90%,${35+t*40}%,.8)` : `hsla(${20+t*190},95%,75%,.65)`;
      c.lineWidth=kind===5?2:4; c.stroke();
    }
  } else {
    c.rotate(kind===1?-.4:.25);
    c.shadowColor='#180b2866'; c.shadowBlur=45; c.shadowOffsetY=35;
    for(let i=0;i<3;i++) {
      const x=(i-1)*190, y=Math.sin(i*2)*90;
      const sphere=c.createRadialGradient(x-45,y-65,4,x,y,140);
      sphere.addColorStop(0,kind===4?'#fff2b8':'#f9eaff'); sphere.addColorStop(.24,kind===2?'#8894ff':kind===4?'#c2763d':'#b3a1d4'); sphere.addColorStop(.55,kind===4?'#76351e':'#39324d'); sphere.addColorStop(.8,'#100f19'); sphere.addColorStop(1,accent);
      c.fillStyle=sphere; c.beginPath(); c.ellipse(x,y,112,160,i*.65,0,Math.PI*2); c.fill();
    }
  }
  c.restore();
  c.fillStyle=kind===1||kind===4?'#211b2b99':'#ffffffa0'; c.font='12px Arial'; c.fillText('FORM STUDY   /   '+String(kind+1).padStart(2,'0'),30,568);
  return canvas;
}
