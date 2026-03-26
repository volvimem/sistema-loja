import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeGGqXV4LOB_ENZLkj_QHOIE5_OEp29s0",
  authDomain: "filhaocell-a528e.firebaseapp.com",
  projectId: "filhaocell-a528e",
  storageBucket: "filhaocell-a528e.firebasestorage.app",
  messagingSenderId: "69033828352",
  appId: "1:69033828352:web:a0ec6bcbf797622e6838e5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SENHA = "0800"; 
const EMPRESA = { nome: "FILHÃO.CELL", cnpj: "31.926.078/0001-65", tel: "(81) 9 9507-4007", end: "Rua Jose Medeiros Rego, 09, Centro", cid: "Surubim - PE", email: "filhao.cell@gmail.com" };

window.db = { clientes:[], produtos:[], servicos:[], os:[], logs:[], dividas:[], os_hist:[] };
window.carrinho = []; window.carrinhoOS = []; window.shareData = null; window.tempImg = null; window.retornoVenda = false; window.retornoOS = false; window.osFotos = [null, null, null, null]; window.currentFotoIndex = 0; window.extratoAtual = null; window.editingDateId = null;
window.callbackSenha = null; window.verValores = false;
window.isEditing = false; 
window.currentOSCollection = 'os_ativa'; 

window.estoqueTab = 'prod'; 

// ==========================================
// CORREÇÃO DO BUG DA FOLHA BRANCA NA IMPRESSÃO
// ==========================================
window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-cupom', 'printing-relatorio');
    document.getElementById('area-cupom-visual').innerHTML = '';
    document.getElementById('area-relatorio-visual').innerHTML = '';
});

window.salvarEstadoLocal = function() {
    const estado = {
        abaAtiva: document.querySelector('.page.active')?.id.replace('page-', '') || 'vendas',
        carrinhoVenda: window.carrinho,
        carrinhoOS: window.carrinhoOS,
        inputs: {
            'v-cli': document.getElementById('v-cli')?.value,
            'v-desc': document.getElementById('v-desc')?.value,
            'v-sinal': document.getElementById('v-sinal')?.value,
            's-cli': document.getElementById('s-cli')?.value,
            's-mod': document.getElementById('s-mod')?.value,
            's-senha': document.getElementById('s-senha')?.value,
            's-def': document.getElementById('s-def')?.value,
            's-desc': document.getElementById('s-desc')?.value,
            's-sinal': document.getElementById('s-sinal')?.value,
            'os-id': document.getElementById('os-id')?.value,
            'isEditing': window.isEditing
        }
    };
    localStorage.setItem('filhao_v1_state', JSON.stringify(estado));
}

window.restaurarEstadoLocal = function() {
    const salvo = localStorage.getItem('filhao_v1_state');
    if (salvo) {
        try {
            const estado = JSON.parse(salvo);
            window.carrinho = estado.carrinhoVenda || [];
            window.carrinhoOS = estado.carrinhoOS || [];
            window.isEditing = estado.inputs.isEditing || false;
            if(estado.inputs) {
                for (const [id, val] of Object.entries(estado.inputs)) {
                    const el = document.getElementById(id);
                    if(el) el.value = val || '';
                }
            }
            renderCarrinho();
            renderItemsOS();
            if(estado.abaAtiva) {
                window.nav(estado.abaAtiva);
            }
        } catch (e) {
            console.error("Erro ao restaurar estado", e);
        }
    } else {
        window.nav('vendas');
    }
}

document.addEventListener('keyup', (e) => {
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        window.salvarEstadoLocal();
    }
});
document.addEventListener('click', () => {
    setTimeout(window.salvarEstadoLocal, 100);
});

window.norm = (t) => t ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "";

onSnapshot(collection(db, "clientes"), s => { 
    window.db.clientes = s.docs.map(d=>({id:d.id, ...d.data()})); 
    if(isPg('clientes')) listarCli(); 
});
onSnapshot(collection(db, "produtos"), s => { window.db.produtos = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('estoque') && window.estoqueTab=='prod') renderListaEstoque(); });
onSnapshot(collection(db, "servicos_cad"), s => { window.db.servicos = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('estoque') && window.estoqueTab=='serv') renderListaEstoque(); });

onSnapshot(query(collection(db, "os_ativa"), orderBy("data", "desc")), s => { 
    window.db.os = s.docs.map(d=>({id:d.id, ...d.data()})); 
    renderKanban(); 
});

onSnapshot(query(collection(db, "logs"), orderBy("data", "desc")), s => { window.db.logs = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('relatorio')) renderRelatorio(); });

onSnapshot(collection(db, "dividas"), s => { 
    window.db.dividas = s.docs.map(d=>({id:d.id, ...d.data()}));
    if(isPg('relatorio')) renderRelatorio();
    if(isPg('clientes')) listarCli();
});
onSnapshot(query(collection(db, "os_historico"), orderBy("data", "desc")), s => { window.db.os_hist = s.docs.map(d=>({id:d.id, ...d.data()})); });

function isPg(p){ return document.getElementById('page-'+p).classList.contains('active'); }

