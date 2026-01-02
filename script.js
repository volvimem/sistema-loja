import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

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
const SENHA = "0800"; // NOVA SENHA ADM

const EMPRESA = {
    nome: "FILHAO.CELL",
    cnpj: "31.926.078/0001-65",
    tel: "(81) 9 9507-4007",
    end: "Rua Jose Medeiros Rego, 09, Centro",
    cid: "Surubim - PE",
    email: "filhao.cell@gmail.com"
};

window.db = { clientes:[], produtos:[], servicos:[], os:[], logs:[] };
window.carrinho = [];
window.carrinhoOS = [];
window.shareData = null;
window.tempImg = null;
window.retornoVenda = false;
window.retornoOS = false;
window.osFotos = [null, null, null, null];
window.currentFotoIndex = 0;

// --- CARREGAMENTO ---
onSnapshot(collection(db, "clientes"), s => { window.db.clientes = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('clientes')) listarCli(); });
onSnapshot(collection(db, "produtos"), s => { window.db.produtos = s.docs.map(d=>({id:d.id, ...d.data()})); });
onSnapshot(collection(db, "servicos_cad"), s => { window.db.servicos = s.docs.map(d=>({id:d.id, ...d.data()})); });
onSnapshot(query(collection(db, "os_ativa"), orderBy("data", "desc")), s => { window.db.os = s.docs.map(d=>({id:d.id, ...d.data()})); renderKanban(); document.getElementById('loading').style.display='none'; });

onSnapshot(query(collection(db, "logs"), orderBy("data", "desc")), s => { 
    window.db.logs = s.docs.map(d=>({id:d.id, ...d.data()})); 
    if(isPg('relatorio')) renderRelatorio();
});

function isPg(p){ return document.getElementById('page-'+p).classList.contains('active'); }

// --- NAV ---
window.nav = function(p, el) {
    if(p === 'relatorio') {
        if(prompt("SENHA ADM:") !== SENHA) return;
    }
    document.querySelectorAll('.page').forEach(d=>d.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(d=>d.classList.remove('active'));
    document.getElementById('page-'+p).classList.add('active');
    if(el) el.classList.add('active');
    if(p==='clientes') listarCli();
    if(p==='estoque') listarEstoque('prod');
    if(p==='relatorio') renderRelatorio();
}

// --- ATUALIZAÇÃO FORÇADA ---
window.forcarAtualizacao = async function() {
    if(!confirm("Deseja forçar a atualização para a versão mais recente? Isso recarregará o sistema.")) return;
    if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistrations(); for(let x of r) await x.unregister(); }
    if ('caches' in window) { const k = await caches.keys(); for(let x of k) await caches.delete(x); }
    window.location.reload(true);
}

// --- BUSCA TOGGLE ---
window.toggleSearch = function(tipo, inpId, boxId) {
    const box = document.getElementById(boxId);
    const val = document.getElementById(inpId).value;

    if(tipo === 'listacli') {
         if(box.innerHTML.trim() !== '') { box.innerHTML = ''; } 
         else { buscar('clientes', val, boxId, true, true); }
         return;
    }

    if(box.style.display === 'block') {
        box.style.display = 'none'; 
    } else {
        if(tipo === 'cli') buscar('clientes', val, boxId, false, true);
        if(tipo === 'venda') buscarVenda(val, true);
        if(tipo === 'os') buscarItemOS(val, true);
    }
}

// --- BUSCAS ---
window.buscar = function(col, txt, divId, lista=false, force=false) {
    const box = document.getElementById(divId);
    if(!window.db[col]) return alert("AGUARDE CARREGAR O SISTEMA...");
    if(!txt && !force && !lista) { box.style.display='none'; return; }
    
    let res = window.db[col].filter(i => (i.nome||'').toUpperCase().includes((txt||'').toUpperCase())).slice(0,8);
    
    if(lista) {
        if(res.length === 0) { document.getElementById(divId).innerHTML = '<div style="text-align:center;padding:10px;color:#999">NENHUM REGISTRO</div>'; } 
        else { document.getElementById(divId).innerHTML = res.map(renderCliCard).join(''); }
        return;
    }
    
    if(res.length) {
        box.innerHTML = res.map(i => `<div class="item-sug" onclick="sel('${col}','${i.id}','${divId}')">${i.nome}</div>`).join('');
        box.style.display='block';
    } else {
         box.innerHTML = '<div class="item-sug" style="color:#999">NENHUM REGISTRO</div>';
         box.style.display='block';
         setTimeout(() => box.style.display='none', 3000); 
    }
}

