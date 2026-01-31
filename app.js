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

// ESTADO DA ABA DE ESTOQUE
window.estoqueTab = 'prod'; 

// --- NOVA LÓGICA DE PERSISTÊNCIA (MANTER DADOS AO ATUALIZAR) ---
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
            'os-id': document.getElementById('os-id')?.value, // Mantém ID se estiver editando
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
            
            // Restaurar Variáveis Globais
            window.carrinho = estado.carrinhoVenda || [];
            window.carrinhoOS = estado.carrinhoOS || [];
            window.isEditing = estado.inputs.isEditing || false;

            // Restaurar Inputs
            if(estado.inputs) {
                for (const [id, val] of Object.entries(estado.inputs)) {
                    const el = document.getElementById(id);
                    if(el) el.value = val || '';
                }
            }

            // Renderizar Listas
            renderCarrinho();
            renderItemsOS();

            // Navegar para a aba certa
            if(estado.abaAtiva) {
                window.nav(estado.abaAtiva);
            }
        } catch (e) {
            console.error("Erro ao restaurar estado", e);
        }
    } else {
        window.nav('vendas'); // Padrão
    }
}

// Adicionar listener para salvar sempre que digitar algo importante
document.addEventListener('keyup', (e) => {
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        window.salvarEstadoLocal();
    }
});
document.addEventListener('click', () => {
    setTimeout(window.salvarEstadoLocal, 100); // Salva após cliques (navegação, adicionar itens)
});

// --- FIM LÓGICA PERSISTÊNCIA ---

// FUNÇÃO HELPER: REMOVER ACENTOS PARA BUSCA
window.norm = (t) => t ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "";

// ESCUTAS DO BANCO DE DADOS
onSnapshot(collection(db, "clientes"), s => { 
    window.db.clientes = s.docs.map(d=>({id:d.id, ...d.data()})); 
    if(isPg('clientes')) listarCli(); 
});
onSnapshot(collection(db, "produtos"), s => { window.db.produtos = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('estoque') && window.estoqueTab=='prod') renderListaEstoque(); });
onSnapshot(collection(db, "servicos_cad"), s => { window.db.servicos = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('estoque') && window.estoqueTab=='serv') renderListaEstoque(); });

// ATUALIZAÇÃO KANBAN (OS ATIVA)
onSnapshot(query(collection(db, "os_ativa"), orderBy("data", "desc")), s => { 
    window.db.os = s.docs.map(d=>({id:d.id, ...d.data()})); 
    renderKanban(); 
});

onSnapshot(query(collection(db, "logs"), orderBy("data", "desc")), s => { window.db.logs = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('relatorio')) renderRelatorio(); });

// ATUALIZAÇÃO DÍVIDAS
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
    
    // Atualiza botão da nav bar
    const navBtn = document.querySelector(`button[onclick="nav('${p}', this)"]`);
    if(navBtn) navBtn.classList.add('active');
    else if(el) el.classList.add('active');
}

window.forcarAtualizacao = async function() { if(!confirm("Atualizar sistema?")) return; window.location.reload(true); }

/* --- LÓGICA DE LUPA INTELIGENTE (TOGGLE) --- */
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
    if(restante > 0) {
        document.getElementById('v-restante').innerHTML = `<span style="color:red">RESTANTE (FIADO): R$ ${restante.toFixed(2)}</span>`;
    } else {
        document.getElementById('v-restante').innerHTML = `<span style="color:green">QUITADO</span>`;
    }
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
    const restante = totalLiquido - sinal;

    document.getElementById('s-total-display').innerText = 'TOTAL: R$ ' + subtotal.toFixed(2);
    document.getElementById('s-restante-display').innerText = 'RESTANTE: R$ ' + restante.toFixed(2);
}
window.setGarantiaOS = function(idx, val) { window.carrinhoOS[idx].garantia = val; window.salvarEstadoLocal(); }
window.editItemOS = function(index) { const i=window.carrinhoOS[index]; const n=prompt(`Valor TOTAL ${i.nome}:`, i.val); if(n!==null){const v=parseFloat(n); if(!isNaN(v)){window.carrinhoOS[index].val=v; renderItemsOS(); window.salvarEstadoLocal();}} }
window.delItemOS = function(i) { window.carrinhoOS.splice(i,1); renderItemsOS(); window.salvarEstadoLocal(); }

window.salvarOS = async function() {
    const id = document.getElementById('os-id').value; const cliField = document.getElementById('s-cli').value.trim();
    if(!cliField) return alert("ERRO: OBRIGATÓRIO NOME DO CLIENTE NA O.S.!");
    
    const sub = window.carrinhoOS.reduce((a,b)=>a+b.val,0); 
    const desc = parseFloat(document.getElementById('s-desc').value) || 0;
    const sinal = parseFloat(document.getElementById('s-sinal').value) || 0;
    const total = sub - desc;

    let numOS = 0;
    if(!id) {
        const configRef = doc(db, "config", "contador"); const configSnap = await getDoc(configRef);
        if (configSnap.exists()) { numOS = configSnap.data().last + 1; await updateDoc(configRef, { last: numOS }); } 
        else { numOS = 1; await setDoc(configRef, { last: 1 }); }
    }
    
    let statusFinal = document.getElementById('os-status-orig').value || 'pecas';
    if (window.isEditing) {
        statusFinal = 'retirado'; 
        window.isEditing = false; 
    } else if (!id) {
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
        status: statusFinal, 
        data: new Date().toISOString() 
    };

    if(!id) os.num = numOS;
    if(id) await updateDoc(doc(db,"os_ativa",id), os); else await addDoc(collection(db,"os_ativa"), os);
    limparOS(); alert("SALVO! OS Nº " + (id ? "ATUALIZADA" : numOS));
}