window.abrirModalSenha = function(callback) {
    window.callbackSenha = callback;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-content-default').innerHTML = `
        <h3 style="justify-content:center; border:none; margin-bottom:5px">ADMINISTRADOR</h3>
        <i class="fas fa-user-shield" style="font-size:26px; color:var(--primary); margin-bottom:12px; display:block"></i>
        <div class="password-container">
            <input type="password" id="input-senha-adm" placeholder="SENHA" onkeydown="if(event.key==='Enter') verificarSenha()">
            <i class="fas fa-eye" onclick="togglePass()" id="eye-icon"></i>
        </div>
        <button class="btn btn-primary" onclick="verificarSenha()" style="margin-top:12px">CONFIRMAR</button>
        <button class="btn" style="background:#666; margin-top:5px" onclick="fecharModal({target:{id:'modal-overlay'}})">CANCELAR</button>
    `;
    setTimeout(() => document.getElementById('input-senha-adm').focus(), 100);
}

window.togglePass = function() {
    const inp = document.getElementById('input-senha-adm');
    const ico = document.getElementById('eye-icon');
    if (inp.type === "password") { inp.type = "text"; ico.classList.remove('fa-eye'); ico.classList.add('fa-eye-slash'); ico.style.color = "var(--primary)"; } 
    else { inp.type = "password"; ico.classList.remove('fa-eye-slash'); ico.classList.add('fa-eye'); ico.style.color = "#777"; }
}

window.verificarSenha = function() {
    const digitada = document.getElementById('input-senha-adm').value;
    if (digitada === SENHA) { if (window.callbackSenha) window.callbackSenha(); } 
    else { alert("SENHA INCORRETA"); document.getElementById('input-senha-adm').value = ''; }
}

window.nav = function(p, el) {
    if(p === 'relatorio') { 
        abrirModalSenha(() => {
            document.getElementById('modal-overlay').style.display='none'; 
            ativarAba(p, el);
            window.verValores = false; 
            document.getElementById('eye-rel').classList.remove('fa-eye-slash');
            document.getElementById('eye-rel').classList.add('fa-eye');
            renderRelatorio();
            window.salvarEstadoLocal();
        });
        return;
    }
    ativarAba(p, el);
    if(p==='clientes') listarCli();
    if(p==='estoque') renderListaEstoque();
    window.salvarEstadoLocal();
}

function ativarAba(p, el) {
    document.querySelectorAll('.page').forEach(d=>d.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(d=>d.classList.remove('active'));
    document.getElementById('page-'+p).classList.add('active');
    const navBtn = document.querySelector(`button[onclick="nav('${p}', this)"]`);
    if(navBtn) navBtn.classList.add('active');
    else if(el) el.classList.add('active');
}

window.forcarAtualizacao = async function() { if(!confirm("Atualizar sistema?")) return; window.location.reload(true); }

window.toggleSearch = function(tipo, inpId, boxId) {
    const box = document.getElementById(boxId); 
    const val = document.getElementById(inpId).value;

    if(tipo === 'listacli') { 
         if(box.innerHTML.trim() !== '' && !box.innerHTML.includes('VAZIO')) { box.innerHTML = ''; } else { buscar('clientes', val, boxId, true, true); } return; 
    }
    if(tipo === 'listaestoque') {
        if(box.innerHTML.trim() !== '' && !box.innerHTML.includes('NENHUM ITEM')) { box.innerHTML = ''; } else { renderListaEstoque(); } return;
    }
    if(box.style.display === 'block') { box.style.display = 'none'; } else {
        if(tipo === 'cli') buscar('clientes', val, boxId, false, true);
        if(tipo === 'venda') buscarVenda(val, true);
        if(tipo === 'os') buscarItemOS(val, true);
    }
}

window.buscar = function(col, txt, divId, lista=false, force=false) {
    const box = document.getElementById(divId); if(!window.db[col]) return;
    if(!txt && !force && !lista) { box.style.display='none'; return; }
    let source = window.db[col].sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
    if(txt) {
        const term = window.norm(txt);
        source = source.filter(i => window.norm(i.nome).includes(term));
    }
    if(!lista) source = source.slice(0, 50);
    if(lista) { if(source.length===0){document.getElementById(divId).innerHTML='<div style="text-align:center;padding:10px;color:#999">VAZIO</div>';} else {document.getElementById(divId).innerHTML=source.map(renderCliCard).join('');} return; }
    if(source.length) { box.innerHTML = source.map(i => `<div class="item-sug" onclick="sel('${col}','${i.id}','${divId}')">${i.nome}</div>`).join(''); box.style.display='block'; box.classList.remove('sugestoes-grid'); } 
    else { box.innerHTML = '<div class="item-sug" style="color:#999">VAZIO</div>'; box.style.display='block'; setTimeout(() => box.style.display='none', 2000); }
}
window.sel = function(c, id, div) {
    const item = window.db[c].find(i=>i.id===id);
    if(div === 'sug-r-cli') { document.getElementById('r-search').value = item.nome; document.getElementById(div).style.display='none'; renderRelatorio(); return; }
    const inp = div.includes('v-') ? 'v-cli' : 's-cli'; document.getElementById(inp).value = item.nome; document.getElementById(div).style.display='none';
    window.salvarEstadoLocal();
}

window.buscarVenda = function(txt, force=false) {
    const box = document.getElementById('sug-v-prod'); const clearBtn = document.getElementById('v-clear-btn');
    if(txt) clearBtn.style.display = 'block'; else clearBtn.style.display = 'none';
    if(!txt && !force) { box.style.display='none'; return; }
    const term = window.norm(txt);
    const prods = window.db.produtos.filter(i => window.norm(i.nome).includes(term)).sort((a,b)=>a.nome.localeCompare(b.nome));
    const servs = window.db.servicos.filter(i => window.norm(i.nome).includes(term)).sort((a,b)=>a.nome.localeCompare(b.nome));
    let html = `<div class="sug-header">ITENS</div><div class="sugestoes-grid">`;
    html += prods.map(i => `<div class="item-sug" onclick="addCar('${i.id}','P','${i.nome}',${i.precoVenda})"><span>${i.nome}</span> <b>R$ ${i.precoVenda}</b></div>`).join('');
    html += servs.map(i => `<div class="item-sug" onclick="addCar('${i.id}','S','${i.nome}',${i.precoVenda})"><span>${i.nome}</span> <b>R$ ${i.precoVenda}</b></div>`).join('');
    html += `</div>`;
    if(!prods.length && !servs.length) { box.innerHTML='<div class="item-sug">VAZIO</div>'; box.style.display='block'; setTimeout(()=>box.style.display='none',2000); } else { box.innerHTML=html; box.style.display='block'; }
}
window.limparBuscaVenda = function() {
    document.getElementById('v-busca').value = ''; document.getElementById('sug-v-prod').style.display='none'; document.getElementById('v-clear-btn').style.display = 'none'; document.getElementById('v-busca').focus();
}
window.limparVendas = function() {
    document.getElementById('v-cli').value = ''; document.getElementById('v-busca').value = ''; document.getElementById('v-desc').value = ''; document.getElementById('v-sinal').value = '';
    document.getElementById('sug-v-cli').style.display='none'; document.getElementById('sug-v-prod').style.display='none'; document.getElementById('v-clear-btn').style.display = 'none';
    window.carrinho=[]; renderCarrinho();
    window.salvarEstadoLocal();
}

window.addCar = function(id, tipo, nome, val) {
    const exist = window.carrinho.find(x => x.id === id);
    if(exist) { exist.qtd++; exist.val += val; } else { window.carrinho.push({ id, tipo, nome, val, qtd: 1, unit: val, garantia: 'SEM GARANTIA' }); }
    renderCarrinho(); limparBuscaVenda();
    window.salvarEstadoLocal();
}
window.renderCarrinho = function() {
    const l = document.getElementById('carrinho-lista'); if(!window.carrinho.length) { l.innerHTML='VAZIO'; document.getElementById('v-total').innerText='TOTAL: R$ 0,00'; document.getElementById('v-restante').innerText=''; return; }
    let subtotal = 0;
    l.innerHTML = window.carrinho.map((i,x) => {
        subtotal += i.val;
        return `<div style="padding:12px; border-bottom:1px solid #eee; background:white; border-radius:8px; margin-bottom:6px"><div style="display:flex; justify-content:space-between; align-items:center;"><span style="flex:1; font-weight:bold">${i.qtd}x ${i.nome}</span><span style="font-weight:bold; color:var(--primary)">R$ ${i.val.toFixed(2)}</span></div><div style="display:flex; align-items:center; gap:8px; margin-top:8px;"><label style="margin:0; font-size:10px">GAR:</label><select style="padding:4px; font-size:11px; width:auto;" onchange="setGarantiaCar(${x}, this.value)"><option value="SEM GARANTIA" ${i.garantia=='SEM GARANTIA'?'selected':''}>SEM</option><option value="30 DIAS" ${i.garantia=='30 DIAS'?'selected':''}>30 D</option><option value="90 DIAS" ${i.garantia=='90 DIAS'?'selected':''}>90 D</option><option value="1 ANO" ${i.garantia=='1 ANO'?'selected':''}>1 ANO</option></select></div><div class="actions-row"><button class="btn-mini blue" onclick="editItemVenda(${x})"><i class="fas fa-pen"></i></button><button class="btn-mini red" onclick="delCar(${x})"><i class="fas fa-trash"></i></button></div></div>`;
    }).join('');
    
    const desc = parseFloat(document.getElementById('v-desc').value) || 0;
    const entrada = parseFloat(document.getElementById('v-sinal').value) || 0;
    const totalLiq = subtotal - desc;
    const restante = totalLiq - entrada;

    document.getElementById('v-total').innerText = 'TOTAL: R$ ' + subtotal.toFixed(2);
}
window.setGarantiaCar = function(idx, val) { window.carrinho[idx].garantia = val; window.salvarEstadoLocal(); }
window.editItemVenda = function(index) { const i=window.carrinho[index]; const n=prompt(`Valor TOTAL ${i.nome} (${i.qtd}x):`, i.val); if(n!==null){const v=parseFloat(n); if(!isNaN(v)){window.carrinho[index].val=v; renderCarrinho(); window.salvarEstadoLocal();}} }
window.delCar = function(i) { window.carrinho.splice(i,1); renderCarrinho(); window.salvarEstadoLocal(); }
window.cadastrarNovoNaVenda = function() { window.retornoVenda=true; window.nav('clientes'); }
window.cadastrarNovoNaOS = function() { window.retornoOS=true; window.nav('clientes'); }

window.finalizarVenda = async function() {
    if(!window.carrinho.length) return alert("VAZIO");
    const cliField = document.getElementById('v-cli').value.trim();
    if(!cliField) return alert("ERRO: DIGITE O NOME DO CLIENTE!");
    const cli = cliField.toUpperCase();
    const desc = parseFloat(document.getElementById('v-desc').value) || 0;
    const entrada = parseFloat(document.getElementById('v-sinal').value) || 0;
    const sub = window.carrinho.reduce((a,b)=>a+b.val,0);
    const total = sub - desc;

    let valorPago = entrada;
    if(entrada === 0) {
        let confirmTotal = confirm(`O cliente pagou o valor TOTAL de R$ ${total.toFixed(2)}?`);
        if(confirmTotal) valorPago = total;
        else {
            let p = prompt("Quanto o cliente pagou?", total);
            valorPago = parseFloat(p);
            if(isNaN(valorPago)) return;
        }
    }
    
    let troco = 0; if(valorPago > total) { troco = valorPago - total; }
    const nowISO = new Date().toISOString();

    for(let i of window.carrinho) { await addDoc(collection(db,"logs"), { tipo: i.tipo=='P'?'PRODUTO':'SERVICO', desc: i.nome, valor: i.val, qtd: i.qtd||1, garantia: i.garantia, cliente: cli, data: nowISO }); }
    if(desc>0) await addDoc(collection(db,"logs"), {tipo:'DESCONTO', desc:'DESCONTO', valor: -desc, cliente:cli, data: nowISO});

    let msgFiado = "";
    if(valorPago < total) {
        const restante = total - valorPago;
        await addDoc(collection(db,"dividas"), { cliente: cli, valor_total: total, valor_pago: valorPago, restante: restante, data_venda: nowISO, data_lembrete: "", itens: window.carrinho.map(i=>`${i.qtd}x ${i.nome}`).join(', ') });
        msgFiado = `\n\nATENÇÃO: DÉBITO DE R$ ${restante.toFixed(2)} REGISTRADO!`;
    }

    window.shareData = { tipo:'VENDA', cliente:cli, itens:window.carrinho, subtotal: sub, desconto: desc, total: total, valorPago: valorPago, troco: troco, sinal: entrada };
    limparVendas();
    alert("VENDA FINALIZADA!" + msgFiado);
    abrirModalShare();
}

window.addFotoOS = function(idx) { window.currentFotoIndex = idx; document.getElementById('os-foto-input').click(); }
window.processFotoOS = function(inp) {
    if(inp.files && inp.files[0]) { const r = new FileReader(); r.onload = e => { const i = new Image(); i.src = e.target.result; i.onload = () => { const c = document.createElement('canvas'); const x = c.getContext('2d'); let w=i.width, h=i.height; if(w>h){if(w>400){h*=400/w;w=400}}else{if(h>400){w*=400/h;h=400}}; c.width=w; c.height=h; x.drawImage(i,0,0,w,h); window.osFotos[window.currentFotoIndex] = c.toDataURL('image/jpeg', 0.6); const slots = document.querySelectorAll('.os-foto-slot'); window.osFotos.forEach((f, i) => { if(f) slots[i].innerHTML = `<img src="${f}">`; else slots[i].innerHTML = `<i class="fas fa-camera"></i>`; }); } }; r.readAsDataURL(inp.files[0]); }
}

window.lerFoto = function(inp, viewId) {
    if(inp.files && inp.files[0]) { 
        const r = new FileReader(); 
        r.onload = e => { 
            const i = new Image(); 
            i.src = e.target.result; 
            i.onload = () => { 
                const c = document.createElement('canvas'); 
                const x = c.getContext('2d'); 
                let w=i.width, h=i.height; 
                const max = 300;
                if(w>h){if(w>max){h*=max/w;w=max}}else{if(h>max){w*=max/h;h=max}}; 
                c.width=w; c.height=h; 
                x.drawImage(i,0,0,w,h); 
                window.tempImg = c.toDataURL('image/jpeg', 0.7); 
                const view=document.getElementById(viewId); 
                view.src=window.tempImg; 
                view.classList.add('has-img'); 
            } 
        }; 
        r.readAsDataURL(inp.files[0]); 
    }
}

window.buscarItemOS = function(txt, force=false) {
    const box = document.getElementById('sug-os-item'); if(!txt && !force) { box.style.display='none'; return; }
    const term = window.norm(txt);
    const prods = window.db.produtos.filter(i => window.norm(i.nome).includes(term)).sort((a,b)=>a.nome.localeCompare(b.nome));
    const servs = window.db.servicos.filter(i => window.norm(i.nome).includes(term)).sort((a,b)=>a.nome.localeCompare(b.nome));
    let html = `<div style="display:flex; width:100%">`;
    html += `<div style="width:50%; border-right:1px solid #ccc"><div class="sug-header" style="background:#e3f2fd; color:#0d47a1">PEÇAS / PRODUTOS</div><div style="display:flex; flex-direction:column;">`;
    if(prods.length > 0) { html += prods.map(i => `<div class="item-sug" onclick="addItemOS('${i.id}', 'P', '${i.nome}', ${i.precoVenda})"><span>${i.nome}</span> <b>R$ ${i.precoVenda}</b></div>`).join(''); } else { html += `<div class="item-sug" style="color:#ccc; text-align:center">NENHUM</div>`; }
    html += `</div></div><div style="width:50%"><div class="sug-header" style="background:#fce4ec; color:#880e4f">SERVIÇOS</div><div style="display:flex; flex-direction:column;">`;
    if(servs.length > 0) { html += servs.map(i => `<div class="item-sug" onclick="addItemOS('${i.id}', 'S', '${i.nome}', ${i.precoVenda})"><span>${i.nome}</span> <b>R$ ${i.precoVenda}</b></div>`).join(''); } else { html += `<div class="item-sug" style="color:#ccc; text-align:center">NENHUM</div>`; }
    html += `</div></div></div>`; box.innerHTML = html; box.style.display='block';
}

window.addItemOS = function(id, tipo, nome, val) {
    const exist = window.carrinhoOS.find(x => x.nome === nome);
    if(exist) { exist.qtd = (exist.qtd || 1) + 1; exist.val += val; } else { window.carrinhoOS.push({id, tipo, nome, val, qtd: 1, unit: val, garantia: '90 DIAS'}); }
    renderItemsOS(); document.getElementById('s-busca-item').value = ''; document.getElementById('sug-os-item').style.display='none'; 
    window.salvarEstadoLocal();
}
window.renderItemsOS = function() {
    const l = document.getElementById('os-lista-itens'); 
    let subtotal = 0;
    
    if(window.carrinhoOS.length) {
        l.innerHTML = window.carrinhoOS.map((i,x) => {
            subtotal += i.val;
            return `<div style="padding:12px; border-bottom:1px solid #eee; background:white; border-radius:8px; margin-bottom:6px"><div style="display:flex; justify-content:space-between; align-items:center;"><span style="flex:1;cursor:pointer; font-weight:bold">${i.qtd||1}x ${i.nome}</span><span style="font-weight:bold; color:var(--primary)">R$ ${i.val.toFixed(2)}</span></div><div style="display:flex; align-items:center; gap:8px; margin-top:8px;"><label style="margin:0; font-size:10px">GAR:</label><select style="padding:4px; font-size:11px; width:auto;" onchange="setGarantiaOS(${x}, this.value)"><option value="SEM GARANTIA" ${i.garantia=='SEM GARANTIA'?'selected':''}>SEM</option><option value="30 DIAS" ${i.garantia=='30 DIAS'?'selected':''}>30 D</option><option value="90 DIAS" ${i.garantia=='90 DIAS'?'selected':''}>90 D</option><option value="1 ANO" ${i.garantia=='1 ANO'?'selected':''}>1 ANO</option></select></div><div class="actions-row"><button class="btn-mini blue" onclick="editItemOS(${x})"><i class="fas fa-pen"></i></button><button class="btn-mini red" onclick="delItemOS(${x})"><i class="fas fa-trash"></i></button></div></div>`;
        }).join('');
    } else {
        l.innerHTML = '<div style="text-align:center; padding:10px; color:#ccc">NENHUM ITEM</div>';
    }

    const desc = parseFloat(document.getElementById('s-desc').value) || 0;
    const sinal = parseFloat(document.getElementById('s-sinal').value) || 0;
    const totalLiquido = subtotal - desc;

    document.getElementById('s-total-display').innerText = 'TOTAL: R$ ' + subtotal.toFixed(2);
}
window.setGarantiaOS = function(idx, val) { window.carrinhoOS[idx].garantia = val; window.salvarEstadoLocal(); }
window.editItemOS = function(index) { const i=window.carrinhoOS[index]; const n=prompt(`Valor TOTAL ${i.nome}:`, i.val); if(n!==null){const v=parseFloat(n); if(!isNaN(v)){window.carrinhoOS[index].val=v; renderItemsOS(); window.salvarEstadoLocal();}} }
window.delItemOS = function(i) { window.carrinhoOS.splice(i,1); renderItemsOS(); window.salvarEstadoLocal(); }

window.salvarOS = async function() {
    const id = document.getElementById('os-id').value; 
    const cliField = document.getElementById('s-cli').value.trim();
    
    if(!cliField) return alert("ERRO: OBRIGATÓRIO NOME DO CLIENTE NA O.S.!");
    
    const sub = window.carrinhoOS.reduce((a,b)=>a+b.val,0); 
    const desc = parseFloat(document.getElementById('s-desc').value) || 0;
    const sinal = parseFloat(document.getElementById('s-sinal').value) || 0;
    const total = sub - desc;

    let statusFinal = document.getElementById('os-status-orig').value || 'pecas';
    if (!id) {
        statusFinal = 'pecas'; 
    }

    const os = { 
        cliente: cliField.toUpperCase(), 
        modelo: document.getElementById('s-mod').value.toUpperCase(), 
        defeito: document.getElementById('s-def').value.toUpperCase(), 
        senha: document.getElementById('s-senha').value.toUpperCase(), 
        valor: total, 
        desconto: desc,
        sinal: sinal, 
        restante: total - sinal,
        itens: window.carrinhoOS, 
        fotos: window.osFotos, 
        status: statusFinal
    };

    if(id) {
        const isHist = window.currentOSCollection === 'os_historico';
        const original = isHist ? window.db.os_hist.find(x => x.id === id) : window.db.os.find(x => x.id === id);
        
        if (original) {
            os.data = original.data; 
            if (original.num) os.num = original.num; 
        } else {
            os.data = new Date().toISOString(); 
        }
        
        await updateDoc(doc(db, isHist ? "os_historico" : "os_ativa", id), os);
    } else {
        const configRef = doc(db, "config", "contador"); 
        const configSnap = await getDoc(configRef);
        let numOS = 1;
        if (configSnap.exists()) { 
            numOS = configSnap.data().last + 1; 
            await updateDoc(configRef, { last: numOS }); 
        } else { 
            await setDoc(configRef, { last: 1 }); 
        }
        
        os.data = new Date().toISOString();
        os.num = numOS;
        await addDoc(collection(db, "os_ativa"), os);
    }

    limparOS(); 
    alert("SALVO! OS Nº " + (os.num || (id ? "ATUALIZADA" : "NOVA")));
}

window.limparOS = function() {
    window.isEditing = false; 
    window.currentOSCollection = 'os_ativa'; 
    document.getElementById('os-id').value = ''; document.getElementById('s-cli').value = ''; document.getElementById('s-mod').value = ''; document.getElementById('s-senha').value = ''; document.getElementById('s-def').value = ''; 
    document.getElementById('s-desc').value = ''; document.getElementById('s-sinal').value = ''; 
    window.carrinhoOS = []; window.osFotos = [null,null,null,null]; renderItemsOS(); const slots = document.querySelectorAll('.os-foto-slot'); slots.forEach(s => s.innerHTML = '<i class="fas fa-camera"></i>');
    window.salvarEstadoLocal();
}

window.renderKanban = function() {
    const c = {pecas:'', pgto:'', retirado:''}; const flow = ['pecas', 'pgto', 'retirado']; const term = document.getElementById('busca-kanban') ? document.getElementById('busca-kanban').value.toUpperCase() : '';
    window.db.os.forEach(o => {
        if(term) { const t = (o.cliente+' '+o.modelo+' '+o.status).toUpperCase(); if(!t.includes(term)) return; }
        const idx = flow.indexOf(o.status);
        let nav = '';
        if(idx > 0) nav += `<button class="btn-mini dark" onclick="moveOS('${o.id}', -1)"><i class="fas fa-arrow-left"></i></button>`;
        if(idx < 2) nav += `<button class="btn-mini dark" onclick="moveOS('${o.id}', 1)"><i class="fas fa-arrow-right"></i></button>`;
        else nav += `<button class="btn-mini primary" style="background:var(--primary)" onclick="arqOS('${o.id}')"><i class="fas fa-archive"></i></button>`;
        
        const numDisplay = o.num ? `<b>#${o.num}</b> - ` : '';
        const restanteVal = o.restante !== undefined ? o.restante : o.valor; 
        
        c[o.status] += `<div id="os-card-${o.id}" class="os-card ${o.status}"><div>${numDisplay}<b>${o.cliente}</b></div><div>${o.modelo}</div><div style="font-weight:bold; color:var(--primary)">FALTA: R$ ${restanteVal.toFixed(2)}</div><div class="actions-row">${nav}</div><div class="actions-row"><button class="btn-mini blue" onclick="editOS('${o.id}', false)"><i class="fas fa-pen"></i></button><button class="btn-mini zap" onclick="shareOS('${o.id}')"><i class="fas fa-share-alt"></i></button><button class="btn-mini red" onclick="delOS('${o.id}', false)"><i class="fas fa-trash"></i></button></div></div>`;
    });
    document.getElementById('k-pecas').innerHTML = c.pecas; document.getElementById('k-pgto').innerHTML = c.pgto; document.getElementById('k-retirado').innerHTML = c.retirado;
}

