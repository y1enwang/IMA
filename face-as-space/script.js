const layers = [
  { key: 'brow', label: 'Brows', marks: [5, 1, 2, 3, 4, 6], pair: true },
  { key: 'eye', label: 'Eyes', marks: [5, 6, 1, 7, 8, 9], pair: true },
  { key: 'nose', label: 'Nose', marks: [5, 1, 3, 6], pair: false },
  { key: 'mouth', label: 'Mouth', marks: [5, 6, 4, 2, 8], pair: false }
];
const state = [0, 0, 0, 0];
const busy = [false, false, false, false];
const pages = document.getElementById('pages');
const colors = {};
const ns = 'http://www.w3.org/2000/svg';
const filters = document.createElementNS(ns, 'svg');
filters.setAttribute('width', '0'); filters.setAttribute('height', '0');
filters.setAttribute('aria-hidden', 'true');
filters.style.position = 'absolute';
const definitions = document.createElementNS(ns, 'defs'); filters.appendChild(definitions);
document.body.appendChild(filters);
const presets = document.createElement('datalist'); presets.id='ink-colors';
presets.innerHTML=['#181818','#bb302e','#92565f','#a16e3b','#657751','#55669c','#975c9c'].map(color=>`<option value="${color}"></option>`).join('');
document.body.appendChild(presets);
function colorKey(i, slot) { return `${layers[i].key}-${layers[i].marks[state[i]]}-${slot}`; }
function tint(i, slot, hex) {
  const id = `ink-${i}-${slot}`;
  let filter = document.getElementById(id);
  if (!filter) {
    filter = document.createElementNS(ns,'filter'); filter.id=id;
    filter.setAttribute('color-interpolation-filters','sRGB');
    filter.innerHTML='<feComponentTransfer><feFuncR type="linear"/><feFuncG type="linear"/><feFuncB type="linear"/></feComponentTransfer>';
    definitions.appendChild(filter);
  }
  const values = [1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255);
  ['R','G','B'].forEach((channel,index)=>{
    const fn=filter.querySelector(`feFunc${channel}`);
    fn.setAttribute('slope',String(1-values[index])); fn.setAttribute('intercept',String(values[index]));
  });
  pages.children[i].querySelectorAll('.leaf img')[slot].style.filter=`url(#${id})`;
}
function asset(key, mark) { return `assets/${key}-${mark}.png`; }
layers.forEach((layer, i) => {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layer = layer.key;
  row.innerHTML = `<button class="arrow previous" aria-label="Previous ${layer.label.toLowerCase()}">‹</button><button class="leaf"><img alt="" draggable="false">${layer.pair ? '<img class="mirror" alt="" draggable="false">' : ''}<span class="index" aria-hidden="true"></span></button><button class="arrow next" aria-label="Next ${layer.label.toLowerCase()}">›</button>`;
  row.querySelector('.previous').onclick = () => flip(i, -1);
  row.querySelector('.next').onclick = () => flip(i, 1);
  row.querySelector('.leaf').onclick = () => flip(i, 1);
  pages.appendChild(row);
  const palette=document.createElement('div'); palette.className='palette';
  for(let slot=0;slot<(layer.pair?2:1);slot++){
    const label=document.createElement('label');
    const name=layer.pair?`${slot===0?'Left':'Right'} ${layer.label.toLowerCase()}`:layer.label;
    label.title=`${name} color`;
    const input=document.createElement('input'); input.type='color'; input.value='#181818';
    input.setAttribute('aria-label',`${name} color`); input.setAttribute('list','ink-colors');
    input.oninput=()=>{colors[colorKey(i,slot)]=input.value;tint(i,slot,input.value);};
    label.appendChild(input);palette.appendChild(label);
  }
  row.appendChild(palette);
  paint(i);
});
function paint(i) {
  const layer = layers[i];
  const leaf = pages.children[i].querySelector('.leaf');
  leaf.querySelectorAll('img').forEach(img => {
    img.src = asset(layer.key, layer.marks[state[i]]);
    img.classList.toggle('pair', layer.pair);
  });
  leaf.querySelector('.index').textContent = `${state[i]+1} / ${layer.marks.length}`;
  leaf.setAttribute('aria-label', `${layer.label}, page ${state[i]+1} of ${layer.marks.length}. Turn page.`);
  pages.children[i].querySelectorAll('input[type=color]').forEach((input,slot)=>{
    const hex=colors[colorKey(i,slot)] || '#181818'; input.value=hex; tint(i,slot,hex);
  });
}
function flip(i, direction) {
  if (busy[i]) return;
  const leaf = pages.children[i].querySelector('.leaf');
  const update = () => { state[i] = (state[i]+direction+layers[i].marks.length)%layers[i].marks.length; paint(i); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
  busy[i] = true;
  leaf.classList.remove('arrive');
  leaf.classList.add('leave');
  leaf.addEventListener('animationend', function afterLeave() {
    leaf.classList.remove('leave');
    update();
    leaf.classList.add('arrive');
    leaf.addEventListener('animationend', () => {
      leaf.classList.remove('arrive'); busy[i] = false;
    }, { once: true });
  }, { once: true });
}