window.limparOS = function() {
    window.isEditing = false; 
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
        
        c[o.status] += `<div id="os-card-${o.id}" class="os-card ${o.status}"><div>${numDisplay}<b>${o.cliente}</b></div><div>${o.modelo}</div><div style="font-weight:bold; color:var(--primary)">FALTA: R$ ${restanteVal.toFixed(2)}</div><div class="actions-row">${nav}</div><div class="actions-row"><button class="btn-mini blue" onclick="editOS('${o.id}')"><i class="fas fa-pen"></i></button><button class="btn-mini zap" onclick="shareOS('${o.id}')"><i class="fas fa-share-alt"></i></button><button class="btn-mini red" onclick="delOS('${o.id}')"><i class="fas fa-trash"></i></button></div></div>`;
    });
    document.getElementById('k-pecas').innerHTML = c.pecas; document.getElementById('k-pgto').innerHTML = c.pgto; document.getElementById('k-retirado').innerHTML = c.retirado;
}
window.delOS = async function(id) { abrirModalSenha(async () => { document.getElementById('modal-overlay').style.display='none'; if(confirm("EXCLUIR OS?")) await deleteDoc(doc(db, "os_ativa", id)); }); }
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

window.verHistoricoOS = function() {
    abrirModalSenha(() => {
        document.getElementById('modal-overlay').style.display = 'none';
        let html = '';
        if(window.db.os_hist.length === 0) html = '<div style="padding:20px;text-align:center;color:#999">VAZIO</div>';
        else {
            html = window.db.os_hist.map(o => {
                return `<div class="fin-item" style="background:white; border-left-color:#666"><div class="fin-date">${new Date(o.data).toLocaleDateString()} - #${o.num||'S/N'}</div><b>${o.cliente}</b> - ${o.modelo}<br>R$ ${o.valor.toFixed(2)}<button class="btn-mini blue" style="margin-top:5px; width:100%" onclick="reabrirOS('${o.id}')">REABRIR (CORRIGIR)</button></div>`;
            }).join('');
        }
        document.getElementById('ext-nome').innerText = "HISTÓRICO OS"; document.getElementById('ext-lista').innerHTML = html; document.getElementById('ext-share-area').style.display = 'none'; document.getElementById('modal-extrato').style.display = 'flex';
    });
}

window.reabrirOS = async function(id) {
    if(!confirm("REABRIR PARA EDIÇÃO?\n\nIsso trará a OS de volta para a tela inicial.")) return;
    const o = window.db.os_hist.find(x => x.id === id);
    if(!o) return;

    window.isEditing = true; 
    document.getElementById('os-id').value = ''; 
    document.getElementById('s-cli').value = o.cliente;
    document.getElementById('s-mod').value = o.modelo;
    document.getElementById('s-senha').value = o.senha;
    document.getElementById('s-def').value = o.defeito;
    document.getElementById('s-desc').value = o.desconto;
    document.getElementById('s-sinal').value = o.sinal;

    window.osFotos = o.fotos || [null,null,null,null];
    const slots = document.querySelectorAll('.os-foto-slot'); 
    window.osFotos.forEach((f, i) => { 
        if(f) slots[i].innerHTML = `<img src="${f}">`; 
        else slots[i].innerHTML = `<i class="fas fa-camera"></i>`; 
    });

    window.carrinhoOS = o.itens || [];
    renderItemsOS();

    if (o.num) {
        const q = query(collection(db, "dividas"), where("origem_os", "==", o.num));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (d) => await deleteDoc(doc(db, "dividas", d.id)));
    }
    
    await deleteDoc(doc(db, "os_historico", id));
    document.getElementById('modal-extrato').style.display = 'none';
    window.nav('servicos');
    alert("DADOS RECUPERADOS! EDITE E SALVE.");
    window.salvarEstadoLocal();
}

