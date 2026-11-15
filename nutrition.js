// MPMFIT Nutrition — diario manual y consulta de códigos de barras.
// Los datos se guardan localmente y quedan aislados por cuenta. La sincronización cloud
// de nutrición se incorporará cuando se apruebe y pruebe su esquema independiente.
let nutritionData={goal:'maintenance',targets:{kcal:0,protein:0,carbs:0,fat:0},entries:[]};
let barcodeStream=null,barcodeFrame=null;
let nutritionAddLocked=false,barcodeLookupInProgress=false,barcodeCameraStarting=false,currentFoodUnit=null;
function nutritionStorageKey(){return 'mpmfit_nutrition_v1_'+(currentUser?.id||'guest')}
function loadNutritionData(){
 try{
  const saved=JSON.parse(localStorage.getItem(nutritionStorageKey()));
  nutritionData=saved&&Array.isArray(saved.entries)?saved:{goal:'maintenance',targets:{kcal:0,protein:0,carbs:0,fat:0},entries:[]};
 }catch(e){nutritionData={goal:'maintenance',targets:{kcal:0,protein:0,carbs:0,fat:0},entries:[]}}
}
function saveNutritionData(){localStorage.setItem(nutritionStorageKey(),JSON.stringify(nutritionData))}
function nutritionToday(){return document.getElementById('nutritionDate')?.value||new Date().toISOString().slice(0,10)}
function nutritionNumber(id){return Math.max(0,Number(document.getElementById(id)?.value)||0)}
function nutritionGoalName(goal){return ({bulk:'Volumen',cut:'Definición',maintenance:'Mantenimiento'})[goal]||'Mantenimiento'}
function nutritionTotals(date){
 return nutritionData.entries.filter(e=>e.date===date).reduce((a,e)=>{a.kcal+=e.kcal;a.protein+=e.protein;a.carbs+=e.carbs;a.fat+=e.fat;return a},{kcal:0,protein:0,carbs:0,fat:0});
}
function nutritionProgress(label,value,target,unit){
 const pct=target>0?Math.min(100,value/target*100):0;
 return '<div class="card stat"><span>'+label+'</span><b>'+Math.round(value*10)/10+' <small>'+unit+'</small></b><span>'+(target>0?'Objetivo: '+target+' '+unit:'Objetivo sin configurar')+'</span><div class="barwrap"><div class="bar" style="width:'+pct+'%"></div></div></div>';
}
function nutritionTargetCard(label,value,unit){return '<div class="card stat"><span>'+label+'</span><b>'+(value||'—')+' <small>'+unit+'</small></b><span>Objetivo diario</span></div>'}
function renderNutrition(){
 if(!document.getElementById('nutritionDate'))return;
 if(!document.getElementById('nutritionDate').value)document.getElementById('nutritionDate').value=new Date().toISOString().slice(0,10);
 const t=nutritionData.targets||{},goal=document.getElementById('nutritionGoalsView');
 goal.innerHTML='<div class="card stat"><span>Objetivo</span><b style="font-size:20px">'+nutritionGoalName(nutritionData.goal)+'</b></div>'+nutritionTargetCard('Calorías',t.kcal,'kcal')+nutritionTargetCard('Proteínas',t.protein,'g')+nutritionTargetCard('Hidratos',t.carbs,'g')+nutritionTargetCard('Grasas',t.fat,'g');
 const totals=nutritionTotals(nutritionToday());
 document.getElementById('nutritionSummary').innerHTML=nutritionProgress('Calorías consumidas',totals.kcal,t.kcal||0,'kcal')+nutritionProgress('Proteínas',totals.protein,t.protein||0,'g')+nutritionProgress('Hidratos',totals.carbs,t.carbs||0,'g')+nutritionProgress('Grasas',totals.fat,t.fat||0,'g');
 const entries=nutritionData.entries.filter(e=>e.date===nutritionToday());
 const meals=['Desayuno','Media mañana','Comida','Merienda','Cena','Otros'];
 document.getElementById('nutritionDiary').innerHTML=entries.length?meals.map(meal=>{
  const items=entries.filter(e=>e.meal===meal);
  return items.length?'<div class="history-item"><strong>'+meal+'</strong>'+items.map(e=>'<div class="row" style="padding:8px 0;gap:8px"><div><strong>'+esc(e.name)+'</strong><div class="hint">'+nutritionEntryQuantity(e)+' · '+Math.round(e.kcal)+' kcal · P '+e.protein.toFixed(1)+' g · HC '+e.carbs.toFixed(1)+' g · G '+e.fat.toFixed(1)+' g</div></div><button class="btn danger small" onclick="deleteNutritionEntry(\''+e.id+'\')">×</button></div>').join('')+'</div>':'';
 }).join(''):'<div class="empty">Todavía no has añadido alimentos para este día.</div>';
}
function toggleNutritionGoals(show){
 const form=document.getElementById('nutritionGoalsForm'),visible=show===undefined?form.style.display==='none':show;
 form.style.display=visible?'block':'none';
 if(visible){
  document.getElementById('nutritionGoal').value=nutritionData.goal||'maintenance';
  const t=nutritionData.targets||{};
  document.getElementById('nutritionKcal').value=t.kcal||'';
  document.getElementById('nutritionProtein').value=t.protein||'';
  document.getElementById('nutritionCarbs').value=t.carbs||'';
  document.getElementById('nutritionFat').value=t.fat||'';
 }
}
function saveNutritionGoals(){
 const kcal=nutritionNumber('nutritionKcal'),protein=nutritionNumber('nutritionProtein'),carbs=nutritionNumber('nutritionCarbs'),fat=nutritionNumber('nutritionFat');
 if(!kcal||!protein||!carbs||!fat){toast('Completa calorías y los tres macronutrientes con valores mayores que cero');return}
 nutritionData.goal=document.getElementById('nutritionGoal').value;
 nutritionData.targets={kcal,protein,carbs,fat};
 saveNutritionData();toggleNutritionGoals(false);renderNutrition();toast('Objetivos nutricionales guardados');
}
function nutritionEntryQuantity(entry){
 const labels={g:'g',ml:'ml',unit:Math.abs(entry.amount)===1?'unidad':'unidades',portion:Math.abs(entry.amount)===1?'ración':'raciones'};
 const amount=Number(entry.amount??entry.grams)||0;
 return (Number.isInteger(amount)?amount:amount.toLocaleString('es-ES',{maximumFractionDigits:2}))+' '+(labels[entry.unit]||entry.unit||'g');
}
function nutritionFoodValues(){return ['foodKcal','foodProtein','foodCarbs','foodFat'].map(id=>Number(document.getElementById(id)?.value))}
function renderFoodPreview(){
 const preview=document.getElementById('foodNutritionPreview');if(!preview)return;
 const amount=Number(document.getElementById('foodGrams')?.value),unit=document.getElementById('foodUnit')?.value||'g';
 const values=nutritionFoodValues();
 if(!Number.isFinite(amount)||amount<=0||values.some(v=>!Number.isFinite(v)||v<0)||!document.getElementById('foodKcal')?.value){preview.textContent='Introduce una cantidad y los valores nutricionales para ver el cálculo.';return}
 const factor=(unit==='g'||unit==='ml')?amount/100:amount,totals=values.map(v=>v*factor);
 preview.innerHTML='<strong>Esta cantidad aporta:</strong> '+Math.round(totals[0])+' kcal · Proteínas '+totals[1].toFixed(1)+' g · Hidratos '+totals[2].toFixed(1)+' g · Grasas '+totals[3].toFixed(1)+' g';
}
function addNutritionEntry(item){
 const amount=Math.max(0.01,Number(item.amount)||0),factor=item.basis==='100g'||item.basis==='100ml'?amount/100:amount;
 nutritionData.entries.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),date:nutritionToday(),meal:document.getElementById('foodMeal').value,name:item.name,amount,unit:item.unit,basis:item.basis,kcal:item.kcal*factor,protein:item.protein*factor,carbs:item.carbs*factor,fat:item.fat*factor,barcode:item.barcode||null});
 saveNutritionData();renderNutrition();toast('Alimento añadido al diario');
}
function updateFoodUnitUI(){
 const unit=document.getElementById('foodUnit')?.value||'g';
 if(currentFoodUnit&&currentFoodUnit!==unit){
  ['foodKcal','foodProtein','foodCarbs','foodFat'].forEach(id=>{const field=document.getElementById(id);if(field)field.value=''});
  const barcode=document.getElementById('foodBarcode');if(barcode)delete barcode.dataset.lastBarcode;
  const result=document.getElementById('barcodeResult');if(result)result.textContent='Has cambiado la unidad. Introduce los valores nutricionales correspondientes a la nueva referencia.';
 }
 currentFoodUnit=unit;
 const basis=document.getElementById('foodBasis');
 const amountLabel=document.getElementById('foodAmountLabel');
 if(basis){
  const options={g:[['100g','Por 100 g']],ml:[['100ml','Por 100 ml']],unit:[['unit','Por unidad']],portion:[['portion','Por ración']]};
  basis.innerHTML=options[unit].map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('');
 }
 if(amountLabel)amountLabel.textContent=({g:'Cantidad (g)',ml:'Cantidad (ml)',unit:'Cantidad (unidades)',portion:'Cantidad (raciones)'})[unit];
 const hint=document.getElementById('foodReferenceHint');
 if(hint)hint.textContent=({g:'Introduce los valores nutricionales por cada 100 g (etiqueta del producto).',ml:'Introduce los valores por cada 100 ml. No uses valores por 100 g para un registro en ml.',unit:'Introduce los valores correspondientes a una unidad (por ejemplo, un huevo).',portion:'Introduce los valores correspondientes a una ración completa.'})[unit];
 renderFoodPreview();
}

