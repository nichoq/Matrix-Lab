'use strict';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = ['#1e7750','#3a6491','#9c6525','#88569a','#178184','#a44b58','#657a28','#635ba6'];
const rankStyle = rank => `--rank-bg:hsl(${(rank * 137 + 140) % 360} 45% 91%);--rank-ink:${colors[rank % colors.length]}`;
const number = value => Number.isInteger(value) ? String(value) : value.toFixed(3);
const seconds = value => value.toFixed(6);
function updateCalculatorDisplay() {
  const size = $('demo-size').value;
  $('calculator-size').textContent = `${size} × ${size}`;
}
$('demo-size').addEventListener('change',updateCalculatorDisplay);
updateCalculatorDisplay();
let demo = null, cell = 0, term = 0, playback = null, busy = false, stopSuite = false, suiteRunning = false;
let history = [], selectedRun = -1;

async function post(path, body) {
  const response = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The calculation failed.');
  return result;
}
function setProgress(message, running = false) {
  $('progress').hidden = false;
  $('progress').classList.toggle('is-running',running);
  $('progress').setAttribute('aria-busy',String(running));
  $('progress-message').textContent = message;
}
function errorAt(id, error) { $(id).textContent = error.message; $(id).classList.remove('hidden'); }
function setBusy(value) {
  busy = value;
  for (const id of ['run','suite-run','demo-run']) $(id).disabled = value;
  for (const input of document.querySelectorAll('#form input, #demo-form input, #demo-form select')) input.disabled = value;
}
function ownerOf(partition, row) { return partition.find(p => row >= p.start && row < p.start + p.count).rank; }
function renderOwnership(id, partition) {
  $(id).innerHTML = partition.map(p => `<div class="rank" style="${rankStyle(p.rank)}"><div class="rank-top"><span class="rank-avatar" aria-hidden="true"><i></i><i></i></span><div class="rank-title"><small>MPI process</small><strong>Rank ${p.rank}</strong></div></div><div class="rank-assignment"><span>Assigned work</span><strong>${p.count ? `Rows ${p.start + 1}${p.count > 1 ? `–${p.start + p.count}` : ''} of A → C` : 'No rows assigned'}</strong></div><p>${p.count ? 'Calculates its assigned rows' : 'Idle for this calculation'} · Receives all of B</p></div>`).join('');
}
function matrixMarkup(values, label, partition, key, interactive = false, selected = null) {
  const row = selected === null ? -1 : Math.floor(selected / values.length), col = selected === null ? -1 : selected % values.length;
  return `<figure class="matrix-block"><figcaption>${label}</figcaption><table class="matrix-table" aria-label="${label}"><tbody>${values.map((cells,i) => `<tr>${cells.map((value,j) => {
    const owned = key !== 'b';
    const rank = owned ? ownerOf(partition,i) : null;
    const highlight = key === 'a' && i === row || key === 'b' && j === col;
    const isSelected = interactive && i === row && j === col;
    const attributes = `class="matrix-cell${owned ? ' owned' : ''}${highlight ? ' highlight' : ''}${isSelected ? ' selected' : ''}" ${owned ? `style="${rankStyle(rank)}"` : ''} title="Row ${i+1}, column ${j+1}: ${value}${owned ? `; rank ${rank}` : '; shared by every rank'}"`;
    return `<td>${interactive ? `<button type="button" ${attributes} data-cell="${i*values.length+j}" aria-pressed="${isSelected}" aria-label="C row ${i+1}, column ${j+1}, value ${value}, rank ${rank}">${number(value)}</button>` : `<span ${attributes}>${number(value)}</span>`}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table><p class="matrix-caption">${key === 'b' ? 'All ranks receive B' : 'Row colors indicate MPI ownership'}</p></figure>`;
}
function matricesMarkup(result, interactive = false) {
  const {preview:p, partition} = result;
  return matrixMarkup(p.a,'Matrix A',partition,'a',false,interactive ? cell : null) + '<span class="matrix-symbol" aria-hidden="true">×</span>' + matrixMarkup(p.b,'Matrix B',partition,'b',false,interactive ? cell : null) + '<span class="matrix-symbol" aria-hidden="true">=</span>' + matrixMarkup(p.c,'Result C',partition,'c',interactive,interactive ? cell : null);
}
function renderPlaybackControl() {
  const button = $('term-play'), finished = demo && term >= demo.size;
  const label = finished ? 'Replay calculation' : playback ? 'Pause calculation' : 'Play calculation';
  const path = finished ? '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>'
    : playback ? '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>' : '<path d="m7 5 11 7-11 7Z" fill="currentColor" stroke="none"/>';
  button.classList.toggle('replay-control',Boolean(finished));
  button.classList.add('playback-icon');
  button.setAttribute('aria-label',label); button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg><span class="control-tooltip" aria-hidden="true">${label}</span>`;
}
function stopPlayback() { clearInterval(playback); playback = null; renderPlaybackControl(); }
function renderCalculation() {
  if (!demo) return;
  const n = demo.size, row = Math.floor(cell/n), col = cell%n;
  $('cell-title').textContent = `Inside C[${row+1}, ${col+1}]`;
  $('cell-owner').textContent = `Rank ${ownerOf(demo.partition,row)} computes row ${row+1}. Multiply row ${row+1} of A by column ${col+1} of B, then add the products.`;
  let partial = 0;
  const terms = demo.preview.a[row].map((a,k) => {
    const b = demo.preview.b[k][col], product = a*b;
    if (k < term) partial += product;
    return `${k ? '<span class="equals" aria-hidden="true">+</span>' : ''}<div class="term ${k < term ? 'active' : 'pending'}"><span>${a} × ${b}</span><strong>${product}</strong></div>`;
  }).join('');
  $('dot-product').innerHTML = terms + `<span class="equals">=</span><div class="term sum"><strong>${partial}</strong></div>`;
  $('term-step').hidden = term === n;
  renderPlaybackControl();
  $('previous-cell').hidden = cell === 0;
  $('next-cell').hidden = cell === n*n-1;
}
function selectCell(index, focus = false) {
  stopPlayback(); cell = index; term = 0;
  $('demo-matrices').innerHTML = matricesMarkup(demo,true);
  renderCalculation();
  if (focus) document.querySelector(`[data-cell="${cell}"]`).focus();
}
$('demo-matrices').addEventListener('click', e => { const button = e.target.closest('[data-cell]'); if(button) selectCell(Number(button.dataset.cell),true); });
$('previous-cell').addEventListener('click', () => selectCell(Math.max(0,cell-1)));
$('next-cell').addEventListener('click', () => selectCell(Math.min(demo.size**2-1,cell+1)));
$('term-step').addEventListener('click', () => { stopPlayback(); term = Math.min(demo.size,term+1); renderCalculation(); });
$('term-play').addEventListener('click', () => {
  if (playback) { stopPlayback(); return; }
  if (term === demo.size) term = 0;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { term = demo.size; renderCalculation(); return; }
  playback = setInterval(() => { term++; renderCalculation(); if(term === demo.size) stopPlayback(); },900);
  renderCalculation();
});
$('demo-form').addEventListener('submit', async e => {
  e.preventDefault(); if(busy) return;
  const body = {size:Number($('demo-size').value),processes:Number($('demo-processes').value)};
  setBusy(true); stopPlayback(); $('demo-error').classList.add('hidden');
  $('demo-form').classList.add('is-calculating'); $('demo-form').setAttribute('aria-busy','true');
  $('demo-status').textContent = 'Calculating with MPI and checking the complete result…';
  try {
    demo = await post('/api/demo',body);
    $('demo-content').classList.remove('hidden');
    $('demo-status').textContent = `${demo.size} × ${demo.size} · ${demo.processes} MPI ranks · full result verified against sequential multiplication.`;
    selectCell(0); renderOwnership('demo-ownership',demo.partition);
  } catch(error) { errorAt('demo-error',error); $('demo-status').textContent = 'Example failed. Previous example, if shown, is unchanged.'; }
  finally { $('demo-form').classList.remove('is-calculating'); $('demo-form').removeAttribute('aria-busy'); setBusy(false); }
});

function showRun(result,index) {
  selectedRun = index;
  $('empty').classList.add('hidden'); $('results').classList.remove('hidden');
  $('seq').textContent = seconds(result.sequential_seconds)+' s'; $('par').textContent = seconds(result.parallel_seconds)+' s';
  $('speed').textContent = result.speedup.toFixed(3)+'×'; $('eff').textContent = result.efficiency_percent.toFixed(2)+'%';
  $('seqval').textContent = seconds(result.sequential_seconds)+' s'; $('parval').textContent = seconds(result.parallel_seconds)+' s';
  const max = Math.max(result.sequential_seconds,result.parallel_seconds);
  $('seqbar').style.width = result.sequential_seconds/max*100+'%'; $('parbar').style.width = result.parallel_seconds/max*100+'%';
  $('interpretation').textContent = result.speedup >= 1 ? `MPI was ${result.speedup.toFixed(2)}× as fast as sequential in this experiment. Efficiency was ${result.efficiency_percent.toFixed(1)}% across ${result.processes} processes.` : `Sequential was faster in this experiment (MPI speedup ${result.speedup.toFixed(2)}×). Communication and other parallel overhead can outweigh the benefit of dividing the work.`;
  $('trial-details').innerHTML = `<h4>Individual trials</h4><table class="trial-table"><thead><tr><th scope="col">Trial</th><th scope="col">Sequential (s)</th><th scope="col">MPI (s)</th></tr></thead><tbody>${result.sequential_trials.map((t,i) => `<tr><th scope="row">${i+1}</th><td>${seconds(t)}</td><td>${seconds(result.parallel_trials[i])}</td></tr>`).join('')}</tbody></table>`;
  $('preview-section').classList.remove('hidden');
  $('preview-note').textContent = result.size <= 5 ? `Complete ${result.size} × ${result.size} matrices. Values shown to 3 decimal places; hover for full precision.` : `Top-left ${result.preview.shown} × ${result.preview.shown} of each ${result.size} × ${result.size} matrix. Values rounded to 3 decimals. C was computed using the full matrices, not just these corners. Hover for full precision.`;
  $('preview-matrices').innerHTML = matricesMarkup(result);
  renderOwnership('preview-ownership',result.partition);
  document.querySelectorAll('[data-run]').forEach(button => button.closest('tr').classList.toggle('current',Number(button.dataset.run) === index));
}
function benchmarkInputs() { return {size:Number($('size').value),processes:Number($('processes').value),repeats:Number($('repeats').value),seed:Number($('seed').value)}; }
async function benchmark(body) {
  const result = await post('/api/run',body);
  history.push(result); renderHistory();
  showRun(result,history.length-1);
  return result;
}
$('form').addEventListener('submit', async e => {
  e.preventDefault(); if(busy) return;
  const body = benchmarkInputs(); setBusy(true); $('error').classList.add('hidden'); setProgress('Running experiment…', true);
  try { await benchmark(body); setProgress('Experiment saved.'); }
  catch(error) { errorAt('error',error); setProgress('Experiment failed. Please try again.'); }
  finally { setBusy(false); }
});
$('suite-run').addEventListener('click', async () => {
  if(suiteRunning) {
    stopSuite = true; setProgress('Finishing the current test…', true);
    $('suite-run').disabled = true; $('suite-run').textContent = 'Stopping…';
    return;
  }
  if(busy || !$('form').reportValidity()) return;
  const {repeats,seed} = benchmarkInputs(); setBusy(true); stopSuite = false; let completed = 0;
  suiteRunning = true;
  $('suite-run').disabled = false; $('suite-run').textContent = 'Stop';
  $('suite-run').classList.add('is-suite-running'); $('suite-run').title = 'Stop after the current test';
  $('error').classList.add('hidden');
  try {
    for(const size of [100,500,1000]) {
      for(const processes of [1,2,4]) {
        if(stopSuite) break;
        setProgress(`Running test ${completed+1} of 9…`, true);
        await benchmark({size,processes,repeats,seed}); completed++;
      }
      if(stopSuite) break;
    }
    setProgress(stopSuite ? `Stopped. ${completed} of 9 tests saved.` : 'All 9 tests saved.');
  } catch(error) { errorAt('error',error); setProgress(`Test failed. ${completed} of 9 saved.`); }
  finally {
    suiteRunning = false; setBusy(false);
    $('suite-run').textContent = 'Run test cases'; $('suite-run').classList.remove('is-suite-running');
    $('suite-run').removeAttribute('title');
  }
});

function renderHistory() {
  $('history-status').textContent = history.length ? `${history.length} saved experiment${history.length === 1 ? '' : 's'}. Times are medians; all listed results passed full-matrix verification.` : 'No saved experiments yet. Run one configuration or the nine-case suite to start comparing.';
  $('history-rows').innerHTML = history.map((r,i) => `<tr${i === selectedRun ? ' class="current"' : ''}><td title="${escapeHtml(new Date(r.recorded_at).toLocaleString())}">${i+1}</td><td>${r.size} × ${r.size}</td><td>${r.processes}</td><td>${r.repeats}</td><td>${r.seed}</td><td>${seconds(r.sequential_seconds)}</td><td>${seconds(r.parallel_seconds)}</td><td>${r.speedup.toFixed(3)}×</td><td>${r.efficiency_percent.toFixed(2)}%</td><td><button class="inspect-run" data-run="${i}" aria-label="Inspect run ${i+1}">Inspect</button></td></tr>`).reverse().join('');
  $('export-csv').disabled = $('export-json').disabled = !history.length;
  renderGraphs();
}
$('history-rows').addEventListener('click', e => {const button = e.target.closest('[data-run]'); if(button) {const index = Number(button.dataset.run); showRun(history[index],index); activateTab('benchmark', {focus:true});} });
function latestConfigurations() {
  const latest = new Map();
  history.forEach(r => latest.set(`${r.size}/${r.processes}`,r));
  return [...latest.values()];
}
function pointDetails(run) {
  return `Run ${history.indexOf(run)+1} · ${run.repeats} trial${run.repeats === 1 ? '' : 's'} · seed ${run.seed}`;
}
function chart(id, title, series, xLabel, yLabel, reference = null) {
  const points = series.flatMap(s => s.points);
  if(!points.length) { $(id).innerHTML = '<p class="graph-empty">Run an experiment to build this graph.</p>'; return; }
  const xs = [...new Set(points.map(p => p[0]))].sort((a,b)=>a-b);
  const minX = xs[0], maxX = xs.at(-1);
  const dataMax = Math.max(...points.map(p=>p[1]), reference || 0, 0.000001);
  const rawStep = dataMax * 1.08 / 6;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1,2,2.5,5,10].find(n=>n >= rawStep/magnitude) * magnitude;
  const maxY = reference === 100 && dataMax <= 100 ? 100 : Math.ceil(dataMax*1.06/step)*step;
  const tickStep = reference === 100 && dataMax <= 100 ? 25 : step;
  const w = Math.max(320,Math.min(840,$(id).clientWidth || 720)), h = 320;
  const left = 68, right = 28, top = 52, bottom = 60;
  const x = n => maxX === minX ? (w+left-right)/2 : left + (n-minX)/(maxX-minX)*(w-left-right);
  const y = n => h-bottom-n/maxY*(h-top-bottom);
  const tick = n => n === 0 ? '0' : n < .0001 ? n.toExponential(0) : Number(n.toPrecision(5)).toString();
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeHtml(title)}"><title>${escapeHtml(title)}</title><rect width="${w}" height="${h}" fill="#ffffff"/><g font-family="Space Grotesk, sans-serif" font-size="11" fill="#617869"><text class="plot-title" x="${w/2}" y="23" text-anchor="middle" font-size="13" font-weight="600" fill="#294e3a">${escapeHtml(title)}</text>`;
  for(let i=0;i<=Math.round(maxY/tickStep);i++) {
    const value = i*tickStep, py = y(value);
    svg += `<line x1="${left}" x2="${w-right}" y1="${py}" y2="${py}" stroke="${i===0?'#cadbd0':'#e7efe9'}"${i===0?'':' stroke-dasharray="3 5"'}/><text x="${left-12}" y="${py+4}" text-anchor="end">${tick(value)}</text>`;
  }
  svg += xs.map(value => `<line x1="${x(value)}" x2="${x(value)}" y1="${h-bottom}" y2="${h-bottom+5}" stroke="#bdd2c4"/><text x="${x(value)}" y="${h-bottom+23}" text-anchor="middle">${value}</text>`).join('');
  svg += `<text x="${(left+w-right)/2}" y="${h-12}" text-anchor="middle" fill="#456451">${escapeHtml(xLabel)}</text><text transform="translate(17 ${(top+h-bottom)/2}) rotate(-90)" text-anchor="middle" fill="#456451">${escapeHtml(yLabel)}</text>`;
  if(reference !== null) svg += `<line x1="${left}" x2="${w-right}" y1="${y(reference)}" y2="${y(reference)}" stroke="#8ca595" stroke-dasharray="5 5"/><text x="${w-right}" y="${y(reference)-9}" text-anchor="end" fill="#607a68">${reference === 1 ? 'Same time as one worker' : '100% efficiency'}</text>`;
  series.forEach((s,index) => {
    const color = s.color || colors[index%colors.length], sorted = [...s.points].sort((a,b)=>a[0]-b[0]);
    svg += `<polyline points="${sorted.map(p=>`${x(p[0])},${y(p[1])}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${s.dashed?2:3}" stroke-linecap="round" stroke-linejoin="round"${s.dashed ? ' stroke-dasharray="5 6" opacity="0.65"' : ''}/>`;
    svg += sorted.map(p => `<circle cx="${x(p[0])}" cy="${y(p[1])}" r="${s.dashed?3.5:4.5}" fill="${s.dashed?'#fff':color}" stroke="${s.dashed?color:'#fff'}" stroke-width="${s.dashed?1.7:2}"><title>${escapeHtml(s.label)}: ${xLabel} ${p[0]}, ${p[1].toPrecision(6)} ${escapeHtml(yLabel)}${p[2] ? ` · ${escapeHtml(p[2])}` : ''}</title></circle>`).join('');
  });
  svg += '</g></svg>';
  $(id).innerHTML = svg + `<div class="legend">${series.map((s,i)=>`<span data-color="${s.color || colors[i%colors.length]}" data-dashed="${Boolean(s.dashed)}"><i style="--series:${s.color || colors[i%colors.length]}"></i>${escapeHtml(s.label)}</span>`).join('')}</div>`;
}
function renderGraphs() {
  const rows = latestConfigurations(), sizes = [...new Set(rows.map(r=>r.size))].sort((a,b)=>a-b), current = Number($('graph-size').value);
  $('graph-size').innerHTML = sizes.map(size=>`<option value="${size}">${size} × ${size}</option>`).join('');
  if(sizes.includes(current)) $('graph-size').value = current;
  else if(sizes.length) $('graph-size').value = sizes[sizes.length-1];
  const counts = [...new Set(rows.map(r=>r.processes))].sort((a,b)=>a-b), series = [];
  counts.forEach((count,i) => {
    const group = rows.filter(r=>r.processes===count);
    series.push({label:`MPI · ${count} process${count===1?'':'es'}`,color:colors[i%colors.length],points:group.map(r=>[r.size,r.parallel_seconds,pointDetails(r)])});
    series.push({label:`Sequential · paired with ${count}`,color:colors[i%colors.length],dashed:true,points:group.map(r=>[r.size,r.sequential_seconds,pointDetails(r)])});
  });
  chart('time-graph','Execution time by matrix dimension',series,'Matrix dimension','Seconds');
  const size = Number($('graph-size').value), scaling = rows.filter(r=>r.size===size).sort((a,b)=>a.processes-b.processes);
  chart('speedup-graph',`Speedup for ${size} × ${size}`,[{label:`${size} × ${size}`,points:scaling.map(r=>[r.processes,r.speedup,pointDetails(r)])}],'MPI processes','Speedup (×)',1);
  chart('efficiency-graph',`Efficiency for ${size} × ${size}`,[{label:`${size} × ${size}`,points:scaling.map(r=>[r.processes,r.efficiency_percent,pointDetails(r)])}],'MPI processes','Efficiency (%)',100);
  document.querySelectorAll('.graph-download').forEach(button => button.disabled = !rows.length);
  if(!rows.length) { $('findings').innerHTML = '<h3>Did teamwork help?</h3><p>Run an experiment to see whether a team of workers finishes sooner than one worker.</p>'; return; }
  const fastest = rows.reduce((best,r)=>r.speedup>best.speedup?r:best), slower = rows.filter(r=>r.speedup<1).length;
  const best = fastest.speedup > 1
    ? `The biggest benefit came with ${fastest.size} × ${fastest.size} matrices and ${fastest.processes} worker${fastest.processes === 1 ? '' : 's'}. The team finished in about <strong>${(100/fastest.speedup).toFixed(0)}% of the time</strong> one worker needed. That means the job took roughly ${(100*(1-1/fastest.speedup)).toFixed(0)}% less time.`
    : 'So far, sharing the work has not finished sooner than doing it with one worker. Sending the numbers around and collecting the answers can take longer than the time a team saves.';
  let comparison = 'Try another team size with the same matrices to see whether adding workers helps.';
  if(scaling.length > 1) {
    const first = scaling[0], last = scaling.at(-1), change = 100*(1-last.parallel_seconds/first.parallel_seconds);
    comparison = `For the selected ${size} × ${size} matrices, using ${last.processes} workers instead of ${first.processes} ${first.processes === 1 ? 'worker' : 'workers'} ${Math.abs(change) < .5 ? 'made almost no difference to the finishing time' : `made the job take about ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'less' : 'more'} time`}.`;
  }
  const slowerText = slower ? ` One worker finished first in ${slower} of the ${rows.length} setups shown here.` : '';
  $('findings').innerHTML = `<h3>Did teamwork help?</h3><p>${best}${slowerText}</p><p>${comparison} We use the latest saved result for each setup in this comparison.</p>`;
}
$('graph-size').addEventListener('change',renderGraphs);

function download(content,filename,type) {
  const url = URL.createObjectURL(new Blob([content],{type})), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export-json').addEventListener('click',()=>download(JSON.stringify({schema_version:1,measurement:'Median trials; MPI includes communication; startup/generation/verification excluded',experiments:history},null,2),'matrix-lab-experiments.json','application/json'));
$('export-csv').addEventListener('click',()=> {
  const fields = ['recorded_at','size','processes','repeats','seed','sequential_seconds','parallel_seconds','speedup','efficiency_percent','correct','max_absolute_error','sequential_trials','parallel_trials','python','numpy','mpi','platform','processor','logical_cpus','numerical_threads_per_process'];
  const quote = value => '"'+String(value ?? '').replace(/"/g,'""')+'"';
  const lines = history.map(r => fields.map(key=>quote(Array.isArray(r[key]) ? JSON.stringify(r[key]) : r[key] ?? r.environment[key])).join(','));
  download([fields.join(','),...lines].join('\r\n'),'matrix-lab-experiments.csv','text/csv;charset=utf-8');
});
document.querySelectorAll('.graph-download').forEach(button=>button.addEventListener('click',()=> {
  const svg = $(button.dataset.chart).querySelector('svg'); if(!svg) return;
  const clone = svg.cloneNode(true), legend = document.createElementNS('http://www.w3.org/2000/svg','text');
  const labels = [...$(button.dataset.chart).querySelectorAll('.legend span')];
  const extra = labels.length*22+90, width = svg.viewBox.baseVal.width, height = svg.viewBox.baseVal.height;
  clone.setAttribute('viewBox',`0 0 ${width} ${height+extra}`);
  const ns = 'http://www.w3.org/2000/svg';
  const rect = document.createElementNS(ns,'rect'); rect.setAttribute('y',String(height)); rect.setAttribute('width',String(width)); rect.setAttribute('height',String(extra)); rect.setAttribute('fill','#ffffff'); clone.append(rect);
  labels.forEach((label,i)=> {
    const line=document.createElementNS(ns,'line'); line.setAttribute('x1','30'); line.setAttribute('x2','55'); line.setAttribute('y1',String(height+18+i*22)); line.setAttribute('y2',String(height+18+i*22)); line.setAttribute('stroke',label.dataset.color); line.setAttribute('stroke-width','3'); if(label.dataset.dashed === 'true') line.setAttribute('stroke-dasharray','5 4'); clone.append(line);
    const node=legend.cloneNode(); node.setAttribute('x','66'); node.setAttribute('y',String(height+22+i*22)); node.setAttribute('font-size','12'); node.setAttribute('font-family','Space Grotesk, sans-serif'); node.setAttribute('fill','#35563f'); node.textContent=label.textContent; clone.append(node);
  });
  ['Latest saved run per setup', 'Trials and seeds are in run details'].forEach((text,i)=>{const context=legend.cloneNode(); context.setAttribute('x','30'); context.setAttribute('y',String(height+40+labels.length*22+i*20)); context.setAttribute('font-size','12'); context.setAttribute('font-family','Space Grotesk, sans-serif'); context.setAttribute('fill','#35563f'); context.textContent=text; clone.append(context);});
  // Each series already has a title on every point; include a readable legend in exports.
  download(new XMLSerializer().serializeToString(clone),`matrix-lab-${button.dataset.chart}.svg`,'image/svg+xml');
}));
async function loadHistory() {
  try {
    const response = await fetch('/api/history'); const data = await response.json();
    if(!response.ok) throw new Error(data.error || 'Could not load history.');
    history = data; renderHistory(); if(history.length) showRun(history.at(-1),history.length-1);
  } catch(error) { $('history-status').textContent = error.message+' Reload the page to try again.'; renderGraphs(); }
}
loadHistory();
const labTabBar = document.querySelector('.lab-navigation');
const labTabs = [...labTabBar.querySelectorAll('[role="tab"]')];
function positionTabSelection() {
  const selected = labTabs.find(tab=>tab.getAttribute('aria-selected') === 'true');
  if(!selected) return;
  labTabBar.style.setProperty('--tab-x',selected.offsetLeft+'px');
  labTabBar.style.setProperty('--tab-width',selected.offsetWidth+'px');
  labTabBar.style.setProperty('--tab-height',selected.offsetHeight+'px');
  labTabBar.style.setProperty('--tab-y',selected.offsetTop+'px');
}
function activateTab(id, {focus = false, updateUrl = true} = {}) {
  if(!labTabs.some(tab => tab.getAttribute('aria-controls') === id)) id = 'demonstration';
  const changed = $(id).hidden;
  for(const tab of labTabs) {
    const active = tab.getAttribute('aria-controls') === id;
    tab.setAttribute('aria-selected',String(active)); tab.tabIndex = active ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !active;
    if(active && focus) tab.focus();
  }
  positionTabSelection();
  if(id !== 'demonstration') stopPlayback();
  if(updateUrl && location.hash !== '#'+id) window.history.pushState(null,'','#'+id);
  if(changed && updateUrl) window.scrollTo({top:0,behavior:'instant'});
  if(id === 'history') requestAnimationFrame(renderGraphs);
}
labTabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>activateTab(tab.getAttribute('aria-controls')));
  tab.addEventListener('keydown',event=>{
    if(event.ctrlKey || event.metaKey || event.altKey) return;
    let next;
    if(event.key === 'ArrowRight') next = (index+1)%labTabs.length;
    else if(event.key === 'ArrowLeft') next = (index+labTabs.length-1)%labTabs.length;
    else if(event.key === 'Home') next = 0;
    else if(event.key === 'End') next = labTabs.length-1;
    else return;
    event.preventDefault(); activateTab(labTabs[next].getAttribute('aria-controls'),{focus:true});
  });
});
const restoreTab = ()=>activateTab(location.hash.slice(1),{updateUrl:false});
window.addEventListener('popstate',restoreTab);
window.addEventListener('hashchange',restoreTab);
restoreTab();
new ResizeObserver(positionTabSelection).observe(labTabBar);
document.fonts.ready.then(positionTabSelection);
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer); resizeTimer=setTimeout(renderGraphs,150);});

const graphHelp = [...document.querySelectorAll('.graph-help')];
function closeGraphHelp(except = null) {
  graphHelp.filter(help=>help !== except).forEach(help=>{
    help.classList.remove('is-open'); help.classList.add('is-dismissed');
    help.querySelector('button').setAttribute('aria-expanded','false');
  });
}
graphHelp.forEach(help=>{
  const button = help.querySelector('button');
  button.addEventListener('click',()=>{
    const open = !help.classList.contains('is-open'); closeGraphHelp();
    help.classList.toggle('is-open',open); help.classList.toggle('is-dismissed',!open);
    button.setAttribute('aria-expanded',String(open));
  });
  help.addEventListener('pointerenter',()=>help.classList.remove('is-dismissed'));
  button.addEventListener('focus',()=>help.classList.remove('is-dismissed'));
  button.addEventListener('keydown',event=>{if(event.key === 'Escape'){closeGraphHelp();event.preventDefault();}});
});
document.addEventListener('click',event=>{if(!event.target.closest('.graph-help')) closeGraphHelp();});