window.sel = function(c, id, div) {
    const item = window.db[c].find(i=>i.id===id);
    if(div === 'sug-r-cli') {
        document.getElementById('r-search').value = item.nome;
        document.getElementById(div).style.display='none';
        renderRelatorio();
        return;
    }
    const inp = div.includes('v-') ? 'v-cli' : 's-cli';
    document.getElementById(inp).value = item.nome;
    document.getElementById(div).style.display='none';
}

// --- VENDAS ---
window.buscarVenda = function(txt, force=false) {
    const box = document.getElementById('sug-v-prod');
    if(!txt && !force) { box.style.display='none'; return; }
    
    const prods = window.db.produtos.filter(i => (i.nome||'').toUpperCase().includes((txt||'').toUpperCase())).slice(0,5);
    const servs = window.db.servicos.filter(i => (i.nome||'').toUpperCase().includes((txt||'').toUpperCase())).slice(0,5);
    
    let html = '';
    if(prods.length) html += `<div class="sug-header">PRODUTOS ESTOQUE</div>` + prods.map(i => `<div class="item-sug" onclick="addCar('${i.id}','P','${i.nome}',${i.precoVenda})"><span>${i.nome}</span> <b>R$ ${i.precoVenda}</b></div>`).join('');
    if(servs.length) html += `<div class="sug-header" style="border-top:2px solid #ddd">SERVIÇOS</div>` + servs.map(i => `<div class="item-sug" onclick="addCar('${i.id}','S','${i.nome}',${i.precoVenda})"><span>${i.nome}</span> <b>R$ ${i.precoVenda}</b></div>`).join('');

    if(html === '') { box.innerHTML = '<div class="item-sug" style="color:#999">NENHUM ITEM</div>'; box.style.display = 'block'; setTimeout(() => box.style.display='none', 2000); } 
    else { box.innerHTML = html; box.style.display = 'block'; }
}

window.addCar = function(id, tipo, nome, val) {
    window.carrinho.push({ id, tipo, nome, val });
    renderCarrinho();
    document.getElementById('v-busca').value = '';
    document.getElementById('sug-v-prod').style.display='none';
    document.getElementById('v-busca').focus();
}

window.renderCarrinho = function() {
    const l = document.getElementById('carrinho-lista');
    if(!window.carrinho.length) { l.innerHTML = 'CARRINHO VAZIO'; document.getElementById('v-total').innerText='TOTAL: R$ 0,00'; return; }
    
    let subtotal = 0;
    l.innerHTML = window.carrinho.map((i,x) => {
        subtotal += i.val;
        return `<div style="display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #eee; align-items:center">
            <span onclick="editItemVenda(${x})" style="flex:1; cursor:pointer">${i.nome}</span>
            <span onclick="editItemVenda(${x})" style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold; color:var(--primary)">
                <i class="fas fa-pen" style="font-size:10px; color:#555"></i> R$ ${i.val.toFixed(2)}
            </span>
            <i class="fas fa-trash" style="color:red;cursor:pointer;margin-left:10px" onclick="delCar(${x})"></i>
        </div>`;
    }).join('');
    
    const desconto = parseFloat(document.getElementById('v-desc').value) || 0;
    const totalFinal = subtotal - desconto;
    document.getElementById('v-total').innerText = 'TOTAL: R$ ' + totalFinal.toFixed(2);
}

window.editItemVenda = function(index) {
    const item = window.carrinho[index];
    const novoVal = prompt(`Alterar valor de ${item.nome}:`, item.val);
    if(novoVal !== null) {
        const v = parseFloat(novoVal);
        if(!isNaN(v)) { window.carrinho[index].val = v; renderCarrinho(); }
    }
}

window.delCar = function(i) { window.carrinho.splice(i,1); renderCarrinho(); }
window.cadastrarNovoNaVenda = function() { window.retornoVenda=true; window.nav('clientes'); }
window.cadastrarNovoNaOS = function() { window.retornoOS=true; window.nav('clientes'); }