window.editOS = function(id) {
    const o = window.db.os.find(i=>i.id===id); 
    document.getElementById('os-id').value=id; document.getElementById('s-cli').value=o.cliente; document.getElementById('s-mod').value=o.modelo; document.getElementById('os-status-orig').value = o.status; document.getElementById('s-def').value=o.defeito; document.getElementById('s-senha').value=o.senha; 
    document.getElementById('s-desc').value = o.desconto || '';
    document.getElementById('s-sinal').value = o.sinal || '';
    window.carrinhoOS = (o.itens && Array.isArray(o.itens)) ? o.itens : (o.valor>0?[{nome: 'Serviço Antigo', val: o.valor, qtd: 1, garantia: '90 DIAS', tipo:'S'}]:[]);
    renderItemsOS(); 
    window.osFotos = o.fotos || [null, null, null, null]; const slots = document.querySelectorAll('.os-foto-slot'); window.osFotos.forEach((f, i) => { if(f) slots[i].innerHTML = `<img src="${f}">`; else slots[i].innerHTML = `<i class="fas fa-camera"></i>`; }); document.getElementById('page-servicos').scrollIntoView();
    window.salvarEstadoLocal();
}
window.shareOS = function(id) {
    const o = window.db.os.find(i=>i.id===id); const it = (o.itens && o.itens.length) ? o.itens : [{nome:o.modelo, val:o.valor, qtd:1, garantia:'90 DIAS'}];
    const sub = it.reduce((a,b)=>a+b.val,0); const desc = o.desconto || 0; const numDisplay = o.num ? `Nº ${o.num}` : 'S/N';
    window.shareData={ tipo:'OS '+numDisplay, cliente:o.cliente, itens: it, subtotal: sub, desconto: desc, sinal: o.sinal || 0, total: o.valor, obs: o.defeito, senha: o.senha, fotos: o.fotos || [] };
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
        document.getElementById('ext-nome').innerText = "CARTEIRA DE DEVEDORES"; document.getElementById('ext-lista').innerHTML = html; document.getElementById('ext-share-area').style.display = 'none'; document.getElementById('ext-preview-box').style.display = 'none'; document.getElementById('modal-extrato').style.display = 'flex';
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
    document.getElementById('ext-nome').innerText = "FINANCEIRO: " + nome; document.getElementById('ext-lista').innerHTML = html; document.getElementById('ext-share-area').style.display = 'none'; document.getElementById('ext-preview-box').style.display = 'none'; document.getElementById('modal-extrato').style.display = 'flex';
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

window.togglePriv = function() { window.verValores = !window.verValores; const ico = document.getElementById('eye-rel'); if(window.verValores) { ico.classList.remove('fa-eye'); ico.classList.add('fa-eye-slash'); ico.classList.add('fa-eye'); } else { ico.classList.remove('fa-eye-slash'); ico.classList.add('fa-eye'); } renderRelatorio(); }
window.renderRelatorio = function() {
    const f = document.getElementById('r-filtro').value; const now = new Date(); const searchTxt = document.getElementById('r-search').value; 
    const logsFiltrados = window.db.logs.filter(l => {
        const d = new Date(l.data); let matchDate = false;
        if(f=='dia') matchDate = d.toDateString()===now.toDateString(); else if(f=='semana') matchDate = (now-d) < 604800000; else if(f=='mes') matchDate = d.getMonth()===now.getMonth(); else matchDate = d.getFullYear()===now.getFullYear();
        let matchText = true; 
        if(searchTxt) { matchText = (l.cliente && window.norm(l.cliente).includes(window.norm(searchTxt))); } 
        return matchDate && matchText;
    });
    let totalGeral = 0; let lucroGeral = 0; const clientesMap = {}; 
    logsFiltrados.forEach(l => {
        totalGeral += l.valor; let custoItem = 0; if(l.tipo === 'PRODUTO' || l.tipo === 'P') { const prod = window.db.produtos.find(p => p.nome === l.desc); if(prod && prod.custo) custoItem = parseFloat(prod.custo) * (l.qtd || 1); } lucroGeral += (l.valor - custoItem);
        if(!clientesMap[l.cliente]) { clientesMap[l.cliente] = { nome: l.cliente, total: 0, count: 0, lastDate: l.data, lastOS: null }; } 
        clientesMap[l.cliente].total += l.valor; clientesMap[l.cliente].count++;
        if (new Date(l.data) > new Date(clientesMap[l.cliente].lastDate)) { clientesMap[l.cliente].lastDate = l.data; }
        if (l.osNum) clientesMap[l.cliente].lastOS = l.osNum;
    });
    
    const clientesArray = Object.values(clientesMap).sort((a,b) => b.total - a.total);
    document.getElementById('r-hist').innerHTML = clientesArray.map(c => {
        const temDivida = window.db.dividas.some(d => d.cliente === c.nome && d.restante > 0.01);
        const iconDivida = temDivida ? '<span style="font-size:14px">⚠️</span> ' : '';
        const osTxt = c.lastOS ? `Nº ${c.lastOS}` : 'S/N';
        return `<div style="padding:10px; border-bottom:1px solid #f0f0f0; display:flex; justify-content:space-between; align-items:center">
            <div style="font-size:10px">${iconDivida}<b>${c.nome}</b><br><span style="color:#777">${new Date(c.lastDate).toLocaleDateString()} - ${osTxt}</span></div>
            <div style="text-align:right"><b style="color:var(--primary); font-size:11px">R$ ${c.total.toFixed(2)}</b><br><div class="actions-row" style="justify-content:flex-end"><button class="btn-mini green" onclick="abrirExtratoCliente('${c.nome}')"><i class="fas fa-eye"></i></button> <button class="btn-mini blue" onclick="abrirOpcoesEdicao('${c.nome}')"><i class="fas fa-pen"></i></button></div></div>
        </div>`;
    }).join('');

    if(clientesArray.length === 0) document.getElementById('r-hist').innerHTML = '<div style="text-align:center; padding:20px; color:#ccc">NENHUM DADO ENCONTRADO</div>';
    document.getElementById('r-total').innerText = window.verValores ? "R$ " + totalGeral.toFixed(2) : "****"; document.getElementById('r-lucro').innerText = window.verValores ? "R$ " + lucroGeral.toFixed(2) : "****";
    
    const rank = (k, d) => { 
        const c={}; 
        window.db.logs.forEach(i => { 
            if(i.tipo === 'DESCONTO') return;
            const isProd = (i.tipo === 'PRODUTO' || i.tipo === 'P'); 
            const isServ = (i.tipo === 'SERVICO' || i.tipo === 'S'); 
            const qtd = i.qtd || 1; 
            if(k === 'CLI') { const n = i.cliente; c[n] = (c[n]||0) + 1; } 
            else if(k === 'PROD' && isProd) { const n = i.desc; c[n] = (c[n]||0) + qtd; } 
            else if(k === 'SERV' && isServ) { const n = i.desc; c[n] = (c[n]||0) + qtd; } 
        }); 
        document.getElementById(d).innerHTML = Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>`<div class="rank-item"><span>${x[0]}</span><b>${x[1]}</b></div>`).join(''); 
    }
    rank('CLI','rank-cli'); rank('PROD','rank-prod'); rank('SERV','rank-serv');
}