window.delOS = async function(id, isHist = false) { 
    abrirModalSenha(async () => { 
        document.getElementById('modal-overlay').style.display='none'; 
        if(confirm(isHist ? "EXCLUIR OS DO HISTÓRICO PERMANENTEMENTE?" : "EXCLUIR OS?")) {
            const col = isHist ? "os_historico" : "os_ativa";
            await deleteDoc(doc(db, col, id)); 
            
            if(isHist) {
                const extNome = document.getElementById('ext-nome').innerText;
                if(extNome.includes("HISTÓRICO OS")) {
                    verHistoricoOS();
                } else if(extNome.includes("HISTÓRICO:")) {
                    const nomeStr = extNome.replace('HISTÓRICO: ', '');
                    abrirExtratoCliente(nomeStr);
                }
            }
        }
    }); 
}

window.moveOS = async function(id, dir) { const o = window.db.os.find(i=>i.id===id); const idx = ['pecas', 'pgto', 'retirado'].indexOf(o.status) + dir; await updateDoc(doc(db,"os_ativa",id), {status: ['pecas', 'pgto', 'retirado'][idx]}); }

window.arqOS = async function(id) {
    if(!confirm("Arquivar e Finalizar?")) return; 
    
    const cardElement = document.getElementById(`os-card-${id}`);
    if(cardElement) cardElement.remove();

    const o = window.db.os.find(i=>i.id===id);
    if(!o) return; 

    const totalCalc = o.valor || 0;
    const sinalCalc = o.sinal || 0;

    if (sinalCalc > 0) {
        const restanteReal = totalCalc - sinalCalc;
        if (restanteReal > 0.01) {
            const nomeCliente = o.cliente.trim().toUpperCase();
            await addDoc(collection(db, "dividas"), {
                cliente: nomeCliente, 
                valor_total: totalCalc, 
                valor_pago: sinalCalc,
                restante: restanteReal,
                data_venda: o.data,
                data_lembrete: "",
                itens: (o.itens || []).map(x => x.nome).join(', '),
                origem_os: o.num || 'S/N'
            });
        }
    }

    await setDoc(doc(db, "os_historico", id), o);
    
    if(o.itens && o.itens.length>0) { 
        for(let i of o.itens) {
            let tipoLog = 'SERVICO';
            if (i.tipo === 'P' || i.tipo === 'PRODUTO') { tipoLog = 'PRODUTO'; } else if (i.tipo === 'S' || i.tipo === 'SERVICO') { tipoLog = 'SERVICO'; } else { const isProdName = window.db.produtos.some(p => p.nome === i.nome); tipoLog = isProdName ? 'PRODUTO' : 'SERVICO'; }
            
            await addDoc(collection(db,"logs"), {
                tipo: tipoLog, desc: i.nome, valor: i.val, qtd: i.qtd||1, garantia: i.garantia, cliente: o.cliente, data: o.data, osNum: o.num
            }); 
        } 
    } else { 
        await addDoc(collection(db,"logs"), {tipo:'SERVICO', desc: 'OS: '+o.modelo, valor: o.valor, qtd: 1, cliente: o.cliente, data: o.data, osNum: o.num}); 
    }
    
    if(o.desconto>0) await addDoc(collection(db,"logs"), {tipo:'DESCONTO', desc: 'DESCONTO OS', valor: -o.desconto, cliente: o.cliente, data: o.data});
    await deleteDoc(doc(db,"os_ativa",id));
}