window.finalizarVenda = async function() {
    if(!window.carrinho.length) return alert("VAZIO");
    const cli = document.getElementById('v-cli').value || "CONSUMIDOR";
    const desconto = parseFloat(document.getElementById('v-desc').value) || 0;
    
    // Salva Itens
    for(let i of window.carrinho) {
        await addDoc(collection(db,"logs"), {tipo:i.tipo=='P'?'PRODUTO':'SERVICO', desc:i.nome, valor:i.val, cliente:cli, data:new Date().toISOString()});
    }
    // Salva Desconto se houver
    if(desconto > 0) {
        await addDoc(collection(db,"logs"), {tipo:'DESCONTO', desc:'DESCONTO PROMOCIONAL', valor: -desconto, cliente:cli, data:new Date().toISOString()});
    }

    const subtotal = window.carrinho.reduce((a,b)=>a+b.val,0);

    window.shareData = {
        tipo:'VENDA', 
        cliente:cli, 
        itens:window.carrinho, 
        subtotal: subtotal,
        desconto: desconto,
        total: subtotal - desconto
    };
    
    window.carrinho=[]; 
    document.getElementById('v-cli').value='';
    document.getElementById('v-desc').value='';
    renderCarrinho();
    
    abrirModalShare();
}

// --- OS ---
window.addFotoOS = function(idx) { window.currentFotoIndex = idx; document.getElementById('os-foto-input').click(); }
window.processFotoOS = function(inp) {
    if(inp.files && inp.files[0]) {
         const r = new FileReader(); r.onload = e => { const i = new Image(); i.src = e.target.result; i.onload = () => { const c = document.createElement('canvas'); const x = c.getContext('2d'); let w=i.width, h=i.height; if(w>h){if(w>400){h*=400/w;w=400}}else{if(h>400){w*=400/h;h=400}}; c.width=w; c.height=h; x.drawImage(i,0,0,w,h); window.osFotos[window.currentFotoIndex] = c.toDataURL('image/jpeg', 0.6); renderFotosOS(); } }; r.readAsDataURL(inp.files[0]);
    }
}
function renderFotosOS() {
    const slots = document.querySelectorAll('.os-foto-slot');
    window.osFotos.forEach((f, i) => { if(f) slots[i].innerHTML = `<img src="${f}">`; else slots[i].innerHTML = `<i class="fas fa-camera"></i>`; });
}

window.buscarItemOS = function(txt, force=false) {
    const box = document.getElementById('sug-os-item');
    if(!txt && !force) { box.style.display='none'; return; }
    
    const term = (txt||'').toUpperCase();
    const prods = window.db.produtos.filter(i => (i.nome||'').toUpperCase().includes(term)).slice(0,5);
    const servs = window.db.servicos.filter(i => (i.nome||'').toUpperCase().includes(term)).slice(0,5);
    
    let html = '';
    if(prods.length) html += `<div class="sug-header">PRODUTOS</div>` + prods.map(i => `<div class="item-sug" onclick="addItemOS('${i.nome}', ${i.precoVenda})">${i.nome} - R$ ${i.precoVenda}</div>`).join('');
    if(servs.length) html += `<div class="sug-header">SERVIÇOS</div>` + servs.map(i => `<div class="item-sug" onclick="addItemOS('${i.nome}', ${i.precoVenda})">${i.nome} - R$ ${i.precoVenda}</div>`).join('');
    
    if(html) { box.innerHTML = html; box.style.display='block'; } else { box.style.display='none'; }
}

window.addItemOS = function(nome, val) { window.carrinhoOS.push({nome, val}); renderItemsOS(); document.getElementById('s-busca-item').value = ''; document.getElementById('sug-os-item').style.display='none'; }

window.renderItemsOS = function() {
    const l = document.getElementById('os-lista-itens');
    if(!window.carrinhoOS.length) { l.innerHTML = '<div style="text-align:center;color:#ccc;font-size:10px">NENHUM ITEM</div>'; document.getElementById('s-total-display').innerText='TOTAL: R$ 0,00'; return; }
    
    let subtotal = 0;
    l.innerHTML = window.carrinhoOS.map((i,x) => {
        subtotal += i.val;
        return `<div style="display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #eee;align-items:center;font-size:12px">
            <span onclick="editItemOS(${x})" style="flex:1;cursor:pointer">${i.nome}</span>
            <span onclick="editItemOS(${x})" style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold; color:var(--primary)">
                <i class="fas fa-pen" style="font-size:10px; color:#555"></i> R$ ${i.val.toFixed(2)}
            </span>
            <i class="fas fa-trash" style="color:red;cursor:pointer;margin-left:8px" onclick="delItemOS(${x})"></i>
        </div>`;
    }).join('');
    
    const desconto = parseFloat(document.getElementById('s-desc').value) || 0;
    const totalFinal = subtotal - desconto;
    document.getElementById('s-total-display').innerText = 'TOTAL: R$ ' + totalFinal.toFixed(2);
}