function addManualFood(){
 if(nutritionAddLocked)return;
 const name=document.getElementById('foodName').value.trim();
 if(!name){toast('Escribe el nombre del alimento');return}
 const values=['foodKcal','foodProtein','foodCarbs','foodFat'].map(n=>Number(document.getElementById(n).value));
 if(values.some(v=>!Number.isFinite(v)||v<0)||!document.getElementById('foodKcal').value){toast('Introduce calorías y macros según la referencia seleccionada');return}
 const amount=Number(document.getElementById('foodGrams').value),unit=document.getElementById('foodUnit').value,basis=document.getElementById('foodBasis').value;
 if(!Number.isFinite(amount)||amount<=0){toast('Introduce una cantidad válida');return}
 const compatible={g:'100g',ml:'100ml',unit:'unit',portion:'portion'};
 if(compatible[unit]!==basis){toast('La unidad y la referencia nutricional no coinciden');return}
 nutritionAddLocked=true;
 const button=document.querySelector('button[onclick="addManualFood()"]');
 if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Añadiendo…'}
 try{addNutritionEntry({name,amount,unit,basis,kcal:values[0],protein:values[1],carbs:values[2],fat:values[3]})}
 finally{setTimeout(()=>{nutritionAddLocked=false;if(button){button.disabled=false;button.textContent=button.dataset.originalText||'＋ Añadir al diario'}},700)}
}
function fillFoodForm(product,barcode){
 document.getElementById('foodName').value=product.name||'Producto sin nombre';
 document.getElementById('foodGrams').value=100;
 document.getElementById('foodUnit').value='g';updateFoodUnitUI();
 document.getElementById('foodKcal').value=product.kcal??'';
 document.getElementById('foodProtein').value=product.protein??'';
 document.getElementById('foodCarbs').value=product.carbs??'';
 document.getElementById('foodFat').value=product.fat??'';
 renderFoodPreview();
 document.getElementById('barcodeResult').textContent='Producto encontrado: '+(product.name||'Sin nombre')+(product.brand?' · '+product.brand:'')+'. Revisa los valores y pulsa «Añadir al diario».';
 document.getElementById('foodBarcode').dataset.lastBarcode=barcode;
}
async function lookupBarcode(code){
 if(barcodeLookupInProgress)return;
 const barcode=String(code||document.getElementById('foodBarcode').value).trim();
 if(!/^[0-9]{8,14}$/.test(barcode)){toast('Introduce un código EAN/UPC válido (8 a 14 cifras)');return}
 barcodeLookupInProgress=true;
 const button=document.querySelector('button[onclick="lookupBarcode()"]');
 if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Buscando…'}
 const result=document.getElementById('barcodeResult');result.textContent='Buscando producto…';
 try{
  const response=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(barcode)+'.json?fields=product_name,product_name_es,brands,nutriments');
  if(!response.ok)throw new Error('No se ha podido consultar la base de datos');
  const data=await response.json();
  if(data.status!==1||!data.product)throw new Error('No encontramos ese código. Puedes introducir el alimento manualmente.');
  const p=data.product,n=p.nutriments||{};
  let kcal=Number(n['energy-kcal_100g']);
  if(!Number.isFinite(kcal)||kcal<=0){const kj=Number(n['energy_100g']);kcal=Number.isFinite(kj)?kj/4.184:0}
  const product={name:p.product_name_es||p.product_name||'Producto',brand:p.brands||'',kcal:kcal||0,protein:Number(n.proteins_100g)||0,carbs:Number(n.carbohydrates_100g)||0,fat:Number(n.fat_100g)||0};
  fillFoodForm(product,barcode);
  toast('Producto localizado. Comprueba la etiqueta.');
 }catch(error){result.textContent=error.message||'Error al buscar el producto';}
 finally{barcodeLookupInProgress=false;if(button){button.disabled=false;button.textContent=button.dataset.originalText||'Buscar producto'}}
}
async function startBarcodeCamera(){
 if(barcodeCameraStarting||barcodeStream)return;
 barcodeCameraStarting=true;
 if(!('BarcodeDetector' in window)){barcodeCameraStarting=false;document.getElementById('barcodeResult').textContent='Este navegador no ofrece escáner integrado. Puedes escribir el código de barras y pulsar Buscar producto.';return}
 if(!navigator.mediaDevices?.getUserMedia){barcodeCameraStarting=false;document.getElementById('barcodeResult').textContent='No se puede acceder a la cámara en este contexto. Usa HTTPS o introduce el código manualmente.';return}
 try{
  const supported=await BarcodeDetector.getSupportedFormats();
  const formats=['ean_13','ean_8','upc_a','upc_e'].filter(format=>supported.includes(format));
  if(!formats.length)throw new Error('El navegador no admite formatos EAN/UPC compatibles. Introduce el código manualmente.');
  const detector=new BarcodeDetector({formats});
  barcodeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  const video=document.getElementById('barcodeVideo');video.srcObject=barcodeStream;await video.play();
  document.getElementById('barcodeCamera').style.display='block';
  document.getElementById('barcodeCameraStatus').textContent='Apunta al código de barras del envase';
  const scan=async()=>{
   if(!barcodeStream)return;
   try{const codes=await detector.detect(video);if(codes.length){document.getElementById('foodBarcode').value=codes[0].rawValue;stopBarcodeCamera();lookupBarcode(codes[0].rawValue);return}}catch(e){}
   barcodeFrame=requestAnimationFrame(scan);
  };
  scan();
 }catch(error){stopBarcodeCamera();document.getElementById('barcodeResult').textContent='No se pudo iniciar la cámara. Comprueba el permiso del navegador o introduce el código manualmente.'}
 finally{barcodeCameraStarting=false}
}
function stopBarcodeCamera(){
 if(barcodeFrame)cancelAnimationFrame(barcodeFrame);barcodeFrame=null;
 if(barcodeStream){barcodeStream.getTracks().forEach(t=>t.stop());barcodeStream=null}
 const video=document.getElementById('barcodeVideo');if(video)video.srcObject=null;
 const camera=document.getElementById('barcodeCamera');if(camera)camera.style.display='none';
}
function deleteNutritionEntry(id){nutritionData.entries=nutritionData.entries.filter(e=>e.id!==id);saveNutritionData();renderNutrition();toast('Alimento eliminado')}
function initNutrition(){loadNutritionData();updateFoodUnitUI();if(document.getElementById('nutritionDate'))document.getElementById('nutritionDate').value=new Date().toISOString().slice(0,10);renderNutrition()}
window.addEventListener('load',()=>{if(typeof currentUser!=='undefined'&&currentUser)initNutrition()});
window.addEventListener('beforeunload',stopBarcodeCamera);

 
// Catálogo básico integrado para alimentos habituales sin marca.
const nutritionCommonFoods=[
 {name:'Arroz blanco seco',kcal:360,protein:7,carbs:80,fat:0.7},
 {name:'Arroz blanco cocido',kcal:130,protein:2.7,carbs:28.2,fat:0.3},
 {name:'Arroz integral seco',kcal:370,protein:7.5,carbs:77,fat:2.7},
 {name:'Arroz integral cocido',kcal:123,protein:2.7,carbs:25.6,fat:1},
 {name:'Pechuga de pollo cruda',kcal:120,protein:22.5,carbs:0,fat:2.6},
 {name:'Pechuga de pollo cocinada',kcal:165,protein:31,carbs:0,fat:3.6},
 {name:'Huevo entero',kcal:143,protein:12.6,carbs:0.7,fat:9.5},
 {name:'Plátano',kcal:89,protein:1.1,carbs:22.8,fat:0.3},
 {name:'Manzana',kcal:52,protein:0.3,carbs:13.8,fat:0.2},
 {name:'Avena seca',kcal:389,protein:16.9,carbs:66.3,fat:6.9},
 {name:'Patata cocida',kcal:87,protein:1.9,carbs:20.1,fat:0.1},
 {name:'Pasta seca',kcal:371,protein:13,carbs:75,fat:1.5},
 {name:'Pasta cocida',kcal:158,protein:5.8,carbs:30.9,fat:0.9},
 {name:'Salmón crudo',kcal:208,protein:20.4,carbs:0,fat:13.4},
 {name:'Leche entera',kcal:61,protein:3.2,carbs:4.8,fat:3.3},
 {name:'Yogur natural entero',kcal:61,protein:3.5,carbs:4.7,fat:3.3},
 {name:'Pan blanco',kcal:266,protein:8.9,carbs:49,fat:3.2},
 {name:'Almendras',kcal:579,protein:21.2,carbs:21.6,fat:49.9},
 {name:'Aceite de oliva',kcal:884,protein:0,carbs:0,fat:100}
].map(food=>({name:food.name,brands:'MPMFIT · valores orientativos',dataSource:'Catálogo MPMFIT',nutriments:{
 'energy-kcal_100g':food.kcal,proteins_100g:food.protein,carbohydrates_100g:food.carbs,fat_100g:food.fat
}}));
let nutritionFoodSearchResults=[];
let nutritionFoodSearchInProgress=false;
function normalizeNutritionSearch(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function renderNutritionFoodSearchResults(){
 const results=document.getElementById('nutritionFoodSearchResults');
 const status=document.getElementById('nutritionFoodSearchStatus');
 if(!nutritionFoodSearchResults.length){
  results.innerHTML='';
  status.textContent='No hemos encontrado alimentos con información nutricional suficiente. Prueba otra búsqueda o utiliza el registro manual.';
  return;
 }
 results.innerHTML=nutritionFoodSearchResults.map((p,i)=>{
  const n=p.nutriments||{},name=p.product_name_es||p.product_name||p.generic_name||p.name||'Alimento';
  let kcal=Number(n['energy-kcal_100g']);if(!Number.isFinite(kcal)||kcal<=0){const kj=Number(n['energy_100g']);kcal=Number.isFinite(kj)&&kj>0?kj/4.184:null}
  const protein=Number(n.proteins_100g),carbs=Number(n.carbohydrates_100g),fat=Number(n.fat_100g);
  const valid=v=>Number.isFinite(v)&&v>=0;
  const details=[valid(kcal)?Math.round(kcal)+' kcal':'kcal —',valid(protein)?'P '+protein+' g':'P —',valid(carbs)?'HC '+carbs+' g':'HC —',valid(fat)?'G '+fat+' g':'G —'].join(' · ');
  return '<div class="catalog-item"><strong>'+esc(name)+'</strong><small>'+esc(p.brands||p.dataSource||p.quantity||'Alimento')+'</small><div class="hint">'+details+' por 100 g</div><button class="btn secondary small" style="margin-top:9px" onclick="selectNutritionFood('+i+')">Seleccionar</button></div>';
 }).join('');
 status.textContent='Resultados encontrados: '+nutritionFoodSearchResults.length+'. Selecciona el alimento correcto. Los valores del catálogo básico son orientativos.';
}
async function searchNutritionFoods(){
 if(nutritionFoodSearchInProgress)return;
 const query=(document.getElementById('nutritionFoodSearch')?.value||'').trim();
 const status=document.getElementById('nutritionFoodSearchStatus');
 const results=document.getElementById('nutritionFoodSearchResults');
 if(query.length<2){status.textContent='Escribe al menos 2 caracteres para buscar.';results.innerHTML='';return}
 nutritionFoodSearchInProgress=true;
 const button=document.getElementById('nutritionFoodSearchButton');
 if(button){button.disabled=true;button.textContent='Buscando…'}
 status.textContent='Buscando alimentos…';results.innerHTML='';
 const normalized=normalizeNutritionSearch(query);
 const localMatches=nutritionCommonFoods.filter(p=>normalizeNutritionSearch(p.name).includes(normalized));
 try{
  const params=new URLSearchParams({search_terms:query,search_simple:'1',action:'process',json:'1',page_size:'12',fields:'code,product_name,product_name_es,generic_name,brands,quantity,nutriments'});
  const response=await fetch('https://world.openfoodfacts.org/cgi/search.pl?'+params.toString());
  if(!response.ok)throw new Error('No se ha podido consultar la base de productos.');
  const data=await response.json();
  const products=Array.isArray(data.products)?data.products:[];
  const hasValue=value=>value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
  const externalMatches=products.filter(p=>{
   const n=p.nutriments||{};
   const hasEnergy=hasValue(n['energy-kcal_100g'])||hasValue(n['energy_100g']);
   return (p.product_name_es||p.product_name||p.generic_name)&&hasEnergy&&
    hasValue(n.proteins_100g)&&hasValue(n.carbohydrates_100g)&&hasValue(n.fat_100g);
  }).map(p=>({...p,dataSource:'Open Food Facts'}));
  const localNames=new Set(localMatches.map(p=>normalizeNutritionSearch(p.name)));
  nutritionFoodSearchResults=[...localMatches,...externalMatches.filter(p=>!localNames.has(normalizeNutritionSearch(p.product_name_es||p.product_name||p.generic_name)))].slice(0,12);
 }catch(error){
  nutritionFoodSearchResults=localMatches;
  if(!localMatches.length){status.textContent=error.message||'Error al buscar alimentos. Puedes introducirlo manualmente.';return}
  status.textContent='No se ha podido consultar Open Food Facts; mostramos los alimentos del catálogo integrado.';
 }
 finally{nutritionFoodSearchInProgress=false;if(button){button.disabled=false;button.textContent='Buscar alimento'}}
 renderNutritionFoodSearchResults();
}
function selectNutritionFood(index){
 const p=nutritionFoodSearchResults[index];if(!p)return;
 const n=p.nutriments||{};
 let kcal=Number(n['energy-kcal_100g']);
 if(!Number.isFinite(kcal)||kcal<=0){const kj=Number(n['energy_100g']);kcal=Number.isFinite(kj)&&kj>0?kj/4.184:0}
 const protein=Number(n.proteins_100g),carbs=Number(n.carbohydrates_100g),fat=Number(n.fat_100g);
 const name=p.product_name_es||p.product_name||p.generic_name||p.name||'Alimento';
 document.getElementById('foodName').value=name;
 document.getElementById('foodUnit').value='g';updateFoodUnitUI();
 document.getElementById('foodBasis').value='100g';
 document.getElementById('foodGrams').value=100;
 document.getElementById('foodKcal').value=Number.isFinite(kcal)?Math.max(0,kcal).toFixed(1):'';
 document.getElementById('foodProtein').value=Number.isFinite(protein)?Math.max(0,protein).toFixed(1):'';
 document.getElementById('foodCarbs').value=Number.isFinite(carbs)?Math.max(0,carbs).toFixed(1):'';
 document.getElementById('foodFat').value=Number.isFinite(fat)?Math.max(0,fat).toFixed(1):'';
 document.getElementById('foodBarcode').value=p.code||'';
 renderFoodPreview();
 document.getElementById('barcodeResult').textContent='Alimento cargado. Revisa los valores, especialmente si son orientativos, y ajusta la cantidad antes de añadirlo.';
 document.getElementById('nutritionFoodSearchStatus').textContent='Seleccionado: '+name+'. Ahora indica la cantidad que has comido y pulsa «Añadir al diario».';
 document.getElementById('foodGrams').focus();
 document.getElementById('foodGrams').select();
}
