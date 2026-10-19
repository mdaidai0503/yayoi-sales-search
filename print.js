/* 印刷専用。既存の認証付き検索APIのページ取得だけを使用します。 */
(function(root){
 "use strict";
 const fields=[["sale_date","売上日"],["slip_no","伝票番号"],["customer_name","得意先"],["product_code","商品コード"],["product_name","商品名"],["quantity","数量"],["unit","単位"],["unit_price","単価"],["amount","金額"]];
 function decimal(value){
  const text=String(value??0).trim();
  const m=/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
  if(!m)throw new Error("数量または金額に数値以外の値があります。");
  let scale=(m[3]||"").length-Number(m[4]||0);
  if(Math.abs(scale)>100)throw new Error("数値の桁数を確認してください。");
  let n=BigInt((m[1]==="-"?"-":"")+m[2]+(m[3]||""));
  if(scale<0){n*=10n**BigInt(-scale);scale=0;}
  return {n,scale};
 }
 function add(a,b){const scale=Math.max(a.scale,b.scale);return {n:a.n*10n**BigInt(scale-a.scale)+b.n*10n**BigInt(scale-b.scale),scale};}
 function format(d){
  const negative=d.n<0n;let s=(negative?-d.n:d.n).toString().padStart(d.scale+1,"0");
  let whole=d.scale?s.slice(0,-d.scale):s;
  const fraction=d.scale?s.slice(-d.scale).replace(/0+$/,""):"";
  return (negative?"-":"")+whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")+(fraction?"."+fraction:"");
 }
 async function collect(filters,request,progress=()=>{}){
  const rows=[];let count=null,firstSignature;
  for(let page=1;;page++){
   const data=await request({...filters,page,pageSize:50});
   if(!Number.isSafeInteger(data.count)||data.count<0||!Array.isArray(data.rows))throw new Error("検索APIの応答形式を確認してください。");
   if(count===null){count=data.count;firstSignature=JSON.stringify(data.rows);}
   if(data.count!==count)throw new Error("取得中に売上データの件数が変わりました。同期完了後に再実行してください。");
   const expected=Math.min(50,count-rows.length);
   if(data.rows.length!==expected)throw new Error("検索結果を全件取得できませんでした。再実行してください。");
   rows.push(...data.rows);progress(rows.length,count);
   if(rows.length===count)break;
  }
  if(count>50){
   const check=await request({...filters,page:1,pageSize:50});
   if(check.count!==count||JSON.stringify(check.rows)!==firstSignature)throw new Error("取得中に検索結果が変わりました。同期完了後に再実行してください。");
  }
  let quantity=decimal(0),amount=decimal(0);const units=new Set();
  for(const row of rows){quantity=add(quantity,decimal(row.quantity));amount=add(amount,decimal(row.amount));units.add(String(row.unit??""));}
  return {rows,quantity:format(quantity),amount:format(amount),mixedUnits:units.size>1};
 }
 async function render(win,result,filters,isCancelled=()=>false){
  const doc=win.document;
  doc.documentElement.lang="ja";doc.title="弥生販売 売上履歴 検索結果";
  doc.head.innerHTML='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
  const style=doc.createElement("style");style.textContent=`
   @page{size:A4 landscape;margin:10mm}
   *{box-sizing:border-box}body{margin:0;background:#e9edf2;color:#17212e;font-family:"Yu Gothic","Meiryo",sans-serif;font-size:9pt}
   .toolbar{padding:14px;position:sticky;top:0;background:white;z-index:2;border-bottom:1px solid #ccd3db}button{padding:9px 18px;font-size:14px;cursor:pointer} .hint{margin-left:12px;font-size:12px}
   .sheet{width:277mm;height:189mm;padding:0;margin:10mm auto;background:white;position:relative;break-after:page;page-break-after:always;overflow:visible}
   .sheet:last-child{break-after:auto;page-break-after:auto}h1{font-size:17pt;margin:0 0 2mm}.meta{font-size:8pt;color:#4b5663;margin-bottom:2mm}
   .conditions{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #bbc5cf;padding:2mm;margin-bottom:2mm;font-size:8pt}
   .totals{padding:2mm 0;font-weight:bold;display:flex;gap:8mm;flex-wrap:wrap;font-size:10pt}.note{font-size:7.5pt;margin-bottom:2mm}
   table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt} th{background:#e8eef5;font-weight:bold}th,td{border:1px solid #bbc5cf;padding:1.5mm 1mm;text-align:left;overflow-wrap:anywhere;white-space:pre-wrap;vertical-align:top;line-height:1.4}td.numeric{text-align:right;font-variant-numeric:tabular-nums}
   .content{position:absolute;inset:0 0 8mm;overflow:visible}.footer{position:absolute;bottom:0;width:100%;border-top:1px solid #ccd3db;padding-top:1.5mm;text-align:right;font-size:8pt}
   @media print{body{background:white}.toolbar{display:none}.sheet{margin:0}}
  `;doc.head.append(style);doc.body.replaceChildren();
  const make=(tag,text,cls)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const toolbar=make("div",undefined,"toolbar"),button=make("button","印刷 / PDF保存");button.disabled=true;button.onclick=()=>{win.focus();win.print();};
  toolbar.append(button,make("span","送信先を「PDFに保存」または「Microsoft Print to PDF」、用紙をA4・横、倍率を100%、ヘッダーとフッターをオフにしてください。","hint"));doc.body.append(toolbar);
  const labels=[["customer","得意先名"],["product","商品名"],["productCode","商品コード"],["slipNo","伝票番号"],["from","開始日"],["to","終了日"]];
  const conditions=labels.map(([key,label])=>label+"："+(filters[key]||"指定なし")).join("　／　");
  const created=new Date().toLocaleString("ja-JP");
  let sheet,content,tbody;const sheets=[];
  const newPage=()=>{
   sheet=make("section",undefined,"sheet");content=make("div",undefined,"content");
   content.append(make("h1","弥生販売 売上履歴 検索結果"),make("div","作成日時："+created+"　金額は検索結果の値を集計","meta"),make("div",conditions,"conditions"));
   const totals=make("div",undefined,"totals");
   totals.append(make("span","対象："+result.rows.length.toLocaleString("ja-JP")+"件"),make("span","数量合計："+result.quantity),make("span","金額合計："+result.amount+" 円"));content.append(totals);
   if(result.mixedUnits)content.append(make("div","数量合計は単位換算せずに加算しています（複数の単位を含みます）。","note"));
   const table=make("table"),cols=make("colgroup");[9,9,15,10,21,8,5,10,13].forEach(w=>{const col=make("col");col.style.width=w+"%";cols.append(col)});table.append(cols);
   const head=make("thead"),tr=make("tr");fields.forEach(([,label])=>tr.append(make("th",label)));head.append(tr);tbody=make("tbody");table.append(head,tbody);content.append(table);sheet.append(content,make("div","","footer"));doc.body.append(sheet);sheets.push(sheet);
  };
  newPage();await doc.fonts.ready;
  const overflow=()=>tbody.getBoundingClientRect().bottom>content.getBoundingClientRect().bottom-1;
  for(let i=0;i<result.rows.length;i++){
   const row=result.rows[i],tr=make("tr");
   fields.forEach(([key])=>tr.append(make("td",["quantity","unit_price","amount"].includes(key)?format(decimal(row[key])):String(row[key]??""),["quantity","unit_price","amount"].includes(key)?"numeric":undefined)));
   tbody.append(tr);
   if(overflow()){
    tr.remove();if(!tbody.children.length)throw new Error("検索条件または明細が1ページに収まりません。条件を短くして再実行してください。");
    newPage();tbody.append(tr);if(overflow())throw new Error("長い明細が1ページに収まりません。対象を絞って再実行してください。");
   }
   if(i%200===199)await new Promise(resolve=>setTimeout(resolve,0));
   if(win.closed||isCancelled())throw new Error("印刷を中止しました。");
  }
  if(!result.rows.length){const tr=make("tr"),td=make("td","該当する売上履歴はありません。");td.colSpan=9;tr.append(td);tbody.append(tr);if(overflow())throw new Error("検索条件が1ページに収まりません。条件を短くして再実行してください。");}
  sheets.forEach((s,i)=>s.querySelector(".footer").textContent=`全${result.rows.length.toLocaleString("ja-JP")}件　／　${i+1} / ${sheets.length} ページ`);
  button.disabled=false;win.scrollTo(0,0);
 }
 root.YayoiPrint={collect,render,decimal,add,format};
})(typeof window!=="undefined"?window:globalThis);