window.editItemOS = function(index) {
    const item = window.carrinhoOS[index];
    const novoVal = prompt(`Alterar valor de ${item.nome}:`, item.val);
    if(novoVal !== null) { const v = parseFloat(novoVal); if(!isNaN(v)) { window.carrinhoOS[index].val = v; renderItemsOS(); } }
}
window.delItemOS = function(i) { window.carrinhoOS.splice(i,1); renderItemsOS(); }

window.salvarOS = async function() {
    const id = document.getElementById('os-id').value;
    const statusOrig = document.getElementById('os-status-orig').value;
    const subtotal = window.carrinhoOS.reduce((a,b)=>a+b.val,0);
    const desconto = parseFloat(document.getElementById('s-desc').value) || 0;
    
    const os = {
        cliente: document.getElementById('s-cli').value,
        modelo: document.getElementById('s-mod').value,
        defeito: document.getElementById('s-def').value,
        senha: document.getElementById('s-senha').value,
        valor: subtotal - desconto, // Valor Final
        desconto: desconto,         // Salva desconto
        itens: window.carrinhoOS, 
        fotos: window.osFotos,
        status: statusOrig || 'pecas',
        data: new Date().toISOString()
    };
    if(id) await updateDoc(doc(db,"os_ativa",id), os); else await addDoc(collection(db,"os_ativa"), os);
    limparOS();
}

window.renderKanban = function() {
    const c = {pecas:'', pgto:'', retirado:''};
    const flow = ['pecas', 'pgto', 'retirado'];

    window.db.os.forEach(o => {
        const currentIdx = flow.indexOf(o.status);
        let navBtns = '';
        if(currentIdx > 0) navBtns += `<button class="btn-mini btn-dark" onclick="moveOS('${o.id}', -1)"><i class="fas fa-arrow-left"></i></button>`;
        if(currentIdx < 2) navBtns += `<button class="btn-mini btn-dark" onclick="moveOS('${o.id}', 1)"><i class="fas fa-arrow-right"></i></button>`;
        else navBtns += `<button class="btn-mini btn-primary" onclick="arqOS('${o.id}')"><i class="fas fa-archive"></i></button>`;

        c[o.status] += `
        <div class="os-card ${o.status}">
            <b>${o.cliente}</b>
            <div>${o.modelo}</div>
            <div style="font-weight:bold; color:var(--primary)">R$ ${o.valor.toFixed(2)}</div>
            <div style="display:flex; justify-content:space-between; margin-top:5px">
                   <div style="display:flex; gap:5px">${navBtns}</div>
                   <div style="display:flex; gap:5px">
                      <button class="btn-mini btn-info" onclick="editOS('${o.id}')"><i class="fas fa-pen"></i></button>
                      <button class="btn-mini btn-success" onclick="shareOS('${o.id}')"><i class="fas fa-share-alt"></i></button>
                      <button class="btn-mini btn-dark" style="background:#c62828" onclick="delOS('${o.id}')"><i class="fas fa-trash"></i></button>
                   </div>
            </div>
        </div>`;
    });
    document.getElementById('k-pecas').innerHTML = c.pecas;
    document.getElementById('k-pgto').innerHTML = c.pgto;
    document.getElementById('k-retirado').innerHTML = c.retirado;
}

window.delOS = async function(id) {
    if(prompt("SENHA ADM:") !== SENHA) return;
    if(confirm("Deseja EXCLUIR permanentemente esta OS?")) { await deleteDoc(doc(db, "os_ativa", id)); }
}

window.moveOS = async function(id, dir) {
    const flow = ['pecas', 'pgto', 'retirado'];
    const o = window.db.os.find(i=>i.id===id);
    const nextIdx = flow.indexOf(o.status) + dir;
    if(nextIdx >= 0 && nextIdx < flow.length) await updateDoc(doc(db,"os_ativa",id), {status: flow[nextIdx]});
}

window.arqOS = async function(id) {
    if(!confirm("Arquivar?")) return;
    const o = window.db.os.find(i=>i.id===id);
    await addDoc(collection(db,"logs"), {tipo:'SERVICO', desc:'OS: '+o.modelo, valor:o.valor, cliente:o.cliente, data:new Date().toISOString()});
    await deleteDoc(doc(db,"os_ativa",id));
}