window.abrirOpcoesEdicao = function(nome) { document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('modal-content-default').innerHTML = `<h3 style="justify-content:center">EDITAR</h3><div style="font-size:11px; text-align:center; margin-bottom:12px; font-weight:bold; color:var(--primary)">${nome}</div><button class="btn btn-primary" onclick="editarClienteRapido('${nome}')"><i class="fas fa-user-edit"></i> DADOS CLIENTE</button><button class="btn btn-dark" style="margin-top:10px" onclick="editarMovimentacaoCliente('${nome}')"><i class="fas fa-list-ul"></i> MOVIMENTAÇÕES</button><button class="btn" style="background:#666; margin-top:10px" onclick="fecharModal({target:{id:'modal-overlay'}})">CANCELAR</button>`; }
window.editarClienteRapido = function(nome) { fecharModal({target:{id:'modal-overlay'}}); const cli = window.db.clientes.find(c => c.nome === nome); if(cli) { window.nav('clientes'); window.edtCli(cli.id); } else { if(confirm("Cliente não encontrado. Cadastrar?")) { window.nav('clientes'); document.getElementById('c-nome').value = nome; } } }

window.editarMovimentacaoCliente = function(nome) {
    fecharModal({target:{id:'modal-overlay'}}); const logs = window.db.logs.filter(l => l.cliente === nome).sort((a,b) => new Date(b.data) - new Date(a.data));
    let html = `<div style="padding:10px; background:#ffebee; border-bottom:1px solid #d32f2f; text-align:center; color:#d32f2f; font-weight:bold; font-size:10px"><button id="btn-del-sel" class="btn" style="background:#d32f2f; padding:8px; display:none; margin-bottom:10px" onclick="excluirSelecionados('${nome}')"><i class="fas fa-trash"></i> EXCLUIR SELECIONADOS</button>CLIQUE NO LÁPIS PARA EDITAR DATA</div>`;
    logs.forEach(i => { 
        const dataVal = i.data.split('T')[0]; 
        html += `<div style="background:white; padding:8px; border-bottom:1px solid #eee; display:flex; align-items:center;"><input type="checkbox" class="check-log" value="${i.id}" onchange="toggleBtnDelete()"><div style="flex:1"><div id="date-display-${i.id}" style="display:flex; align-items:center; gap:5px; font-size:9px; color:#555"><span>${new Date(i.data).toLocaleDateString('pt-BR')}</span><i class="fas fa-pencil-alt" style="cursor:pointer; color:orange" onclick="toggleEditDate('${i.id}')"></i></div><div id="date-edit-${i.id}" style="display:none; align-items:center; gap:5px;"><input type="date" id="input-date-${i.id}" value="${dataVal}" style="font-size:9px; padding:2px; width:auto"><i class="fas fa-check-circle" style="cursor:pointer; color:green; font-size:12px" onclick="saveNewDate('${i.id}', '${nome}')"></i></div><b style="font-size:10px">${i.desc}</b></div><div style="text-align:right"><b style="font-size:10px">R$ ${i.valor.toFixed(2)}</b><br><div class="actions-row" style="width:auto; gap:5px"><button class="btn-mini blue btn-refazer-acao" data-id="${i.id}" data-desc="${i.desc.replace(/"/g, '&quot;')}" data-valor="${i.valor}" data-cliente="${nome}" data-garantia="${i.garantia || '90 DIAS'}" data-osnum="${i.osNum || ''}"><i class="fas fa-undo"></i> REFAZER</button></div></div></div>`; 
    });
    document.getElementById('ext-nome').innerText = "EDITAR: " + nome; document.getElementById('ext-lista').innerHTML = html; document.getElementById('ext-share-area').style.display = 'none'; document.getElementById('ext-preview-box').style.display = 'none'; document.getElementById('modal-extrato').style.display = 'flex';
}

document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-refazer-acao');
    if (btn) {
        e.preventDefault();
        const dados = { id: btn.getAttribute('data-id'), desc: btn.getAttribute('data-desc'), valor: btn.getAttribute('data-valor'), cliente: btn.getAttribute('data-cliente'), garantia: btn.getAttribute('data-garantia'), osNum: btn.getAttribute('data-osnum') };
        executarRefazerCompleto(dados);
    }
});

