/* PDF操作を独立して初期化し、読み込み状態を画面に表示します。 */
(function(){
 "use strict";
 const button=document.getElementById("printPdf"),status=document.getElementById("printStatus");
 if(!button||!status)return;
 if(typeof YayoiPrint==="undefined"||typeof q!=="function"||typeof refreshIfNeeded!=="function"){
  status.textContent="PDF印刷 v1.1.1：必要なファイルを読み込めませんでした。app.js・print.js・pdf-start.jsを含む全ファイルを更新し、Ctrl+F5で再読み込みしてください。";return;
 }
 let printing=false;
 button.onclick=async()=>{
  if(printing)return;
  status.textContent="印刷の準備を開始しています…";
  let controller,viewer,closed=false;
  try{
   const filters=q();
   if(filters.from&&filters.to&&filters.from>filters.to)throw new Error("開始日は終了日以前にしてください。");
   controller=new AbortController();
   printing=true;button.disabled=true;
   viewer=document.createElement("section");viewer.id="pdfViewer";viewer.setAttribute("role","dialog");viewer.setAttribute("aria-modal","true");viewer.setAttribute("aria-label","売上履歴 PDF印刷プレビュー");
   viewer.style.cssText="position:fixed;inset:0;background:white;z-index:1000;display:flex;flex-direction:column";
   const bar=document.createElement("div");bar.style.cssText="padding:10px;display:flex;gap:12px;align-items:center;border-bottom:1px solid #ccc;flex-shrink:0";
   const close=document.createElement("button");close.id="closePdf";close.textContent="閉じて検索画面に戻る";
   const message=document.createElement("span");message.id="pdfProgress";message.setAttribute("role","status");message.style.cssText="font-size:14px";message.textContent="検索結果を取得しています…";
   const frame=document.createElement("iframe");frame.id="pdfFrame";frame.title="売上履歴 印刷プレビュー";frame.style.cssText="width:100%;flex:1;min-height:0;border:0";
   bar.append(close,message);viewer.append(bar,frame);document.body.append(viewer);
   const originalOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
   const dismiss=()=>{
    if(closed)return;
    closed=true;controller.abort();viewer.remove();document.body.style.overflow=originalOverflow;
    document.removeEventListener("keydown",onKey);
    if(printing)status.textContent="印刷を中止しました。";
    button.focus();
   };
   const onKey=e=>{if(e.key==="Escape")dismiss();};
   close.onclick=dismiss;document.addEventListener("keydown",onKey);close.focus();
   const report=frame.contentWindow;
   report.document.body.textContent="印刷用データを取得しています。しばらくお待ちください。";
   const result=await YayoiPrint.collect(filters,async query=>{
    if(closed)throw new Error("印刷を中止しました。");
    const s=await refreshIfNeeded();
    if(!s)throw new Error("再ログインしてから印刷してください。");
    const timeout=setTimeout(()=>controller.abort("timeout"),45000);
    try{
     const r=await fetch(SUPA+"/functions/v1/yayoi-sales-search",{method:"POST",headers:{"apikey":PUB,"Authorization":"Bearer "+s.access_token,"Content-Type":"application/json"},body:JSON.stringify(query),signal:controller.signal});
     const data=await r.json();if(!r.ok)throw new Error(data.error||"検索結果を取得できませんでした。");return data;
    }finally{clearTimeout(timeout);}
   },(done,count)=>{message.textContent=`印刷用データ取得中：${done.toLocaleString("ja-JP")} / ${count.toLocaleString("ja-JP")}件`;status.textContent=message.textContent;});
   if(closed)throw new Error("印刷を中止しました。");
   message.textContent="全件取得完了。印刷レイアウトを作成しています…";
   await YayoiPrint.render(report,result,filters,()=>closed);
   if(closed)throw new Error("印刷を中止しました。");
   message.textContent=`${result.rows.length.toLocaleString("ja-JP")}件の準備ができました。下の「印刷 / PDF保存」を押してください。`;
   status.textContent=message.textContent;
  }catch(e){
   const text=controller?.signal.reason==="timeout"?"PDF印刷エラー：通信が時間切れになりました。再実行してください。":closed?"印刷を中止しました。":"PDF印刷エラー："+e.message;
   status.textContent=text;
   if(viewer&&!closed){
    viewer.querySelector("#pdfProgress").textContent=text;
    try{viewer.querySelector("iframe").contentDocument.body.textContent="印刷を作成できませんでした。上のボタンで検索画面に戻り、再実行してください。";}catch(_){}
   }
  }finally{printing=false;button.disabled=false;}
 };
 button.disabled=false;
 status.textContent="PDF印刷 v1.1.1：準備できました。現在の入力条件に一致する全件を印刷します。";
})();