window.editOS = function(id) {
    const o = window.db.os.find(i=>i.id===id);
    document.getElementById('os-id').value=id; 
    document.getElementById('s-cli').value=o.cliente;
    document.getElementById('s-mod').value=o.modelo; 
    document.getElementById('os-status-orig').value = o.status;
    
    let def = o.defeito; let sen = o.senha || '';
    if(!sen && def && def.includes(' | S: ')) { const p = def.split(' | S: '); def = p[0]; sen = p[1]; }
    document.getElementById('s-def').value=def;
    document.getElementById('s-senha').value=sen;
    
    // Carrega Desconto
    document.getElementById('s-desc').value = o.desconto || '';

    if(o.itens && Array.isArray(o.itens)) window.carrinhoOS = o.itens;
    else window.carrinhoOS = o.valor > 0 ? [{nome: 'Serviço/Peça (Antigo)', val: o.valor}] : [];
    
    renderItemsOS();
    window.osFotos = o.fotos || [null, null, null, null];
    renderFotosOS();
}

window.shareOS = function(id) {
    const o = window.db.os.find(i=>i.id===id);
    let obsTexto = o.defeito; let senhaTexto = o.senha || '';
    if(!senhaTexto && obsTexto && obsTexto.includes(' | S: ')) { const p = obsTexto.split(' | S: '); obsTexto = p[0]; senhaTexto = p[1]; }

    const itensList = (o.itens && o.itens.length) ? o.itens : [{nome:o.modelo, val:o.valor}];
    const subtotal = itensList.reduce((a,b)=>a+b.val,0);
    const desc = o.desconto || 0;

    window.shareData={
        tipo:'OS', 
        cliente:o.cliente, 
        itens: itensList, 
        subtotal: subtotal,
        desconto: desc,
        total: o.valor, // Valor final
        obs: obsTexto,
        senha: senhaTexto,
        fotos: o.fotos || []
    };
    abrirModalShare();
}

// --- CLIENTE/ESTOQUE ---
window.salvarCliente = async function() {
    const id = document.getElementById('c-id').value;
    const d = { nome: document.getElementById('c-nome').value, tel: document.getElementById('c-tel').value, bairro: document.getElementById('c-bairro').value, cidade: document.getElementById('c-cidade').value, foto: window.tempImg||'' };
    if(id) await updateDoc(doc(db,"clientes",id), d); else await addDoc(collection(db,"clientes"), d);
    limparCli();
    if(window.retornoVenda) { window.retornoVenda=false; window.nav('vendas'); document.getElementById('v-cli').value=d.nome; }
    if(window.retornoOS) { window.retornoOS=false; window.nav('servicos'); document.getElementById('s-cli').value=d.nome; }
}
window.listarCli = function() { document.getElementById('lista-clientes').innerHTML = window.db.clientes.map(renderCliCard).join(''); }

function renderCliCard(c) {
    const zapLink = c.tel ? `https://wa.me/55${c.tel.replace(/\D/g,'')}` : '#';
    return `<div class="card" style="padding:10px; display:flex; justify-content:space-between; align-items:center">
        <div style="display:flex; gap:10px; align-items:center">
            ${c.foto?`<img src="${c.foto}" style="width:40px;height:40px;border-radius:50%">`:`<div style="width:40px;height:40px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center"><i class="fas fa-user"></i></div>`}
            <div>
                <b>${c.nome}</b><br>
                <span style="font-size:11px">${c.tel}</span>
                <div style="font-size:9px; color:#666; font-weight:bold">${c.bairro||''} ${c.cidade?'- '+c.cidade:''}</div>
            </div>
        </div>
        <div style="display:flex; gap:5px">
            ${c.tel ? `<a href="${zapLink}" target="_blank" class="btn-mini btn-zap" style="width:25px; text-decoration:none"><i class="fab fa-whatsapp"></i></a>` : ''}
            <button class="btn-mini btn-info" onclick="edtCli('${c.id}')"><i class="fas fa-pen"></i></button> 
            <button class="btn-mini btn-dark" onclick="del('clientes','${c.id}')"><i class="fas fa-trash"></i></button>
        </div>
    </div>`;
}

window.edtCli = function(id) {
    const c = window.db.clientes.find(i=>i.id===id);
    document.getElementById('c-id').value=id; document.getElementById('c-nome').value=c.nome; document.getElementById('c-tel').value=c.tel;
    document.getElementById('c-bairro').value=c.bairro||''; document.getElementById('c-cidade').value=c.cidade||'';
    window.tempImg=c.foto; 
    const view = document.getElementById('c-foto-view'); view.src=c.foto||''; 
    if(c.foto) view.classList.add('has-img'); else view.classList.remove('has-img');
    document.getElementById('form-cli').scrollIntoView();
}