window.executarRefazerCompleto = async function(dados) {
    if(!confirm("REFAZER ESTA O.S.?\n\nO sistema buscará Modelo, Defeito, Senha e Fotos originais do histórico.")) return;
    document.getElementById('modal-extrato').style.display = 'none';
    limparOS();
    document.getElementById('s-cli').value = dados.cliente;
    let encontrouHistorico = false;
    if (dados.osNum && dados.osNum !== 'undefined') {
        try {
            const qDiv = query(collection(db, "dividas"), where("origem_os", "==", parseInt(dados.osNum)));
            const snapDiv = await getDocs(qDiv);
            snapDiv.forEach(async (d) => await deleteDoc(doc(db, "dividas", d.id)));

            const q = query(collection(db, "os_historico"), where("num", "==", parseInt(dados.osNum)));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const osOriginal = querySnapshot.docs[0].data();
                document.getElementById('s-mod').value = osOriginal.modelo || '';
                document.getElementById('s-senha').value = osOriginal.senha || '';
                document.getElementById('s-def').value = osOriginal.defeito || '';
                document.getElementById('s-sinal').value = osOriginal.sinal || '';
                document.getElementById('s-desc').value = osOriginal.desconto || '';

                if (osOriginal.fotos) {
                    window.osFotos = osOriginal.fotos;
                    const slots = document.querySelectorAll('.os-foto-slot'); 
                    window.osFotos.forEach((f, i) => { if(f) slots[i].innerHTML = `<img src="${f}">`; else slots[i].innerHTML = `<i class="fas fa-camera"></i>`; });
                }
                if (osOriginal.itens && osOriginal.itens.length > 0) { window.carrinhoOS = osOriginal.itens; } 
                else { window.carrinhoOS.push({ id: 'REOPEN', tipo: 'S', nome: dados.desc, val: Math.abs(parseFloat(dados.valor)), qtd: 1, unit: Math.abs(parseFloat(dados.valor)), garantia: dados.garantia }); }
                encontrouHistorico = true;
                alert("SUCESSO! Dados completos recuperados.");
            }
        } catch (error) { console.error("Erro ao buscar histórico:", error); }
    }
    if (!encontrouHistorico) {
        window.carrinhoOS.push({ id: 'REOPEN', tipo: 'S', nome: dados.desc, val: Math.abs(parseFloat(dados.valor)), qtd: 1, unit: Math.abs(parseFloat(dados.valor)), garantia: dados.garantia });
        alert("Atenção: Detalhes completos não encontrados. Preenchido apenas o básico.");
    }
    window.isEditing = true; renderItemsOS(); window.nav('servicos');
    window.salvarEstadoLocal();
}

window.toggleBtnDelete = function() { const checked = document.querySelectorAll('.check-log:checked'); document.getElementById('btn-del-sel').style.display = checked.length > 0 ? 'block' : 'none'; }
window.excluirSelecionados = async function(nome) { const checked = document.querySelectorAll('.check-log:checked'); if(!confirm(`Excluir ${checked.length} itens selecionados?`)) return; for(const cb of checked) { await deleteDoc(doc(db, "logs", cb.value)); } alert("Excluídos!"); window.editarMovimentacaoCliente(nome); }
window.toggleEditDate = function(id) { document.getElementById(`date-display-${id}`).style.display='none'; document.getElementById(`date-edit-${id}`).style.display='flex'; }
window.saveNewDate = async function(id, nome) { const nova = document.getElementById(`input-date-${id}`).value; if(nova){ await updateDoc(doc(db,"logs",id), { data: new Date(nova).toISOString() }); alert("DATA ATUALIZADA!"); renderRelatorio(); window.editarMovimentacaoCliente(nome); } }
window.delLog = async function(id) { if(!confirm("Excluir este lançamento permanentemente?")) return; await deleteDoc(doc(db, "logs", id)); alert("Excluído!"); document.getElementById('modal-extrato').style.display='none'; renderRelatorio(); }
window.abrirExtratoCliente = function(nome) {
    const logs = window.db.logs.filter(l => l.cliente === nome).sort((a,b) => new Date(b.data) - new Date(a.data)); const porData = {}; let totalExtrato = 0;
    logs.forEach(l => { const dStr = new Date(l.data).toLocaleDateString('pt-BR'); if(!porData[dStr]) porData[dStr] = []; porData[dStr].push(l); totalExtrato += l.valor; });
    let html = '';
    for (const [data, itens] of Object.entries(porData)) { html += `<div style="margin-bottom:12px; background:white; padding:8px; border-radius:8px; border:1px solid #eee"><div style="font-weight:bold; color:var(--primary); font-size:10px; border-bottom:1px solid #eee; padding-bottom:4px; margin-bottom:4px"><i class="far fa-calendar-alt"></i> ${data}</div>`; let subDia = 0; itens.forEach(i => { subDia += i.valor; const isDesc = (i.tipo === 'DESCONTO'); const color = isDesc ? 'color:red' : 'color:black'; const qtdTxt = (!isDesc && (i.qtd > 1 || i.qtd === 1)) ? `<b>${i.qtd||1}x</b> ` : ''; html += `<div style="display:flex; justify-content:space-between; font-size:9px; margin-bottom:2px; ${color}"><span>${qtdTxt}${i.desc}</span><span style="font-weight:bold">${i.valor < 0 ? '' : 'R$ '}${i.valor.toFixed(2)}</span></div>`; }); html += `<div style="text-align:right; font-size:9px; font-weight:900; color:#555; margin-top:4px; border-top:1px dashed #ccc; padding-top:2px">TOTAL DIA: R$ ${subDia.toFixed(2)}</div></div>`; }
    window.extratoAtual = { cliente: nome, html: html, dados: porData, total: totalExtrato }; document.getElementById('ext-nome').innerText = nome; document.getElementById('ext-lista').innerHTML = html + `<div style="text-align:center; font-size:16px; font-weight:900; margin-top:15px; color:var(--primary)">TOTAL GERAL: R$ ${totalExtrato.toFixed(2)}</div>`; document.getElementById('ext-share-area').style.display = 'flex'; document.getElementById('modal-extrato').style.display = 'flex';
}

