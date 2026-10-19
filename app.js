const SUPA="https://crltrozxztivkyxtjjxv.supabase.co", PUB="sb_publishable_znOVYKMnJiZuxrsXPaLPxA_EbUdenvN";
let page=1, total=0, lastQuery={};
const $=id=>document.getElementById(id);
const yen=n=>new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY",maximumFractionDigits:0}).format(Number(n||0));
const num=n=>new Intl.NumberFormat("ja-JP",{maximumFractionDigits:4}).format(Number(n||0));

function session(){try{return JSON.parse(localStorage.getItem("yayoi_sales_session")||"null")}catch{return null}}
function setSession(s){localStorage.setItem("yayoi_sales_session",JSON.stringify(s))}
function showApp(ok){$("loginBox").classList.toggle("hidden",ok);$("app").classList.toggle("hidden",!ok);$("logout").classList.toggle("hidden",!ok)}

async function login(){
 $("loginMsg").textContent="ログイン中…";
 const r=await fetch(SUPA+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":PUB,"Content-Type":"application/json"},body:JSON.stringify({email:$("email").value.trim(),password:$("password").value})});
 const d=await r.json();
 if(!r.ok){$("loginMsg").textContent="ログインできませんでした。メールアドレス・パスワードを確認してください。";return}
 setSession(d); showApp(true); $("password").value=""; $("loginMsg").textContent="";
}
async function refreshIfNeeded(){
 let s=session(); if(!s) return null;
 if(Date.now()/1000 < (s.expires_at||0)-60) return s;
 const r=await fetch(SUPA+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":PUB,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:s.refresh_token})});
 if(!r.ok){localStorage.removeItem("yayoi_sales_session");showApp(false);return null}
 s=await r.json();setSession(s);return s;
}
function q(){
 return {customer:$("customer").value.trim(),product:$("product").value.trim(),productCode:$("productCode").value.trim(),slipNo:$("slipNo").value.trim(),from:$("from").value,to:$("to").value,page,pageSize:50};
}
async function search(reset=true){
 if(reset) page=1;
 const s=await refreshIfNeeded(); if(!s) return;
 lastQuery=q(); $("status").textContent="検索中…"; $("search").disabled=true;
 try{
  const r=await fetch(SUPA+"/functions/v1/yayoi-sales-search",{method:"POST",headers:{"apikey":PUB,"Authorization":"Bearer "+s.access_token,"Content-Type":"application/json"},body:JSON.stringify(lastQuery)});
  const d=await r.json();
  if(!r.ok) throw new Error(d.error||"検索エラー");
  total=d.count||0;
  $("count").textContent=new Intl.NumberFormat("ja-JP").format(total)+"件";
  $("pageTotal").textContent="表示分 金額 "+yen(d.pageTotals?.amount||0);
  $("pageLabel").textContent=page+"ページ / "+Math.max(1,Math.ceil(total/50))+"ページ";
  $("prev").disabled=page<=1; $("next").disabled=page*50>=total;
  $("rows").innerHTML=(d.rows||[]).length?d.rows.map(r=>`<tr><td>${esc(r.sale_date)}</td><td>${esc(r.slip_no)}</td><td>${esc(r.customer_name)}</td><td>${esc(r.product_code)}</td><td>${esc(r.product_name)}</td><td class="num">${num(r.quantity)}</td><td>${esc(r.unit)}</td><td class="num">${yen(r.unit_price)}</td><td class="num">${yen(r.amount)}</td></tr>`).join(""):`<tr><td colspan="9">該当する売上履歴はありません。</td></tr>`;
  $("status").textContent="検索完了";
 }catch(e){$("status").textContent="エラー: "+e.message}finally{$("search").disabled=false}
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
$("login").onclick=login;
$("password").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
$("logout").onclick=()=>{localStorage.removeItem("yayoi_sales_session");showApp(false)};
$("search").onclick=()=>search(true);
$("clear").onclick=()=>{["customer","product","productCode","slipNo","from","to"].forEach(x=>$(x).value="");page=1};
$("prev").onclick=()=>{if(page>1){page--;search(false)}};
$("next").onclick=()=>{if(page*50<total){page++;search(false)}};
(async()=>{const s=await refreshIfNeeded();showApp(!!s)})();
if("serviceWorker" in navigator) { try { navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).catch(()=>{}); } catch(e) { /* LAN配信などで未対応でも検索・印刷を初期化します。 */ } }