window.salvarProduto = async function(t) {
    const col = t==='prod'?'produtos':'servicos_cad';
    const d = { nome: document.getElementById('p-nome').value, precoVenda: parseFloat(document.getElementById('p-venda').value||0), qtd: document.getElementById('p-qtd').value, custo: document.getElementById('p-custo').value, foto: window.tempImg||'' };
    const id = document.getElementById('p-id').value;
    if(id) await updateDoc(doc(db,col,id), d); else await addDoc(collection(db,col), d);
    limparEstoque();
}
window.listarEstoque = function(t) {
    const l = t==='prod'?window.db.produtos:window.db.servicos; const col=t==='prod'?'produtos':'servicos_cad';
    document.getElementById('lista-estoque').innerHTML = l.map(i => `<div class="card" style="padding:10px; display:flex; justify-content:space-between; align-items:center"><div style="display:flex;gap:10px;align-items:center">${i.foto?`<img src="${i.foto}" style="width:40px;height:40px;border-radius:50%">`:`<div style="width:40px;height:40px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center"><i class="fas fa-box"></i></div>`}<div><b>${i.nome}</b><br>R$ ${i.precoVenda}</div></div><div><button class="btn-mini btn-info" onclick="edtProd('${col}','${i.id}')"><i class="fas fa-pen"></i></button> <button class="btn-mini btn-dark" onclick="del('${col}','${i.id}')"><i class="fas fa-trash"></i></button></div></div>`).join('');
}
window.edtProd = function(col, id) {
    const i = (col=='produtos'?window.db.produtos:window.db.servicos).find(x=>x.id===id);
    document.getElementById('p-id').value=id; document.getElementById('p-nome').value=i.nome; document.getElementById('p-venda').value=i.precoVenda; document.getElementById('p-qtd').value=i.qtd||''; document.getElementById('p-custo').value=i.custo||'';
    document.getElementById('p-custo').type = 'password'; document.getElementById('btn-ver-custo').style.display = 'block';
    window.tempImg=i.foto; const view = document.getElementById('p-foto-view'); view.src=i.foto||''; if(i.foto) view.classList.add('has-img'); else view.classList.remove('has-img'); document.getElementById('page-estoque').querySelector('.card').scrollIntoView();
}
window.revelarCusto = function() { if(prompt("SENHA ADM:") === SENHA) { document.getElementById('p-custo').type = 'number'; document.getElementById('btn-ver-custo').style.display = 'none'; } }