window.acaoImprimirRelatorio = function() {
    abrirModalSenha(() => {
        document.getElementById('modal-overlay').style.display='none';
        const f = document.getElementById('r-filtro').value; const now = new Date(); const searchTxt = document.getElementById('r-search').value.toUpperCase(); 
        const logsFiltrados = window.db.logs.filter(l => {
            const d = new Date(l.data); let matchDate = false;
            if(f=='dia') matchDate = d.toDateString()===now.toDateString(); else if(f=='semana') matchDate = (now-d) < 604800000; else if(f=='mes') matchDate = d.getMonth()===now.getMonth(); else matchDate = d.getFullYear()===now.getFullYear();
            let matchText = true; if(searchTxt) { matchText = (l.cliente && l.cliente.toUpperCase().includes(searchTxt)); } return matchDate && matchText;
        }).sort((a,b) => new Date(b.data) - new Date(a.data));

        let totalGeral = 0; let lucroGeral = 0;
        const linhasTabela = logsFiltrados.map(l => {
            totalGeral += l.valor; let custoItem = 0; 
            if(l.tipo === 'PRODUTO' || l.tipo === 'P') { const prod = window.db.produtos.find(p => p.nome === l.desc); if(prod && prod.custo) custoItem = parseFloat(prod.custo) * (l.qtd || 1); } 
            lucroGeral += (l.valor - custoItem);
            const color = (l.valor < 0) ? 'red' : 'black';
            return `<tr style="font-size:11px; border-bottom:1px solid #ccc;"><td style="padding:4px;">${new Date(l.data).toLocaleDateString()}</td><td style="padding:4px;">${l.cliente}</td><td style="padding:4px;">${l.desc}</td><td style="padding:4px; text-align:right; color:${color}">${l.valor.toFixed(2)}</td></tr>`;
        }).join('');

        const htmlRelatorio = `<div style="font-family: Arial, sans-serif; padding:20px; color:#000;"><h2 style="text-align:center; margin-bottom:5px;">${EMPRESA.nome}</h2><div style="text-align:center; font-size:12px; margin-bottom:20px;">RELATÓRIO FINANCEIRO - ${f.toUpperCase()}</div><div style="display:flex; justify-content:space-between; margin-bottom:20px; border:1px solid #000; padding:10px;"><div><b>EMISSÃO:</b> ${new Date().toLocaleString()}<br><b>ITENS:</b> ${logsFiltrados.length}</div><div style="text-align:right"><b>FATURAMENTO:</b> R$ ${totalGeral.toFixed(2)}<br><b>LUCRO EST.:</b> R$ ${lucroGeral.toFixed(2)}</div></div><table style="width:100%; border-collapse:collapse;"><thead><tr style="background:#eee; font-weight:bold; font-size:12px;"><th style="text-align:left; padding:5px;">DATA</th><th style="text-align:left; padding:5px;">CLIENTE</th><th style="text-align:left; padding:5px;">DESCRIÇÃO</th><th style="text-align:right; padding:5px;">VALOR</th></tr></thead><tbody>${linhasTabela}</tbody></table><div style="margin-top:20px; text-align:center; font-size:10px;">Sistema Filhão.Cell v1.0</div></div>`;

        document.getElementById('area-relatorio-visual').innerHTML = htmlRelatorio;
        document.body.classList.remove('printing-cupom');
        document.body.classList.add('printing-relatorio');
        
        setTimeout(() => {
            window.print();
            setTimeout(() => { document.body.classList.remove('printing-relatorio'); }, 1000);
        }, 500);
    });
}

