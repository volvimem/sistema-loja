import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs, writeBatch, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

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

// Tornar variáveis globais acessíveis
window.db = { clientes:[], produtos:[], servicos:[], os:[], logs:[], dividas:[], os_hist:[] };
window.carrinho = []; window.carrinhoOS = []; window.shareData = null; window.tempImg = null; window.retornoVenda = false; window.retornoOS = false; window.osFotos = [null, null, null, null]; window.currentFotoIndex = 0; window.extratoAtual = null; window.editingDateId = null;
window.callbackSenha = null; window.verValores = false;
window.isEditing = false; 
window.estoqueTab = 'prod'; 

window.norm = (t) => t ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "";

// ESCUTAS DO BANCO DE DADOS
onSnapshot(collection(db, "clientes"), s => { 
    window.db.clientes = s.docs.map(d=>({id:d.id, ...d.data()})); 
    if(isPg('clientes')) listarCli(); 
});
onSnapshot(collection(db, "produtos"), s => { window.db.produtos = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('estoque') && window.estoqueTab=='prod') renderListaEstoque(); });
onSnapshot(collection(db, "servicos_cad"), s => { window.db.servicos = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('estoque') && window.estoqueTab=='serv') renderListaEstoque(); });
onSnapshot(query(collection(db, "os_ativa"), orderBy("data", "desc")), s => { window.db.os = s.docs.map(d=>({id:d.id, ...d.data()})); renderKanban(); });
onSnapshot(query(collection(db, "logs"), orderBy("data", "desc")), s => { window.db.logs = s.docs.map(d=>({id:d.id, ...d.data()})); if(isPg('relatorio')) renderRelatorio(); });

onSnapshot(collection(db, "dividas"), s => { 
    window.db.dividas = s.docs.map(d=>({id:d.id, ...d.data()}));
    if(isPg('relatorio')) renderRelatorio();
    if(isPg('clientes')) listarCli();
});
onSnapshot(query(collection(db, "os_historico"), orderBy("data", "desc")), s => { window.db.os_hist = s.docs.map(d=>({id:d.id, ...d.data()})); });

function isPg(p){ 
    const el = document.getElementById('page-'+p);
    return el && el.classList.contains('active'); 
}

// ... [O restante do código JS permanece igual, vou focar apenas na alteração da impressão] ...
// COPIE TODAS AS OUTRAS FUNÇÕES (abrirModalSenha, nav, buscar, etc) AQUI...
// PARA ECONOMIZAR ESPAÇO, ABAIXO APENAS AS FUNÇÕES ALTERADAS PARA A IMPRESSÃO:

window.acaoImprimirRelatorio = function() {
    abrirModalSenha(() => {
        document.getElementById('modal-overlay').style.display='none';
        
        const f = document.getElementById('r-filtro').value; const now = new Date(); const searchTxt = document.getElementById('r-search').value.toUpperCase(); 
        const logsFiltrados = window.db.logs.filter(l => {
            const d = new Date(l.data); let matchDate = false;
            if(f=='dia') matchDate = d.toDateString()===now.toDateString(); else if(f=='semana') matchDate = (now-d) < 604800000; else if(f=='mes') matchDate = d.getMonth()===now.getMonth(); else matchDate = d.getFullYear()===now.getFullYear();
            let matchText = true; if(searchTxt) { matchText = (l.cliente && l.cliente.toUpperCase().includes(searchTxt)); } return matchDate && matchText;
        }).sort((a,b) => new Date(b.data) - new Date(a.data));

        let totalGeral = 0;
        let lucroGeral = 0;
        
        const linhasTabela = logsFiltrados.map(l => {
            totalGeral += l.valor;
            let custoItem = 0; 
            if(l.tipo === 'PRODUTO' || l.tipo === 'P') { const prod = window.db.produtos.find(p => p.nome === l.desc); if(prod && prod.custo) custoItem = parseFloat(prod.custo) * (l.qtd || 1); } 
            lucroGeral += (l.valor - custoItem);
            
            const tipoLbl = (l.tipo==='DESCONTO') ? 'DESC' : (l.tipo.substring(0,4));
            const color = (l.valor < 0) ? 'red' : 'black';
            return `
                <tr style="font-size:11px; border-bottom:1px solid #ccc;">
                    <td style="padding:4px;">${new Date(l.data).toLocaleDateString()}</td>
                    <td style="padding:4px;">${l.cliente}</td>
                    <td style="padding:4px;">${l.desc}</td>
                    <td style="padding:4px; text-align:right; color:${color}">${l.valor.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const htmlRelatorio = `
            <div style="font-family: Arial, sans-serif; padding:20px; color:#000;">
                <h2 style="text-align:center; margin-bottom:5px;">${EMPRESA.nome}</h2>
                <div style="text-align:center; font-size:12px; margin-bottom:20px;">RELATÓRIO FINANCEIRO - ${f.toUpperCase()}</div>
                
                <div style="display:flex; justify-content:space-between; margin-bottom:20px; border:1px solid #000; padding:10px;">
                    <div>
                        <b>EMISSÃO:</b> ${new Date().toLocaleString()}<br>
                        <b>ITENS:</b> ${logsFiltrados.length}
                    </div>
                    <div style="text-align:right">
                        <b>FATURAMENTO:</b> R$ ${totalGeral.toFixed(2)}<br>
                        <b>LUCRO EST.:</b> R$ ${lucroGeral.toFixed(2)}
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#eee; font-weight:bold; font-size:12px;">
                            <th style="text-align:left; padding:5px;">DATA</th>
                            <th style="text-align:left; padding:5px;">CLIENTE</th>
                            <th style="text-align:left; padding:5px;">DESCRIÇÃO</th>
                            <th style="text-align:right; padding:5px;">VALOR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasTabela}
                    </tbody>
                </table>
                <div style="margin-top:20px; text-align:center; font-size:10px;">Sistema Filhão.Cell v2.4</div>
            </div>
        `;

        const area = document.getElementById('area-relatorio-visual');
        area.innerHTML = htmlRelatorio;
        
        document.body.classList.remove('printing-cupom');
        document.body.classList.add('printing-relatorio');
        
        // CORREÇÃO 1: PEQUENO DELAY PARA O ANDROID RENDERIZAR
        setTimeout(() => {
            window.print();
            setTimeout(() => { document.body.classList.remove('printing-relatorio'); }, 1000);
        }, 500);
    });
}

// CORREÇÃO NA FUNÇÃO DE IMPRESSÃO DO CUPOM (PDF)
window.acaoShare = function(tipo) {
    const d = window.shareData; 
    
    if(tipo === 'pdf') {
        const htmlCupom = montarHtmlCupom(d); // Certifique-se que essa função está no arquivo
        document.getElementById('area-cupom-visual').innerHTML = htmlCupom;

        document.body.classList.remove('printing-relatorio');
        document.body.classList.add('printing-cupom');
        
        // CORREÇÃO 1: DELAY PARA ANDROID
        setTimeout(() => {
            window.print(); 
            setTimeout(() => { document.body.classList.remove('printing-cupom'); }, 1000);
        }, 500);
    }
    else if(tipo === 'bluetooth') {
        // ... (código existente bluetooth) ...
        const W = 32; 
        let T = '';
        T += txtCenter(EMPRESA.nome, W) + '\n';
        // ... (restante do código bluetooth existente) ...
        // Coloque aqui todo o código original do bluetooth
        window.location.href = 'rawbt:data?val=' + encodeURIComponent(T);
    }
    else if(tipo === 'zap') {
        // ... (código existente zap) ...
        let txt = `*${EMPRESA.nome}*\n----------------\n*${d.tipo}*\nCLI: ${d.cliente}\nDATA: ${new Date().toLocaleString()}\n----------------\n`;
        // ... (restante do código zap existente) ...
         window.location.href = urlZap;
    }
}

// CERTIFIQUE-SE DE COPIAR TODAS AS OUTRAS FUNÇÕES JS DO ARQUIVO ORIGINAL PARA CÁ TAMBÉM
// (montarHtmlCupom, nav, buscar, salvarOS, etc...)
// Exemplo de funções auxiliares que devem estar aqui:
window.abrirModalSenha = function(callback) { /* ...código original... */ }
window.togglePass = function() { /* ...código original... */ }
window.verificarSenha = function() { /* ...código original... */ }
window.nav = function(p, el) { /* ...código original... */ }
window.forcarAtualizacao = async function() { /* ...código original... */ }
window.toggleSearch = function(tipo, inpId, boxId) { /* ...código original... */ }
window.buscar = function(col, txt, divId, lista=false, force=false) { /* ...código original... */ }
window.sel = function(c, id, div) { /* ...código original... */ }
window.buscarVenda = function(txt, force=false) { /* ...código original... */ }
window.limparBuscaVenda = function() { /* ...código original... */ }
window.limparVendas = function() { /* ...código original... */ }
window.addCar = function(id, tipo, nome, val) { /* ...código original... */ }
window.renderCarrinho = function() { /* ...código original... */ }
window.setGarantiaCar = function(idx, val) { /* ...código original... */ }
window.editItemVenda = function(index) { /* ...código original... */ }
window.delCar = function(i) { /* ...código original... */ }
window.cadastrarNovoNaVenda = function() { /* ...código original... */ }
window.cadastrarNovoNaOS = function() { /* ...código original... */ }
window.finalizarVenda = async function() { /* ...código original... */ }
window.addFotoOS = function(idx) { /* ...código original... */ }
window.processFotoOS = function(inp) { /* ...código original... */ }
window.lerFoto = function(inp, viewId) { /* ...código original... */ }
window.buscarItemOS = function(txt, force=false) { /* ...código original... */ }
window.addItemOS = function(id, tipo, nome, val) { /* ...código original... */ }
window.renderItemsOS = function() { /* ...código original... */ }
window.setGarantiaOS = function(idx, val) { /* ...código original... */ }
window.editItemOS = function(index) { /* ...código original... */ }
window.delItemOS = function(i) { /* ...código original... */ }
window.salvarOS = async function() { /* ...código original... */ }
window.limparOS = function() { /* ...código original... */ }
window.renderKanban = function() { /* ...código original... */ }
window.delOS = async function(id) { /* ...código original... */ }
window.moveOS = async function(id, dir) { /* ...código original... */ }
window.arqOS = async function(id) { /* ...código original... */ }
window.verHistoricoOS = function() { /* ...código original... */ }
window.reabrirOS = async function(id) { /* ...código original... */ }
window.editOS = function(id) { /* ...código original... */ }
window.shareOS = function(id) { /* ...código original... */ }
window.maskTel = function(o) { /* ...código original... */ }
window.salvarCliente = async function() { /* ...código original... */ }
window.listarCli = function() { /* ...código original... */ }
window.limparCli = function() { /* ...código original... */ }
window.edtCli = function(id) { /* ...código original... */ }
window.abrirCarteiraDevedores = function() { /* ...código original... */ }
window.gerenciarDividas = function(nome) { /* ...código original... */ }
window.excluirDivida = function(id, nome) { /* ...código original... */ }
window.maskMoney = function(o) { /* ...código original... */ }
window.maskDate = function(o) { /* ...código original... */ }
window.abaterDivida = function(id, nome, max) { /* ...código original... */ }
window.confirmarAbater = async function(id, nome, max) { /* ...código original... */ }
window.agendarLembrete = function(id, nome, dataAtual='') { /* ...código original... */ }
window.confirmarLembrete = async function(id, nome) { /* ...código original... */ }
window.salvarProduto = async function(t) { /* ...código original... */ }
window.limparEstoque = function() { /* ...código original... */ }
window.mudarTabEstoque = function(tab) { /* ...código original... */ }
window.renderListaEstoque = function() { /* ...código original... */ }
window.edtProd = function(col, id) { /* ...código original... */ }
window.revelarCusto = function() { /* ...código original... */ }
window.togglePriv = function() { /* ...código original... */ }
window.renderRelatorio = function() { /* ...código original... */ }
window.abrirOpcoesEdicao = function(nome) { /* ...código original... */ }
window.editarClienteRapido = function(nome) { /* ...código original... */ }
window.editarMovimentacaoCliente = function(nome) { /* ...código original... */ }
window.executarRefazerCompleto = async function(dados) { /* ...código original... */ }
window.toggleBtnDelete = function() { /* ...código original... */ }
window.excluirSelecionados = async function(nome) { /* ...código original... */ }
window.toggleEditDate = function(id) { /* ...código original... */ }
window.saveNewDate = async function(id, nome) { /* ...código original... */ }
window.delLog = async function(id) { /* ...código original... */ }
window.abrirExtratoCliente = function(nome) { /* ...código original... */ }
window.montarHtmlCupom = function(d) { /* ...código original... */ }
window.abrirModalShare = function() { /* ...código original... */ }
window.txtCenter = function(text, width=32) { /* ...código original... */ }
window.txtPair = function(left, right, width=32) { /* ...código original... */ }
window.txtLine = function(width=32) { /* ...código original... */ }
window.fecharExtrato = function(e) { /* ...código original... */ }
window.del = async function(c, id) { /* ...código original... */ }
window.fecharModal = function(e) { /* ...código original... */ }

// EVENT LISTENER GLOBAL
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-refazer-acao');
    if (btn) {
        e.preventDefault();
        const dados = {
            id: btn.getAttribute('data-id'),
            desc: btn.getAttribute('data-desc'),
            valor: btn.getAttribute('data-valor'),
            cliente: btn.getAttribute('data-cliente'),
            garantia: btn.getAttribute('data-garantia'),
            osNum: btn.getAttribute('data-osnum')
        };
        executarRefazerCompleto(dados);
    }
});