// --- RELATÓRIOS ---
window.renderRelatorio = function() {
    const f = document.getElementById('r-filtro').value; const now = new Date();
    const searchTxt = document.getElementById('r-search').value.toUpperCase(); 
    
    const logs = window.db.logs.filter(l => {
        const d = new Date(l.data);
        let matchDate = false;
        if(f=='dia') matchDate = d.toDateString()===now.toDateString();
        else if(f=='semana') matchDate = (now-d) < 604800000;
        else if(f=='mes') matchDate = d.getMonth()===now.getMonth();
        else matchDate = d.getFullYear()===now.getFullYear();
        
        let matchText = true;
        if(searchTxt) {
            matchText = (l.cliente && l.cliente.toUpperCase().includes(searchTxt)) || 
                        (l.desc && l.desc.toUpperCase().includes(searchTxt));
        }
        return matchDate && matchText;
    });

    let t = 0;
    document.getElementById('r-hist').innerHTML = logs.map(l => {
        t+=l.valor;
        // ITEM DE HISTORICO COM CLIQUE NO NOME PARA FILTRAR
        return `<div style="padding:8px; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center">
            <div style="font-size:10px">
                <b>${l.desc}</b><br>
                <span style="color:blue; cursor:pointer; text-decoration:underline" onclick="filtrarCliente('${l.cliente}')">${l.cliente}</span>
            </div>
            <div style="text-align:right">
                <b style="color:${l.valor<0?'red':'var(--primary)'}">R$ ${l.valor.toFixed(2)}</b><br>
                <div style="display:flex; justify-content:flex-end; gap:5px">
                   <i class="fas fa-eye" style="color:green; cursor:pointer" onclick="verExtratoCliente('${l.cliente}')" title="Ver Histórico Completo"></i>
                   <i class="fas fa-share-alt" style="color:#555; cursor:pointer" onclick="shareLog('${l.id}')"></i>
                   <i class="fas fa-pen" style="color:blue; cursor:pointer" onclick="editLog('${l.id}')"></i>
                   <i class="fas fa-trash" style="color:red; cursor:pointer" onclick="del('logs','${l.id}')"></i>
                </div>
            </div>
        </div>`;
    }).join('');
    document.getElementById('r-total').innerText = "R$ " + t.toFixed(2);
    
    const rank = (k, d) => {
        const c={}; window.db.logs.forEach(i => { if((k=='CLI' || (k=='PROD' && i.tipo=='PRODUTO') || (k=='SERV' && i.tipo!='PRODUTO'))) { const n = k=='CLI'?i.cliente:i.desc; c[n]=(c[n]||0)+1; } });
        document.getElementById(d).innerHTML = Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>`<div class="rank-item"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
    }
    rank('CLI','rank-cli'); rank('PROD','rank-prod'); rank('SERV','rank-serv');
}

window.filtrarCliente = function(nome) {
    document.getElementById('r-search').value = nome;
    document.getElementById('r-filtro').value = 'ano'; // Muda para ano para ver tudo
    renderRelatorio();
}

window.verExtratoCliente = function(nome) {
    const itens = window.db.logs.filter(l => l.cliente === nome).map(l => ({nome: l.desc + ` (${new Date(l.data).toLocaleDateString()})`, val: l.valor}));
    const total = itens.reduce((a,b)=>a+b.val,0);
    window.shareData = { tipo: 'EXTRATO CLIENTE', cliente: nome, itens: itens, subtotal: total, desconto: 0, total: total };
    abrirModalShare();
}

// --- EXTRAS E SHARE ---
window.del = async function(c, id) { if(c === 'logs') { if(!confirm("Apagar?")) return; await deleteDoc(doc(db,c,id)); return; } if(prompt("SENHA ADM:")===SENHA) await deleteDoc(doc(db,c,id)); }
window.toggleCusto = function() { if(prompt("SENHA ADM:")===SENHA) document.getElementById('box-custo').style.display='block'; }
window.editLog = async function(id) { const l = window.db.logs.find(i=>i.id===id); const novoVal = prompt("NOVO VALOR:", l.valor); const novaDesc = prompt("NOVA DESCRIÇÃO:", l.desc); if(novoVal && novaDesc) await updateDoc(doc(db,"logs",id), { valor: parseFloat(novoVal), desc: novaDesc }); }
window.shareLog = function(id) { const l = window.db.logs.find(i=>i.id===id); window.shareData = { tipo: 'HISTORICO', cliente: l.cliente, itens: [{nome:l.desc, val:l.valor}], subtotal:l.valor, desconto:0, total: l.valor }; abrirModalShare(); }

window.abrirModalShare = function(m) {
    if(m=='orcamento' && window.carrinho.length) {
        const sub = window.carrinho.reduce((a,b)=>a+b.val,0);
        const desc = parseFloat(document.getElementById('v-desc').value) || 0;
        window.shareData = { tipo: 'ORCAMENTO', cliente: document.getElementById('v-cli').value, itens: window.carrinho, subtotal: sub, desconto: desc, total: sub - desc };
        abrirModalShare();
    }
}
window.abrirModalShare = function() { document.getElementById('modal-overlay').style.display='flex'; }
window.fecharModal = function(e) { if(e.target.id=='modal-overlay') document.getElementById('modal-overlay').style.display='none'; }

// --- IMPRESSÃO AVANÇADA ---
window.acaoShare = function(tipo) {
    const d = window.shareData;
    document.getElementById('modal-overlay').style.display='none'; // Fecha o modal

    let txt = `*${EMPRESA.nome}*\n` +
              `*${d.tipo}*\n` +
              `DATA: ${new Date().toLocaleString()}\n` +
              `CLI: ${d.cliente||'Consumidor'}\n` +
              `----------------\n` + 
              d.itens.map(i=>`${i.nome} ... R$ ${i.val.toFixed(2)}`).join('\n') +
              `\n----------------\n`;
    
    if(d.desconto > 0) txt += `SUBTOTAL: R$ ${d.subtotal.toFixed(2)}\nDESCONTO: -R$ ${d.desconto.toFixed(2)}\n`;
    txt += `*TOTAL FINAL: R$ ${d.total.toFixed(2)}*`;
    
    if(d.obs) txt += `\nOBS: ${d.obs}`;
    if(d.senha) txt += `\nSENHA: ${d.senha}`;

    if(tipo=='zap') window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`);
    
    if(tipo=='print' || tipo=='pdf') {
        let htmlPrint = `
        <div class="p-header">
            <div class="p-title">${EMPRESA.nome}</div>
            <div class="p-info">${EMPRESA.end}</div>
            <div class="p-info">${EMPRESA.cid}</div>
            <div class="p-info">CNPJ: ${EMPRESA.cnpj}</div>
            <div class="p-info">Tel: ${EMPRESA.tel}</div>
            <div class="p-info">${EMPRESA.email}</div>
        </div>
        
        <div style="text-align:center; margin-bottom:10px; border-bottom:1px dashed #000; padding-bottom:5px">
            <b>${d.tipo}</b><br>
            ${new Date().toLocaleString()}
        </div>
        
        <div style="margin-bottom:10px; font-weight:bold; font-size:12px">
            CLIENTE: ${d.cliente || 'CONSUMIDOR'}
        </div>

        <table class="p-table">
            <thead><tr><th>ITEM</th><th style="text-align:right">R$</th></tr></thead>
            <tbody>
                ${d.itens.map(i => `<tr><td>${i.nome}</td><td style="text-align:right">${i.val.toFixed(2)}</td></tr>`).join('')}
            </tbody>
        </table>
        
        <div class="p-line"></div>
        
        <div style="display:flex; justify-content:space-between; font-size:11px">
            <span>SUBTOTAL:</span><span>R$ ${d.subtotal.toFixed(2)}</span>
        </div>`;
        
        if(d.desconto > 0) {
            htmlPrint += `
            <div style="display:flex; justify-content:space-between; font-size:11px; color:black">
                <span>DESCONTO:</span><span>- R$ ${d.desconto.toFixed(2)}</span>
            </div>`;
        }

        htmlPrint += `
        <div class="p-total" style="font-size:18px; border-top:1px solid #000; margin-top:5px; padding-top:5px">
            TOTAL: R$ ${d.total.toFixed(2)}
        </div>`;
        
        if(d.obs || d.senha) {
            htmlPrint += `<div style="margin-top:10px; text-align:left; font-size:11px; border:1px solid #000; padding:5px; border-radius:5px">`;
            if(d.obs) htmlPrint += `<b>OBS:</b> ${d.obs}<br>`;
            if(d.senha) htmlPrint += `<b>SENHA:</b> ${d.senha}<br>`;
            htmlPrint += `</div>`;
        }
        
        if(d.fotos && d.fotos.some(f=>f)) {
            htmlPrint += `<div class="p-imgs">`;
            d.fotos.forEach(f => { if(f) htmlPrint += `<img src="${f}">`; });
            htmlPrint += `</div>`;
        }

        htmlPrint += `
        <div class="p-sign">
            ASSINATURA DO CLIENTE
        </div>
        <div style="text-align:center; margin-top:15px; font-size:9px">OBRIGADO PELA PREFERÊNCIA!</div>
        `;
        
        document.getElementById('area-print').innerHTML = htmlPrint;
        window.print();
    }
}