window.montarHtmlCupom = function(d) {
    const agora = new Date(); 
    const dataHora = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR').substring(0,5);
    const itensHtml = d.itens.map(i => {
        const totalItem = (i.val).toFixed(2);
        return `<tr><td style="width:10%"><strong>${i.qtd || 1}x</strong></td><td style="width:65%"><span class="c-item-name">${i.nome}</span>${i.garantia ? `<span class="c-item-meta">GAR: ${i.garantia}</span>` : ''}</td><td style="width:25%; text-align:right">R$ ${totalItem}</td></tr>`;
    }).join('');

    let htmlFinanceiroExtra = '';
    if (d.sinal && d.sinal > 0) {
        const restante = d.total - d.sinal;
        htmlFinanceiroExtra = `<div class="c-row"><span>SINAL (PAGO):</span> <span>- R$ ${parseFloat(d.sinal).toFixed(2)}</span></div><div class="c-total-box" style="border-style:dashed; margin-top:5px"><div style="font-size:10px; font-weight:bold;">RESTANTE A PAGAR:</div><div class="c-big-total" style="font-size:18px">R$ ${restante.toFixed(2)}</div></div>`;
    }

    return `<div class="cupom-wrapper"><div class="c-header"><span class="c-company">${EMPRESA.nome}</span><span class="c-sub">${EMPRESA.end}</span><span class="c-sub">${EMPRESA.cid}</span><span class="c-sub">CNPJ: ${EMPRESA.cnpj}</span><span class="c-sub">Tel: ${EMPRESA.tel}</span></div><div class="c-body"><div class="c-destaque-os">${d.tipo}</div><div class="c-row"><span>DATA:</span> <span>${dataHora}</span></div><div style="margin:5px 0; border-bottom:1px solid #ccc; padding-bottom:5px;"><span style="font-size:10px;">CLIENTE:</span><br><span class="c-destaque-nome">${d.cliente || 'CONSUMIDOR'}</span></div><table class="c-table"><thead><tr><th>QTD</th><th>ITEM</th><th style="text-align:right">TOTAL</th></tr></thead><tbody>${itensHtml}</tbody></table><div class="c-section-title">RESUMO FINANCEIRO</div><div class="c-row"><span>SUBTOTAL:</span> <span>R$ ${d.subtotal.toFixed(2)}</span></div>${d.desconto > 0 ? `<div class="c-row"><span>DESCONTO:</span> <span>- R$ ${d.desconto.toFixed(2)}</span></div>` : ''}<div style="margin-top:10px; text-align:right;"><div style="font-size:10px; font-weight:bold;">TOTAL GERAL:</div><div class="c-big-total">R$ ${d.total.toFixed(2)}</div></div>${htmlFinanceiroExtra}<div style="margin-top:10px">${d.valorPago ? `<div class="c-row"><span>VALOR PAGO:</span> <span>R$ ${d.valorPago.toFixed(2)}</span></div>` : ''}${d.troco ? `<div class="c-row"><span>TROCO:</span> <span>R$ ${d.troco.toFixed(2)}</span></div>` : ''}</div>${d.obs ? `<div style="margin-top:15px; border:1px solid #000; padding:8px; font-weight:bold; background:#eee;">OBS: ${d.obs}</div>` : ''}${d.senha ? `<div style="margin-top:10px; font-weight:bold; text-align:center; font-size:18px; border:2px solid #000; padding:5px;">SENHA: ${d.senha}</div>` : ''}</div><div class="c-footer"><div style="border-top:1px solid #000; width:70%; margin:40px auto 5px auto;"></div><div>ASSINATURA DO CLIENTE</div><br><div style="font-weight:bold; font-size:12px">OBRIGADO PELA PREFERÊNCIA!</div><div style="font-size:10px; margin-top:5px; font-style:italic">Sistema Filhão.Cell v1.0</div></div></div>`;
}

window.abrirModalShare = function() {
    const htmlCupom = montarHtmlCupom(window.shareData);
    document.getElementById('area-cupom-visual').innerHTML = htmlCupom;
    document.getElementById('modal-content-default').innerHTML = `<h3 class="no-print" style="justify-content:center"><i class="fas fa-check-circle"></i> SUCESSO!</h3><div class="no-print" style="display:flex; flex-direction:column; gap:10px; margin-top:15px"><button class="btn" style="background:#007bff; margin:0; padding:12px" onclick="acaoShare('bluetooth')"><i class="fas fa-print"></i> IMPRIMIR BLUETOOTH</button><button class="btn" style="background:#333; margin:0; padding:12px" onclick="acaoShare('pdf')"><i class="fas fa-file-pdf"></i> PDF / PC (CTRL+P)</button><button class="btn" style="background:#28a745; margin:0; padding:12px" onclick="verComprovanteTela()"><i class="fas fa-eye"></i> VER NA TELA</button><button class="btn" style="background:#25d366; margin:0; padding:12px" onclick="acaoShare('zap')"><i class="fab fa-whatsapp"></i> ENVIAR WHATSAPP</button><button class="btn" style="background:#d32f2f; margin:0; padding:12px" onclick="fecharModal({target:{id:'modal-overlay'}})"> <i class="fas fa-times"></i> FECHAR</button></div>`; 
    document.getElementById('modal-overlay').style.display='flex'; 
}

function txtCenter(text, width=32) { if(text.length >= width) return text.substring(0, width); const padding = Math.floor((width - text.length) / 2); return ' '.repeat(padding) + text; }
function txtPair(left, right, width=32) { const space = width - left.length - right.length; if(space < 1) return left.substring(0, width-right.length-1) + ' ' + right; return left + ' '.repeat(space) + right; }
function txtLine(width=32) { return '-'.repeat(width); }