// ==============================================================
// LISTAS DOS MODAIS - ÁREA DE COMPARTILHAMENTO FICA OCULTA AQUI
// ==============================================================

window.verHistoricoOS = function() {
    abrirModalSenha(() => {
        document.getElementById('modal-overlay').style.display = 'none';
        let html = '';
        if(window.db.os_hist.length === 0) html = '<div style="padding:20px;text-align:center;color:#999">VAZIO</div>';
        else {
            html = window.db.os_hist.map(o => {
                return `<div class="fin-item" style="background:white; border-left-color:#666">
                    <div class="fin-date">${new Date(o.data).toLocaleDateString()} - #${o.num||'S/N'}</div>
                    <div style="font-size:12px; margin-bottom:4px"><b>${o.cliente}</b> - ${o.modelo}</div>
                    ${o.senha ? `<div style="font-size:11px; color:#555"><b>SENHA:</b> ${o.senha}</div>` : ''}
                    ${o.defeito ? `<div style="font-size:11px; color:#555"><b>OBS:</b> ${o.defeito}</div>` : ''}
                    <div style="font-weight:900; color:var(--primary); margin-top:5px; font-size:14px">TOTAL: R$ ${o.valor.toFixed(2)}</div>
                    
                    <div class="actions-row" style="margin-top:10px">
                        <button class="btn-mini blue" onclick="prepararReciboOS('${o.id}', true)"><i class="fas fa-print"></i> RECIBO</button>
                        <button class="btn-mini dark" onclick="editOS('${o.id}', true)"><i class="fas fa-pen"></i></button>
                        <button class="btn-mini red" onclick="delOS('${o.id}', true)"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
            }).join('');
        }
        document.getElementById('ext-nome').innerText = "HISTÓRICO OS"; 
        document.getElementById('ext-lista').innerHTML = html; 
        document.getElementById('ext-share-area').style.display = 'none'; // OCULTO AQUI
        document.getElementById('ext-preview-box').style.display = 'none';
        document.getElementById('modal-extrato').style.display = 'flex';
        window.shareData = null; 
    });
}

window.editOS = function(id, isHist = false) {
    const o = isHist ? window.db.os_hist.find(i=>i.id===id) : window.db.os.find(i=>i.id===id); 
    if(!o) return; 
    
    window.currentOSCollection = isHist ? 'os_historico' : 'os_ativa';
    
    document.getElementById('os-id').value=id; 
    document.getElementById('s-cli').value=o.cliente; 
    document.getElementById('s-mod').value=o.modelo; 
    document.getElementById('os-status-orig').value = o.status || 'pecas'; 
    document.getElementById('s-def').value=o.defeito || ''; 
    document.getElementById('s-senha').value=o.senha || ''; 
    document.getElementById('s-desc').value = o.desconto || '';
    document.getElementById('s-sinal').value = o.sinal || '';
    
    window.carrinhoOS = (o.itens && Array.isArray(o.itens)) ? o.itens : (o.valor>0?[{nome: 'Serviço Antigo', val: o.valor, qtd: 1, garantia: '90 DIAS', tipo:'S'}]:[]);
    renderItemsOS(); 
    
    window.osFotos = o.fotos || [null, null, null, null]; 
    const slots = document.querySelectorAll('.os-foto-slot'); 
    window.osFotos.forEach((f, i) => { if(f) slots[i].innerHTML = `<img src="${f}">`; else slots[i].innerHTML = `<i class="fas fa-camera"></i>`; }); 
    
    document.getElementById('modal-extrato').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
    
    window.nav('servicos');
    document.getElementById('page-servicos').scrollIntoView();
    window.salvarEstadoLocal();
}

window.shareOS = function(id) {
    const o = window.db.os.find(i=>i.id===id); const it = (o.itens && o.itens.length) ? o.itens : [{nome:o.modelo, val:o.valor, qtd:1, garantia:'90 DIAS'}];
    const sub = it.reduce((a,b)=>a+b.val,0); const desc = o.desconto || 0; const numDisplay = o.num ? `Nº ${o.num}` : 'S/N';
    window.shareData={ tipo:'OS '+numDisplay, cliente:o.cliente, modelo:o.modelo, itens: it, subtotal: sub, desconto: desc, sinal: o.sinal || 0, total: o.valor, obs: o.defeito, senha: o.senha, fotos: o.fotos || [] };
    abrirModalShare();
}
window.maskTel = function(o) { let v = o.value.replace(/\D/g,""); if(v.length > 11) v = v.substring(0,11); if(v.length >= 2) v = "(" + v.substring(0,2) + ") " + v.substring(2); if(v.length >= 7) v = v.substring(0,10) + "-" + v.substring(10); o.value = v; }

window.salvarCliente = async function() {
    const id = document.getElementById('c-id').value; const d = { nome: document.getElementById('c-nome').value.toUpperCase(), tel: document.getElementById('c-tel').value, bairro: document.getElementById('c-bairro').value.toUpperCase(), cidade: document.getElementById('c-cidade').value.toUpperCase(), foto: window.tempImg||'' };
    if(id) await updateDoc(doc(db,"clientes",id), d); else await addDoc(collection(db,"clientes"), d);
    limparCli(); if(window.retornoVenda) { window.retornoVenda=false; window.nav('vendas'); document.getElementById('v-cli').value=d.nome; } else if(window.retornoOS) { window.retornoOS=false; window.nav('servicos'); document.getElementById('s-cli').value=d.nome; }
}
window.listarCli = function() { document.getElementById('lista-clientes').innerHTML = window.db.clientes.map(renderCliCard).join(''); }
window.limparCli = function() { document.getElementById('c-id').value = ''; document.getElementById('c-nome').value = ''; document.getElementById('c-tel').value = ''; document.getElementById('c-bairro').value = ''; document.getElementById('c-cidade').value = ''; window.tempImg = null; document.getElementById('c-foto-view').src = ''; document.getElementById('c-foto-view').classList.remove('has-img'); }

function renderCliCard(c) {
    const zap = c.tel ? `https://wa.me/55${c.tel.replace(/\D/g,'')}` : '#';
    const temDivida = window.db.dividas.some(d => d.cliente.toUpperCase().trim() === c.nome.toUpperCase().trim() && d.restante > 0.01);
    const alerta = temDivida ? '<span style="color:red; font-size:14px; margin-right:5px">⚠️</span>' : '';

    return `<div class="card" style="padding:10px; display:flex; justify-content:space-between; align-items:center"><div style="display:flex; gap:10px; align-items:center">${c.foto?`<img src="${c.foto}" style="width:40px;height:40px;border-radius:50%">`:`<div style="width:40px;height:40px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center"><i class="fas fa-user"></i></div>`}<div>${alerta}<b>${c.nome}</b><br><span style="font-size:11px">${c.tel}</span><div style="font-size:9px; color:#666; font-weight:bold">${c.bairro||''} ${c.cidade?'- '+c.cidade:''}</div></div></div><div class="actions-row" style="width:auto; gap:5px; justify-content:flex-end">${c.tel?`<a href="${zap}" target="_blank" class="btn-mini zap" style="padding:5px; font-size:12px; width:30px; flex:none"><i class="fab fa-whatsapp"></i></a>`:''} <button class="btn-mini blue" style="padding:5px; font-size:12px; width:30px; flex:none" onclick="edtCli('${c.id}')"><i class="fas fa-pen"></i></button> <button class="btn-mini red" style="padding:5px; font-size:12px; width:30px; flex:none" onclick="del('clientes','${c.id}')"><i class="fas fa-trash"></i></button></div></div>`;
}
window.edtCli = function(id) { const c=window.db.clientes.find(i=>i.id===id); document.getElementById('c-id').value=id; document.getElementById('c-nome').value=c.nome; document.getElementById('c-tel').value=c.tel; document.getElementById('c-bairro').value=c.bairro||''; document.getElementById('c-cidade').value=c.cidade||''; window.tempImg=c.foto; const view=document.getElementById('c-foto-view'); view.src=c.foto||''; if(c.foto) view.classList.add('has-img'); else view.classList.remove('has-img'); document.getElementById('form-cli').scrollIntoView(); }

window.abrirCarteiraDevedores = function() {
    abrirModalSenha(() => {
        document.getElementById('modal-overlay').style.display='none';
        const devedores = {};
        window.db.dividas.forEach(d => { if(d.restante > 0.01) { if(!devedores[d.cliente]) devedores[d.cliente] = 0; devedores[d.cliente] += d.restante; } });
        const lista = Object.entries(devedores).sort((a,b)=>b[1]-a[1]); let html = '';
        if(lista.length === 0) html = '<div style="text-align:center; padding:20px; color:#999">NINGUÉM DEVENDO!</div>';
        else { html = lista.map(([nome, total]) => `<div class="fin-item" style="display:flex; justify-content:space-between; align-items:center; background:white; border-left-color:red"><div>⚠️ <b>${nome}</b><br><span style="color:red; font-weight:bold">R$ ${total.toFixed(2)}</span></div><button class="btn-mini green" style="max-width:50px" onclick="gerenciarDividas('${nome}')"><i class="fas fa-eye"></i></button></div>`).join(''); }
        
        document.getElementById('ext-nome').innerText = "CARTEIRA DE DEVEDORES"; 
        document.getElementById('ext-lista').innerHTML = html; 
        document.getElementById('ext-share-area').style.display = 'none'; // OCULTO AQUI
        document.getElementById('ext-preview-box').style.display = 'none'; 
        document.getElementById('modal-extrato').style.display = 'flex';
        window.shareData = null; 
    });
}

window.gerenciarDividas = function(nome) {
    const dividas = window.db.dividas.filter(d => d.cliente === nome && d.restante > 0.01).sort((a,b)=>new Date(a.data_venda)-new Date(b.data_venda)); 
    let html = '';
    if(dividas.length === 0) html = '<div style="text-align:center; padding:20px; color:#999">NENHUM DÉBITO PENDENTE</div>';
    else { 
        html = dividas.map(d => { 
            const date = new Date(d.data_venda).toLocaleDateString('pt-BR'); 
            const dataLembretePt = d.data_lembrete ? d.data_lembrete.split('-').reverse().join('/') : ''; 
            const lembrete = dataLembretePt ? `<span style="color:red"><i class="fas fa-bell"></i> ${dataLembretePt}</span>` : ''; 
            return `
            <div class="fin-item">
                <div class="fin-date">${date} - ${d.itens}</div>
                <div style="display:flex; justify-content:space-between">
                    <div>TOTAL: R$ ${d.valor_total.toFixed(2)}<br>PAGO: R$ ${d.valor_pago.toFixed(2)}</div>
                    <div style="text-align:right">
                        <div class="fin-val">RESTANTE: R$ ${d.restante.toFixed(2)}</div>${lembrete}
                    </div>
                </div>
                <div class="actions-row" style="margin-top:10px">
                    <button class="btn-mini green" onclick="abaterDivida('${d.id}', '${nome}', ${d.restante})">PAGAR</button>
                    <button class="btn-mini blue" onclick="agendarLembrete('${d.id}', '${nome}', '${dataLembretePt}')">LEMBRETE</button>
                    <button class="btn-mini red" style="flex:0; min-width:30px" onclick="excluirDivida('${d.id}', '${nome}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`; 
        }).join(''); 
    }
    document.getElementById('ext-nome').innerText = "FINANCEIRO: " + nome; 
    document.getElementById('ext-lista').innerHTML = html; 
    document.getElementById('ext-share-area').style.display = 'none'; // OCULTO AQUI
    document.getElementById('ext-preview-box').style.display = 'none'; 
    document.getElementById('modal-extrato').style.display = 'flex';
    window.shareData = null; 
}

window.excluirDivida = function(id, nome) {
    abrirModalSenha(async () => {
        document.getElementById('modal-overlay').style.display='none';
        if(confirm("ATENÇÃO: Deseja apagar esta dívida permanentemente?\n(Não desfaz movimentações de caixa, apenas remove a cobrança)")) {
            await deleteDoc(doc(db, "dividas", id));
            gerenciarDividas(nome);
            listarCli(); 
        }
    });
}

window.maskMoney = function(o) { let v = o.value.replace(/\D/g, ""); v = (v/100).toFixed(2) + ""; v = v.replace(".", ","); v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1."); o.value = v; }
window.maskDate = function(o) { let v = o.value.replace(/\D/g, "").slice(0,8); if (v.length > 4) v = v.slice(0,2) + '-' + v.slice(2,4) + '-' + v.slice(4); else if (v.length > 2) v = v.slice(0,2) + '-' + v.slice(2); o.value = v; }

window.abaterDivida = function(id, nome, max) {
    document.getElementById('modal-extrato').style.display = 'none'; document.getElementById('modal-overlay').style.display = 'flex'; 
    document.getElementById('modal-content-default').innerHTML = `<h3 style="justify-content:center">PAGAR DÍVIDA</h3><div style="font-size:12px; margin-bottom:10px">${nome}</div><div style="color:red; font-weight:bold; font-size:10px; margin-bottom:5px">RESTANTE: R$ ${max.toFixed(2)}</div><input type="tel" id="input-pagar-val" placeholder="0,00" oninput="maskMoney(this)" style="font-size:24px; text-align:center; font-weight:bold; color:#2e7d32"><button class="btn btn-primary" onclick="confirmarAbater('${id}', '${nome}', ${max})">CONFIRMAR</button><button class="btn" style="background:#666; margin-top:5px" onclick="fecharModal({target:{id:'modal-overlay'}})">CANCELAR</button>`; setTimeout(()=>document.getElementById('input-pagar-val').focus(),100);
}
window.confirmarAbater = async function(id, nome, max) {
    const raw = document.getElementById('input-pagar-val').value; const val = parseFloat(raw.replace(/\./g,'').replace(',','.'));
    if(!val || val <= 0 || val > max) return alert("Valor inválido");
    const div = window.db.dividas.find(d => d.id === id); const novoPago = div.valor_pago + val; const novoRestante = div.restante - val;
    await updateDoc(doc(db,"dividas",id), { valor_pago: novoPago, restante: novoRestante });
    await addDoc(collection(db,"logs"), { tipo: 'PAGAMENTO DÍVIDA', desc: 'ABATIMENTO: '+nome, valor: val, qtd: 1, cliente: nome, data: new Date().toISOString() });
    alert("PAGAMENTO REGISTRADO!"); document.getElementById('modal-overlay').style.display='none'; gerenciarDividas(nome);
}
window.agendarLembrete = function(id, nome, dataAtual='') {
    document.getElementById('modal-extrato').style.display = 'none'; document.getElementById('modal-overlay').style.display = 'flex'; const titulo = dataAtual ? "EDITAR LEMBRETE" : "NOVO LEMBRETE"; const valorInicial = dataAtual ? `value="${dataAtual}"` : "";
    document.getElementById('modal-content-default').innerHTML = `<h3 style="justify-content:center">${titulo}</h3><div style="font-size:12px; margin-bottom:10px">${nome}</div><input type="tel" id="input-lembrete-date" ${valorInicial} placeholder="DD-MM-AAAA" oninput="maskDate(this)" maxlength="10" style="font-size:20px; text-align:center; font-weight:bold"><div style="font-size:9px; color:#666; margin-top:5px"><i class="fas fa-clock"></i> Horário padrão: 09:00 e 13:00</div><button class="btn btn-primary" onclick="confirmarLembrete('${id}', '${nome}')">SALVAR</button><button class="btn" style="background:#666; margin-top:5px" onclick="fecharModal({target:{id:'modal-overlay'}})">CANCELAR</button>`; setTimeout(()=>document.getElementById('input-lembrete-date').focus(),100);
}
window.confirmarLembrete = async function(id, nome) {
    const raw = document.getElementById('input-lembrete-date').value; if(raw.length !== 10) return alert("Data inválida"); const parts = raw.split('-'); const iso = `${parts[2]}-${parts[1]}-${parts[0]}`; await updateDoc(doc(db,"dividas",id), { data_lembrete: iso }); alert("LEMBRETE DEFINIDO!"); document.getElementById('modal-overlay').style.display='none'; gerenciarDividas(nome);
}

window.salvarProduto = async function(t) {
    const nome = document.getElementById('p-nome').value.toUpperCase(); if(!nome) return alert("NOME OBRIGATÓRIO"); const col = t==='prod'?'produtos':'servicos_cad';
    const d = { nome: nome, precoVenda: parseFloat(document.getElementById('p-venda').value||0), qtd: document.getElementById('p-qtd').value, custo: document.getElementById('p-custo').value, foto: window.tempImg||'' }; const id = document.getElementById('p-id').value;
    if(id) await updateDoc(doc(db,col,id), d); else await addDoc(collection(db,col), d); limparEstoque();
}
window.limparEstoque = function() { document.getElementById('p-id').value = ''; document.getElementById('p-nome').value = ''; document.getElementById('p-venda').value = ''; document.getElementById('p-qtd').value = ''; document.getElementById('p-custo').value = ''; window.tempImg = null; document.getElementById('p-foto-view').src = ''; document.getElementById('p-foto-view').classList.remove('has-img'); }

window.mudarTabEstoque = function(tab) {
    window.estoqueTab = tab;
    document.getElementById('btn-tab-prod').style.opacity = tab==='prod' ? '1' : '0.5';
    document.getElementById('btn-tab-serv').style.opacity = tab==='serv' ? '1' : '0.5';
    renderListaEstoque();
}

window.renderListaEstoque = function() {
    const termRaw = document.getElementById('estoque-search').value;
    const term = window.norm(termRaw);
    let list = [];
    if(term) {
        const prods = window.db.produtos.map(x => ({...x, col: 'produtos'}));
        const servs = window.db.servicos.map(x => ({...x, col: 'servicos_cad'}));
        list = [...prods, ...servs];
    } else {
        const isProd = window.estoqueTab === 'prod';
        list = isProd ? window.db.produtos.map(x => ({...x, col: 'produtos'})) : window.db.servicos.map(x => ({...x, col: 'servicos_cad'}));
    }
    const filtered = list.filter(i => window.norm(i.nome).includes(term));
    if (filtered.length === 0) {
        document.getElementById('lista-estoque').innerHTML = '<div style="text-align:center; padding:20px; color:#ccc">NENHUM ITEM</div>';
        return;
    }
    document.getElementById('lista-estoque').innerHTML = filtered.map(i => `<div class="card" style="padding:10px; display:flex; justify-content:space-between; align-items:center"><div style="display:flex;gap:10px;align-items:center">${i.foto?`<img src="${i.foto}" style="width:40px;height:40px;border-radius:50%">`:`<div style="width:40px;height:40px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center"><i class="fas fa-box"></i></div>`}<div><b>${i.nome}</b><br>R$ ${i.precoVenda}</div></div><div class="actions-row" style="width:auto; gap:5px"><button class="btn-mini blue" onclick="edtProd('${i.col}','${i.id}')"><i class="fas fa-pen"></i></button> <button class="btn-mini red" onclick="del('${i.col}','${i.id}')"><i class="fas fa-trash"></i></button></div></div>`).join('');
}

window.edtProd = function(col, id) { const i=(col=='produtos'?window.db.produtos:window.db.servicos).find(x=>x.id===id); document.getElementById('p-id').value=id; document.getElementById('p-nome').value=i.nome; document.getElementById('p-venda').value=i.precoVenda; document.getElementById('p-qtd').value=i.qtd||''; document.getElementById('p-custo').value=i.custo||''; document.getElementById('p-custo').type='password'; document.getElementById('btn-ver-custo').style.display='block'; window.tempImg=i.foto; const view=document.getElementById('p-foto-view'); view.src=i.foto||''; if(i.foto) view.classList.add('has-img'); else view.classList.remove('has-img'); document.getElementById('page-estoque').querySelector('.card').scrollIntoView(); }
window.revelarCusto = function() { abrirModalSenha(() => { document.getElementById('modal-overlay').style.display='none'; document.getElementById('p-custo').type = 'number'; document.getElementById('btn-ver-custo').style.display = 'none'; }); }

window.togglePriv = function() { 
    window.verValores = !window.verValores; 
    const ico = document.getElementById('eye-rel'); 
    if(window.verValores) { ico.classList.remove('fa-eye'); ico.classList.add('fa-eye-slash'); } else { ico.classList.remove('fa-eye-slash'); ico.classList.add('fa-eye'); } 
    renderRelatorio(); 
}

window.renderRelatorio = function() {
    const f = document.getElementById('r-filtro').value; 
    const now = new Date(); 
    const searchTxt = document.getElementById('r-search').value; 
    
    const logsFiltrados = window.db.logs.filter(l => {
        const d = new Date(l.data); 
        let matchDate = false;
        if(f === 'dia') matchDate = d.toDateString() === now.toDateString();
        else if(f === 'semana') matchDate = (now - d) < 604800000;
        else if(f === 'mes') matchDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        else if(f === 'ano') matchDate = d.getFullYear() === now.getFullYear();
        else if(f.length === 2 && !isNaN(f)) matchDate = d.getMonth() === (parseInt(f) - 1) && d.getFullYear() === now.getFullYear();
        let matchText = true; 
        if(searchTxt) matchText = (l.cliente && window.norm(l.cliente).includes(window.norm(searchTxt))); 
        return matchDate && matchText;
    });
    
    let totalGeral = 0; 
    let lucroGeral = 0; 
    const clientesMap = {}; 
    
    logsFiltrados.forEach(l => {
        totalGeral += l.valor; 
        let custoItem = 0; 
        if(l.tipo === 'PRODUTO' || l.tipo === 'P') { 
            const prod = window.db.produtos.find(p => p.nome === l.desc); 
            if(prod && prod.custo) custoItem = parseFloat(prod.custo) * (l.qtd || 1); 
        } 
        lucroGeral += (l.valor - custoItem);
        
        if(!clientesMap[l.cliente]) clientesMap[l.cliente] = { nome: l.cliente, total: 0, count: 0, lastDate: l.data, lastOS: null }; 
        clientesMap[l.cliente].total += l.valor; 
        clientesMap[l.cliente].count++;
        if (new Date(l.data) > new Date(clientesMap[l.cliente].lastDate)) clientesMap[l.cliente].lastDate = l.data; 
        if (l.osNum) clientesMap[l.cliente].lastOS = l.osNum;
    });
    
    const clientesArray = Object.values(clientesMap).sort((a,b) => b.total - a.total);
    document.getElementById('r-hist').innerHTML = clientesArray.map(c => {
        const temDivida = window.db.dividas.some(d => d.cliente === c.nome && d.restante > 0.01);
        const iconDivida = temDivida ? '<span style="font-size:14px">⚠️</span> ' : '';
        const osTxt = c.lastOS ? `Nº ${c.lastOS}` : 'S/N';
        return `<div style="padding:10px; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center">
            <div style="font-size:10px">${iconDivida}<b>${c.nome}</b><br><span style="color:#777">${new Date(c.lastDate).toLocaleDateString()} - ${osTxt}</span></div>
            <div style="text-align:right"><b style="color:var(--primary); font-size:11px">R$ ${c.total.toFixed(2)}</b><br><div class="actions-row" style="justify-content:flex-end"><button class="btn-mini green" onclick="abrirExtratoCliente('${c.nome}')"><i class="fas fa-eye"></i></button></div></div>
        </div>`;
    }).join('');

    if(clientesArray.length === 0) document.getElementById('r-hist').innerHTML = '<div style="text-align:center; padding:20px; color:#ccc">NENHUM DADO ENCONTRADO</div>';
    document.getElementById('r-total').innerText = window.verValores ? "R$ " + totalGeral.toFixed(2) : "****"; 
    document.getElementById('r-lucro').innerText = window.verValores ? "R$ " + lucroGeral.toFixed(2) : "****";
    
    const rank = (tipo) => {
        const contagem = {};
        logsFiltrados.forEach(l => {
            if(tipo === 'cliente' && l.cliente) contagem[l.cliente] = (contagem[l.cliente] || 0) + l.valor;
            else if (tipo === 'produto' && (l.tipo === 'PRODUTO' || l.tipo === 'P')) contagem[l.desc] = (contagem[l.desc] || 0) + (l.qtd || 1);
            else if (tipo === 'servico' && (l.tipo === 'SERVICO' || l.tipo === 'S')) contagem[l.desc] = (contagem[l.desc] || 0) + (l.qtd || 1);
        });
        return Object.entries(contagem).sort((a,b) => b[1] - a[1]).slice(0, 5);
    };

    const rankCli = rank('cliente');
    document.getElementById('rank-cli').innerHTML = rankCli.length ? rankCli.map(c => `<div class="rank-item"><span>${c[0]}</span> <b>R$ ${c[1].toFixed(2)}</b></div>`).join('') : '<div style="text-align:center; color:#999; font-size:10px">VAZIO</div>';
    const rankProd = rank('produto');
    document.getElementById('rank-prod').innerHTML = rankProd.length ? rankProd.map(p => `<div class="rank-item"><span>${p[0]}</span> <b>${p[1]}x</b></div>`).join('') : '<div style="text-align:center; color:#999; font-size:10px">VAZIO</div>';
    const rankServ = rank('servico');
    document.getElementById('rank-serv').innerHTML = rankServ.length ? rankServ.map(s => `<div class="rank-item"><span>${s[0]}</span> <b>${s[1]}x</b></div>`).join('') : '<div style="text-align:center; color:#999; font-size:10px">VAZIO</div>';
}

window.abrirExtratoCliente = function(nome) {
    let html = '';
    
    const oss = [...window.db.os_hist, ...window.db.os].filter(o => o.cliente === nome);
    
    oss.sort((a,b) => new Date(b.data) - new Date(a.data)).forEach(o => {
        const isFechada = window.db.os_hist.some(h => h.id === o.id);
        const statusLabel = isFechada ? 'FINALIZADA' : 'ATIVA';
        
        html += `
        <div class="fin-item" style="background:white; border-left-color: ${isFechada ? '#4caf50' : '#ff9800'}">
            <div class="fin-date">${new Date(o.data).toLocaleDateString()} - OS #${o.num||'S/N'} (${statusLabel})</div>
            <div style="font-size:12px; margin-bottom:4px"><b>MODELO:</b> ${o.modelo}</div>
            ${o.senha ? `<div style="font-size:11px; color:#555"><b>SENHA:</b> ${o.senha}</div>` : ''}
            ${o.defeito ? `<div style="font-size:11px; color:#555"><b>OBS:</b> ${o.defeito}</div>` : ''}
            <div style="font-weight:900; color:var(--primary); margin-top:5px; font-size:14px">TOTAL: R$ ${o.valor.toFixed(2)}</div>
            
            <div class="actions-row" style="margin-top:10px">
                <button class="btn-mini blue" onclick="prepararReciboOS('${o.id}', ${isFechada})"><i class="fas fa-print"></i> RECIBO</button>
                <button class="btn-mini dark" onclick="editOS('${o.id}', ${isFechada})"><i class="fas fa-pen"></i></button>
                <button class="btn-mini red" onclick="delOS('${o.id}', ${isFechada})"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    });
    
    const logsVendas = window.db.logs.filter(l => l.cliente === nome && !l.osNum).sort((a,b) => new Date(b.data) - new Date(a.data));
    
    if (logsVendas.length > 0) {
        html += `<h4 style="margin:15px 0 10px 0; font-size:11px; text-align:center; color:#666">OUTRAS MOVIMENTAÇÕES (VENDAS GERAIS)</h4>`;
        logsVendas.forEach(l => {
            const color = l.valor < 0 ? 'red' : 'var(--primary)';
            html += `
            <div class="fin-item" style="background:white; border-left-color:${color}; padding: 8px;">
                <div class="fin-date">${new Date(l.data).toLocaleDateString()} ${new Date(l.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
                <div style="display:flex; justify-content:space-between; align-items:center">
                    <div><b>${l.tipo}</b><br><span style="font-size:10px">${l.desc}</span></div>
                    <div style="font-weight:bold; color:${color}">R$ ${l.valor.toFixed(2)}</div>
                </div>
            </div>`;
        });
    }

    if(!html) html = '<div style="text-align:center; padding:20px; color:#999">NENHUM REGISTRO ENCONTRADO</div>';

    document.getElementById('ext-nome').innerText = "HISTÓRICO: " + nome;
    document.getElementById('ext-lista').innerHTML = html;
    
    document.getElementById('ext-share-area').style.display = 'none'; 
    document.getElementById('ext-preview-box').style.display = 'none';
    document.getElementById('modal-extrato').style.display = 'flex';
    
    window.shareData = null; 
}

window.prepararReciboOS = function(id, isFechada) {
    const o = isFechada ? window.db.os_hist.find(x => x.id === id) : window.db.os.find(x => x.id === id);
    if(!o) return;
    
    const it = (o.itens && o.itens.length) ? o.itens : [{nome: o.modelo, val: o.valor, qtd: 1, garantia: '90 DIAS'}];
    const sub = it.reduce((a,b)=>a+b.val,0); 
    const desc = o.desconto || 0; 
    const numDisplay = o.num ? `Nº ${o.num}` : 'S/N';
    
    window.shareData = { 
        tipo: 'OS ' + numDisplay, 
        cliente: o.cliente, 
        modelo: o.modelo,
        itens: it, 
        subtotal: sub, 
        desconto: desc, 
        sinal: o.sinal || 0, 
        total: o.valor, 
        senha: o.senha, 
        fotos: o.fotos || [] 
    };
    
    abrirModalShare();
}

// =========================================================
// GERA OS BOTÕES FORÇADAMENTE SÓ DENTRO DO RECIBO
// =========================================================
window.abrirModalShare = function() {
    if(!window.shareData) return;
    const d = window.shareData;
    
    let htmlPreview = `
        <div class="cupom-wrapper">
            <div class="c-header">
                <span class="c-company">${EMPRESA.nome}</span>
                <span class="c-sub">${EMPRESA.cnpj} | ${EMPRESA.tel}</span>
                <span class="c-sub">${EMPRESA.end}</span>
            </div>
            <div class="c-section-title">COMPROVANTE DE ${d.tipo}</div>
            <div class="c-row"><span>CLIENTE:</span> <span class="c-row bold">${d.cliente}</span></div>
            ${d.modelo ? `<div class="c-row"><span>APARELHO:</span> <span class="c-row bold">${d.modelo}</span></div>` : ''}
            <div class="c-row"><span>DATA:</span> <span>${new Date().toLocaleString()}</span></div>
            
            <table class="c-table">
                <thead><tr><th>QTD</th><th>ITEM</th><th style="text-align:right">TOTAL</th></tr></thead>
                <tbody>
                    ${d.itens.map(i => `
                        <tr>
                            <td>${i.qtd || 1}x</td>
                            <td><span class="c-item-name">${i.nome}</span>
                                ${i.garantia && i.garantia !== 'SEM GARANTIA' ? `<span class="c-item-meta">Garantia: ${i.garantia}</span>` : ''}
                            </td>
                            <td style="text-align:right">R$ ${i.val.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="c-total-box">
                <div class="c-row"><span>SUBTOTAL:</span> <span>R$ ${d.subtotal.toFixed(2)}</span></div>
                ${d.desconto > 0 ? `<div class="c-row"><span>DESCONTO:</span> <span>- R$ ${d.desconto.toFixed(2)}</span></div>` : ''}
                <div class="c-big-total">TOTAL: R$ ${d.total.toFixed(2)}</div>
            </div>
            
            ${d.sinal > 0 ? `<div class="c-row" style="margin-top:10px"><span>SINAL PAGO:</span> <span>R$ ${d.sinal.toFixed(2)}</span></div>` : ''}
            
            <div class="c-footer">
                OBRIGADO PELA PREFERÊNCIA!<br>
                SISTEMA FILHÃO.CELL
            </div>
        </div>
    `;
    
    document.getElementById('ext-nome').innerText = "COMPARTILHAR RECIBO";
    document.getElementById('ext-lista').innerHTML = '';
    
    const shareArea = document.getElementById('ext-share-area');
    
    // GERA OS BOTÕES NO MODAL
    shareArea.innerHTML = `
        <div id="ext-preview-box" style="display:block; margin-bottom:15px; max-height:40vh; overflow-y:auto; border:1px solid #ccc; border-radius:8px; padding:5px">${htmlPreview}</div>
        <div style="font-size:10px; color:#999; text-align:center; font-weight:bold; margin-bottom:10px">ESCOLHA COMO ENVIAR OU IMPRIMIR</div>
        <button class="btn" style="background:#25d366; margin:0 0 8px 0; padding:12px; width:100%" onclick="shareExtrato('zap')"><i class="fab fa-whatsapp"></i> ENVIAR WHATSAPP</button>
        <button class="btn" style="background:#0277bd; margin:0 0 8px 0; padding:12px; width:100%" onclick="shareExtrato('bluetooth')"><i class="fab fa-bluetooth"></i> IMPRIMIR RAWBT (BLUETOOTH)</button>
        <button class="btn" style="background:#333; margin:0; padding:12px; width:100%" onclick="shareExtrato('pdf')"><i class="fas fa-file-pdf"></i> GERAR PDF / IMPRIMIR A4</button>
    `;
    
    shareArea.style.display = 'flex';
    shareArea.style.flexDirection = 'column';
    
    document.getElementById('modal-extrato').style.display = 'flex';
}

window.shareExtrato = function(metodo) {
    if(metodo === 'pdf' || metodo === 'bluetooth') {
        const area = document.getElementById('area-cupom-visual');
        area.innerHTML = document.getElementById('ext-preview-box').innerHTML;
        
        document.body.classList.add('printing-cupom');
        
        // Timeout pequeno apenas para garantir a renderização antes de abrir o print()
        setTimeout(() => { 
            window.print(); 
        }, 150);
        
    } else if (metodo === 'zap') {
        let telefoneCli = '';
        
        if(window.shareData && window.shareData.cliente) {
            const cli = window.db.clientes.find(c => c.nome.toUpperCase() === window.shareData.cliente.toUpperCase());
            if(cli && cli.tel) {
                telefoneCli = '55' + cli.tel.replace(/\D/g, ''); 
            }
        }

        if (window.shareData) {
            const d = window.shareData;
            let txt = `*${EMPRESA.nome}*\n`;
            txt += `Comprovante: ${d.tipo}\n`;
            txt += `Cliente: ${d.cliente}\n`;
            if (d.modelo) txt += `Aparelho: ${d.modelo}\n`;
            txt += `Data: ${new Date().toLocaleString()}\n\n`;
            txt += `*ITENS:*\n`;
            d.itens.forEach(i => { txt += `${i.qtd || 1}x ${i.nome} - R$ ${i.val.toFixed(2)}\n`; });
            txt += `\n*SUBTOTAL:* R$ ${d.subtotal.toFixed(2)}\n`;
            if(d.desconto > 0) txt += `*DESCONTO:* - R$ ${d.desconto.toFixed(2)}\n`;
            txt += `*TOTAL:* R$ ${d.total.toFixed(2)}\n`;
            if(d.sinal > 0) txt += `*SINAL PAGO:* R$ ${d.sinal.toFixed(2)}\n`;
            
            const encoded = encodeURIComponent(txt);
            const url = telefoneCli ? `https://wa.me/${telefoneCli}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
            window.open(url, '_blank');
        }
    }
}

window.acaoImprimirRelatorio = function() {
    const area = document.getElementById('area-relatorio-visual');
    const selectBox = document.getElementById('r-filtro');
    const fNome = selectBox.options[selectBox.selectedIndex].text;
    const total = document.getElementById('r-total').innerText;
    const lucro = document.getElementById('r-lucro').innerText;

    let html = `
        <div style="text-align:center; margin-bottom: 20px;">
            <h2 style="margin:0; font-family:sans-serif;">${EMPRESA.nome}</h2>
            <div style="font-size:12px; margin-top:5px; font-family:sans-serif;">${EMPRESA.cnpj} | ${EMPRESA.tel}</div>
            <div style="font-size:12px; font-family:sans-serif; margin-bottom:15px">${EMPRESA.end}</div>

            <div style="font-size:16px; color:#333; font-weight:bold; font-family:sans-serif; border-bottom: 2px dashed #000; padding-bottom:5px;">RELATÓRIO FINANCEIRO - ${fNome}</div>
            <div style="font-size:12px; margin-top:5px; font-family:sans-serif;">Gerado em: ${new Date().toLocaleString()}</div>
        </div>
        <div style="display:flex; justify-content:space-around; margin-bottom: 20px; border: 1px solid #000; padding: 15px; background:#f9f9f9; font-family:sans-serif;">
            <div style="font-size:16px;"><strong>FATURAMENTO:</strong> ${total}</div>
            <div style="font-size:16px;"><strong>LUCRO ESTIMADO:</strong> ${lucro}</div>
        </div>
        <table class="relatorio-print-table">
            <thead>
                <tr>
                    <th>DATA / HORA</th>
                    <th>TIPO</th>
                    <th>DESCRIÇÃO / ITEM</th>
                    <th>CLIENTE</th>
                    <th>VALOR (R$)</th>
                </tr>
            </thead>
            <tbody>
    `;

    const filtroVal = document.getElementById('r-filtro').value;
    const now = new Date();
    const logsPrint = window.db.logs.filter(l => {
        const d = new Date(l.data);
        if(filtroVal === 'dia') return d.toDateString() === now.toDateString();
        if(filtroVal === 'semana') return (now-d) < 604800000;
        if(filtroVal === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if(filtroVal === 'ano') return d.getFullYear() === now.getFullYear();
        if(filtroVal.length === 2 && !isNaN(filtroVal)) return d.getMonth() === (parseInt(filtroVal) - 1) && d.getFullYear() === now.getFullYear();
        return true;
    });

    logsPrint.forEach(l => {
        html += `
            <tr>
                <td>${new Date(l.data).toLocaleDateString()} ${new Date(l.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</td>
                <td>${l.tipo}</td>
                <td>${l.desc}</td>
                <td>${l.cliente || '-'}</td>
                <td>R$ ${l.valor.toFixed(2)}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    area.innerHTML = html;

    document.body.classList.add('printing-relatorio');
    
    // Timeout pequeno apenas para garantir a renderização antes de abrir o print()
    setTimeout(() => { 
        window.print(); 
    }, 150);
}

window.fecharExtrato = function(e) {
    if(e.target.id === 'modal-extrato') {
        document.getElementById('modal-extrato').style.display = 'none';
    }
}

window.fecharModal = function(e) {
    if(e.target.id === 'modal-overlay') {
        document.getElementById('modal-overlay').style.display = 'none';
    }
}