// --- UTIL ---
window.limparOS = function() { 
    document.querySelectorAll('#page-servicos input').forEach(i=>i.value=''); 
    document.getElementById('os-id').value=''; 
    window.osFotos = [null, null, null, null];
    window.carrinhoOS = []; 
    renderItemsOS();
    renderFotosOS();
}
window.limparCli = function() { document.querySelectorAll('#page-clientes input').forEach(i=>i.value=''); window.tempImg=null; const v = document.getElementById('c-foto-view'); v.src=''; v.classList.remove('has-img'); document.getElementById('c-id').value=''; }
window.limparEstoque = function() { 
    document.querySelectorAll('#page-estoque input').forEach(i=>i.value=''); window.tempImg=null; 
    const v = document.getElementById('p-foto-view'); v.src=''; v.classList.remove('has-img'); document.getElementById('p-id').value='';
    document.getElementById('p-custo').type='number'; 
    document.getElementById('btn-ver-custo').style.display='none';
}
window.maskTel = function(v){ v.value=v.value.replace(/\D/g,"").replace(/^(\d{2})(\d)/g,"($1) $2").replace(/(\d)(\d{4})$/,"$1-$2"); }
window.lerFoto = function(inp, vId) { 
    if(inp.files && inp.files[0]) { 
        const r = new FileReader(); r.onload = e => { const i = new Image(); i.src=e.target.result; i.onload = () => { const c = document.createElement('canvas'); const x = c.getContext('2d'); let w=i.width, h=i.height; if(w>h){if(w>300){h*=300/w;w=300}}else{if(h>300){w*=300/h;h=300}}; c.width=w; c.height=h; x.drawImage(i,0,0,w,h); window.tempImg = c.toDataURL('image/jpeg',0.6); const view = document.getElementById(vId); view.src=window.tempImg; view.classList.add('has-img'); } }; r.readAsDataURL(inp.files[0]); 
    } 
}