window.acaoShare = function(tipo) {
    const d = window.shareData; 
    if(tipo === 'pdf') {
        document.body.classList.remove('printing-relatorio');
        document.body.classList.add('printing-cupom');
        setTimeout(() => { window.print(); setTimeout(() => { document.body.classList.remove('printing-cupom'); }, 1000); }, 500);
    }
    else if(tipo === 'bluetooth') {
        const W = 32; let T = '';
        T += txtCenter(EMPRESA.nome, W) + '\n' + txtCenter('ASSISTENCIA TECNICA', W) + '\n' + txtCenter(EMPRESA.tel, W) + '\n' + txtLine(W) + '\n';
        T += 'DATA: ' + new Date().toLocaleString() + '\nTIPO: ' + d.tipo + '\nCLIENTE: ' + d.cliente + '\n' + txtLine(W) + '\n';
        T += txtPair('QTD ITEM', 'TOTAL', W) + '\n';
        d.itens.forEach(i => { let nomeItem = i.nome; if(nomeItem.length > 20) nomeItem = nomeItem.substring(0,20); T += (i.qtd||1) + 'x ' + nomeItem + '\n' + txtPair('', 'R$ ' + i.val.toFixed(2), W) + '\n'; if(i.garantia) T += '   (GAR: ' + i.garantia + ')\n'; });
        T += '\n' + txtPair('SUBTOTAL:', 'R$ ' + d.subtotal.toFixed(2), W) + '\n';
        if(d.desconto > 0) { T += txtPair('DESCONTO:', '- R$ ' + d.desconto.toFixed(2), W) + '\n'; }
        T += txtLine(W) + '\n' + txtCenter('TOTAL: R$ ' + d.total.toFixed(2), W) + '\n' + txtLine(W) + '\n';
        if(d.sinal && d.sinal > 0) { const restante = d.total - d.sinal; T += txtPair('SINAL PAGO:', 'R$ ' + parseFloat(d.sinal).toFixed(2), W) + '\n\n' + txtCenter('*** RESTANTE ***', W) + '\n' + txtCenter('R$ ' + restante.toFixed(2), W) + '\n\n'; }
        if(d.valorPago) T += txtPair('VALOR PAGO:', 'R$ ' + d.valorPago.toFixed(2), W) + '\n';
        if(d.troco) T += txtPair('TROCO:', 'R$ ' + d.troco.toFixed(2), W) + '\n';
        if(d.obs) { T += '\nOBSERVACOES:\n' + d.obs + '\n'; }
        if(d.senha) { T += '\n\n' + txtCenter('SENHA: ' + d.senha, W) + '\n'; }
        T += '\n\n' + txtCenter('OBRIGADO PELA PREFERENCIA!', W) + '\n' + txtCenter('Filhao.Cell v1.0', W) + '\n\n\n';
        window.location.href = 'rawbt:data?val=' + encodeURIComponent(T);
    }
    else if(tipo === 'zap') {
        let txt = `*${EMPRESA.nome}*\n----------------\n*${d.tipo}*\nCLI: ${d.cliente}\nDATA: ${new Date().toLocaleString()}\n----------------\n`;
        d.itens.forEach(i => { txt += `${i.qtd || 1}x ${i.nome}\n   R$ ${i.val.toFixed(2)}\n`; });
        txt += `----------------\n*TOTAL: R$ ${d.total.toFixed(2)}*`;
        if(d.desconto > 0) txt += `\n(Desc: R$ ${d.desconto.toFixed(2)})`;
        if(d.sinal > 0) { const rest = d.total - d.sinal; txt += `\nSINAL: R$ ${parseFloat(d.sinal).toFixed(2)}`; txt += `\n*RESTANTE: R$ ${rest.toFixed(2)}*`; }
        if(d.obs) txt += `\nOBS: ${d.obs}`;
        const cliObj = window.db.clientes.find(c => c.nome.toUpperCase() === (d.cliente||'').toUpperCase());
        let phone = (cliObj && cliObj.tel) ? cliObj.tel.replace(/\D/g, '') : '';
        let urlZap = `whatsapp://send?text=${encodeURIComponent(txt)}`;
        if(phone.length >= 10) urlZap = `whatsapp://send?phone=55${phone}&text=${encodeURIComponent(txt)}`;
        window.location.href = urlZap;
    }
}

window.fecharExtrato = function(e) { if(e.target.id === 'modal-extrato') document.getElementById('modal-extrato').style.display = 'none'; }
window.del = async function(c, id) { 
    if(c === 'logs') { 
        if(!confirm("Apagar Movimentação?\n\n(Dívidas associadas serão removidas)")) return; 
        const docSnap = await getDoc(doc(db, "logs", id));
        if (docSnap.exists()) {
            const l = docSnap.data();
            await deleteDoc(doc(db, "logs", id));
            const q = query(collection(db, "dividas"), where("cliente", "==", l.cliente));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(async (docDiv) => {
                const d = docDiv.data();
                if ((l.osNum && d.origem_os == l.osNum) || (d.data_venda === l.data)) { await deleteDoc(doc(db, "dividas", docDiv.id)); }
            });
            listarCli();
        }
        return; 
    } 
    abrirModalSenha(async () => { document.getElementById('modal-overlay').style.display='none'; await deleteDoc(doc(db,c,id)); }); 
}

window.fecharModal = function(e) { if(e.target.id=='modal-overlay') document.getElementById('modal-overlay').style.display='none'; }

// INICIALIZAR: Recuperar o estado salvo
window.onload = function() {
    window.restaurarEstadoLocal();
};
// --- SISTEMA DE SEGURANÇA: BACKUP ---

window.fazerBackup = function() {
    if(!window.db.clientes.length && !window.db.logs.length) {
        alert("O sistema ainda está carregando ou está vazio. Espere os dados aparecerem.");
        return;
    }

    if(!confirm("Baixar cópia de segurança de TUDO para o seu computador?")) return;
    
    // Pega tudo que está na memória do sistema agora
    const backup = {
        data: new Date().toISOString(),
        sistema: "FILHAO_CELL",
        dados: {
            clientes: window.db.clientes || [],
            produtos: window.db.produtos || [],
            servicos: window.db.servicos || [],
            os_ativa: window.db.os || [],
            logs: window.db.logs || [],
            dividas: window.db.dividas || [],
            os_historico: window.db.os_hist || []
        }
    };

    // Cria o arquivo para download
    const blob = new Blob([JSON.stringify(backup)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BACKUP_FILHAO_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Adicionar botão de Backup automaticamente no topo da tela (para facilitar)
setTimeout(() => {
    const btn = document.createElement('button');
    btn.innerHTML = '<i class="fas fa-download"></i> BACKUP';
    btn.style.cssText = "position:fixed; top:10px; right:10px; z-index:9999; background:black; color:white; padding:5px 10px; border:none; border-radius:5px; cursor:pointer; font-size:10px; opacity:0.7;";
    btn.onclick = window.fazerBackup;
    document.body.appendChild(btn);
}, 3000); // Aparece 3 segundos após abrir o sistema
